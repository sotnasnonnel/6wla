import "server-only";

import type { Cliente } from "@/server/auth";

/** Automações da obra (a RLS só devolve para gestor da obra ou admin). */
export async function listaAutomacoes(supabase: Cliente, obraId: string) {
  const { data, error } = await supabase
    .from("6wla_automacoes")
    .select("*")
    .eq("obra_id", obraId)
    .order("criado_em");
  if (error) throw new Error(`Falha ao listar automações: ${error.message}`);
  return data;
}

/** Últimos envios das automações informadas, mais recentes primeiro. */
export async function listaEnvios(
  supabase: Cliente,
  automacaoIds: readonly string[],
  limite = 50,
) {
  if (automacaoIds.length === 0) return [];
  const { data, error } = await supabase
    .from("6wla_automacao_envios")
    .select(
      "id, automacao_id, agendado_para, status, destinatario, total_itens, erro, teste, criado_em, confirmado_em",
    )
    .in("automacao_id", [...automacaoIds])
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) throw new Error(`Falha ao listar envios: ${error.message}`);
  return data;
}
