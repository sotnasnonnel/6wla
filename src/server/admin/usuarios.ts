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

/**
 * Marca gravada no `app_metadata` de toda conta criada pelo 6wla. O usuário
 * não consegue editar `app_metadata`, então ela prova a origem da conta: é o
 * que permite ao 6wla trocar senha sem arriscar uma conta do PHD View. A
 * cópia em `user_metadata` é só para o gatilho do PHD View não abrir acesso
 * lá (ver Devs/view/supabase/ignora-contas-6wla.sql).
 */
const APP_ORIGEM = "6wla";

const usuarioSchema = z.object({
  workspaceId: z.guid(),
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  email: z.email("E-mail inválido").transform((e) => e.toLowerCase()),
  senha: z.string().min(8, "Senha com pelo menos 8 caracteres").max(72),
  papel: z.enum(["admin", "gestor", "membro"]).default("membro"),
});

/**
 * Admin do workspace (ou global) cadastra a pessoa e já a inclui no
 * workspace. Não há convite por e-mail nesta versão.
 *
 * O banco é compartilhado com o PHD View, e os dois apps dividem o login
 * (auth.users). Por isso não existe gatilho criando perfil: é aqui que o
 * perfil do 6wla nasce. Dois casos:
 *   - e-mail sem conta: cria a conta com a senha inicial e o perfil;
 *   - e-mail com conta (do PHD View): só ADMIN GLOBAL pode vincular. Reaproveita
 *     a conta SEM mexer na senha e só cria o perfil do 6wla. Para admin de
 *     workspace a resposta é a mesma de qualquer falha, sem dizer se o e-mail
 *     tem conta em outro sistema (senão vira enumeração de usuários).
 * Tudo com service_role porque a pessoa nova ainda não é visível pela RLS de
 * quem cadastra; a autorização é o `exigeAdminWs` logo abaixo.
 */
export async function criaUsuario(
  form: FormData,
): Promise<Resultado<{ id: string; contaExistente: boolean }>> {
  const parsed = usuarioSchema.safeParse({
    workspaceId: form.get("workspaceId"),
    nome: form.get("nome"),
    email: form.get("email"),
    senha: form.get("senha"),
    papel: form.get("papel") || "membro",
  });
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { perfil: quem } = await exigeAdminWs(parsed.data.workspaceId);
  const admin = createAdminClient();

  const { data: perfilExistente } = await admin
    .from("6wla_perfis")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (perfilExistente) {
    return falha(
      'Essa pessoa já está no 6wla. Use "Incluir pessoa que já tem conta".',
    );
  }

  const { data: idExistente, error: erroBusca } = await admin.rpc(
    "6wla_auth_id_por_email",
    { p_email: parsed.data.email },
  );
  if (erroBusca) return erroInterno("usuarios.criaUsuario.busca", erroBusca);

  let userId: string;
  const contaExistente = idExistente !== null;
  if (idExistente !== null) {
    if (!quem.admin) {
      return falha(
        "Não foi possível cadastrar esse e-mail. Se a pessoa já usa outro sistema da PHD, peça a um administrador geral para incluí-la.",
      );
    }
    userId = idExistente;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.senha,
      email_confirm: true,
      // user_metadata: lido pelo gatilho do PHD View no INSERT (não cria
      // perfil lá). app_metadata: prova de origem que o usuário não edita.
      user_metadata: { nome: parsed.data.nome, app_origem: APP_ORIGEM },
      app_metadata: { app_origem: APP_ORIGEM },
    });
    if (error || !data.user)
      return erroInterno("usuarios.criaUsuario.auth", error);
    userId = data.user.id;
  }

  const { error: erroPerfil } = await admin.from("6wla_perfis").insert({
    id: userId,
    email: parsed.data.email,
    nome: parsed.data.nome,
  });
  if (erroPerfil) {
    // Conta criada agora e sem perfil é lixo que ninguém consegue usar nem
    // cadastrar de novo pelo mesmo caminho. Conta do PHD View fica intacta.
    if (!contaExistente) await admin.auth.admin.deleteUser(userId);
    return erroInterno("usuarios.criaUsuario.perfil", erroPerfil);
  }

  const { error: erroMembro } = await admin
    .from("6wla_membros_workspace")
    .insert({
      workspace_id: parsed.data.workspaceId,
      user_id: userId,
      papel: parsed.data.papel,
    });
  if (erroMembro) return erroInterno("usuarios.criaUsuario.membro", erroMembro);

  revalidatePath("/workspace/pessoas");
  revalidatePath("/admin/usuarios");
  return sucesso({ id: userId, contaExistente });
}

