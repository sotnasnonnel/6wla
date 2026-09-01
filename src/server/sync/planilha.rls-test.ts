import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { sincronizaPlanilha, statusPendentesDeEscrita, confirmaEscrita } from './planilha';
import type { MapaColunas, MapaStatus } from '@/lib/planilha/mapa';

/**
 * Ciclo completo planilha -> banco -> planilha, contra o Supabase local.
 *
 * É o teste que prova a parte que nunca existiu no processo atual: hoje nenhum
 * workflow do n8n escreve em lugar nenhum.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Mapa real da IMCS, extraído do workflow n8n `IMCS-CT09-PLAN - Restrições`. */
const MAPA_IMCS: MapaColunas = {
  id: ['ID'],
  descricao: ['Restrição'],
  acao: ['Ação'],
  responsavel_nome: ['Responsável'],
  responsavel_email: ['E-mail Responsável'],
  data_criacao: ['Data de criação'],
  data_limite: ['Data limite de remoção'],
  atividade_impactada: ['Atividade Impactada'],
  classificacao: ['Classificação'],
  localizacao: ['Local'],
  setor: ['Setor'],
  status: ['Status'],
};

const MAPA_STATUS: MapaStatus = {
  Pendente: 'pendente',
  'No prazo': 'pendente',
  Atrasado: 'pendente',
  Concluído: 'resolvida',
};

/** A IMCS descarta 2 linhas e usa a 3ª como cabeçalho: dados começam na 4. */
const PRIMEIRA_LINHA = 4;

function linha(descricao: string, extra: Record<string, unknown> = {}) {
  return {
    Status: 'No prazo',
    Responsável: 'Silas Moreira',
    'E-mail Responsável': 'silas.moreira@phdengenharia.eng.br',
    Restrição: descricao,
    Ação: 'Tratar com a fiscalização',
    'Data limite de remoção': 46010,
    Setor: 'Civil',
    ...extra,
  };
}

let obraId: string;
const sufixo = Date.now();

beforeAll(async () => {
  const { data, error } = await admin
    .from('obras')
    .insert({ codigo: `IMCS-SYNC-${sufixo}`, nome: 'IMCS sincronizacao' })
    .select('id')
    .single();
  if (error) throw error;
  obraId = data.id;
}, 60_000);

afterAll(async () => {
  await admin.from('obras').delete().eq('id', obraId);
});

describe('primeira carga', () => {
  it('insere as linhas e devolve os IDs para o n8n gravar na coluna ID', async () => {
    const r = await sincronizaPlanilha(
      obraId,
      [linha('Liberar fundacao do eixo 4'), linha('Aprovar projeto eletrico')],
      MAPA_IMCS,
      MAPA_STATUS,
      PRIMEIRA_LINHA
    );

    expect(r.inseridas).toBe(2);
    expect(r.atualizadas).toBe(0);
    // A planilha ainda não tem coluna ID: os dois UUIDs voltam para serem escritos.
    expect(r.ids_para_gravar).toHaveLength(2);
    expect(r.ids_para_gravar[0].linha_planilha).toBe(4);
    expect(r.ids_para_gravar[1].linha_planilha).toBe(5);
  });

  it('usa o status da planilha na carga inicial', async () => {
    const { data } = await admin.from('restricoes').select('status').eq('obra_id', obraId);
    expect(data?.every((r) => r.status === 'pendente')).toBe(true);
  });

  it('ignora linha sem descricao sem derrubar as demais', async () => {
    const r = await sincronizaPlanilha(
      obraId,
      [linha('Liberar fundacao do eixo 4'), { Status: 'No prazo' }],
      MAPA_IMCS,
      MAPA_STATUS,
      PRIMEIRA_LINHA
    );
    expect(r.ignoradas).toHaveLength(1);
    expect(r.ignoradas[0].linha).toBe(5);
  });
});

describe('a planilha nao desfaz o que foi respondido no app', () => {
  let id: string;

  beforeAll(async () => {
    await admin.from('restricoes').delete().eq('obra_id', obraId);
    const r = await sincronizaPlanilha(
      obraId,
      [linha('Restricao que sera respondida')],
      MAPA_IMCS,
      MAPA_STATUS,
      PRIMEIRA_LINHA
    );
    id = r.ids_para_gravar[0].id;

    // A pessoa responde no app.
    await admin.from('restricoes').update({ status: 'resolvida' }).eq('id', id);
  });

  it('mantem o status do app mesmo com a planilha ainda dizendo "No prazo"', async () => {
    // Agora a planilha já tem o ID gravado, e o Status dela continua desatualizado.
    await sincronizaPlanilha(
      obraId,
      [linha('Restricao que sera respondida', { ID: id, Status: 'No prazo' })],
      MAPA_IMCS,
      MAPA_STATUS,
      PRIMEIRA_LINHA
    );

    const { data } = await admin.from('restricoes').select('status').eq('id', id).single();
    // Se isto virasse 'pendente', a leitura das 4x/dia estaria apagando as
    // respostas das pessoas todo dia — o bug clássico deste tipo de sync.
    expect(data?.status).toBe('resolvida');
  });

  it('mas atualiza o cadastro, que continua sendo da planilha', async () => {
    await sincronizaPlanilha(
      obraId,
      [
        linha('Descricao corrigida pelo planejamento', {
          ID: id,
          'Data limite de remoção': 46020,
        }),
      ],
      MAPA_IMCS,
      MAPA_STATUS,
      PRIMEIRA_LINHA
    );

    const { data } = await admin
      .from('restricoes')
      .select('descricao, data_limite, status')
      .eq('id', id)
      .single();

    expect(data?.descricao).toBe('Descricao corrigida pelo planejamento');
    expect(data?.status).toBe('resolvida');
  });
});

