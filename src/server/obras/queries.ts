import "server-only";

import { buscaObraComWorkspace, type Cliente } from "@/server/auth";
import { hojeIso, STATUS_ABERTOS } from "@/lib/restricoes/dominio";
import { listaMembrosWorkspace } from "@/server/workspaces/queries";

/** Obras do workspace que o usuário alcança (a RLS filtra as da equipe dele). */
export async function listaObras(supabase: Cliente, workspaceId: string) {
  const { data, error } = await supabase
    .from("6wla_obras")
    .select("id, codigo, nome, ativa, criado_em")
    .eq("workspace_id", workspaceId)
    .order("codigo");
  if (error) throw new Error(`Falha ao listar obras: ${error.message}`);
  return data;
}

/** A mesma leitura (em cache por requisição) que o guard `exigeMembro` faz. */
export function buscaObra(supabase: Cliente, obraId: string) {
  return buscaObraComWorkspace(supabase, obraId);
}

/**
 * Equipe da obra: o dono (gestor que criou) e quem ele incluiu, com o papel
 * de cada um no workspace. Só pessoas ativas e ainda no workspace — as mesmas
 * que o banco aceita como responsável ou menção.
 */
export async function listaEquipe(supabase: Cliente, obraId: string) {
  const obra = await buscaObra(supabase, obraId);
  if (!obra) return [];
  const [membros, { data: equipe, error }] = await Promise.all([
    listaMembrosWorkspace(supabase, obra.workspace_id),
    supabase
      .from("6wla_membros_obra")
      .select("user_id")
      .eq("obra_id", obraId),
  ]);
  if (error) throw new Error(`Falha ao listar equipe: ${error.message}`);
  const naEquipe = new Set((equipe ?? []).map((e) => e.user_id));
  return membros
    .filter((m) => m.ativo && (m.id === obra.criado_por || naEquipe.has(m.id)))
    .map(({ id, nome, email, papel }) => ({
      id,
      nome,
      email,
      papel,
      dono: id === obra.criado_por,
    }));
}

/** Pessoas que podem ser responsável ou mencionadas numa obra: a equipe. */
export async function listaMembros(supabase: Cliente, obraId: string) {
  const equipe = await listaEquipe(supabase, obraId);
  return equipe.map(({ id, nome, email, papel }) => ({ id, nome, email, papel }));
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
