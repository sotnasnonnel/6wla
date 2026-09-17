import "server-only";

import { todasAsPaginas } from "@/server/paginacao";
import type { Cliente } from "@/server/auth";
import type { LinhaInsight } from "@/lib/restricoes/insights";

/**
 * Restrições da obra no formato das regras de insight. Consulta própria (e
 * não `linhasDaObra`) porque as regras precisam de `reprogramacoes` e
 * `atualizado_em`, e o painel de indicadores não tem por que carregá-los.
 * Texto livre (descrição, ação, observações) fica de fora: nenhuma regra usa.
 */
export async function linhasInsights(
  supabase: Cliente,
  obraId: string,
): Promise<LinhaInsight[]> {
  const data = await todasAsPaginas(
    (de, ate) =>
      supabase
        .from("6wla_restricoes")
        .select(
          "id, numero, status, data_criacao, data_limite, data_conclusao, responsavel_nome, area, setor, causa_6m, atualizado_em, reprogramacoes, responsavel:6wla_perfis!6wla_restricoes_responsavel_id_fkey(nome)",
        )
        .eq("obra_id", obraId)
        .order("numero")
        .range(de, ate),
    "Falha ao carregar insights",
  );

  return data.map((r) => ({
    id: r.id,
    numero: r.numero,
    status: r.status,
    data_criacao: r.data_criacao,
    data_limite: r.data_limite,
    data_conclusao: r.data_conclusao,
    // Mesmo nome que a tabela mostra, para o filtro por responsável bater.
    responsavel: r.responsavel?.nome ?? r.responsavel_nome,
    area: r.area,
    setor: r.setor,
    causa_6m: r.causa_6m,
    atualizado_em: r.atualizado_em,
    reprogramacoes: r.reprogramacoes,
  }));
}
