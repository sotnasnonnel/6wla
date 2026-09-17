import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { precisaTrocarSenha } from "@/server/admin/troca-senha";
import type { Enums, Tables } from "@/lib/database.types";

export type Perfil = Tables<"6wla_perfis">;
export type Cliente = Awaited<ReturnType<typeof createClient>>;
/**
 * Papel efetivo da pessoa. `admin` vem de `perfis.admin` (global); gestor e
 * membro vêm do único vínculo dela com um workspace.
 */
export type PapelWorkspace = Enums<"6wla_workspace_papel">;
export type Workspace = Pick<
  Tables<"6wla_workspaces">,
  "id" | "codigo" | "nome" | "ativo"
>;

/**
 * Workspace escolhido no seletor da sidebar. Só o admin troca de workspace;
 * as outras pessoas estão em um só.
 */
export const COOKIE_WORKSPACE = "ws";

/**
 * Usuário logado + perfil. Redireciona para /login se não houver.
 *
 * Desempenho: `getClaims` confere a assinatura do JWT localmente (o projeto
 * usa chave assimétrica ES256), sem ida ao servidor de Auth a cada clique; e
 * `cache` faz layout e página da mesma requisição dividirem uma chamada só.
 * O corte de quem foi desativado continua valendo: o perfil é lido do banco.
 */
export const exigeUsuario = cache(async (): Promise<{
  perfil: Perfil;
  supabase: Cliente;
}> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  // Senha provisória: nada do app (páginas nem Server Actions) antes da troca.
  // O JWT pode estar atrasado em relação ao Auth; na dúvida, confirma lá.
  if (precisaTrocarSenha({ app_metadata: claims.app_metadata ?? {} })) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    if (precisaTrocarSenha(user)) redirect("/primeiro-acesso");
  }

  const { data: perfil } = await supabase
    .from("6wla_perfis")
    .select("*")
    .eq("id", claims.sub)
    .single();
  if (!perfil || !perfil.ativo) {
    await supabase.auth.signOut();
    redirect("/login?erro=inativo");
  }
  return { perfil, supabase };
});

/** Admin global: cria workspaces e usuários e enxerga todas as obras. */
export async function exigeAdmin() {
  const ctx = await exigeUsuario();
  if (!ctx.perfil.admin) redirect("/obras");
  return ctx;
}

/**
 * Vínculo do usuário logado (um só: workspace + papel), lido uma vez por
 * requisição. `null` para quem não está em workspace (ex.: admin global).
 */
const vinculoDoUsuario = cache(async (userId: string) => {
  const { supabase } = await exigeUsuario();
  const { data } = await supabase
    .from("6wla_membros_workspace")
    .select("workspace_id, papel")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
});

/**
 * Workspaces que o usuário alcança, com o papel. Admin global vê todos (a
 * RLS libera) e atua como admin neles; os demais têm um só.
 */
export async function workspacesDoUsuario(
  supabase: Cliente,
  perfil: Perfil,
): Promise<Array<Workspace & { papel: PapelWorkspace }>> {
  const [{ data: workspaces }, vinculo] = await Promise.all([
    supabase.from("6wla_workspaces").select("id, codigo, nome, ativo").order("nome"),
    vinculoDoUsuario(perfil.id),
  ]);
  return (workspaces ?? [])
    .map((w) => {
      const papel = perfil.admin
        ? "admin"
        : vinculo?.workspace_id === w.id
          ? vinculo.papel
          : undefined;
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
  const vinculo = await vinculoDoUsuario(perfil.id);
  return vinculo?.workspace_id === workspaceId ? vinculo.papel : null;
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

/**
 * Obra + workspace dela. `null` se não existe ou a RLS não deixa ver. Em
 * cache por requisição: o guard e as consultas da página leem a mesma.
 */
export const buscaObraComWorkspace = cache(async (
  supabase: Cliente,
  obraId: string,
) => {
  const { data } = await supabase
    .from("6wla_obras")
    .select("id, workspace_id, codigo, nome, ativa, criado_por")
    .eq("id", obraId)
    .maybeSingle();
  return data;
});

/**
 * Participa da obra (dono, equipe ou admin). A RLS só devolve a obra para
 * quem participa; o papel vem do vínculo com o workspace dela.
 */
export const exigeMembro = cache(async (obraId: string) => {
  const ctx = await exigeUsuario();
  // Obra e vínculo em paralelo; o vínculo fica em cache para o resto da
  // requisição (layout, página e componentes).
  const [obra] = await Promise.all([
    buscaObraComWorkspace(ctx.supabase, obraId),
    ctx.perfil.admin ? null : vinculoDoUsuario(ctx.perfil.id),
  ]);
  if (!obra) redirect("/obras");
  const papel = await papelNoWorkspace(
    ctx.supabase,
    ctx.perfil,
    obra.workspace_id,
  );
  if (!papel) redirect("/obras");
  return { ...ctx, obra, papel };
});

/** Gestor na obra (dono ou da equipe) ou admin. */
export async function exigeGestor(obraId: string) {
  const ctx = await exigeMembro(obraId);
  if (!ehGestor(ctx.papel)) redirect(`/obras/${obraId}`);
  return ctx;
}

/** Dono pode montar a equipe: o gestor que criou a obra, ou o admin. */
export function ehDonoObra(
  perfil: Perfil,
  papel: PapelWorkspace | null,
  obra: { criado_por: string | null },
): boolean {
  return perfil.admin || (papel === "gestor" && obra.criado_por === perfil.id);
}

export async function exigeDonoObra(obraId: string) {
  const ctx = await exigeMembro(obraId);
  if (!ehDonoObra(ctx.perfil, ctx.papel, ctx.obra)) redirect(`/obras/${obraId}`);
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
