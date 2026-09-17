import "server-only";

import { todasAsPaginas } from "@/server/paginacao";
import { z } from "zod";
import type { Cliente } from "@/server/auth";
import {
  chaveCodigo,
  mapaColunasSchema,
  type LinhaPlanilha,
  type MapaColunas,
} from "@/lib/importacao/mapa";
import {
  planejaImportacao,
  type GravadaAntes,
  type ModoImportacao,
} from "@/lib/importacao/plano";

const linhasSchema = z.array(z.record(z.string(), z.unknown()));

export type Importacao = {
  id: string;
  obra_id: string;
  arquivo_nome: string;
  aba: string;
  status: "rascunho" | "concluida" | "cancelada";
  cabecalhos: string[];
  linhas: LinhaPlanilha[];
  /** Relatório do que não entrou; validar com `relatorioDaImportacao`. */
  relatorio: unknown;
  mapa_colunas: MapaColunas;
  mapa_origem: string;
  total_linhas: number;
  importadas: number;
  atualizadas: number;
  ignoradas: number;
  modo: "adicionar" | "atualizar";
  criado_em: string;
  concluido_em: string | null;
};

export async function buscaImportacao(
  supabase: Cliente,
  importacaoId: string,
): Promise<Importacao | null> {
  const { data, error } = await supabase
    .from("6wla_importacoes")
    .select("*")
    .eq("id", importacaoId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar importação: ${error.message}`);
  if (!data) return null;

  // jsonb chega como `Json`; valida antes de tratar como linhas/mapa.
  const linhas = linhasSchema.safeParse(data.linhas);
  const mapa = mapaColunasSchema.safeParse(data.mapa_colunas);
  return {
    ...data,
    linhas: linhas.success ? linhas.data : [],
    mapa_colunas: mapa.success ? mapa.data : {},
  };
}

export async function listaImportacoes(supabase: Cliente, obraId: string) {
  const { data, error } = await supabase
    .from("6wla_importacoes")
    .select(
      "id, arquivo_nome, aba, status, total_linhas, importadas, criado_em, concluido_em",
    )
    .eq("obra_id", obraId)
    .order("criado_em", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Falha ao listar importações: ${error.message}`);
  return data;
}

/**
 * Códigos já usados na obra, na chave normalizada de casamento → id da
 * restrição. É o que decide, na importação, se a linha atualiza alguém ou
 * entra como nova. Código repetido na obra fica com a restrição mais antiga.
 *
 * `excetoImportacao` deixa de fora o que essa importação inseriu: numa
 * retomada, essas linhas são "já gravadas", não "já existiam".
 */
export async function codigosDaObra(
  supabase: Cliente,
  obraId: string,
  excetoImportacao?: string,
): Promise<Map<string, string>> {
  const linhas = await todasAsPaginas(
    (de, ate) =>
      supabase
        .from("6wla_restricoes")
        .select("id, codigo, importacao_id, origem")
        .eq("obra_id", obraId)
        .not("codigo", "is", null)
        .order("numero")
        .order("id")
        .range(de, ate),
    "Falha ao ler códigos da obra",
  );
  const mapa = new Map<string, string>();
  for (const r of linhas) {
    if (
      excetoImportacao &&
      r.origem === "importada" &&
      r.importacao_id === excetoImportacao
    )
      continue;
    const chave = chaveCodigo(r.codigo);
    if (chave && !mapa.has(chave)) mapa.set(chave, r.id);
  }
  return mapa;
}

/**
 * Restrições que esta importação já inseriu (numa tentativa que parou no
 * meio). O gatilho de update preserva `importacao_id`/`origem`, então só as
 * inseridas por ela aparecem aqui — as atualizadas mantêm a importação de
 * origem delas.
 */
export async function gravadasDaImportacao(
  supabase: Cliente,
  obraId: string,
  importacaoId: string,
): Promise<GravadaAntes[]> {
  return todasAsPaginas(
    (de, ate) =>
      supabase
        .from("6wla_restricoes")
        .select("codigo, descricao")
        .eq("obra_id", obraId)
        .eq("importacao_id", importacaoId)
        .eq("origem", "importada")
        .order("numero")
        .order("id")
        .range(de, ate),
    "Falha ao ler o que a importação já gravou",
  );
}

/**
 * Relatório guardado ao concluir: só a posição e o motivo das linhas que não
 * viraram restrição. Mora na coluna `relatorio`; importações concluídas antes
 * dela o guardaram em `linhas` (ver `relatorioDaImportacao`).
 */
const relatorioSchema = z.array(
  z.object({
    tipo: z.enum(["descartada", "ignorada"]),
    numero: z.number().int().positive(),
    exato: z.boolean(),
    motivo: z.string(),
  }),
);
export type ItemRelatorio = z.infer<typeof relatorioSchema>[number];

export function relatorioDe(json: unknown): ItemRelatorio[] {
  const r = relatorioSchema.safeParse(json);
  return r.success ? r.data : [];
}

export function relatorioDaImportacao(imp: {
  relatorio: unknown;
  linhas: unknown;
}): ItemRelatorio[] {
  const proprio = relatorioDe(imp.relatorio);
  return proprio.length > 0 ? proprio : relatorioDe(imp.linhas);
}

/** Quantas linhas problemáticas a conferência lista (o total vem sempre). */
const LISTA_MAXIMA = 200;

export type ResumoImportacao = {
  novas: number;
  atualizar: number;
  ignoradas: number;
  descartadas: number;
  jaGravadas: number;
  /** Primeiras `LISTA_MAXIMA` linhas que não entram, com motivo. */
  problemas: Array<{
    tipo: "descartada" | "ignorada";
    numero: number;
    exato: boolean;
    motivo: string;
  }>;
};

/** Contagem exata do que a gravação faria, com o mesmo plano da gravação. */
export async function resumoDoPlano(
  supabase: Cliente,
  imp: Importacao,
  mapa: MapaColunas,
  modo: ModoImportacao,
): Promise<ResumoImportacao> {
  const [gravadas, existentes] = await Promise.all([
    gravadasDaImportacao(supabase, imp.obra_id, imp.id),
    codigosDaObra(supabase, imp.obra_id, imp.id),
  ]);
  const plano = planejaImportacao({
    linhas: imp.linhas,
    mapa,
    modo,
    existentes,
    gravadas,
  });
  const problemas = [
    ...plano.descartadas.map((d) => ({ tipo: "descartada" as const, ...d })),
    ...plano.ignoradas.map((d) => ({ tipo: "ignorada" as const, ...d })),
  ]
    .sort((a, b) => a.numero - b.numero)
    .slice(0, LISTA_MAXIMA);
  return {
    novas: plano.novas.length,
    atualizar: plano.atualizar.length,
    ignoradas: plano.ignoradas.length,
    descartadas: plano.descartadas.length,
    jaGravadas: plano.jaGravadas,
    problemas,
  };
}
