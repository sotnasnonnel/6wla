import type { Tables } from "@/lib/database.types";
import type { ColunaXlsx, ValorCelula } from "@/lib/exportacao/xlsx";
import {
  PRIORIDADE_ROTULO,
  STATUS_ROTULO,
  formataNumero,
  hojeIso,
} from "./dominio";
import { SITUACAO_ROTULO, situacaoDe, tempoAtraso } from "./indicadores";

type Restricao = Tables<"restricoes">;

/**
 * De-para da tabela da tela para a planilha exportada. As chaves são os ids
 * das colunas da grade — assim "exportar" devolve exatamente as colunas que a
 * pessoa está vendo, na ordem em que ela as vê.
 *
 * O que sai daqui é para humano abrir no Excel: status vira rótulo, não enum;
 * responsável vira nome, não uuid; data vai como data, não texto.
 */
type Definicao = {
  cabecalho: string;
  tipo: ColunaXlsx["tipo"];
  largura?: number;
  valor: (r: Restricao, ctx: Contexto) => ValorCelula;
};

type Contexto = { nomePorId: Map<string, string>; hoje: string };

const nomeResponsavel = (r: Restricao, ctx: Contexto): string | null =>
  (r.responsavel_id ? ctx.nomePorId.get(r.responsavel_id) : null) ??
  r.responsavel_nome;

export const COLUNAS_PLANILHA: Record<string, Definicao> = {
  numero: {
    cabecalho: "Nº",
    tipo: "texto",
    largura: 10,
    valor: (r) => formataNumero(r.numero),
  },
  status: {
    cabecalho: "Status",
    tipo: "texto",
    valor: (r) => STATUS_ROTULO[r.status],
  },
  prioridade: {
    cabecalho: "Prioridade",
    tipo: "texto",
    valor: (r) => PRIORIDADE_ROTULO[r.prioridade],
  },
  descricao: {
    cabecalho: "Restrição",
    tipo: "texto",
    largura: 50,
    valor: (r) => r.descricao,
  },
  acao: { cabecalho: "Ação", tipo: "texto", largura: 40, valor: (r) => r.acao },
  responsavel: {
    cabecalho: "Responsável",
    tipo: "texto",
    largura: 24,
    valor: nomeResponsavel,
  },
  data_limite: {
    cabecalho: "Prazo",
    tipo: "data",
    valor: (r) => r.data_limite,
  },
  previsao_conclusao: {
    cabecalho: "Previsão",
    tipo: "data",
    valor: (r) => r.previsao_conclusao,
  },
  data_conclusao: {
    cabecalho: "Concluída em",
    tipo: "data",
    valor: (r) => r.data_conclusao,
  },
  causa_6m: { cabecalho: "Causa 6M", tipo: "texto", valor: (r) => r.causa_6m },
  classificacao: {
    cabecalho: "Classificação",
    tipo: "texto",
    largura: 24,
    valor: (r) => r.classificacao,
  },
  area: { cabecalho: "Área", tipo: "texto", valor: (r) => r.area },
  setor: { cabecalho: "Setor", tipo: "texto", valor: (r) => r.setor },
  localizacao: {
    cabecalho: "Local",
    tipo: "texto",
    valor: (r) => r.localizacao,
  },
  atividade_impactada: {
    cabecalho: "Atividade impactada",
    tipo: "texto",
    largura: 30,
    valor: (r) => r.atividade_impactada,
  },
  id_atividade: {
    cabecalho: "ID atividade",
    tipo: "texto",
    valor: (r) => r.id_atividade,
  },
  inicio_atividade: {
    cabecalho: "Início atividade",
    tipo: "data",
    valor: (r) => r.inicio_atividade,
  },
  semana_programada: {
    cabecalho: "Semana",
    tipo: "texto",
    valor: (r) => r.semana_programada,
  },
  descricao_status: {
    cabecalho: "Situação (texto)",
    tipo: "texto",
    largura: 30,
    valor: (r) => r.descricao_status,
  },
  observacoes: {
    cabecalho: "Observações",
    tipo: "texto",
    largura: 40,
    valor: (r) => r.observacoes,
  },
  codigo: { cabecalho: "Cód. planilha", tipo: "texto", valor: (r) => r.codigo },
  responsavel_email: {
    cabecalho: "E-mail resp.",
    tipo: "texto",
    largura: 28,
    valor: (r) => r.responsavel_email,
  },
  responsavel_telefone: {
    cabecalho: "Telefone",
    tipo: "texto",
    valor: (r) => r.responsavel_telefone,
  },
  data_criacao: {
    cabecalho: "Criada em",
    tipo: "data",
    valor: (r) => r.data_criacao,
  },
  reprogramacoes: {
    cabecalho: "Reprogramações",
    tipo: "numero",
    valor: (r) => r.reprogramacoes,
  },
};

/**
 * Duas colunas que não existem na tela mas todo relatório acaba precisando:
 * a situação calculada (a coluna que a planilha antiga preenchia à mão) e o
 * atraso em dias. Vão sempre no fim, independentemente das colunas visíveis.
 */
const CALCULADAS: Definicao[] = [
  {
    cabecalho: "Situação (calculada)",
    tipo: "texto",
    largura: 22,
    valor: (r, ctx) => SITUACAO_ROTULO[situacaoDe(r, ctx.hoje)],
  },
  {
    cabecalho: "Dias de atraso",
    tipo: "numero",
    valor: (r, ctx) => tempoAtraso(r, ctx.hoje),
  },
];

/**
 * Monta cabeçalhos e células para `geraXlsx`. `ids` são as colunas visíveis da
 * grade, na ordem; id desconhecido é ignorado (a grade pode ganhar coluna sem
 * derrubar a exportação).
 */
export function planilhaDeRestricoes(
  restricoes: Restricao[],
  ids: string[],
  opcoes: { nomePorId?: Map<string, string>; hoje?: string } = {},
): { colunas: ColunaXlsx[]; linhas: ValorCelula[][] } {
  const ctx: Contexto = {
    nomePorId: opcoes.nomePorId ?? new Map(),
    hoje: opcoes.hoje ?? hojeIso(),
  };
  const definicoes = [
    ...ids.map((id) => COLUNAS_PLANILHA[id]).filter((d): d is Definicao => !!d),
    ...CALCULADAS,
  ];
  return {
    colunas: definicoes.map((d) => ({
      cabecalho: d.cabecalho,
      tipo: d.tipo,
      ...(d.largura === undefined ? {} : { largura: d.largura }),
    })),
    linhas: restricoes.map((r) => definicoes.map((d) => d.valor(r, ctx))),
  };
}
