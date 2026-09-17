import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CAMPOS_RESTRICAO_EMAIL } from "@/lib/automacoes/colunas";
import type { RestricaoComPerfil } from "@/lib/automacoes/email";
import { STATUS_ABERTOS } from "@/lib/restricoes/dominio";
import { todasAsPaginas } from "@/server/paginacao";

/**
 * Restrições abertas da obra no formato do e-mail, com o perfil do
 * responsável. Serve ao cliente do usuário (RLS; prévia e teste) e ao
 * service_role (API do n8n) — por isso recebe o cliente.
 */
export function restricoesAbertasParaEmail(
  supabase: SupabaseClient<Database>,
  obraId: string,
): Promise<RestricaoComPerfil[]> {
  const campos =
    `${CAMPOS_RESTRICAO_EMAIL}, responsavel:6wla_perfis!6wla_restricoes_responsavel_id_fkey(nome, email)` as const;
  return todasAsPaginas(
    (de, ate) =>
      supabase
        .from("6wla_restricoes")
        .select(campos)
        .eq("obra_id", obraId)
        .in("status", [...STATUS_ABERTOS])
        .order("numero")
        .range(de, ate),
    "Falha ao listar restrições para o e-mail",
  );
}
