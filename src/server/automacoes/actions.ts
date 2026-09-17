"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hojeNoFuso } from "@/lib/automacoes/agenda";
import { montaEmailTeste } from "@/lib/automacoes/email";
import {
  automacaoSchema,
  configDoBanco,
  emailValido,
  type AutomacaoConfig,
} from "@/lib/automacoes/schema";
import { reservaTeste } from "@/server/admin/automacoes";
import { sincronizaFluxo } from "@/server/admin/fluxos";
import {
  erroInterno,
  exigeGestor,
  exigeUsuario,
  falha,
  sucesso,
  type Resultado,
} from "@/server/auth";
import { permite } from "@/server/limite";
import { restricoesAbertasParaEmail } from "./dados";

/**
 * Automações da obra: só gestor da obra (ou admin). Toda action valida a
 * entrada com Zod, depois checa o gestor; a RLS repete a regra no banco.
 */

const idSchema = z.guid();

function primeiroErro(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Dados inválidos";
}

function revalida(obraId: string) {
  revalidatePath(`/obras/${obraId}/automacoes`);
}

/**
 * Depois de mudar as automações, ajusta o fluxo n8n da obra. Falha no n8n
 * não desfaz a mudança: fica registrada e a aba mostra o aviso.
 */
async function aposMudar(obraId: string) {
  await sincronizaFluxo(obraId);
  revalida(obraId);
}

