import "server-only";

import { todasAsPaginas } from "@/server/paginacao";
import type { Cliente } from "@/server/auth";
import type { Tables } from "@/lib/database.types";

export type Restricao = Tables<"6wla_restricoes">;

export function listaRestricoes(
  supabase: Cliente,
  obraId: string,
): Promise<Restricao[]> {
  return todasAsPaginas(
    (de, ate) =>
      supabase
        .from("6wla_restricoes")
        .select("*")
        .eq("obra_id", obraId)
        .order("numero", { ascending: false })
        .range(de, ate),
    "Falha ao listar restrições",
  );
}

/**
 * Colunas da grade sem `extras` (o jsonb das colunas extras da planilha, a
 * parte pesada). Basta para filtrar e ordenar como a grade no anterior/
 * próxima do detalhe.
 */
const COLUNAS_NAVEGACAO =
  "id, numero, status, prioridade, codigo, descricao, acao, responsavel_id, responsavel_nome, responsavel_email, responsavel_telefone, descricao_status, causa_6m, classificacao, area, setor, localizacao, id_atividade, atividade_impactada, inicio_atividade, data_criacao, data_limite, previsao_conclusao, data_conclusao, semana_programada, observacoes, prazo_original, reprogramacoes, origem, criado_em, atualizado_em";

export function listaRestricoesParaNavegar(supabase: Cliente, obraId: string) {
  return todasAsPaginas(
    (de, ate) =>
      supabase
        .from("6wla_restricoes")
        .select(COLUNAS_NAVEGACAO)
        .eq("obra_id", obraId)
        .order("numero", { ascending: false })
        .range(de, ate),
    "Falha ao listar restrições",
  );
}

export async function buscaRestricao(
  supabase: Cliente,
  restricaoId: string,
): Promise<Restricao | null> {
  const { data, error } = await supabase
    .from("6wla_restricoes")
    .select("*")
    .eq("id", restricaoId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar restrição: ${error.message}`);
  return data;
}

export type Comentario = {
  id: string;
  texto: string;
  mencoes: string[];
  criado_em: string;
  autor: { id: string; nome: string } | null;
};

export async function listaComentarios(
  supabase: Cliente,
  restricaoId: string,
): Promise<Comentario[]> {
  const { data, error } = await supabase
    .from("6wla_restricao_comentarios")
    .select("id, texto, mencoes, criado_em, autor:6wla_perfis(id, nome)")
    .eq("restricao_id", restricaoId)
    .order("criado_em");
  if (error) throw new Error(`Falha ao listar comentários: ${error.message}`);
  return data;
}

export type Evento = {
  id: string;
  tipo: Tables<"6wla_restricao_eventos">["tipo"];
  campo: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  criado_em: string;
  autor: { id: string; nome: string } | null;
};

export async function listaEventos(
  supabase: Cliente,
  restricaoId: string,
): Promise<Evento[]> {
  const { data, error } = await supabase
    .from("6wla_restricao_eventos")
    .select(
      "id, tipo, campo, valor_anterior, valor_novo, criado_em, autor:6wla_perfis(id, nome)",
    )
    .eq("restricao_id", restricaoId)
    .order("criado_em");
  if (error) throw new Error(`Falha ao listar histórico: ${error.message}`);
  return data;
}

export type Anexo = {
  id: string;
  nome: string;
  tamanho: number;
  tipo_mime: string | null;
  criado_em: string;
  autor: { id: string; nome: string } | null;
};

export async function listaAnexos(
  supabase: Cliente,
  restricaoId: string,
): Promise<Anexo[]> {
  const { data, error } = await supabase
    .from("6wla_restricao_anexos")
    .select(
      "id, nome, tamanho, tipo_mime, criado_em, autor:6wla_perfis(id, nome)",
    )
    .eq("restricao_id", restricaoId)
    .order("criado_em", { ascending: false });
  if (error) throw new Error(`Falha ao listar anexos: ${error.message}`);
  return data;
}

export type Tarefa = {
  id: string;
  texto: string;
  concluida: boolean;
  concluida_em: string | null;
  concluidor: { id: string; nome: string } | null;
};

export async function listaTarefas(
  supabase: Cliente,
  restricaoId: string,
): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from("6wla_restricao_tarefas")
    .select(
      "id, texto, concluida, concluida_em, concluidor:6wla_perfis!6wla_restricao_tarefas_concluida_por_fkey(id, nome)",
    )
    .eq("restricao_id", restricaoId)
    .order("criado_em");
  if (error) throw new Error(`Falha ao listar tarefas: ${error.message}`);
  return data;
}
