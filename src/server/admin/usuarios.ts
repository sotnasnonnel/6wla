"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  ehDonoObra,
  erroInterno,
  exigeAdmin,
  exigeMembro,
  falha,
  sucesso,
  type Resultado,
} from "@/server/auth";
import {
  enviaLinkRedefinicao,
  urlDefinirSenha,
} from "@/server/links-senha";
import { convitePendente, enviaConvite } from "./convites";
import { createAdminClient } from "./supabase";
import { permite } from "@/server/limite";
import { precisaTrocarSenha } from "./troca-senha";

/**
 * Marca gravada no `app_metadata` de toda conta criada pelo 6wla. O usuário
 * não consegue editar `app_metadata`, então ela prova a origem da conta. A
 * cópia em `user_metadata` (enviada no convite) é para o gatilho do PHD View
 * não abrir acesso lá (ver Devs/view/supabase/ignora-contas-6wla.sql).
 */
const APP_ORIGEM = "6wla";

const PAPEIS = ["admin", "gestor", "membro"] as const;

const contaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  email: z.email("E-mail inválido").transform((e) => e.toLowerCase()),
});

type NovaConta = z.infer<typeof contaSchema> & {
  /** `null` só para admin global, que não pertence a workspace. */
  workspaceId: string | null;
  papel: (typeof PAPEIS)[number];
  /** Só o admin global pode vincular e-mail que já tem conta do PHD View. */
  podeReaproveitarConta: boolean;
};

/**
 * Apaga o que o cadastro criou quando um passo seguinte falha. Sem isso fica
 * uma conta sem vínculo, que ninguém consegue usar nem cadastrar de novo.
 * Conta que já existia (PHD View) perde só o perfil do 6wla.
 */
async function desfazConta(userId: string, contaExistente: boolean) {
  const admin = createAdminClient();
  await admin.from("6wla_perfis").delete().eq("id", userId);
  if (!contaExistente) await admin.auth.admin.deleteUser(userId);
}

/**
 * Cria a pessoa no 6wla. O banco é compartilhado com o PHD View, e os dois
 * apps dividem o login (auth.users), por isso não existe gatilho criando
 * perfil: é aqui que o perfil do 6wla nasce. Dois casos:
 *   - e-mail sem conta: CONVIDA por e-mail (a pessoa cria a senha pelo
 *     link, ninguém mais a conhece) e cria o perfil;
 *   - e-mail com conta (do PHD View): só ADMIN GLOBAL pode vincular.
 *     Reaproveita a conta SEM mexer na senha. Para o gestor, a resposta é a
 *     mesma de qualquer falha, sem dizer se o e-mail tem conta em outro
 *     sistema (senão vira enumeração de usuários).
 * Usa service_role porque a pessoa nova ainda não é visível pela RLS de quem
 * cadastra. Quem chama já fez a autorização.
 */