/** Automação + checagem de gestor da obra dela. `null` se não enxerga. */
async function contextoDaAutomacao(id: string) {
  const { supabase } = await exigeUsuario();
  const { data, error } = await supabase
    .from("6wla_automacoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar automação: ${error.message}`);
  if (!data) return null;
  const ctx = await exigeGestor(data.obra_id);
  return { ...ctx, automacao: data };
}

function colunasDoBanco(c: AutomacaoConfig) {
  return {
    nome: c.nome,
    ativa: c.ativa,
    dias_semana: c.dias_semana,
    hora: c.hora,
    fuso: c.fuso,
    situacoes: c.situacoes,
    colunas: c.colunas,
    destino: c.destino,
    destinatarios: c.destino === "lista" ? c.destinatarios : [],
    copias: c.copias,
    assunto: c.assunto,
    agrupar_por_responsavel: c.agrupar_por_responsavel,
  };
}

export async function criaAutomacao(
  obraId: unknown,
  entrada: unknown,
): Promise<Resultado<{ id: string }>> {
  const obra = idSchema.safeParse(obraId);
  if (!obra.success) return falha("Obra inválida");
  const parsed = automacaoSchema.safeParse(entrada);
  if (!parsed.success) return falha(primeiroErro(parsed.error));

  const { supabase, perfil } = await exigeGestor(obra.data);
  const { data, error } = await supabase
    .from("6wla_automacoes")
    .insert({
      ...colunasDoBanco(parsed.data),
      obra_id: obra.data,
      criado_por: perfil.id,
      // Horário que já passou hoje não dispara na hora de criar.
      ultimo_disparo: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return erroInterno("automacoes.insert", error);

  await aposMudar(obra.data);
  return sucesso({ id: data.id });
}

export async function editaAutomacao(
  automacaoId: unknown,
  entrada: unknown,
): Promise<Resultado> {
  const id = idSchema.safeParse(automacaoId);
  if (!id.success) return falha("Identificador inválido");
  const parsed = automacaoSchema.safeParse(entrada);
  if (!parsed.success) return falha(primeiroErro(parsed.error));

  const ctx = await contextoDaAutomacao(id.data);
  if (!ctx) return falha("Automação não encontrada");

  const antes = configDoBanco(ctx.automacao);
  const novo = parsed.data;
  const reagendou =
    antes.hora !== novo.hora ||
    antes.fuso !== novo.fuso ||
    antes.dias_semana.join() !== novo.dias_semana.join() ||
    (!antes.ativa && novo.ativa);

  const { error } = await ctx.supabase
    .from("6wla_automacoes")
    .update({
      ...colunasDoBanco(novo),
      ...(reagendou ? { ultimo_disparo: new Date().toISOString() } : {}),
    })
    .eq("id", id.data);
  if (error) return erroInterno("automacoes.update", error);

  await aposMudar(ctx.automacao.obra_id);
  return sucesso(undefined);
}

export async function alternaAutomacao(
  automacaoId: unknown,
  ativa: unknown,
): Promise<Resultado> {
  const id = idSchema.safeParse(automacaoId);
  const liga = z.boolean().safeParse(ativa);
  if (!id.success || !liga.success) return falha("Dados inválidos");

  const ctx = await contextoDaAutomacao(id.data);
  if (!ctx) return falha("Automação não encontrada");

  const { error } = await ctx.supabase
    .from("6wla_automacoes")
    .update({
      ativa: liga.data,
      // Ao religar, não dispara o horário que passou enquanto estava parada.
      ...(liga.data ? { ultimo_disparo: new Date().toISOString() } : {}),
    })
    .eq("id", id.data);
  if (error) return erroInterno("automacoes.alterna", error);

  await aposMudar(ctx.automacao.obra_id);
  return sucesso(undefined);
}

export async function excluiAutomacao(
  automacaoId: unknown,
): Promise<Resultado> {
  const id = idSchema.safeParse(automacaoId);
  if (!id.success) return falha("Identificador inválido");

  const ctx = await contextoDaAutomacao(id.data);
  if (!ctx) return falha("Automação não encontrada");

  const { error } = await ctx.supabase
    .from("6wla_automacoes")
    .delete()
    .eq("id", id.data);
  if (error) return erroInterno("automacoes.delete", error);

  await aposMudar(ctx.automacao.obra_id);
  return sucesso(undefined);
}

/** Botão "Sincronizar" da aba: refaz o fluxo n8n da obra. */
export async function sincronizaFluxoDaObra(
  obraId: unknown,
): Promise<Resultado> {
  const obra = idSchema.safeParse(obraId);
  if (!obra.success) return falha("Obra inválida");

  const { perfil } = await exigeGestor(obra.data);
  if (!permite(`fluxo-sync:${perfil.id}`, 10, 10 * 60_000))
    return falha("Muitas tentativas seguidas. Espere alguns minutos.");

  const r = await sincronizaFluxo(obra.data);
  revalida(obra.data);
  if (r === "desligado")
    return falha("A integração com o n8n não está configurada no servidor.");
  if (r === "erro")
    return falha("O n8n não respondeu como esperado. Tente mais tarde.");
  return sucesso(undefined);
}

/**
 * "Enviar teste para mim". O app não tem SMTP: aqui só entra na fila, com o
 * e-mail de quem pediu, e o n8n entrega no próximo ciclo (até 15 min). Usa a
 * configuração SALVA.
 */
export async function enviaTeste(
  automacaoId: unknown,
): Promise<Resultado<{ total: number }>> {
  const id = idSchema.safeParse(automacaoId);
  if (!id.success) return falha("Identificador inválido");

  const ctx = await contextoDaAutomacao(id.data);
  if (!ctx) return falha("Automação não encontrada");

  if (!permite(`automacao-teste:${ctx.perfil.id}`, 5, 10 * 60_000))
    return falha("Muitos testes seguidos. Espere alguns minutos.");

  const email = ctx.perfil.email.trim().toLowerCase();
  if (!emailValido(email))
    return falha("Seu cadastro não tem um e-mail válido.");

  try {
    const config = configDoBanco(ctx.automacao);
    const restricoes = await restricoesAbertasParaEmail(
      ctx.supabase,
      ctx.obra.id,
    );
    const teste = montaEmailTeste(
      restricoes,
      {
        obra: { id: ctx.obra.id, codigo: ctx.obra.codigo, nome: ctx.obra.nome },
        site: null,
        hoje: hojeNoFuso(new Date(), config.fuso),
        config,
      },
      email,
    );
    if (!teste)
      return falha(
        "Nenhuma restrição nas situações escolhidas: o e-mail sairia vazio.",
      );

    const r = await reservaTeste({
      automacaoId: id.data,
      email,
      assunto: teste.assunto,
      total: teste.total,
    });
    if (r === "na_fila")
      return falha("Já há um teste desta automação esperando o envio.");

    revalida(ctx.automacao.obra_id);
    return sucesso({ total: teste.total });
  } catch (e) {
    return erroInterno("automacoes.teste", e);
  }
}
