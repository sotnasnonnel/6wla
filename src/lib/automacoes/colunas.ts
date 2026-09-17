import type { Tables } from "@/lib/database.types";
import {
  diasParaPrazo,
  formataNumero,
  PRIORIDADE_ROTULO,
  STATUS_ROTULO,
} from "@/lib/restricoes/dominio";

/**
 * Catálogo das colunas que um relatório por e-mail pode mostrar. A chave é o
 * que fica gravado em `6wla_automacoes.colunas`; o rótulo vai no cabeçalho
 * da tabela; `valor` devolve o texto (sem HTML — quem monta o e-mail escapa).
 */

/** Campos da restrição que o e-mail usa (a consulta pede só estes). */
export type RestricaoEmail = Pick<
  Tables<"6wla_restricoes">,
  | "id"
  | "numero"
  | "codigo"
  | "descricao"
  | "acao"
  | "status"
  | "prioridade"
  | "data_criacao"
  | "data_limite"
  | "prazo_original"
  | "previsao_conclusao"
  | "data_conclusao"
  | "atividade_impactada"
  | "id_atividade"
  | "inicio_atividade"
  | "classificacao"
  | "localizacao"
  | "setor"
  | "area"
  | "causa_6m"
  | "descricao_status"
  | "observacoes"
  | "semana_programada"
  | "responsavel_id"
  | "responsavel_nome"
  | "responsavel_email"
>;

/** Colunas pedidas ao banco para montar o e-mail. */
export const CAMPOS_RESTRICAO_EMAIL =
  "id, numero, codigo, descricao, acao, status, prioridade, data_criacao, data_limite, prazo_original, previsao_conclusao, data_conclusao, atividade_impactada, id_atividade, inicio_atividade, classificacao, localizacao, setor, area, causa_6m, descricao_status, observacoes, semana_programada, responsavel_id, responsavel_nome, responsavel_email";

/** Restrição já com o nome do responsável resolvido (perfil ou texto). */
export type LinhaEmail = RestricaoEmail & { responsavelExibido: string };

/** `2026-09-03` → `03-09-2026` (formato do relatório original). */
export function dataEmail(iso: string | null | undefined): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}-${mes}-${ano}`;
}

const texto = (v: string | null) => v ?? "";

type DefColuna = {
  rotulo: string;
  valor: (r: LinhaEmail, hoje: string) => string;
};

const CATALOGO = {
  descricao: { rotulo: "Restrição", valor: (r) => r.descricao },
  acao: { rotulo: "Ação", valor: (r) => texto(r.acao) },
  data_criacao: {
    rotulo: "Data de criação",
    valor: (r) => dataEmail(r.data_criacao),
  },
  data_limite: {
    rotulo: "Data limite de remoção",
    valor: (r) => dataEmail(r.data_limite),
  },
  atividade_impactada: {
    rotulo: "Atividade impactada",
    valor: (r) => texto(r.atividade_impactada),
  },
  classificacao: {
    rotulo: "Classificação",
    valor: (r) => texto(r.classificacao),
  },
  localizacao: { rotulo: "Local", valor: (r) => texto(r.localizacao) },
  setor: { rotulo: "Setor", valor: (r) => texto(r.setor) },
  descricao_status: {
    rotulo: "Descrição do status",
    valor: (r) => texto(r.descricao_status),
  },
  responsavel: { rotulo: "Responsável", valor: (r) => r.responsavelExibido },
  numero: { rotulo: "Nº", valor: (r) => formataNumero(r.numero) },
  codigo: { rotulo: "Código", valor: (r) => texto(r.codigo) },
  status: { rotulo: "Status", valor: (r) => STATUS_ROTULO[r.status] },
  prioridade: {
    rotulo: "Prioridade",
    valor: (r) => PRIORIDADE_ROTULO[r.prioridade],
  },
  area: { rotulo: "Área", valor: (r) => texto(r.area) },
  causa_6m: { rotulo: "Causa 6M", valor: (r) => texto(r.causa_6m) },
  semana_programada: {
    rotulo: "Semana programada",
    valor: (r) => dataEmail(r.semana_programada),
  },
  previsao_conclusao: {
    rotulo: "Previsão de conclusão",
    valor: (r) => dataEmail(r.previsao_conclusao),
  },
  prazo_original: {
    rotulo: "Prazo original",
    valor: (r) => dataEmail(r.prazo_original),
  },
  dias_prazo: {
    rotulo: "Dias para o prazo",
    valor: (r, hoje) => {
      const dias = diasParaPrazo(r.data_limite, hoje);
      if (dias === null) return "";
      if (dias < 0) return `${-dias} dia(s) de atraso`;
      if (dias === 0) return "Vence hoje";
      return `${dias} dia(s)`;
    },
  },
  id_atividade: {
    rotulo: "ID da atividade",
    valor: (r) => texto(r.id_atividade),
  },
  inicio_atividade: {
    rotulo: "Início da atividade",
    valor: (r) => dataEmail(r.inicio_atividade),
  },
  observacoes: { rotulo: "Observações", valor: (r) => texto(r.observacoes) },
} satisfies Record<string, DefColuna>;

export type ChaveColuna = keyof typeof CATALOGO;

export const CHAVES_COLUNAS = Object.keys(CATALOGO) as [
  ChaveColuna,
  ...ChaveColuna[],
];

export const COLUNAS: Record<ChaveColuna, DefColuna> = CATALOGO;

export function ehChaveColuna(v: string): v is ChaveColuna {
  return Object.hasOwn(CATALOGO, v);
}

/** Descarta chaves desconhecidas (gravadas à mão no banco, por exemplo). */
export function colunasValidas(chaves: readonly string[]): ChaveColuna[] {
  return chaves.filter(ehChaveColuna);
}

/** As 9 colunas do relatório da planilha, na ordem original. */
export const COLUNAS_PLANILHA: ChaveColuna[] = [
  "descricao",
  "acao",
  "data_criacao",
  "data_limite",
  "atividade_impactada",
  "classificacao",
  "localizacao",
  "setor",
  "descricao_status",
];
