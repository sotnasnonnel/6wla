"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  erroInterno,
  exigeAdmin,
  exigeAdminWs,
  falha,
  sucesso,
  type Resultado,
} from "@/server/auth";
import { createAdminClient } from "./supabase";

const usuarioSchema = z.object({
  workspaceId: z.guid(),
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  email: z.email("E-mail inválido").transform((e) => e.toLowerCase()),
  senha: z.string().min(8, "Senha com pelo menos 8 caracteres").max(72),
  papel: z.enum(["admin", "gestor", "membro"]).default("membro"),
});

/**
 * Admin do workspace (ou global) cria a conta com senha inicial e já a
 * inclui no workspace. Não há convite por e-mail nesta versão. O perfil
 * nasce pelo gatilho `cria_perfil`; a inclusão usa service_role porque o
 * usuário recém-criado ainda não é visível pela RLS de quem cadastra.
 */
export async function criaUsuario(
  form: FormData,
): Promise<Resultado<{ id: string }>> {
  const parsed = usuarioSchema.safeParse({
    workspaceId: form.get("workspaceId"),
    nome: form.get("nome"),
    email: form.get("email"),
    senha: form.get("senha"),
    papel: form.get("papel") || "membro",
  });
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");

  await exigeAdminWs(parsed.data.workspaceId);
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.senha,
    email_confirm: true,
    user_metadata: { nome: parsed.data.nome },
  });
  if (error || !data.user) {
    if (error?.message.includes("already")) {
      return falha(
        'Já existe usuário com esse e-mail. Use "Incluir pessoa que já tem conta".',
      );
    }
    return erroInterno("usuarios.criaUsuario", error);
  }
  const { error: erroMembro } = await admin.from("membros_workspace").insert({
    workspace_id: parsed.data.workspaceId,
    user_id: data.user.id,
    papel: parsed.data.papel,
  });
  if (erroMembro) return erroInterno("usuarios.criaUsuario.membro", erroMembro);

  revalidatePath("/workspace/pessoas");
  revalidatePath("/admin/usuarios");
  return sucesso({ id: data.user.id });
}

const alternaSchema = z.object({ userId: z.guid(), ativo: z.boolean() });

/** Admin global: desativa no perfil E no auth (senão a sessão continua válida). */
export async function alternaAtivo(form: FormData): Promise<Resultado> {
  const parsed = alternaSchema.safeParse({
    userId: form.get("userId"),
    ativo: form.get("ativo") === "true",
  });
  if (!parsed.success) return falha("Dados inválidos");
  const { perfil } = await exigeAdmin();
  if (perfil.id === parsed.data.userId)
    return falha("Você não pode desativar a si mesmo");
  const admin = createAdminClient();
  const { error: erroAuth } = await admin.auth.admin.updateUserById(
    parsed.data.userId,
    {
      ban_duration: parsed.data.ativo ? "none" : "876000h",
    },
  );
  if (erroAuth) return erroInterno("usuarios.alternaAtivo.auth", erroAuth);
  const { error } = await admin
    .from("perfis")
    .update({ ativo: parsed.data.ativo })
    .eq("id", parsed.data.userId);
  if (error) return erroInterno("usuarios.alternaAtivo", error);
  revalidatePath("/admin/usuarios");
  return sucesso(undefined);
}

const senhaSchema = z.object({
  workspaceId: z.guid(),
  userId: z.guid(),
  senha: z.string().min(8).max(72),
});

/** Admin do workspace redefine senha de alguém do próprio workspace. */
export async function redefineSenha(form: FormData): Promise<Resultado> {
  const parsed = senhaSchema.safeParse({
    workspaceId: form.get("workspaceId"),
    userId: form.get("userId"),
    senha: form.get("senha"),
  });
  if (!parsed.success) return falha("Senha com pelo menos 8 caracteres");
  const { supabase } = await exigeAdminWs(parsed.data.workspaceId);
  const { data: membro } = await supabase
    .from("membros_workspace")
    .select("user_id")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!membro) return falha("Essa pessoa não está neste workspace");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, {
    password: parsed.data.senha,
  });
  if (error) return erroInterno("usuarios.redefineSenha", error);
  return sucesso(undefined);
}

const adminSchema = z.object({ userId: z.guid(), admin: z.boolean() });

/** Admin global promove/rebaixa outro admin global. */
export async function alternaAdmin(form: FormData): Promise<Resultado> {
  const parsed = adminSchema.safeParse({
    userId: form.get("userId"),
    admin: form.get("admin") === "true",
  });
  if (!parsed.success) return falha("Dados inválidos");
  const { perfil } = await exigeAdmin();
  if (perfil.id === parsed.data.userId)
    return falha("Você não pode alterar o próprio papel");
  const admin = createAdminClient();
  const { error } = await admin
    .from("perfis")
    .update({ admin: parsed.data.admin })
    .eq("id", parsed.data.userId);
  if (error) return erroInterno("usuarios.alternaAdmin", error);
  revalidatePath("/admin/usuarios");
  return sucesso(undefined);
}
