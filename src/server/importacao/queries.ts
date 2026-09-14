import "server-only";

import { z } from "zod";
import type { Cliente } from "@/server/auth";
import {
  chaveCodigo,
  mapaColunasSchema,
  type LinhaPlanilha,
  type MapaColunas,
} from "@/lib/importacao/mapa";

const linhasSchema = z.array(z.record(z.string(), z.unknown()));

export type Importacao = {
  id: string;
  obra_id: string;
  arquivo_nome: string;
  aba: string;
  status: "rascunho" | "concluida" | "cancelada";
  cabecalhos: string[];
  linhas: LinhaPlanilha[];
  mapa_colunas: MapaColunas;
  mapa_origem: string;
  total_linhas: number;
  importadas: number;
  criado_em: string;
  concluido_em: string | null;
};

export async function buscaImportacao(
  supabase: Cliente,
  importacaoId: string,
): Promise<Importacao | null> {
  const { data, error } = await supabase
    .from("importacoes")
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
    .from("importacoes")
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
 */
export async function codigosDaObra(
  supabase: Cliente,
  obraId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("restricoes")
    .select("id, codigo")
    .eq("obra_id", obraId)
    .not("codigo", "is", null)
    .order("numero");
  if (error) throw new Error(`Falha ao ler códigos da obra: ${error.message}`);
  const mapa = new Map<string, string>();
  for (const r of data ?? []) {
    const chave = chaveCodigo(r.codigo);
    if (chave && !mapa.has(chave)) mapa.set(chave, r.id);
  }
  return mapa;
}
