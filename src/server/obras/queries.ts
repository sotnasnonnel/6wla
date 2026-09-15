import "server-only";

import type { Cliente } from "@/server/auth";
import { hojeIso, STATUS_ABERTOS } from "@/lib/restricoes/dominio";
import { listaMembrosWorkspace } from "@/server/workspaces/queries";

/** Obras do workspace (a RLS garante que o usuário participa dele). */
export async function listaObras(supabase: Cliente, workspaceId: string) {
  const { data, error } = await supabase
    .from("6wla_obras")
    .select("id, codigo, nome, ativa, criado_em")
    .eq("workspace_id", workspaceId)
    .order("codigo");
  if (error) throw new Error(`Falha ao listar obras: ${error.message}`);
  return data;
}

export async function buscaObra(supabase: Cliente, obraId: string) {
  const { data, error } = await supabase
    .from("6wla_obras")
    .select("id, workspace_id, codigo, nome, ativa")
    .eq("id", obraId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar obra: ${error.message}`);
  return data;
}

/**
 * Pessoas que podem ser responsável ou mencionadas numa obra: todos os
 * membros ativos do workspace dela.
 */
export async function listaMembros(supabase: Cliente, obraId: string) {
  const obra = await buscaObra(supabase, obraId);
  if (!obra) return [];
  const membros = await listaMembrosWorkspace(supabase, obra.workspace_id);
  return membros
    .filter((m) => m.ativo)
    .map(({ id, nome, email, papel }) => ({ id, nome, email, papel }));
}

export type Membro = Awaited<ReturnType<typeof listaMembros>>[number];

/**
 * Obras do workspace com o que a lista precisa mostrar: quantas restrições
 * estão em aberto e, dentro delas, quantas já venceram. Uma consulta só, para
 * não disparar duas por obra.
 */
export async function listaObrasComResumo(supabase: Cliente, workspaceId: string) {
  const [{ data: obras, error }, { data: restricoes }] = await Promise.all([
    supabase
      .from("6wla_obras")
      .select("id, codigo, nome, ativa")
      .eq("workspace_id", workspaceId)
      .order("codigo"),
    supabase
      .from("6wla_restricoes")
      .select("obra_id, status, data_limite, obra:6wla_obras!inner(workspace_id)")
      .eq("obra.workspace_id", workspaceId),
  ]);
  if (error) throw new Error(`Falha ao listar obras: ${error.message}`);

  const hoje = hojeIso();
  const zero = { abertas: 0, atrasadas: 0, concluidas: 0, total: 0 };
  const resumo = new Map<string, typeof zero>();
  for (const r of restricoes ?? []) {
    const atual = resumo.get(r.obra_id) ?? { ...zero };
    atual.total += 1;
    if (STATUS_ABERTOS.includes(r.status)) {
      atual.abertas += 1;
      if (r.data_limite && r.data_limite < hoje) atual.atrasadas += 1;
    }
    if (r.status === "concluida") atual.concluidas += 1;
    resumo.set(r.obra_id, atual);
  }

  return (obras ?? []).map((o) => ({
    ...o,
    ...(resumo.get(o.id) ?? zero),
  }));
}