async function criaConta(
  conta: NovaConta,
): Promise<Resultado<{ id: string; contaExistente: boolean }>> {
  const admin = createAdminClient();
  const redirectTo = await urlDefinirSenha();
  if (!redirectTo)
    return erroInterno("usuarios.criaConta.site", "origem desconhecida");

  const { data: perfilExistente } = await admin
    .from("6wla_perfis")
    .select("id")
    .eq("email", conta.email)
    .maybeSingle();
  // Quem não é admin recebe a mesma resposta para "já está no 6wla" e "tem
  // conta no PHD View": senão o cadastro vira um enumerador de contas.
  const recusa = () =>
    falha(
      "Não foi possível cadastrar esse e-mail. Se a pessoa já usa algum sistema da PHD, peça a um administrador para incluí-la.",
    );
  if (perfilExistente) {
    return conta.podeReaproveitarConta
      ? falha("Já existe um usuário com esse e-mail.")
      : recusa();
  }

  const { data: idExistente, error: erroBusca } = await admin.rpc(
    "6wla_auth_id_por_email",
    { p_email: conta.email },
  );
  if (erroBusca) return erroInterno("usuarios.criaConta.busca", erroBusca);

  let userId: string;
  const contaExistente = idExistente !== null;
  if (idExistente !== null) {
    if (!conta.podeReaproveitarConta) return recusa();
    userId = idExistente;
  } else {
    const convite = await enviaConvite(
      conta.email,
      conta.nome,
      APP_ORIGEM,
      redirectTo,
    );
    if (!convite.ok) {
      // Conta criada entre a busca e o convite: mesma resposta de "já existe".
      if (convite.jaExiste && !conta.podeReaproveitarConta) return recusa();
      return erroInterno("usuarios.criaConta.convite", convite.erro);
    }
    userId = convite.id;
    // Prova de origem que o usuário não edita (o convite só grava
    // user_metadata).
    const { error: erroOrigem } = await admin.auth.admin.updateUserById(
      userId,
      { app_metadata: { app_origem: APP_ORIGEM } },
    );
    if (erroOrigem) {
      await admin.auth.admin.deleteUser(userId);
      return erroInterno("usuarios.criaConta.origem", erroOrigem);
    }
  }

  const { error: erroPerfil } = await admin.from("6wla_perfis").insert({
    id: userId,
    email: conta.email,
    nome: conta.nome,
    admin: conta.papel === "admin",
  });
  if (erroPerfil) {
    // Conta criada agora e sem perfil é lixo que ninguém consegue usar nem
    // cadastrar de novo pelo mesmo caminho. Conta do PHD View fica intacta.
    if (!contaExistente) await admin.auth.admin.deleteUser(userId);
    return erroInterno("usuarios.criaConta.perfil", erroPerfil);
  }

  if (conta.workspaceId && conta.papel !== "admin") {
    const { error: erroVinculo } = await admin
      .from("6wla_membros_workspace")
      .insert({
        workspace_id: conta.workspaceId,
        user_id: userId,
        papel: conta.papel,
      });
    if (erroVinculo) {
      await desfazConta(userId, contaExistente);
      return erroInterno("usuarios.criaConta.vinculo", erroVinculo);
    }
  }

  return sucesso({ id: userId, contaExistente });
}

const usuarioSchema = contaSchema
  .extend({
    papel: z.enum(PAPEIS),
    workspaceId: z
      .guid()
      .nullable()
      .or(z.literal("").transform(() => null)),
  })
  .refine((d) => d.papel === "admin" || d.workspaceId !== null, {
    message: "Escolha o workspace da pessoa",
  });

/** Admin cadastra qualquer pessoa, escolhendo papel e workspace. */
export async function criaUsuario(
  form: FormData,
): Promise<Resultado<{ id: string; contaExistente: boolean }>> {
  const parsed = usuarioSchema.safeParse({
    nome: form.get("nome"),
    email: form.get("email"),
    papel: form.get("papel"),
    workspaceId: form.get("workspaceId") ?? "",
  });
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");
  await exigeAdmin();

  const r = await criaConta({ ...parsed.data, podeReaproveitarConta: true });
  if (r.ok) revalidatePath("/admin/usuarios");
  return r;
}

const membroObraSchema = contaSchema.extend({ obraId: z.guid() });

/**
 * Dono da obra cadastra alguém novo como MEMBRO do próprio workspace e já o
 * coloca na equipe. Papel e workspace não vêm do formulário: são fixos.
 */
