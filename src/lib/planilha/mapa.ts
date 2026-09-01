import { z } from 'zod';

/**
 * Tradução de uma linha da aba `6WLA` para o formato canônico do banco.
 *
 * As planilhas divergem entre obras — IMCS usa `Restrição`/`Ação`/`Data limite
 * de remoção`, MROS usa `O QUÊ`/`PRAZO PARA SOLUÇÃO`/`ÁREA`/`GERÊNCIA` — e a
 * decisão de projeto foi NÃO renomear coluna nenhuma. Então cada obra carrega
 * um de-para (`obra_fontes.mapa_colunas`) e este módulo o aplica.
 *
 * Toda a lógica aqui é pura: nada de rede, nada de banco. É o que permite
 * testar o caso torto de cada obra sem subir nada.
 */

export const STATUS = ['pendente', 'em_tratativa', 'resolvida', 'cancelada'] as const;
export type Status = (typeof STATUS)[number];

/** Campos canônicos que o banco conhece. O resto da linha vai para `extras`. */
export const CAMPOS_CANONICOS = [
  'id',
  'descricao',
  'acao',
  'responsavel_nome',
  'responsavel_email',
  'data_criacao',
  'data_limite',
  'atividade_impactada',
  'classificacao',
  'localizacao',
  'setor',
  'status',
] as const;
export type CampoCanonico = (typeof CAMPOS_CANONICOS)[number];

/** `{ descricao: ['Restrição', 'O QUÊ'], data_limite: ['Data limite de remoção'] }` */
export type MapaColunas = Partial<Record<CampoCanonico, string[]>>;

/** `{ 'no prazo': 'pendente', 'atrasado': 'pendente', 'ok': 'resolvida' }` */
export type MapaStatus = Record<string, Status>;

export type LinhaPlanilha = Record<string, unknown>;

/**
 * Chave normalizada para comparação: sem acento, sem pontuação, caixa alta,
 * espaços colapsados. `"E-mail  Responsável"` e `"EMAIL RESPONSAVEL"` batem.
 */
export function normalizaChave(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Remove separadores por completo, em vez de trocar por espaco: senao
    // "E-mail Responsavel" vira "E MAIL RESPONSAVEL" e deixa de casar com
    // "EMAIL RESPONSAVEL" - que e justamente o alias usado na IMCS.
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();
}

/** Acha a chave real da linha que corresponde a algum dos aliases. */
export function achaColuna(linha: LinhaPlanilha, aliases: string[]): string | undefined {
  const alvos = new Set(aliases.map(normalizaChave));
  return Object.keys(linha).find((chave) => alvos.has(normalizaChave(chave)));
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s.length > 0 ? s : null;
}

/**
 * Datas chegam do xlsx como serial do Excel (número de dias desde 1899-12-30,
 * por causa do bug de ano bissexto de 1900 que a Microsoft manteve) ou como
 * texto em dd/mm/aaaa. Devolve ISO `aaaa-mm-dd`, que é o que o Postgres espera.
 */
export function parseData(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    // Serial fora de 1900-2200 quase certamente não é data — é ID ou quantidade.
    if (valor < 1 || valor > 120000) return null;
    const ms = Math.round(valor) * 86400000;
    const base = Date.UTC(1899, 11, 30);
    return new Date(base + ms).toISOString().slice(0, 10);
  }

  const s = String(valor).trim();

  const brasileira = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s);
  if (brasileira) {
    const [, d, m, a] = brasileira;
    return montaIso(Number(a), Number(m), Number(d));
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const [, a, m, d] = iso;
    return montaIso(Number(a), Number(m), Number(d));
  }

  return null;
}

