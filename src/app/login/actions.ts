"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    senha: z.string().min(8, "Use pelo menos 8 caracteres"),
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
  return { ok: true };
}
