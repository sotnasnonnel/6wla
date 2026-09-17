"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  erroInterno,
  exigeGestor,
  exigeMembro,
  exigeUsuario,
  falha,
  sucesso,
  type Resultado,
} from "@/server/auth";
import {
  atualizaCampoSchema,
  criaRestricaoSchema,
  restricaoEditavelSchema,
  type RestricaoEditavel,
} from "@/lib/restricoes/schemas";
import { hojeIso } from "@/lib/restricoes/dominio";
import type { Restricao } from "./queries";

/** Cria uma restrição manual (linha nova na grade). */
export async function criaRestricao(
  entrada: unknown,
): Promise<Resultado<Restricao>> {
  const parsed = criaRestricaoSchema.safeParse(entrada);
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const { obraId, ...campos } = parsed.data;

  const { supabase, perfil } = await exigeMembro(obraId);
  const { data, error } = await supabase
    .from("6wla_restricoes")
    .insert({
      obra_id: obraId,
      descricao: campos.descricao,
      acao: campos.acao ?? null,
      responsavel_id: campos.responsavel_id ?? null,
      responsavel_nome: campos.responsavel_nome ?? null,
      prioridade: campos.prioridade,
      data_criacao: campos.data_criacao ?? hojeIso(),
      data_limite: campos.data_limite ?? null,
      previsao_conclusao: campos.previsao_conclusao ?? null,
      causa_6m: campos.causa_6m ?? null,
      classificacao: campos.classificacao ?? null,
      area: campos.area ?? null,
      setor: campos.setor ?? null,
      localizacao: campos.localizacao ?? null,
      id_atividade: campos.id_atividade ?? null,
      atividade_impactada: campos.atividade_impactada ?? null,
      inicio_atividade: campos.inicio_atividade ?? null,
      semana_programada: campos.semana_programada ?? null,
      observacoes: campos.observacoes ?? null,
      criado_por: perfil.id,
    })
    .select("*")
    .single();
  if (error) return erroInterno("restricoes", error);
  revalidatePath(`/obras/${obraId}/tabela`);
  revalidatePath(`/obras/${obraId}/indicadores`);
  return sucesso(data);
}

/** Edição de uma célula da grade: um campo, um valor em texto. */
export async function atualizaCampo(
  entrada: unknown,
): Promise<Resultado<Restricao>> {
  const parsed = atualizaCampoSchema.safeParse(entrada);
  if (!parsed.success) return falha("Dados inválidos");
  const { restricaoId, campo, valor } = parsed.data;

  // Valida o valor com o schema do campo específico.
  const schemaCampo = restricaoEditavelSchema.shape[campo];
  const valorParsed = schemaCampo.safeParse(valor);
  if (!valorParsed.success) {
    return falha(valorParsed.error.issues[0]?.message ?? "Valor inválido");
  }

  const { supabase } = await exigeUsuario();
  const { data: atual } = await supabase
    .from("6wla_restricoes")
    .select("obra_id")
    .eq("id", restricaoId)
    .maybeSingle();
  if (!atual) return falha("Restrição não encontrada");
  await exigeMembro(atual.obra_id);

  const patch = { [campo]: valorParsed.data } as Partial<RestricaoEditavel>;
  const { data, error } = await supabase
    .from("6wla_restricoes")
    .update(patch)
    .eq("id", restricaoId)
    .select("*")
    .single();
  if (error) return falha(traduzErro(error));
  revalidatePath(`/obras/${atual.obra_id}/tabela`);
  revalidatePath(`/obras/${atual.obra_id}/indicadores`);
  return sucesso(data);
}

/** Formulário completo de detalhes. */
export async function atualizaRestricao(
  restricaoId: string,
  entrada: Partial<RestricaoEditavel>,
): Promise<Resultado<Restricao>> {
  const id = z.guid().safeParse(restricaoId);
  if (!id.success) return falha("Identificador inválido");
  const parsed = restricaoEditavelSchema.partial().safeParse(entrada);
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { supabase } = await exigeUsuario();
  const { data: atual } = await supabase
    .from("6wla_restricoes")
    .select("obra_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!atual) return falha("Restrição não encontrada");
  await exigeMembro(atual.obra_id);

  const { data, error } = await supabase
    .from("6wla_restricoes")
    .update(parsed.data)
    .eq("id", id.data)
    .select("*")
    .single();
  if (error) return falha(traduzErro(error));
  revalidatePath(`/obras/${atual.obra_id}/tabela`);
  revalidatePath(`/obras/${atual.obra_id}/indicadores`);
  revalidatePath(`/obras/${atual.obra_id}/restricoes/${id.data}`);
  return sucesso(data);
}

export async function excluiRestricao(restricaoId: string): Promise<Resultado> {
  const id = z.guid().safeParse(restricaoId);
  if (!id.success) return falha("Identificador inválido");
  const { supabase } = await exigeUsuario();
  const { data: atual } = await supabase
    .from("6wla_restricoes")
    .select("obra_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!atual) return falha("Restrição não encontrada");
  await exigeGestor(atual.obra_id);
  const { error } = await supabase
    .from("6wla_restricoes")
    .delete()
    .eq("id", id.data);
  if (error) return erroInterno("restricoes", error);
  revalidatePath(`/obras/${atual.obra_id}/tabela`);
  revalidatePath(`/obras/${atual.obra_id}/indicadores`);
  return sucesso(undefined);
}

/** Erros de regra de negócio vindos dos gatilhos viram texto amigável; o resto é genérico. */
function traduzErro(erro: { message: string }): string {
  const m = erro.message;
  if (m.includes("semana programada")) return "Só gestor da obra altera a semana programada.";
  if (m.includes("concluida_tem_data")) return "Restrição concluída precisa de data de conclusão.";
  if (m.includes("equipe da obra")) return "O responsável precisa estar na equipe da obra.";
  console.error("[restricoes]", erro);
  return "Não foi possível salvar. Tente de novo.";
}