const alternaSchema = z.object({ userId: z.guid(), ativo: z.boolean() });

/**
 * Admin global ativa/desativa a pessoa NO 6WLA. Não bane a conta no Auth: o
 * login é compartilhado com o PHD View, e banir lá tiraria a pessoa do outro
 * app também. O corte vale mesmo assim — `exigeUsuario` desloga quem tem
 * perfil inativo a cada requisição, e as funções de papel da RLS exigem
 * `ativo`, então nem uma sessão ainda válida lê ou grava nada do 6wla.
 */
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
  const { data, error } = await admin
    .from("6wla_perfis")
    .update({ ativo: parsed.data.ativo })
    .eq("id", parsed.data.userId)
    .select("id");
  if (error) return erroInterno("usuarios.alternaAtivo", error);
  if (data.length === 0) return falha("Pessoa não encontrada no 6wla");
  revalidatePath("/admin/usuarios");
  return sucesso(undefined);
}

const senhaSchema = z.object({
  workspaceId: z.guid(),
  userId: z.guid(),
  senha: z.string().min(8).max(72),
});

/**
 * Admin do workspace redefine a senha de alguém do próprio workspace. Como a
 * senha vale também no PHD View, três travas:
 *   - só em conta criada pelo 6wla (`app_origem`); conta do PHD View troca a
 *     senha por conta própria;
 *   - quem redefine precisa ser admin de TODOS os workspaces da pessoa —
 *     senão um admin incluiria alguém de outro workspace por e-mail e
 *     tomaria a conta;
 *   - admin global só tem a senha trocada por outro admin global.
 */
export async function redefineSenha(form: FormData): Promise<Resultado> {
  const parsed = senhaSchema.safeParse({
    workspaceId: form.get("workspaceId"),
    userId: form.get("userId"),
    senha: form.get("senha"),
  });
  if (!parsed.success) return falha("Senha com pelo menos 8 caracteres");
  const { perfil: quem } = await exigeAdminWs(parsed.data.workspaceId);
  const admin = createAdminClient();

  const [{ data: alvo }, { data: vinculos }, { data: meus }, conta] =
    await Promise.all([
      admin
        .from("6wla_perfis")
        .select("admin")
        .eq("id", parsed.data.userId)
        .maybeSingle(),
      admin
        .from("6wla_membros_workspace")
        .select("workspace_id")
        .eq("user_id", parsed.data.userId),
      admin
        .from("6wla_membros_workspace")
        .select("workspace_id")
        .eq("user_id", quem.id)
        .eq("papel", "admin"),
      admin.auth.admin.getUserById(parsed.data.userId),
    ]);

  const workspacesDoAlvo = (vinculos ?? []).map((v) => v.workspace_id);
  if (!alvo || !workspacesDoAlvo.includes(parsed.data.workspaceId))
    return falha("Essa pessoa não está neste workspace");
  if (conta.error || !conta.data.user)
    return erroInterno("usuarios.redefineSenha.conta", conta.error);

  if (conta.data.user.app_metadata["app_origem"] !== APP_ORIGEM) {
    return falha(
      "Essa conta também é usada em outro sistema da PHD. A própria pessoa precisa trocar a senha.",
    );
  }
  if (!quem.admin) {
    const administro = new Set((meus ?? []).map((m) => m.workspace_id));
    if (alvo.admin || !workspacesDoAlvo.every((w) => administro.has(w))) {
      return falha(
        "Essa pessoa participa de workspaces que você não administra. Peça a um administrador geral.",
      );
    }
  }

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
    .from("6wla_perfis")
    .update({ admin: parsed.data.admin })
    .eq("id", parsed.data.userId);
  if (error) return erroInterno("usuarios.alternaAdmin", error);
  revalidatePath("/admin/usuarios");
  return sucesso(undefined);
}
