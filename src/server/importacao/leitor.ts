import "server-only";

import { leXlsx } from "@/lib/importacao/xlsx";
import { matrizParaLinhas, type LinhaPlanilha } from "@/lib/importacao/mapa";

export const LIMITE_LINHAS = 5000;

export type PlanilhaLida = {
  aba: string;
  abas: string[];
  cabecalhos: string[];
  linhas: LinhaPlanilha[];
};

/**
 * Lê um .xlsx e devolve a aba escolhida (ou a primeira com dados) como
 * objetos `{ cabeçalho: valor }`. Datas viram ISO, células vazias viram null.
 * Valida a assinatura do arquivo e aborta cedo acima do limite de linhas.
 */
export function lePlanilha(
  bytes: Uint8Array,
  abaPreferida?: string,
): PlanilhaLida {
  const { aba, abas, matriz } = leXlsx(bytes, abaPreferida, LIMITE_LINHAS);
  const { cabecalhos, linhas } = matrizParaLinhas(matriz);
  return { aba, abas, cabecalhos, linhas };
}
