import "server-only";

import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/env";
import { diasParaPrazo, estaAtrasada, hojeIso } from "@/lib/restricoes/dominio";
import { createAdminClient } from "./supabase";

/**
 * Compara o token do header com o configurado sem vazar tempo de resposta.
 * Sem POWERBI_API_TOKEN no ambiente, a API fica desligada.
 */
export function tokenValido(authorization: string | null): boolean {
  const { POWERBI_API_TOKEN } = serverEnv();
  if (!POWERBI_API_TOKEN || !authorization) return false;
  const recebido = authorization.replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(recebido);
  const b = Buffer.from(POWERBI_API_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Extrato plano das restrições para o Power BI, com campos calculados que o
 * relatório precisa (atraso, semanas) já resolvidos aqui. Usa service_role
 * porque não há usuário logado: a autorização é o token, checada antes.
 */
export async function extratoRestricoes(obraCodigo?: string, workspaceCodigo?: string) {
  const admin = createAdminClient();
  let consulta = admin
    .from("restricoes")
    .select(
      "*, obra:obras!inner(codigo, nome, workspace:workspaces!inner(codigo, nome)), responsavel:perfis!restricoes_responsavel_id_fkey(nome, email)",
    )
    .order("obra_id")
    .order("numero");
  if (obraCodigo) consulta = consulta.eq("obra.codigo", obraCodigo);
  if (workspaceCodigo) consulta = consulta.eq("obra.workspace.codigo", workspaceCodigo);

  const { data, error } = await consulta;
  if (error) throw new Error(`Falha ao consultar restrições: ${error.message}`);

  const hoje = hojeIso();
  return data.map((r) => {
    const atrasada = estaAtrasada(r, hoje);
    const concluidaComAtraso =
      r.status === "concluida" &&
      !!r.data_conclusao &&
      !!r.data_limite &&
      r.data_conclusao > r.data_limite;
    const { obra, responsavel, extras, ...campos } = r;
    return {
      ...campos,
      workspace_codigo: obra.workspace.codigo,
      workspace_nome: obra.workspace.nome,
      obra_codigo: obra.codigo,
      obra_nome: obra.nome,
      responsavel: responsavel?.nome ?? r.responsavel_nome,
      responsavel_email_sistema: responsavel?.email ?? r.responsavel_email,
      aberta: r.status === "pendente" || r.status === "em_andamento",
      atrasada,
      concluida_com_atraso: concluidaComAtraso,
      concluida_no_prazo: r.status === "concluida" && !concluidaComAtraso,
      dias_para_prazo: diasParaPrazo(r.data_limite, hoje),
      dias_de_atraso_conclusao:
        r.data_conclusao && r.data_limite
          ? diasParaPrazo(r.data_conclusao, r.data_limite)
          : null,
      tempo_resolucao_dias: r.data_conclusao
        ? diasParaPrazo(r.data_conclusao, r.data_criacao)
        : null,
      semana_limite: semanaIso(r.data_limite),
      semana_conclusao: semanaIso(r.data_conclusao),
      semana_criacao: semanaIso(r.data_criacao),
      extras: JSON.stringify(extras),
    };
  });
}

/** `2026-09-03` → `2026-W36` (semana ISO, segunda a domingo). */
export function semanaIso(iso: string | null): string | null {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return null;
  const data = new Date(Date.UTC(a, m - 1, d));
  const dia = data.getUTCDay() || 7;
  data.setUTCDate(data.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(data.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(
    ((data.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${data.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}
