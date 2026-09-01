import { describe, it, expect } from 'vitest';
import {
  normalizaChave,
  achaColuna,
  parseData,
  parseEmail,
  parseStatus,
  mapeiaLinha,
  estaAtrasada,
  type MapaColunas,
  type MapaStatus,
} from './mapa';

/**
 * Os dois mapas abaixo são os de verdade, extraídos dos workflows n8n de cada
 * obra. São eles que provam que o de-para aguenta a divergência entre planilhas.
 */
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

const MAPA_MROS: MapaColunas = {
  id: ['ID'],
  descricao: ['O QUÊ'],
  responsavel_nome: ['RESPONSÁVEL'],
  responsavel_email: ['E-mail'],
  data_limite: ['PRAZO PARA SOLUÇÃO'],
  setor: ['SETOR'],
  status: ['Status'],
};

const STATUS_PADRAO: MapaStatus = {
  Pendente: 'pendente',
  'No prazo': 'pendente',
  Atrasado: 'pendente',
  'Em tratativa': 'em_tratativa',
  Concluído: 'resolvida',
  Cancelado: 'cancelada',
};

describe('normalizaChave', () => {
  it('ignora acento, caixa e pontuação ao comparar nomes de coluna', () => {
    expect(normalizaChave('E-mail  Responsável')).toBe(normalizaChave('EMAIL RESPONSAVEL'));
    expect(normalizaChave('O QUÊ')).toBe('OQUE');
    expect(normalizaChave('Data limite de remoção')).toBe('DATALIMITEDEREMOCAO');
  });
});

describe('achaColuna', () => {
  it('acha a coluna real mesmo com acento e espaço diferentes', () => {
    const linha = { 'E-mail  Responsável ': 'a@b.com' };
    expect(achaColuna(linha, ['EMAIL RESPONSAVEL'])).toBe('E-mail  Responsável ');
  });

  it('devolve undefined quando nenhum alias bate', () => {
    expect(achaColuna({ Outra: 1 }, ['Restrição', 'O QUÊ'])).toBeUndefined();
  });
});

describe('parseData', () => {
  it('converte serial do Excel usando a época 1899-12-30', () => {
    // 45000 é 2023-03-15 no Excel; a época errada (1900-01-01) daria 2 dias a mais.
    expect(parseData(45000)).toBe('2023-03-15');
    expect(parseData(1)).toBe('1899-12-31');
  });

  it('aceita data brasileira em texto', () => {
    expect(parseData('05/09/2026')).toBe('2026-09-05');
    expect(parseData('5-9-2026')).toBe('2026-09-05');
  });

  it('rejeita número que claramente não é data', () => {
    expect(parseData(0)).toBeNull();
    expect(parseData(999999)).toBeNull();
  });

  it('rejeita data impossível em vez de normalizar em silêncio', () => {
    // O construtor Date transformaria 31/02 em 03/03 sem avisar.
    expect(parseData('31/02/2026')).toBeNull();
    expect(parseData('15/13/2026')).toBeNull();
  });

  it('devolve null para célula vazia', () => {
    expect(parseData('')).toBeNull();
    expect(parseData(null)).toBeNull();
    expect(parseData(undefined)).toBeNull();
  });
});

describe('parseEmail', () => {
  it('normaliza para minúsculas', () => {
    expect(parseEmail('  Lucas.Zacarias@PHDengenharia.eng.br ')).toBe(
      'lucas.zacarias@phdengenharia.eng.br'
    );
  });

  it('pega o primeiro válido quando a célula tem vários', () => {
    expect(parseEmail('a@b.com; c@d.com')).toBe('a@b.com');
    expect(parseEmail('sem-email, c@d.com')).toBe('c@d.com');
  });

  it('devolve null quando não há e-mail válido', () => {
    expect(parseEmail('a definir')).toBeNull();
    expect(parseEmail('')).toBeNull();
  });
});

describe('parseStatus', () => {
  it('traduz "No prazo" e "Atrasado" para pendente — atraso vira cálculo, não status', () => {
    expect(parseStatus('No prazo', STATUS_PADRAO)).toBe('pendente');
    expect(parseStatus('Atrasado', STATUS_PADRAO)).toBe('pendente');
  });

  it('ignora acento e caixa do valor da planilha', () => {
    expect(parseStatus('CONCLUIDO', STATUS_PADRAO)).toBe('resolvida');
    expect(parseStatus('  pendente  ', STATUS_PADRAO)).toBe('pendente');
  });

  it('devolve null para status desconhecido em vez de chutar', () => {
    expect(parseStatus('Aguardando cliente', STATUS_PADRAO)).toBeNull();
  });
});

