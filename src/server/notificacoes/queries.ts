import "server-only";

import type { Cliente } from "@/server/auth";
import { SELECT_CONTAGEM_NAO_LIDAS } from "@/components/notificacoes/contagem";

/** Não lidas que a pessoa consegue abrir (mesmo filtro da lista). */
export async function contaNaoLidas(
  supabase: Cliente,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("6wla_notificacoes")
    .select(SELECT_CONTAGEM_NAO_LIDAS, { count: "exact", head: true })
    .eq("user_id", userId)
    .is("lida_em", null);
  if (error) {
    // Contador é acessório: loga e mostra zero em vez de derrubar o layout.
    console.error("[notificacoes.contaNaoLidas]", error);
    return 0;
  }
  return count ?? 0;
}

export const PAGINA_NOTIFICACOES = 30;
export const MAXIMO_NOTIFICACOES = 300;

/**
 * Notificações mais recentes, até `limite`. Busca uma a mais para saber se
 * existe próxima página sem uma segunda contagem.
 */
export async function listaNotificacoes(
  supabase: Cliente,
  userId: string,
  limite: number,
) {
  const { data, error } = await supabase
    .from("6wla_notificacoes")
    .select(
      "id, tipo, lida_em, criado_em, restricao:6wla_restricoes!inner(id, numero, descricao, obra_id, obra:6wla_obras(codigo, nome)), autor:6wla_perfis!6wla_notificacoes_autor_id_fkey(nome), comentario:6wla_restricao_comentarios(texto)",
    )
    .eq("user_id", userId)
    .order("criado_em", { ascending: false })
    .limit(limite + 1);
  if (error) throw new Error(`Falha ao listar notificações: ${error.message}`);
  return { itens: data.slice(0, limite), temMais: data.length > limite };
}

export type Notificacao = Awaited<
  ReturnType<typeof listaNotificacoes>
>["itens"][number];