export async function criaMembroNaObra(
  form: FormData,
): Promise<Resultado<{ id: string; contaExistente: boolean }>> {
  const parsed = membroObraSchema.safeParse({
    nome: form.get("nome"),
    email: form.get("email"),
    obraId: form.get("obraId"),
  });
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { perfil, papel, obra } = await exigeMembro(parsed.data.obraId);
  if (!ehDonoObra(perfil, papel, obra))
    return falha("Só quem criou a obra monta a equipe.");
  // Cada cadastro dispara um convite, e a cota de e-mail é dividida com o
  // PHD View.
  if (!perfil.admin && !permite(`convite:${perfil.id}`, 10, 60 * 60_000))
    return falha("Muitos cadastros seguidos. Tente de novo mais tarde.");

  const r = await criaConta({
    nome: parsed.data.nome,
    email: parsed.data.email,
    workspaceId: obra.workspace_id,
    papel: "membro",
    podeReaproveitarConta: perfil.admin,
  });
  if (!r.ok) return r;

  const admin = createAdminClient();
  const { error } = await admin.from("6wla_membros_obra").insert({
    obra_id: obra.id,
    user_id: r.dados.id,
    adicionado_por: perfil.id,
  });
  if (error) {
    await desfazConta(r.dados.id, r.dados.contaExistente);
    return erroInterno("usuarios.criaMembroNaObra.equipe", error);
  }

  revalidatePath(`/obras/${obra.id}/equipe`);
  revalidatePath("/admin/usuarios");
  // Conta reaproveitada (só admin consegue) entra com a senha que já usa e
  // não recebe convite: a tela precisa saber para dizer isso.
  return sucesso(r.dados);
}

const acessoSchema = z
  .object({
    userId: z.guid(),
    papel: z.enum(PAPEIS),
    workspaceId: z
      .guid()
      .nullable()
      .or(z.literal("").transform(() => null)),
  })
  .refine((d) => d.papel === "admin" || d.workspaceId !== null, {
    message: "Escolha o workspace da pessoa",
  });

/**
 * Admin define papel e workspace de alguém. Admin global não pertence a
 * workspace (enxerga todos), então virar admin apaga o vínculo; voltar a
 * gestor/membro exige escolher um. Trocar de workspace tira a pessoa das
 * equipes do anterior (gatilho no banco).
 */
export async function defineAcesso(form: FormData): Promise<Resultado> {
  const parsed = acessoSchema.safeParse({
    userId: form.get("userId"),
    papel: form.get("papel"),
    workspaceId: form.get("workspaceId") ?? "",
  });
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const { perfil } = await exigeAdmin();
  if (perfil.id === parsed.data.userId)
    return falha("Você não pode alterar o próprio acesso");

  const { userId, papel, workspaceId } = parsed.data;
  const admin = createAdminClient();

  // Conta antiga com senha provisória (conhecida por quem cadastrou) não vira
  // admin antes de a pessoa trocar. Contas novas nascem por convite, sem ela.
  if (papel === "admin") {
    const conta = await admin.auth.admin.getUserById(userId);
    if (conta.error || !conta.data.user)
      return erroInterno("usuarios.defineAcesso.conta", conta.error);
    if (precisaTrocarSenha(conta.data.user))
      return falha(
        "Essa pessoa ainda não trocou a senha provisória. Ela vira admin depois do primeiro acesso.",
      );
  }

  const { data: alvo, error: erroAlvo } = await admin
    .from("6wla_perfis")
    .update({ admin: papel === "admin" })
    .eq("id", userId)
    .select("id");
  if (erroAlvo) return erroInterno("usuarios.defineAcesso.perfil", erroAlvo);
  if (alvo.length === 0) return falha("Pessoa não encontrada no 6wla");

  if (papel === "admin") {
    const { error } = await admin
      .from("6wla_membros_workspace")
      .delete()
      .eq("user_id", userId);
    if (error) return erroInterno("usuarios.defineAcesso.sai", error);
  } else if (workspaceId) {
    // `update` primeiro para o gatilho ver a troca de workspace e limpar as
    // equipes antigas; `insert` quando a pessoa ainda não tinha vínculo.
    const { data: atualizados, error } = await admin
      .from("6wla_membros_workspace")
      .update({ workspace_id: workspaceId, papel })
      .eq("user_id", userId)
      .select("user_id");
    if (error) return erroInterno("usuarios.defineAcesso.atualiza", error);
    if (atualizados.length === 0) {
      const { error: erroNovo } = await admin
        .from("6wla_membros_workspace")
        .insert({ workspace_id: workspaceId, user_id: userId, papel });
      if (erroNovo) return erroInterno("usuarios.defineAcesso.cria", erroNovo);
    }
  }

  revalidatePath("/admin/usuarios");
  return sucesso(undefined);
}