describe('mapeiaLinha — planilha da IMCS', () => {
  const linha = {
    ID: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    Status: 'No prazo',
    Responsável: 'Silas Moreira',
    'E-mail Responsável': 'Silas.Moreira@phdengenharia.eng.br',
    Restrição: 'Falta liberação da fundação do eixo 4',
    Ação: 'Solicitar liberação à fiscalização',
    'Data de criação': 46000,
    'Data limite de remoção': 46010,
    'Atividade Impactada': 'Concretagem bloco B',
    Classificação: 'Projeto',
    Local: 'Eixo 4',
    Setor: 'Civil',
  };

  it('traduz todos os campos canônicos', () => {
    const r = mapeiaLinha(linha, MAPA_IMCS, STATUS_PADRAO, 7);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.restricao.id).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    expect(r.restricao.descricao).toBe('Falta liberação da fundação do eixo 4');
    expect(r.restricao.responsavel_email).toBe('silas.moreira@phdengenharia.eng.br');
    expect(r.restricao.status).toBe('pendente');
    expect(r.restricao.localizacao).toBe('Eixo 4');
    expect(r.restricao.linha_planilha).toBe(7);
    expect(r.restricao.extras).toEqual({});
  });
});

describe('mapeiaLinha — planilha da MROS', () => {
  const linha = {
    'O QUÊ': 'Liberar acesso ao pátio de montagem',
    RESPONSÁVEL: 'Diego Rodrigues',
    'E-mail': 'diego.rodrigues@phdengenharia.eng.br',
    'PRAZO PARA SOLUÇÃO': '10/09/2026',
    SETOR: 'Montagem',
    Status: 'Atrasado',
    ÁREA: 'Pátio',
    GERÊNCIA: 'McCain/Timenow',
    'DATA REPROGRAMAÇÃO': '20/09/2026',
  };

  it('mapeia colunas com nomes completamente diferentes da IMCS', () => {
    const r = mapeiaLinha(linha, MAPA_MROS, STATUS_PADRAO, 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.restricao.descricao).toBe('Liberar acesso ao pátio de montagem');
    expect(r.restricao.data_limite).toBe('2026-09-10');
    expect(r.restricao.status).toBe('pendente');
  });

  it('guarda em extras as colunas que só existem nessa obra', () => {
    const r = mapeiaLinha(linha, MAPA_MROS, STATUS_PADRAO, 3);
    if (!r.ok) throw new Error('esperava sucesso');

    expect(r.restricao.extras).toEqual({
      ÁREA: 'Pátio',
      GERÊNCIA: 'McCain/Timenow',
      'DATA REPROGRAMAÇÃO': '20/09/2026',
    });
  });

  it('não perde a linha quando a obra não tem coluna de ID ainda', () => {
    const semId = mapeiaLinha(linha, MAPA_MROS, STATUS_PADRAO, 3);
    if (!semId.ok) throw new Error('esperava sucesso');
    expect(semId.restricao.id).toBeNull();
  });

  it('descarta ID que não é UUID em vez de gravar lixo', () => {
    const r = mapeiaLinha({ ...linha, ID: 'linha 3' }, MAPA_MROS, STATUS_PADRAO, 3);
    if (!r.ok) throw new Error('esperava sucesso');
    expect(r.restricao.id).toBeNull();
  });
});

describe('mapeiaLinha — linhas ruins', () => {
  it('rejeita linha sem descrição sem derrubar a sincronização', () => {
    const r = mapeiaLinha({ Status: 'Pendente' }, MAPA_IMCS, STATUS_PADRAO, 12);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/descri/i);
    expect(r.linha_planilha).toBe(12);
  });

  it('aceita linha com campos opcionais faltando', () => {
    const r = mapeiaLinha({ Restrição: 'Só isso' }, MAPA_IMCS, STATUS_PADRAO, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.restricao.responsavel_email).toBeNull();
    expect(r.restricao.data_limite).toBeNull();
    expect(r.restricao.status).toBeNull();
  });
});

describe('estaAtrasada', () => {
  const hoje = new Date('2026-09-01T12:00:00Z');

  it('é atrasada quando o prazo passou e ainda está em aberto', () => {
    expect(estaAtrasada('2026-08-31', 'pendente', hoje)).toBe(true);
    expect(estaAtrasada('2026-08-31', 'em_tratativa', hoje)).toBe(true);
  });

  it('não é atrasada quando já foi resolvida ou cancelada', () => {
    expect(estaAtrasada('2026-08-31', 'resolvida', hoje)).toBe(false);
    expect(estaAtrasada('2026-08-31', 'cancelada', hoje)).toBe(false);
  });

  it('não é atrasada no próprio dia do prazo', () => {
    expect(estaAtrasada('2026-09-01', 'pendente', hoje)).toBe(false);
  });

  it('sem prazo não há atraso', () => {
    expect(estaAtrasada(null, 'pendente', hoje)).toBe(false);
  });
});
