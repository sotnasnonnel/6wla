import "server-only";

import type { Cliente } from "@/server/auth";
import type { LinhaPainel } from "@/components/indicadores/painel";

/**
 * Carrega as restrições de uma obra no formato que o painel consome, com o
 * responsável já resolvido (usuário do sistema ou o texto que veio da
 * planilha). A obra é o contexto de trabalho: o painel não filtra por obra
 * porque nunca vê mais de uma.
 */
export async function linhasDaObra(
  supabase: Cliente,
  obraId: string,
): Promise<LinhaPainel[]> {
  const { data, error } = await supabase
    .from("6wla_restricoes")
    .select(
      "id, obra_id, numero, descricao, acao, status, data_criacao, data_limite, previsao_conclusao, data_conclusao, responsavel_nome, responsavel_id, area, setor, causa_6m, classificacao, atividade_impactada, responsavel:6wla_perfis!6wla_restricoes_responsavel_id_fkey(nome)",
    )
    .eq("obra_id", obraId)
    .order("numero");
  if (error) throw new Error(`Falha ao carregar indicadores: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    obra_id: r.obra_id,
    numero: r.numero,
    descricao: r.descricao,
    acao: r.acao,
    status: r.status,
    data_criacao: r.data_criacao,
    data_limite: r.data_limite,
    previsao_conclusao: r.previsao_conclusao,
    data_conclusao: r.data_conclusao,
    responsavel: r.responsavel?.nome ?? r.responsavel_nome,
    area: r.area,
    setor: r.setor,
    causa_6m: r.causa_6m,
    classificacao: r.classificacao,
    atividade_impactada: r.atividade_impactada,
  }));
}