const alternaSchema = z.object({ userId: z.guid(), ativo: z.boolean() });

/**
 * Admin ativa/desativa a pessoa NO 6WLA. Não bane a conta no Auth: o login é
 * compartilhado com o PHD View, e banir lá tiraria a pessoa do outro app
 * também. O corte vale mesmo assim — `exigeUsuario` desloga quem tem perfil
 * inativo a cada requisição, e as funções de papel da RLS exigem `ativo`,
 * então nem uma sessão ainda válida lê ou grava nada do 6wla.
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

const contaAlvoSchema = z.object({ userId: z.guid() });

/** E-mail e nome de quem tem perfil no 6wla. O e-mail nunca vem do form. */
async function buscaAlvo(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("6wla_perfis")
    .select("id, email, nome")
    .eq("id", userId)
    .maybeSingle();
  return { alvo: data, error };
}

/**
 * Admin manda à pessoa um link para ela mesma criar uma senha nova. Vale
 * para qualquer conta, inclusive do PHD View: quem recebe o link é o dono do
 * e-mail, e ninguém além dele fica sabendo a senha. As sessões abertas não
 * são encerradas aqui (a função `6wla_encerra_sessoes` continua no banco,
 * sem uso).
 */
export async function enviaLinkSenha(form: FormData): Promise<Resultado> {
  const parsed = contaAlvoSchema.safeParse({ userId: form.get("userId") });
  if (!parsed.success) return falha("Dados inválidos");
  await exigeAdmin();

  const { alvo, error } = await buscaAlvo(parsed.data.userId);
  if (error) return erroInterno("usuarios.enviaLinkSenha.perfil", error);
  if (!alvo) return falha("Pessoa não encontrada no 6wla");
  const redirectTo = await urlDefinirSenha();
  if (!redirectTo)
    return erroInterno("usuarios.enviaLinkSenha.site", "origem desconhecida");

  const erroEnvio = await enviaLinkRedefinicao(alvo.email, redirectTo);
  if (erroEnvio) return erroInterno("usuarios.enviaLinkSenha", erroEnvio);
  return sucesso(undefined);
}

/**
 * Admin reenvia o convite de quem ainda não entrou. Se o Auth recusar o
 * convite (conta já confirmada, ex.: criada antes do convite por e-mail),
 * manda o link de redefinição, que leva à mesma tela de criar senha.
 */
export async function reenviaConvite(form: FormData): Promise<Resultado> {
  const parsed = contaAlvoSchema.safeParse({ userId: form.get("userId") });
  if (!parsed.success) return falha("Dados inválidos");
  await exigeAdmin();

  const admin = createAdminClient();
  const [{ alvo, error }, conta] = await Promise.all([
    buscaAlvo(parsed.data.userId),
    admin.auth.admin.getUserById(parsed.data.userId),
  ]);
  if (error) return erroInterno("usuarios.reenviaConvite.perfil", error);
  if (!alvo) return falha("Pessoa não encontrada no 6wla");
  if (conta.error)
    return erroInterno("usuarios.reenviaConvite.conta", conta.error);
  if (!convitePendente(conta.data.user))
    return falha(
      "Essa pessoa já entrou. Use “Enviar link para redefinir senha”.",
    );
  const redirectTo = await urlDefinirSenha();
  if (!redirectTo)
    return erroInterno("usuarios.reenviaConvite.site", "origem desconhecida");

  const convite = await enviaConvite(
    alvo.email,
    alvo.nome,
    APP_ORIGEM,
    redirectTo,
  );
  if (convite.ok) return sucesso(undefined);
  if (!convite.jaExiste)
    return erroInterno("usuarios.reenviaConvite.convite", convite.erro);

  const erroEnvio = await enviaLinkRedefinicao(alvo.email, redirectTo);
  if (erroEnvio)
    return erroInterno("usuarios.reenviaConvite.redefinicao", erroEnvio);
  return sucesso(undefined);
}