describe('linha some da planilha', () => {
  it('marca como removida em vez de apagar, preservando o historico', async () => {
    await admin.from('restricoes').delete().eq('obra_id', obraId);
    const carga = await sincronizaPlanilha(
      obraId,
      [linha('Some depois'), linha('Continua')],
      MAPA_IMCS,
      MAPA_STATUS,
      PRIMEIRA_LINHA
    );
    const idQueSome = carga.ids_para_gravar[0].id;
    const idQueFica = carga.ids_para_gravar[1].id;

    const r = await sincronizaPlanilha(
      obraId,
      [linha('Continua', { ID: idQueFica })],
      MAPA_IMCS,
      MAPA_STATUS,
      PRIMEIRA_LINHA
    );

    expect(r.removidas).toBe(1);

    const { data } = await admin
      .from('restricoes')
      .select('id, removida_da_planilha')
      .eq('id', idQueSome)
      .single();

    expect(data).not.toBeNull();
    expect(data?.removida_da_planilha).toBe(true);
  });
});

describe('ID duplicado na planilha', () => {
  it('processa a primeira e reporta a segunda em vez de sobrescrever', async () => {
    await admin.from('restricoes').delete().eq('obra_id', obraId);
    const carga = await sincronizaPlanilha(
      obraId,
      [linha('Original')],
      MAPA_IMCS,
      MAPA_STATUS,
      PRIMEIRA_LINHA
    );
    const id = carga.ids_para_gravar[0].id;

    const r = await sincronizaPlanilha(
      obraId,
      [linha('Original', { ID: id }), linha('Copiada com o mesmo ID', { ID: id })],
      MAPA_IMCS,
      MAPA_STATUS,
      PRIMEIRA_LINHA
    );

    expect(r.ignoradas).toHaveLength(1);
    expect(r.ignoradas[0].motivo).toMatch(/duplicado/i);
  });
});

describe('escrita de volta na planilha', () => {
  let id: string;

  beforeAll(async () => {
    await admin.from('restricoes').delete().eq('obra_id', obraId);
    const carga = await sincronizaPlanilha(
      obraId,
      [linha('Para escrever de volta')],
      MAPA_IMCS,
      MAPA_STATUS,
      PRIMEIRA_LINHA
    );
    id = carga.ids_para_gravar[0].id;
  });

  it('logo apos a carga ja ha algo a escrever (o status inicial)', async () => {
    const fila = await statusPendentesDeEscrita(obraId);
    expect(fila.map((f) => f.id)).toContain(id);
    expect(fila[0].linha_planilha).toBe(4);
  });

  it('depois de confirmada, a linha sai da fila', async () => {
    const escritoEm = new Date().toISOString();
    const { confirmadas } = await confirmaEscrita([id], escritoEm);
    expect(confirmadas).toBe(1);

    const fila = await statusPendentesDeEscrita(obraId);
    expect(fila.map((f) => f.id)).not.toContain(id);
  });

  it('uma nova resposta no app recoloca a linha na fila', async () => {
    await admin.from('restricoes').update({ status: 'em_tratativa' }).eq('id', id);

    const fila = await statusPendentesDeEscrita(obraId);
    expect(fila.map((f) => f.id)).toContain(id);
    expect(fila.find((f) => f.id === id)?.status).toBe('em_tratativa');
  });

  it('nao perde a resposta que chegou enquanto a gravacao acontecia', async () => {
    // O n8n leu a fila neste instante...
    const lidoEm = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 20));

    // ...e a pessoa respondeu de novo ANTES de a confirmacao chegar.
    await admin.from('restricoes').update({ status: 'resolvida' }).eq('id', id);

    const { confirmadas } = await confirmaEscrita([id], lidoEm);
    expect(confirmadas).toBe(0);

    // A alteracao mais recente continua na fila; nao foi dada como escrita.
    const fila = await statusPendentesDeEscrita(obraId);
    expect(fila.find((f) => f.id === id)?.status).toBe('resolvida');
  });

  it('nao devolve linha que sumiu da planilha', async () => {
    await admin.from('restricoes').update({ removida_da_planilha: true }).eq('id', id);
    const fila = await statusPendentesDeEscrita(obraId);
    expect(fila.map((f) => f.id)).not.toContain(id);
  });
});
