import "server-only";

import type { Cliente } from "@/server/auth";

/** Pessoas do workspace com papel (para a tela de pessoas, responsável e @menção). */
export async function listaMembrosWorkspace(
  supabase: Cliente,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("6wla_membros_workspace")
    .select("papel, perfil:6wla_perfis!inner(id, nome, email, ativo)")
    .eq("workspace_id", workspaceId)
    .order("papel");
  if (error)
    throw new Error(`Falha ao listar pessoas do workspace: ${error.message}`);
  return data
    .map((m) => ({
      id: m.perfil.id,
      nome: m.perfil.nome,
      email: m.perfil.email,
      ativo: m.perfil.ativo,
      papel: m.papel,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export type MembroWorkspace = Awaited<
  ReturnType<typeof listaMembrosWorkspace>
>[number];

/** Visão do admin global: todos os workspaces com contagens. */
export async function listaWorkspacesAdmin(supabase: Cliente) {
  const { data, error } = await supabase
    .from("6wla_workspaces")
    .select(
      "id, codigo, nome, ativo, criado_em, membros:6wla_membros_workspace(count), obras:6wla_obras(count)",
    )
    .order("nome");
  if (error) throw new Error(`Falha ao listar workspaces: ${error.message}`);
  return data.map((w) => ({
    id: w.id,
    codigo: w.codigo,
    nome: w.nome,
    ativo: w.ativo,
    criado_em: w.criado_em,
    total_membros: w.membros[0]?.count ?? 0,
    total_obras: w.obras[0]?.count ?? 0,
  }));
}
