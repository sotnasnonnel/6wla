"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  erroInterno,
  exigeUsuario,
  falha,
  sucesso,
  type Resultado,
} from "@/server/auth";

export async function marcaLida(notificacaoId: string): Promise<Resultado> {
  const id = z.guid().safeParse(notificacaoId);
  if (!id.success) return falha("Identificador inválido");
  const { supabase, perfil } = await exigeUsuario();
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id.data)
    .eq("user_id", perfil.id);
  if (error) return erroInterno("notificacoes", error);
  revalidatePath("/notificacoes");
  return sucesso(undefined);
}

export async function marcaTodasLidas(): Promise<Resultado> {
  const { supabase, perfil } = await exigeUsuario();
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("user_id", perfil.id)
    .is("lida_em", null);
  if (error) return erroInterno("notificacoes", error);
  revalidatePath("/notificacoes");
  return sucesso(undefined);
}

/** Versões para `<form action>`: precisam devolver void. */
export async function marcaLidaForm(form: FormData): Promise<void> {
  await marcaLida(String(form.get("id") ?? ""));
}

export async function marcaTodasLidasForm(): Promise<void> {
  await marcaTodasLidas();
}
