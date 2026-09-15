"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  erroInterno,
  exigeMembro,
  exigeUsuario,
  falha,
  sucesso,
  type Cliente,
  type Resultado,
} from "@/server/auth";
import { criaTarefaSchema, textoTarefaSchema } from "@/lib/restricoes/schemas";
import { buscaRestricao } from "./queries";

/**
 * Checklist da restrição. Qualquer membro da obra cria, marca, renomeia e
 * apaga — quem executa a tarefa é quem está na frente de serviço. A RLS
 * repete a regra no banco; quem marcou e quando é gravado pelo gatilho, não
 * por aqui.
 */

const idSchema = z.guid();

/** Tarefa + obra dela, já com a checagem de membro feita. */
async function contextoDaTarefa(tarefaId: string) {
  const { supabase } = await exigeUsuario();
  const { data: tarefa } = await supabase
    .from("6wla_restricao_tarefas")
    .select("id, restricao_id")
    .eq("id", tarefaId)
    .maybeSingle();
  if (!tarefa) return null;
  const restricao = await buscaRestricao(supabase, tarefa.restricao_id);
  if (!restricao) return null;
  await exigeMembro(restricao.obra_id);
  return { supabase, tarefa, restricao };
}

function revalida(restricao: { id: string; obra_id: string }) {
  revalidatePath(`/obras/${restricao.obra_id}/restricoes/${restricao.id}`);
}

async function atualiza(
  supabase: Cliente,
  tarefaId: string,
  campos: { texto?: string; concluida?: boolean },
  contexto: string,
): Promise<Resultado> {
  const { error } = await supabase
    .from("6wla_restricao_tarefas")
    .update(campos)
    .eq("id", tarefaId);
  if (error) return erroInterno(contexto, error);
  return sucesso(undefined);
}

export async function criaTarefa(entrada: unknown): Promise<Resultado> {
  const parsed = criaTarefaSchema.safeParse(entrada);
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { supabase, perfil } = await exigeUsuario();
  const restricao = await buscaRestricao(supabase, parsed.data.restricaoId);
  if (!restricao) return falha("Restrição não encontrada");
  await exigeMembro(restricao.obra_id);

  const { error } = await supabase.from("6wla_restricao_tarefas").insert({
    restricao_id: restricao.id,
    texto: parsed.data.texto,
    criado_por: perfil.id,
  });
  if (error) return erroInterno("tarefas.insert", error);

  revalida(restricao);
  return sucesso(undefined);
}

export async function marcaTarefa(
  tarefaId: string,
  concluida: boolean,
): Promise<Resultado> {
  const id = idSchema.safeParse(tarefaId);
  const marca = z.boolean().safeParse(concluida);
  if (!id.success || !marca.success) return falha("Dados inválidos");

  const ctx = await contextoDaTarefa(id.data);
  if (!ctx) return falha("Tarefa não encontrada");

  const res = await atualiza(
    ctx.supabase,
    ctx.tarefa.id,
    { concluida: marca.data },
    "tarefas.marca",
  );
  if (res.ok) revalida(ctx.restricao);
  return res;
}

export async function renomeiaTarefa(
  tarefaId: string,
  texto: string,
): Promise<Resultado> {
  const id = idSchema.safeParse(tarefaId);
  if (!id.success) return falha("Identificador inválido");
  const novo = textoTarefaSchema.safeParse(texto);
  if (!novo.success)
    return falha(novo.error.issues[0]?.message ?? "Texto inválido");

  const ctx = await contextoDaTarefa(id.data);
  if (!ctx) return falha("Tarefa não encontrada");

  const res = await atualiza(
    ctx.supabase,
    ctx.tarefa.id,
    { texto: novo.data },
    "tarefas.renomeia",
  );
  if (res.ok) revalida(ctx.restricao);
  return res;
}

export async function removeTarefa(tarefaId: string): Promise<Resultado> {
  const id = idSchema.safeParse(tarefaId);
  if (!id.success) return falha("Identificador inválido");

  const ctx = await contextoDaTarefa(id.data);
  if (!ctx) return falha("Tarefa não encontrada");

  const { error } = await ctx.supabase
    .from("6wla_restricao_tarefas")
    .delete()
    .eq("id", ctx.tarefa.id);
  if (error) return erroInterno("tarefas.delete", error);

  revalida(ctx.restricao);
  return sucesso(undefined);
}
