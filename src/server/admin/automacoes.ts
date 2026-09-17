import "server-only";

import { timingSafeEqual } from "node:crypto";
import { env, serverEnv } from "@/env";
import type { Tables, TablesInsert } from "@/lib/database.types";
import { hojeNoFuso, horarioDevido } from "@/lib/automacoes/agenda";
import {
  montaEmails,
  montaEmailTeste,
  type ContextoEmail,
  type EmailMontado,
  type ObraEmail,
  type RestricaoComPerfil,
} from "@/lib/automacoes/email";
import { configDoBanco, emailValido } from "@/lib/automacoes/schema";
import { restricoesAbertasParaEmail } from "@/server/automacoes/dados";
import { createAdminClient } from "./supabase";

/**
 * Lado service_role das automações: a API que o n8n chama (sem usuário
 * logado; a autorização é o token) e a reserva do "enviar teste", que a
 * Server Action só chama depois de checar que a pessoa é gestora da obra.
 */

export type EstadoToken = "desligado" | "invalido" | "ok";

/** Compara o Bearer com AUTOMACOES_TOKEN em tempo constante. */
export function confereToken(authorization: string | null): EstadoToken {
  const { AUTOMACOES_TOKEN } = serverEnv();
  if (!AUTOMACOES_TOKEN) return "desligado";
  if (!authorization) return "invalido";
  const recebido = Buffer.from(authorization.replace(/^Bearer\s+/i, "").trim());
  const esperado = Buffer.from(AUTOMACOES_TOKEN);
  return recebido.length === esperado.length &&
    timingSafeEqual(recebido, esperado)
    ? "ok"
    : "invalido";
}

/** Item devolvido ao n8n: um e-mail pronto para sair. */
export type EmailPendente = {
  envioId: string;
  to: string;
  cc: string;
  subject: string;
  html: string;
};

type Automacao = Tables<"6wla_automacoes"> & {
  obra: ObraEmail & { ativa: boolean; dono: { email: string } | null };
};

const COLUNAS_AUTOMACAO =
  "*, obra:6wla_obras!inner(id, codigo, nome, ativa, dono:6wla_perfis!6wla_obras_criado_por_fkey(email))" as const;

/** Origem pública só da env: nesta API não há host confiável. */
function siteConfigurado(): string | null {
  return env.NEXT_PUBLIC_SITE_URL
    ? new URL(env.NEXT_PUBLIC_SITE_URL).origin
    : null;
}

function contextoDe(a: Automacao, agora: Date): ContextoEmail {
  const config = configDoBanco(a);
  return {
    obra: { id: a.obra.id, codigo: a.obra.codigo, nome: a.obra.nome },
    site: siteConfigurado(),
    hoje: hojeNoFuso(agora, config.fuso),
    config,
    // O gestor dono da obra vai em cópia de tudo.
    copiasFixas: a.obra.dono?.email ? [a.obra.dono.email] : [],
  };
}

function cacheDeRestricoes() {
  const admin = createAdminClient();
  const cache = new Map<string, Promise<RestricaoComPerfil[]>>();
  return (obraId: string) => {
    let p = cache.get(obraId);
    if (!p) {
      p = restricoesAbertasParaEmail(admin, obraId);
      cache.set(obraId, p);
    }
    return p;
  };
}

/**
 * Passo 1: para cada automação ativa com horário vencido, reserva uma linha
 * por e-mail. O `unique` da tabela e o `ignoreDuplicates` tornam a reserva
 * idempotente entre chamadas simultâneas.
 */
async function agendaDevidas(
  agora: Date,
  obraId: string,
  restricoesDe: (obraId: string) => Promise<RestricaoComPerfil[]>,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("6wla_automacoes")
    .select(COLUNAS_AUTOMACAO)
    .eq("obra_id", obraId)
    .eq("ativa", true);
  if (error) throw new Error(`Falha ao listar automações: ${error.message}`);

  for (const a of data) {
    if (!a.obra.ativa) continue;
    const slot = horarioDevido({
      agora,
      agenda: { dias: a.dias_semana, hora: a.hora, fuso: a.fuso },
      ultimoDisparo: a.ultimo_disparo ? new Date(a.ultimo_disparo) : null,
    });
    if (!slot) continue;
    const agendado = slot.toISOString();

    try {
      const ctx = contextoDe(a, agora);
      const { emails, semEmail } = montaEmails(
        await restricoesDe(a.obra_id),
        ctx,
      );
      const semEmailTexto = semEmail.length
        ? `Sem e-mail do responsável: ${semEmail.map((s) => `${s.nome} (${s.total})`).join(", ")}`.slice(
            0,
            2000,
          )
        : null;
      const linhas: TablesInsert<"6wla_automacao_envios">[] = emails.length
        ? emails.map((e) => ({
            automacao_id: a.id,
            agendado_para: agendado,
            destinatario: e.destinatario,
            copias: e.copias,
            assunto: e.assunto,
            total_itens: e.total,
          }))
        : [
            {
              automacao_id: a.id,
              agendado_para: agendado,
              destinatario: "",
              status: "sem_conteudo",
              erro: semEmailTexto,
              confirmado_em: agora.toISOString(),
              entregue_em: agora.toISOString(),
            },
          ];
      const reserva = await admin.from("6wla_automacao_envios").upsert(linhas, {
        onConflict: "automacao_id,agendado_para,destinatario",
        ignoreDuplicates: true,
      });
      if (reserva.error) throw new Error(reserva.error.message);

      const marco = await admin
        .from("6wla_automacoes")
        .update({ ultimo_disparo: agendado })
        .eq("id", a.id)
        .or(`ultimo_disparo.is.null,ultimo_disparo.lt."${agendado}"`);
      if (marco.error) throw new Error(marco.error.message);
    } catch (e) {
      // Uma automação com problema não segura as outras.
      console.error(`[automacoes] falha ao agendar ${a.id}`, e);
    }
  }
}

