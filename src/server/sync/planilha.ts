import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  mapeiaLinha,
  type LinhaPlanilha,
  type MapaColunas,
  type MapaStatus,
  type RestricaoMapeada,
} from '@/lib/planilha/mapa';
import { createAdminClient } from '@/server/admin/supabase';
import type { Database } from '@/lib/database.types';

type RestricaoInsert = Database['public']['Tables']['restricoes']['Insert'];

/**
 * Sincronização planilha -> banco.
 *
 * Regra que sustenta a propriedade dividida por campo: a planilha manda no
 * CADASTRO, o banco manda no ESTADO. Na prática, aqui:
 *
 *   - inserção: o status vem da planilha (é a carga inicial daquela linha);
 *   - atualização: o status da planilha é IGNORADO. Depois que a restrição
 *     existe, quem manda no status é o app. Sem isso, a leitura das 4x/dia
 *     desfaria o que a pessoa respondeu — o bug clássico desse tipo de sync.
 */

export type ResultadoSync = {
  inseridas: number;
  atualizadas: number;
  removidas: number;
  ignoradas: { linha: number; motivo: string }[];
  /** IDs que o n8n precisa gravar na coluna ID da planilha. */
  ids_para_gravar: { linha_planilha: number; id: string }[];
};

export async function sincronizaPlanilha(
  obraId: string,
  linhas: LinhaPlanilha[],
  mapaColunas: MapaColunas,
  mapaStatus: MapaStatus,
  /** Nº da primeira linha de dados na planilha, para o n8n saber onde escrever. */
  primeiraLinha = 2
): Promise<ResultadoSync> {
  const supabase = createAdminClient();

  const ignoradas: { linha: number; motivo: string }[] = [];
  const mapeadas: RestricaoMapeada[] = [];

  linhas.forEach((linha, i) => {
    const r = mapeiaLinha(linha, mapaColunas, mapaStatus, primeiraLinha + i);
    if (r.ok) mapeadas.push(r.restricao);
    else ignoradas.push({ linha: r.linha_planilha, motivo: r.motivo });
  });

  const existentes = await supabase
    .from('restricoes')
    .select('id')
    .eq('obra_id', obraId)
    .eq('removida_da_planilha', false);
  if (existentes.error) throw existentes.error;
  const idsNoBanco = new Set(existentes.data.map((r) => r.id));

  const agora = new Date().toISOString();
  const ids_para_gravar: { linha_planilha: number; id: string }[] = [];
  const paraInserir: RestricaoInsert[] = [];
  const paraAtualizar: RestricaoInsert[] = [];
  const vistos = new Set<string>();

  for (const r of mapeadas) {
    // Linha sem ID, ou com ID que o banco não conhece: é restrição nova.
    // Geramos o UUID aqui e devolvemos para o n8n gravar na planilha — é assim
    // que a coluna ID se preenche sozinha, sem ninguém digitar.
    const conhecido = r.id !== null && idsNoBanco.has(r.id);
    const id = conhecido ? r.id! : (r.id ?? randomUUID());

    if (vistos.has(id)) {
      ignoradas.push({ linha: r.linha_planilha, motivo: `ID duplicado na planilha: ${id}` });
      continue;
    }
    vistos.add(id);

    const cadastro: RestricaoInsert = {
      id,
      obra_id: obraId,
      descricao: r.descricao,
      acao: r.acao,
      responsavel_nome: r.responsavel_nome,
      responsavel_email: r.responsavel_email,
      data_criacao: r.data_criacao,
      data_limite: r.data_limite,
      atividade_impactada: r.atividade_impactada,
      classificacao: r.classificacao,
      localizacao: r.localizacao,
      setor: r.setor,
      extras: r.extras,
      linha_planilha: r.linha_planilha,
      removida_da_planilha: false,
      sincronizado_em: agora,
    };

    if (conhecido) {
      // Sem `status`: depois de existir, o estado é do banco.
      paraAtualizar.push(cadastro);
    } else {
      paraInserir.push({ ...cadastro, status: r.status ?? 'pendente' });
      if (r.id === null) ids_para_gravar.push({ linha_planilha: r.linha_planilha, id });
    }
  }

  if (paraInserir.length > 0) {
    const { error } = await supabase.from('restricoes').insert(paraInserir);
    if (error) throw error;
  }

  if (paraAtualizar.length > 0) {
    // upsert com os mesmos ids: atualiza só as colunas enviadas.
    const { error } = await supabase.from('restricoes').upsert(paraAtualizar, { onConflict: 'id' });
    if (error) throw error;
  }

  // Sumiu da planilha: marca, não apaga. Apagar levaria junto o histórico de
  // quem respondeu — e uma linha some por engano com facilidade (filtro, corte).
  const sumidas = [...idsNoBanco].filter((id) => !vistos.has(id));
  if (sumidas.length > 0) {
    const { error } = await supabase
      .from('restricoes')
      .update({ removida_da_planilha: true, sincronizado_em: agora })
      .in('id', sumidas);
    if (error) throw error;
  }

  return {
    inseridas: paraInserir.length,
    atualizadas: paraAtualizar.length,
    removidas: sumidas.length,
    ignoradas,
    ids_para_gravar,
  };
}

/**
 * Fila da escrita de volta: o que mudou no app e ainda não foi gravado na
 * planilha. O n8n consome, escreve na coluna Status da linha e confirma.
 */
export async function statusPendentesDeEscrita(obraId: string) {
  const supabase = createAdminClient();

  // Comparacao entre duas colunas: so a funcao no banco expressa isso.
  const { data, error } = await supabase.rpc('restricoes_pendentes_escrita', {
    p_obra: obraId,
  });

  if (error) throw error;
  return data;
}

/**
 * Confirma o que o n8n conseguiu gravar. Só marca as linhas cujo status não
 * mudou de novo enquanto a gravação acontecia — senão a alteração mais recente
 * seria considerada já escrita e nunca chegaria à planilha.
 */
export async function confirmaEscrita(
  ids: string[],
  escritoEm: string
): Promise<{ confirmadas: number }> {
  if (ids.length === 0) return { confirmadas: 0 };
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('restricoes')
    .update({ status_escrito_em: escritoEm })
    .in('id', ids)
    .lte('status_alterado_em', escritoEm)
    .select('id');

  if (error) throw error;
  return { confirmadas: data.length };
}
