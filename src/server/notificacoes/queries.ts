import "server-only";

import type { Cliente } from "@/server/auth";

export async function contaNaoLidas(
  supabase: Cliente,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("lida_em", null);
  return count ?? 0;
}

export async function listaNotificacoes(supabase: Cliente, userId: string) {
  const { data, error } = await supabase
    .from("notificacoes")
    .select(
      "id, tipo, lida_em, criado_em, restricao:restricoes!inner(id, numero, descricao, obra_id), autor:perfis!notificacoes_autor_id_fkey(nome), comentario:restricao_comentarios(texto)",
    )
    .eq("user_id", userId)
    .order("criado_em", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Falha ao listar notificações: ${error.message}`);
  return data;
}

export type Notificacao = Awaited<ReturnType<typeof listaNotificacoes>>[number];