async function marca(
  envioId: string,
  campos: { status: "sem_conteudo" | "erro"; erro?: string },
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("6wla_automacao_envios")
    .update({ ...campos, confirmado_em: new Date().toISOString() })
    .eq("id", envioId);
  if (error) console.error(`[automacoes] falha ao marcar ${envioId}`, error);
}

/**
 * Agenda o que venceu na obra e entrega até `limite` e-mails da fila dela
 * (inclui os testes pedidos na tela). Cada obra tem o próprio fluxo n8n. O
 * HTML é montado agora, com os dados atuais.
 */
export async function processaPendentes(
  agora: Date,
  limite: number,
  obraId: string,
): Promise<EmailPendente[]> {
  const restricoesDe = cacheDeRestricoes();
  await agendaDevidas(agora, obraId, restricoesDe);

  const admin = createAdminClient();
  const { data: fila, error } = await admin.rpc("6wla_reivindica_envios", {
    p_limite: limite,
    p_obra_id: obraId,
  });
  if (error) throw new Error(`Falha ao ler a fila: ${error.message}`);
  if (fila.length === 0) return [];

  const ids = [...new Set(fila.map((f) => f.automacao_id))];
  const { data: automacoes, error: erroAut } = await admin
    .from("6wla_automacoes")
    .select(COLUNAS_AUTOMACAO)
    .in("id", ids);
  if (erroAut) throw new Error(`Falha ao ler automações: ${erroAut.message}`);
  const porId = new Map(automacoes.map((a) => [a.id, a]));

  const prontos: EmailPendente[] = [];
  for (const envio of fila) {
    const a = porId.get(envio.automacao_id);
    if (!a) {
      await marca(envio.id, {
        status: "erro",
        erro: "Automação não encontrada.",
      });
      continue;
    }
    try {
      const ctx = contextoDe(a, agora);
      const restricoes = await restricoesDe(a.obra_id);
      let email: EmailMontado | null;
      if (envio.teste) {
        email = montaEmailTeste(restricoes, ctx, envio.destinatario);
      } else {
        const { emails } = montaEmails(restricoes, ctx);
        email =
          ctx.config.destino === "lista"
            ? (emails[0] ?? null)
            : (emails.find((e) => e.destinatario === envio.destinatario) ??
              null);
      }
      if (!email) {
        await marca(envio.id, { status: "sem_conteudo" });
        continue;
      }
      // Destinatários vêm da reserva; revalidados antes de ir para o n8n.
      const para = envio.destinatario
        .split(",")
        .map((e) => e.trim())
        .filter(emailValido);
      if (para.length === 0) {
        await marca(envio.id, {
          status: "erro",
          erro: "Nenhum destinatário válido.",
        });
        continue;
      }
      prontos.push({
        envioId: envio.id,
        to: para.join(", "),
        cc: envio.copias.filter(emailValido).join(", "),
        subject: (envio.assunto || email.assunto).replace(/[\r\n]+/g, " "),
        html: email.html,
      });
    } catch (e) {
      console.error(`[automacoes] falha ao montar ${envio.id}`, e);
      await marca(envio.id, {
        status: "erro",
        erro: "Falha ao montar o e-mail.",
      });
    }
  }
  return prontos;
}

/** Resultado do n8n. `false` se o envio não existe ou já foi confirmado. */
export async function confirmaEnvio(dados: {
  envioId: string;
  ok: boolean;
  erro?: string | undefined;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("6wla_automacao_envios")
    .update({
      status: dados.ok ? "enviado" : "erro",
      erro: dados.ok
        ? null
        : (dados.erro ?? "Falha informada pelo n8n.").slice(0, 2000),
      confirmado_em: new Date().toISOString(),
    })
    .eq("id", dados.envioId)
    .eq("status", "reservado")
    .not("entregue_em", "is", null)
    .select("id");
  if (error) throw new Error(`Falha ao confirmar envio: ${error.message}`);
  return data.length > 0;
}

/**
 * Coloca um e-mail de teste na fila. Quem chama JÁ checou que a pessoa é
 * gestora da obra da automação. `false` se já há um teste esperando.
 */
export async function reservaTeste(dados: {
  automacaoId: string;
  email: string;
  assunto: string;
  total: number;
}): Promise<"ok" | "na_fila"> {
  const admin = createAdminClient();
  const { count, error: erroFila } = await admin
    .from("6wla_automacao_envios")
    .select("id", { count: "exact", head: true })
    .eq("automacao_id", dados.automacaoId)
    .eq("teste", true)
    .eq("status", "reservado")
    .is("entregue_em", null);
  if (erroFila)
    throw new Error(`Falha ao consultar a fila: ${erroFila.message}`);
  if ((count ?? 0) > 0) return "na_fila";

  const { error } = await admin.from("6wla_automacao_envios").insert({
    automacao_id: dados.automacaoId,
    agendado_para: new Date().toISOString(),
    destinatario: dados.email,
    assunto: dados.assunto,
    total_itens: dados.total,
    teste: true,
  });
  if (error) throw new Error(`Falha ao reservar teste: ${error.message}`);
  return "ok";
}
