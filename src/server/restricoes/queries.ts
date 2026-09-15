import "server-only";

import type { Cliente } from "@/server/auth";
import type { Tables } from "@/lib/database.types";

export type Restricao = Tables<"restricoes">;

export async function listaRestricoes(
  supabase: Cliente,
  obraId: string,
): Promise<Restricao[]> {
  const { data, error } = await supabase
    .from("restricoes")
    .select("*")
    .eq("obra_id", obraId)
    .order("numero", { ascending: false });
  if (error) throw new Error(`Falha ao listar restrições: ${error.message}`);
  return data;
}

export async function buscaRestricao(
  supabase: Cliente,
  restricaoId: string,
): Promise<Restricao | null> {
  const { data, error } = await supabase
    .from("restricoes")
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
    .from("restricao_comentarios")
    .select("id, texto, mencoes, criado_em, autor:perfis(id, nome)")
    .eq("restricao_id", restricaoId)
    .order("criado_em");
  if (error) throw new Error(`Falha ao listar comentários: ${error.message}`);
  return data;
}

export type Evento = {
  id: string;
  tipo: Tables<"restricao_eventos">["tipo"];
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
    .from("restricao_eventos")
    .select(
      "id, tipo, campo, valor_anterior, valor_novo, criado_em, autor:perfis(id, nome)",
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
    .from("restricao_anexos")
    .select("id, nome, tamanho, tipo_mime, criado_em, autor:perfis(id, nome)")
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
    .from("restricao_tarefas")
    .select(
      "id, texto, concluida, concluida_em, concluidor:perfis!restricao_tarefas_concluida_por_fkey(id, nome)",
    )
    .eq("restricao_id", restricaoId)
    .order("criado_em");
  if (error) throw new Error(`Falha ao listar tarefas: ${error.message}`);
  return data;
}
