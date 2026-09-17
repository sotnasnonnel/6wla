"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
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
    .from("6wla_notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id.data)
    .eq("user_id", perfil.id);
  if (error) return erroInterno("notificacoes", error);
  revalidatePath("/notificacoes");
  return sucesso(undefined);
}

/**
 * Abrir uma notificação: marca como lida e leva à restrição. O destino sai do
 * banco (RLS + dono), nunca do cliente, então não há redirect aberto.
 */
export async function abreNotificacao(
  notificacaoId: string,
): Promise<Resultado> {
  const id = z.guid().safeParse(notificacaoId);
  if (!id.success) return falha("Identificador inválido");
  const { supabase, perfil } = await exigeUsuario();
  const { data, error } = await supabase
    .from("6wla_notificacoes")
    .select("id, lida_em, restricao:6wla_restricoes!inner(id, obra_id)")
    .eq("id", id.data)
    .eq("user_id", perfil.id)
    .maybeSingle();
  if (error) return erroInterno("notificacoes.abre", error);
  if (!data) return falha("Essa restrição não está mais disponível para você.");

  if (!data.lida_em) {
    const { error: erroMarca } = await supabase
      .from("6wla_notificacoes")
      .update({ lida_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", perfil.id);
    // Não marcar como lida não impede de abrir: só loga.
    if (erroMarca) console.error("[notificacoes.abre.marca]", erroMarca);
    else revalidatePath("/notificacoes");
  }
  redirect(`/obras/${data.restricao.obra_id}/restricoes/${data.restricao.id}`);
}

export async function marcaTodasLidas(): Promise<Resultado> {
  const { supabase, perfil } = await exigeUsuario();
  const { error } = await supabase
    .from("6wla_notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("user_id", perfil.id)
    .is("lida_em", null);
  if (error) return erroInterno("notificacoes", error);
  revalidatePath("/notificacoes");
  return sucesso(undefined);
}

/** Versão para `<form action>`: precisa devolver void. */
export async function marcaTodasLidasForm(): Promise<void> {
  await marcaTodasLidas();
}
