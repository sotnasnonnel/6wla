import "server-only";

import { env, serverEnv } from "@/env";
import { montaFluxo, nomeDoFluxo } from "@/lib/automacoes/fluxo-n8n";
import {
  apagaFluxo,
  atualizaFluxo,
  criaFluxo,
  ligaFluxo,
  type ConexaoN8n,
} from "./n8n";
import { createAdminClient } from "./supabase";

/**
 * Mantém o fluxo n8n "<código> - Restrições" de cada obra de acordo com as
 * automações dela:
 *   - nenhuma automação  → o fluxo é apagado;
 *   - só pausadas (ou obra inativa) → o fluxo existe, desativado;
 *   - alguma ativa → o fluxo existe, ativo.
 * Quem chama JÁ checou que a pessoa é gestora da obra.
 */

export type SituacaoSync = "ok" | "desligado" | "erro";

const ERRO_TELA =
  "Não foi possível atualizar o fluxo no n8n. As automações ficaram salvas; tente sincronizar de novo.";

function configuracao(): {
  conexao: ConexaoN8n;
  smtp: string;
  token: string;
  site: string;
} | null {
  const e = serverEnv();
  if (
    !e.N8N_URL ||
    !e.N8N_API_KEY ||
    !e.N8N_CREDENCIAL_SMTP_ID ||
    !e.N8N_CREDENCIAL_TOKEN_ID ||
    !env.NEXT_PUBLIC_SITE_URL
  )
    return null;
  return {
    conexao: { url: e.N8N_URL, chave: e.N8N_API_KEY },
    smtp: e.N8N_CREDENCIAL_SMTP_ID,
    token: e.N8N_CREDENCIAL_TOKEN_ID,
    // O n8n chama a origem pública; host da requisição não serve aqui.
    site: new URL(env.NEXT_PUBLIC_SITE_URL).origin,
  };
}

export function sincronizacaoLigada(): boolean {
  return configuracao() !== null;
}

// Duas ações seguidas na mesma obra não podem criar dois fluxos.
const filas = new Map<string, Promise<unknown>>();

export function sincronizaFluxo(obraId: string): Promise<SituacaoSync> {
  const anterior = filas.get(obraId) ?? Promise.resolve();
  const atual = anterior.then(() => sincroniza(obraId));
  const guardada = atual.catch(() => undefined);
  filas.set(obraId, guardada);
  void guardada.then(() => {
    if (filas.get(obraId) === guardada) filas.delete(obraId);
  });
  return atual;
}

async function sincroniza(obraId: string): Promise<SituacaoSync> {
  const cfg = configuracao();
  if (!cfg) return "desligado";

  const admin = createAdminClient();
  const [obraR, autR, fluxoR] = await Promise.all([
    admin
      .from("6wla_obras")
      .select("id, codigo, ativa")
      .eq("id", obraId)
      .maybeSingle(),
    admin.from("6wla_automacoes").select("ativa").eq("obra_id", obraId),
    admin
      .from("6wla_automacao_fluxos")
      .select("n8n_id")
      .eq("obra_id", obraId)
      .maybeSingle(),
  ]);
  if (obraR.error || autR.error || fluxoR.error) {
    console.error("[fluxos] falha ao ler", obraId, {
      obra: obraR.error,
      automacoes: autR.error,
      fluxo: fluxoR.error,
    });
    return "erro";
  }
  const obra = obraR.data;
  if (!obra) return "erro";

  let n8nId = fluxoR.data?.n8n_id ?? null;
  const nome = nomeDoFluxo(obra.codigo);

  try {
    if (autR.data.length === 0) {
      if (n8nId) await apagaFluxo(cfg.conexao, n8nId);
      const { error } = await admin
        .from("6wla_automacao_fluxos")
        .delete()
        .eq("obra_id", obraId);
      if (error) throw new Error(error.message);
      return "ok";
    }

    const ativo = obra.ativa && autR.data.some((a) => a.ativa);
    const fluxo = montaFluxo({
      obraId,
      codigoObra: obra.codigo,
      site: cfg.site,
      credencialSmtpId: cfg.smtp,
      credencialTokenId: cfg.token,
    });
    // Atualizar um fluxo ativo exige desligar antes em algumas versões do
    // n8n; o PUT aqui roda com ele desligado e o estado final vem depois.
    if (n8nId) {
      await ligaFluxo(cfg.conexao, n8nId, false).catch(() => undefined);
      if (!(await atualizaFluxo(cfg.conexao, n8nId, fluxo))) n8nId = null;
    }
    if (!n8nId) n8nId = await criaFluxo(cfg.conexao, fluxo);
    if (ativo) await ligaFluxo(cfg.conexao, n8nId, true);

    await grava(obraId, { n8n_id: n8nId, nome, ativo, erro: null });
    return "ok";
  } catch (e) {
    console.error("[fluxos] falha ao sincronizar", obraId, e);
    // Guarda o id mesmo na falha: um fluxo criado não pode ficar órfão.
    await grava(obraId, { n8n_id: n8nId, nome, ativo: false, erro: ERRO_TELA });
    return "erro";
  }
}

async function grava(
  obraId: string,
  campos: {
    n8n_id: string | null;
    nome: string;
    ativo: boolean;
    erro: string | null;
  },
) {
  const admin = createAdminClient();
  const { error } = await admin.from("6wla_automacao_fluxos").upsert({
    obra_id: obraId,
    ...campos,
    sincronizado_em: new Date().toISOString(),
  });
  if (error) console.error("[fluxos] falha ao gravar situação", obraId, error);
}
