"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  COOKIE_WORKSPACE,
  erroInterno,
  exigeAdmin,
  exigeAdminWs,
  exigeUsuario,
  falha,
  papelNoWorkspace,
  sucesso,
  type Resultado,
} from "@/server/auth";
import { createAdminClient } from "@/server/admin/supabase";

const PAPEIS = ["admin", "gestor", "membro"] as const;

/** Seletor do topo: guarda o workspace escolhido em cookie e volta para /obras. */
export async function selecionaWorkspace(form: FormData): Promise<void> {
  const id = z.guid().safeParse(form.get("workspaceId"));
  if (!id.success) return;
  const { supabase, perfil } = await exigeUsuario();
  const papel = await papelNoWorkspace(supabase, perfil, id.data);
  if (!papel) return;
  (await cookies()).set(COOKIE_WORKSPACE, id.data, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/obras");
}

const workspaceSchema = z.object({
  codigo: z.string().trim().min(2).max(30).toUpperCase(),
  nome: z.string().trim().min(2).max(120),
  adminEmail: z
    .email("E-mail do admin inválido")
    .transform((e) => e.toLowerCase())
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** Admin global cria o workspace e, opcionalmente, já nomeia o primeiro admin. */
export async function criaWorkspace(
  form: FormData,
): Promise<Resultado<{ id: string }>> {
  const parsed = workspaceSchema.safeParse({
    codigo: form.get("codigo"),
    nome: form.get("nome"),
    adminEmail: form.get("adminEmail") ?? "",
  });
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { supabase } = await exigeAdmin();
  const { data, error } = await supabase
    .from("6wla_workspaces")
    .insert({ codigo: parsed.data.codigo, nome: parsed.data.nome })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return falha("Já existe workspace com esse código");
    return erroInterno("workspaces.cria", error);
  }

  if (parsed.data.adminEmail) {
    const admin = createAdminClient();
    const { data: pessoa } = await admin
      .from("6wla_perfis")
      .select("id")
      .eq("email", parsed.data.adminEmail)
      .maybeSingle();
    if (!pessoa) {
      return falha(
        `Workspace criado, mas não existe usuário com o e-mail ${parsed.data.adminEmail}. Cadastre a pessoa em Pessoas.`,
      );
    }
    await supabase
      .from("6wla_membros_workspace")
      .insert({ workspace_id: data.id, user_id: pessoa.id, papel: "admin" });
  }
  revalidatePath("/admin/workspaces");
  return sucesso({ id: data.id });
}

const membroSchema = z.object({
  workspaceId: z.guid(),
  userId: z.guid(),
  papel: z.enum(PAPEIS),
});

export async function alteraPapel(form: FormData): Promise<Resultado> {
  const parsed = membroSchema.safeParse({
    workspaceId: form.get("workspaceId"),
    userId: form.get("userId"),
    papel: form.get("papel"),
  });
  if (!parsed.success) return falha("Dados inválidos");
  const { supabase, perfil } = await exigeAdminWs(parsed.data.workspaceId);
  if (
    perfil.id === parsed.data.userId &&
    !perfil.admin &&
    parsed.data.papel !== "admin"
  ) {
    return falha("Você não pode rebaixar a si mesmo");
  }
  const { error } = await supabase
    .from("6wla_membros_workspace")
    .update({ papel: parsed.data.papel })
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", parsed.data.userId);
  if (error) return erroInterno("workspaces.alteraPapel", error);
  revalidatePath("/workspace/pessoas");
  return sucesso(undefined);
}

export async function removeMembro(form: FormData): Promise<Resultado> {
  const parsed = membroSchema.omit({ papel: true }).safeParse({
    workspaceId: form.get("workspaceId"),
    userId: form.get("userId"),
  });
  if (!parsed.success) return falha("Dados inválidos");
  const { supabase, perfil } = await exigeAdminWs(parsed.data.workspaceId);
  if (perfil.id === parsed.data.userId && !perfil.admin) {
    return falha("Você não pode se remover do workspace");
  }
  const { error } = await supabase
    .from("6wla_membros_workspace")
    .delete()
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", parsed.data.userId);
  if (error) return erroInterno("workspaces.removeMembro", error);
  revalidatePath("/workspace/pessoas");
  return sucesso(undefined);
}

const porEmailSchema = z.object({
  workspaceId: z.guid(),
  email: z.email("E-mail inválido").transform((e) => e.toLowerCase()),
  papel: z.enum(PAPEIS),
});

/**
 * Inclui no workspace alguém que já tem conta (ex.: consultor que atende
 * outro workspace). A busca por e-mail usa service_role porque a RLS não
 * deixa o admin enumerar pessoas de fora; devolve só existe/não existe.
 */
export async function adicionaPorEmail(form: FormData): Promise<Resultado> {
  const parsed = porEmailSchema.safeParse({
    workspaceId: form.get("workspaceId"),
    email: form.get("email"),
    papel: form.get("papel"),
  });
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const { supabase } = await exigeAdminWs(parsed.data.workspaceId);

  const admin = createAdminClient();
  const { data: pessoa } = await admin
    .from("6wla_perfis")
    .select("id, ativo")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (!pessoa || !pessoa.ativo) {
    return falha(
      "Não existe conta ativa com esse e-mail. Cadastre a pessoa abaixo.",
    );
  }

  const { error } = await supabase
    .from("6wla_membros_workspace")
    .upsert({
      workspace_id: parsed.data.workspaceId,
      user_id: pessoa.id,
      papel: parsed.data.papel,
    });
  if (error) return erroInterno("workspaces.adicionaPorEmail", error);
  revalidatePath("/workspace/pessoas");
  return sucesso(undefined);
}
