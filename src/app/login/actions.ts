"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ipDaRequisicao, permite } from "@/server/limite";
import {
  marcaTrocaSenha,
  precisaTrocarSenha,
} from "@/server/admin/troca-senha";
import {
  enviaLinkRedefinicao,
  urlDefinirSenha,
} from "@/server/links-senha";

const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  senha: z.string().min(6, "Senha muito curta"),
  proximo: z.string().optional(),
});

export type EstadoLogin = { erro?: string };

export async function entrar(
  _estado: EstadoLogin,
  form: FormData,
): Promise<EstadoLogin> {
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    senha: form.get("senha"),
    proximo: form.get("proximo") ?? undefined,
  });
  if (!parsed.success)
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.senha,
  });
  if (error) return { erro: "E-mail ou senha incorretos" };

  // Só redireciona para caminho interno (evita open redirect, inclusive
  // variantes com barra invertida ou caractere de controle).
  const proximo = parsed.data.proximo ?? "";
  let destino = "/obras";
  if (/^\/[^/\\]/.test(proximo)) {
    const u = new URL(proximo, "https://interno.invalid");
    if (u.origin === "https://interno.invalid") destino = u.pathname + u.search;
  }
  redirect(destino);
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const trocaSenhaSchema = z
  .object({
    senha: z
      .string()
      .min(8, "Use pelo menos 8 caracteres")
      .max(72, "Use no máximo 72 caracteres"),
    confirma: z.string(),
  })
  .refine((v) => v.senha === v.confirma, {
    message: "As senhas não conferem",
    path: ["confirma"],
  });

export type EstadoSenha = { erro?: string; ok?: boolean };

export async function trocarSenha(
  _estado: EstadoSenha,
  form: FormData,
): Promise<EstadoSenha> {
  const parsed = trocaSenhaSchema.safeParse({
    senha: form.get("senha"),
    confirma: form.get("confirma"),
  });
  if (!parsed.success)
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.senha,
  });
  if (error) return { erro: "Não foi possível trocar a senha" };
  if (precisaTrocarSenha(user)) {
    const erroMarca = await marcaTrocaSenha(user, false);
    if (erroMarca) {
      console.error("[trocarSenha.marca]", erroMarca);
      return { erro: "Senha trocada, mas não foi possível liberar o acesso. Tente de novo." };
    }
    // Novo JWT já sem a marca: o banco nega tudo a um JWT que ainda a tenha.
    const { error: erroSessao } = await supabase.auth.refreshSession();
    if (erroSessao) {
      console.error("[trocarSenha.sessao]", erroSessao);
      return { erro: "Senha trocada. Saia e entre de novo com a nova senha." };
    }
    redirect("/obras");
  }
  return { ok: true };
}

/**
 * /definir-senha (convite ou "esqueci minha senha"): a sessão já foi aberta
 * pelo link no navegador. Troca a senha e entra no app.
 */
export async function definirSenha(
  estado: EstadoSenha,
  form: FormData,
): Promise<EstadoSenha> {
  const r = await trocarSenha(estado, form);
  if (r.ok) redirect("/obras");
  return r;
}

const esqueciSchema = z.object({
  email: z.email("E-mail inválido").transform((e) => e.toLowerCase()),
});

export type EstadoEsqueci = { erro?: string; enviado?: boolean };

/**
 * "Esqueci minha senha". Responde igual exista ou não a conta: senão a tela
 * vira um verificador de e-mails cadastrados. Falha do envio só vai para o
 * log, pelo mesmo motivo.
 */
export async function pedirLinkSenha(
  _estado: EstadoEsqueci,
  form: FormData,
): Promise<EstadoEsqueci> {
  const parsed = esqueciSchema.safeParse({ email: form.get("email") });
  if (!parsed.success)
    return { erro: parsed.error.issues[0]?.message ?? "E-mail inválido" };

  // Freio contra enxurrada de e-mails (a cota de envio é dividida com o PHD
  // View). Acima do limite a resposta é a mesma, para não virar oráculo.
  const ip = await ipDaRequisicao();
  const QUINZE_MIN = 15 * 60_000;
  if (
    !permite(`senha:ip:${ip}`, 5, QUINZE_MIN) ||
    !permite(`senha:email:${parsed.data.email}`, 3, QUINZE_MIN) ||
    // Teto da instância: segura mesmo quem troca de IP a cada pedido.
    !permite("senha:global", 30, QUINZE_MIN)
  ) {
    console.warn("[pedirLinkSenha.limite]", { ip });
    return { enviado: true };
  }

  const redirectTo = await urlDefinirSenha();
  if (!redirectTo) {
    console.error("[pedirLinkSenha.site]", "origem desconhecida");
    return { erro: "Não foi possível enviar agora. Tente de novo." };
  }
  const erro = await enviaLinkRedefinicao(parsed.data.email, redirectTo);
  if (erro) console.error("[pedirLinkSenha]", erro);
  return { enviado: true };
}