function montaIso(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  // Rejeita 31/02: o Date normaliza em silêncio para 03/03.
  if (data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return data.toISOString().slice(0, 10);
}

const emailSchema = z.email();

/** Uma célula de e-mail pode trazer vários separados por `;` ou `,`. */
export function parseEmail(valor: unknown): string | null {
  const bruto = texto(valor);
  if (!bruto) return null;
  for (const parte of bruto.split(/[;,]/)) {
    const candidato = parte.trim().toLowerCase();
    if (emailSchema.safeParse(candidato).success) return candidato;
  }
  return null;
}

/**
 * Traduz o status da planilha para o enum do banco.
 *
 * "No prazo" e "Atrasado" NÃO são status no nosso modelo — são função da data
 * limite. Na planilha eles ocupam a mesma coluna do andamento, e é por isso que
 * cada obra filtra um conjunto diferente. Aqui os dois viram `pendente`, e o
 * atraso passa a ser calculado.
 */
export function parseStatus(valor: unknown, mapa: MapaStatus): Status | null {
  const bruto = texto(valor);
  if (!bruto) return null;
  const chave = normalizaChave(bruto);

  for (const [origem, destino] of Object.entries(mapa)) {
    if (normalizaChave(origem) === chave) return destino;
  }
  return null;
}

const uuidSchema = z.uuid();

export type RestricaoMapeada = {
  id: string | null;
  descricao: string;
  acao: string | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
  data_criacao: string | null;
  data_limite: string | null;
  atividade_impactada: string | null;
  classificacao: string | null;
  localizacao: string | null;
  setor: string | null;
  status: Status | null;
  extras: Record<string, string>;
  linha_planilha: number;
};

export type ResultadoMapa =
  | { ok: true; restricao: RestricaoMapeada }
  | { ok: false; motivo: string; linha_planilha: number };

/**
 * Mapeia uma linha. Devolve erro em vez de lançar: uma célula torta numa obra
 * não pode derrubar a sincronização das outras 20 linhas.
 */
export function mapeiaLinha(
  linha: LinhaPlanilha,
  mapaColunas: MapaColunas,
  mapaStatus: MapaStatus,
  numeroLinha: number
): ResultadoMapa {
  const pega = (campo: CampoCanonico): unknown => {
    const aliases = mapaColunas[campo];
    if (!aliases || aliases.length === 0) return undefined;
    const chave = achaColuna(linha, aliases);
    return chave === undefined ? undefined : linha[chave];
  };

  const descricao = texto(pega('descricao'));
  if (!descricao) {
    return { ok: false, motivo: 'linha sem descrição', linha_planilha: numeroLinha };
  }

  const idBruto = texto(pega('id'));
  const id = idBruto && uuidSchema.safeParse(idBruto).success ? idBruto : null;

  // Colunas que aquela obra tem e não têm campo canônico (ÁREA, GERÊNCIA...).
  const usadas = new Set<string>();
  for (const campo of CAMPOS_CANONICOS) {
    const aliases = mapaColunas[campo];
    if (!aliases) continue;
    const chave = achaColuna(linha, aliases);
    if (chave) usadas.add(chave);
  }

  const extras: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(linha)) {
    if (usadas.has(chave)) continue;
    const v = texto(valor);
    if (v) extras[chave] = v;
  }

  return {
    ok: true,
    restricao: {
      id,
      descricao,
      acao: texto(pega('acao')),
      responsavel_nome: texto(pega('responsavel_nome')),
      responsavel_email: parseEmail(pega('responsavel_email')),
      data_criacao: parseData(pega('data_criacao')),
      data_limite: parseData(pega('data_limite')),
      atividade_impactada: texto(pega('atividade_impactada')),
      classificacao: texto(pega('classificacao')),
      localizacao: texto(pega('localizacao')),
      setor: texto(pega('setor')),
      status: parseStatus(pega('status'), mapaStatus),
      extras,
      linha_planilha: numeroLinha,
    },
  };
}

/** Está atrasada? Mesma regra do `public.restricao_atrasada` no banco. */
export function estaAtrasada(
  dataLimite: string | null,
  status: Status,
  hoje = new Date()
): boolean {
  if (!dataLimite) return false;
  if (status !== 'pendente' && status !== 'em_tratativa') return false;
  return dataLimite < hoje.toISOString().slice(0, 10);
}
