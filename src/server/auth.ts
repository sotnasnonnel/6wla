import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/database.types";

export type Perfil = Tables<"6wla_perfis">;
export type Cliente = Awaited<ReturnType<typeof createClient>>;
export type PapelWorkspace = Enums<"6wla_workspace_papel">;
export type Workspace = Pick<
  Tables<"6wla_workspaces">,
  "id" | "codigo" | "nome" | "ativo"
>;

/** Nome do cookie que guarda o workspace escolhido no seletor do topo. */
export const COOKIE_WORKSPACE = "ws";

/** Usuário logado + perfil. Redireciona para /login se não houver. */
export async function exigeUsuario(): Promise<{
  perfil: Perfil;
  supabase: Cliente;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("6wla_perfis")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!perfil || !perfil.ativo) {
    await supabase.auth.signOut();
    redirect("/login?erro=inativo");
  }
  return { perfil, supabase };
}

/** Admin global (super-admin): cria workspaces e enxerga tudo. */
export async function exigeAdmin() {
  const ctx = await exigeUsuario();
  if (!ctx.perfil.admin) redirect("/obras");
  return ctx;
}

/**
 * Workspaces do usuário com o papel em cada um. Admin global vê todos (a RLS
 * libera) e atua como admin neles.
 */
export async function workspacesDoUsuario(
  supabase: Cliente,
  perfil: Perfil,
): Promise<Array<Workspace & { papel: PapelWorkspace }>> {
  const [{ data: workspaces }, { data: membros }] = await Promise.all([
    supabase.from("6wla_workspaces").select("id, codigo, nome, ativo").order("nome"),
    supabase
      .from("6wla_membros_workspace")
      .select("workspace_id, papel")
      .eq("user_id", perfil.id),
  ]);
  const papelPorWs = new Map(
    (membros ?? []).map((m) => [m.workspace_id, m.papel]),
  );
  return (workspaces ?? [])
    .map((w) => {
      const papel = perfil.admin ? "admin" : papelPorWs.get(w.id);
      return papel ? { ...w, papel } : null;
    })
    .filter((w): w is Workspace & { papel: PapelWorkspace } => w !== null);
}

/**
 * Papel do usuário num workspace, checado pela aplicação (a RLS checa de
 * novo no banco). `null` = não participa.
 */
export async function papelNoWorkspace(
  supabase: Cliente,
  perfil: Perfil,
  workspaceId: string,
): Promise<PapelWorkspace | null> {
  if (perfil.admin) return "admin";
  const { data } = await supabase
    .from("6wla_membros_workspace")
    .select("papel")
    .eq("workspace_id", workspaceId)
    .eq("user_id", perfil.id)
    .maybeSingle();
  return data?.papel ?? null;
}

export function ehGestor(papel: PapelWorkspace | null): boolean {
  return papel === "admin" || papel === "gestor";
}

/**
 * Workspace "atual" do usuário: o do cookie, se ele ainda participa; senão o
 * primeiro da lista. `null` quando não participa de nenhum.
 */
export async function workspaceAtual(supabase: Cliente, perfil: Perfil) {
  const lista = await workspacesDoUsuario(supabase, perfil);
  const escolhido = (await cookies()).get(COOKIE_WORKSPACE)?.value;
  const atual = lista.find((w) => w.id === escolhido) ?? lista[0] ?? null;
  return { atual, lista };
}

export async function exigeWorkspaceAtual() {
  const ctx = await exigeUsuario();
  const { atual, lista } = await workspaceAtual(ctx.supabase, ctx.perfil);
  if (!atual) redirect("/sem-workspace");
  return { ...ctx, workspace: atual, papel: atual.papel, workspaces: lista };
}

export async function exigeMembroWs(workspaceId: string) {
  const ctx = await exigeUsuario();
  const papel = await papelNoWorkspace(ctx.supabase, ctx.perfil, workspaceId);
  if (!papel) redirect("/obras");
  return { ...ctx, papel };
}

export async function exigeGestorWs(workspaceId: string) {
  const ctx = await exigeMembroWs(workspaceId);
  if (!ehGestor(ctx.papel)) redirect("/obras");
  return ctx;
}

export async function exigeAdminWs(workspaceId: string) {
  const ctx = await exigeMembroWs(workspaceId);
  if (ctx.papel !== "admin") redirect("/obras");
  return ctx;
}

/** Obra + workspace dela. `null` se não existe ou a RLS não deixa ver. */
export async function buscaObraComWorkspace(supabase: Cliente, obraId: string) {
  const { data } = await supabase
    .from("6wla_obras")
    .select("id, workspace_id, codigo, nome, ativa")
    .eq("id", obraId)
    .maybeSingle();
  return data;
}

/** Membro do workspace da obra. Devolve a obra e o papel para a UI. */
export async function exigeMembro(obraId: string) {
  const ctx = await exigeUsuario();
  const obra = await buscaObraComWorkspace(ctx.supabase, obraId);
  if (!obra) redirect("/obras");
  const papel = await papelNoWorkspace(
    ctx.supabase,
    ctx.perfil,
    obra.workspace_id,
  );
  if (!papel) redirect("/obras");
  return { ...ctx, obra, papel };
}

/** Gestor ou admin do workspace da obra. */
export async function exigeGestor(obraId: string) {
  const ctx = await exigeMembro(obraId);
  if (!ehGestor(ctx.papel)) redirect(`/obras/${obraId}`);
  return ctx;
}

/** Resultado padrão das Server Actions: nunca lança para o cliente. */
export type Resultado<T = undefined> =
  { ok: true; dados: T } | { ok: false; erro: string };

export function falha(erro: string): Resultado<never> {
  return { ok: false, erro };
}

export function sucesso<T>(dados: T): Resultado<T> {
  return { ok: true, dados };
}

/**
 * Erro inesperado (banco, auth): loga o detalhe no servidor e devolve texto
 * genérico. Mensagem crua do Postgres entrega nomes de tabela/constraint.
 */
export function erroInterno(contexto: string, erro: unknown): Resultado<never> {
  console.error(`[${contexto}]`, erro);
  return {
    ok: false,
    erro: "Não foi possível concluir a operação. Tente de novo.",
  };
}
