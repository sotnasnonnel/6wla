import { normalizaChave, parseData } from "@/lib/importacao/mapa";
import {
  atividadePpcSchema,
  CAMPOS_PPC,
  OBRIGATORIOS_PPC,
  ROTULOS_PPC,
  chaveAtividadePpc,
  type AtividadePpc,
  type CampoPpc,
  type MapaPpc,
} from "./dominio";

const APELIDOS: Record<CampoPpc, string[]> = {
  unidade: ["Unidade", "UND. DE MEDIDA", "Unidade de medida", "UND", "UN"],
  desvio: ["Desvio", "Desvios", "Motivo do desvio"],
  id_atividade: [
    "ID",
    "ID atividade",
    "ID da atividade",
    "ID CRONOGRAMA",
    "Código",
    "Código atividade",
  ],
  nome_atividade: [
    "Nome da atividade",
    "Nome atividade",
    "Atividade",
    "ATIVIDADES",
    "Descrição da atividade",
    "Descrição",
    "Tarefa",
  ],
  semana: ["Semana", "Semana programada", "Semana planejamento", "Nº semana"],
  quantidade_prevista: [
    "Quantidade prevista",
    "Qtd prevista",
    "Qtde prevista",
    "Quant prevista",
    "Quantidade planejada",
    "Qtd planejada",
  ],
  quantidade_realizada: [
    "Quantidade realizada",
    "Qtd realizada",
    "Qtde realizada",
    "Quant realizada",
    "Quantidade executada",
    "Qtd executada",
  ],
  status_planejamento: [
    "Status Planejamento",
    "Status do planejamento",
    "Status Planjemaneto",
    "Status",
    "Situação",
  ],
  observacoes: ["Observações", "Observação", "Obs", "Comentários"],
  causa_6ms: ["6M+S", "6MS", "6M", "Causa 6M+S", "Causa", "Motivo"],
  lider_imediato: ["Líder imediato", "Lider", "Liderança imediata"],
  encarregado: ["Encarregado", "ENCARREGADO / LIDER"],
  responsavel: ["Responsável", "Responsavel atividade"],
  disciplina: ["Disciplina", "Dsciplina"],
  inicio_semana: [
    "Início semana",
    "Início da semana",
    "Data início semana",
    "Início",
  ],
  termino_semana: [
    "Término semana",
    "Término da semana",
    "Fim semana",
    "Fim da semana",
    "Término",
    "Fim",
  ],
};
export type LinhaPpc = {
  numero: number;
  valores: Record<string, string>;
  /** Valores da linha Real: quantidades nunca herdam as da linha Previsto. */
  real?: { numero: number; valores: Record<string, string> };
};

export function valorMapeadoPpc(
  linha: LinhaPpc,
  campo: CampoPpc,
  mapa: MapaPpc,
): string {
  const valores =
    campo === "quantidade_realizada" && linha.real
      ? linha.real.valores
      : linha.valores;
  return valores[mapa[campo] ?? ""] ?? "";
}

export function mapaPpcReutilizaColuna(
  mapa: MapaPpc,
  emPares: boolean,
): boolean {
  const usadas = new Map<string, CampoPpc[]>();
  for (const campo of CAMPOS_PPC) {
    const coluna = mapa[campo];
    if (coluna) usadas.set(coluna, [...(usadas.get(coluna) ?? []), campo]);
  }
  return [...usadas.values()].some(
    (campos) =>
      campos.length > 1 &&
      !(
        emPares &&
        campos.length === 2 &&
        campos.includes("quantidade_prevista") &&
        campos.includes("quantidade_realizada")
      ),
  );
}

export function sugereMapaPpc(cabecalhos: string[]): MapaPpc {
  const mapa: MapaPpc = {};
  const usadas = new Set<string>();
  for (const campo of CAMPOS_PPC) {
    const nomes = APELIDOS[campo].map(normalizaChave);
    // Priorizar nomes específicos (Início semana) antes dos genéricos
    // (Início), independentemente da posição das colunas na planilha.
    const coluna = nomes
      .map((nome) =>
        cabecalhos.find((c) => !usadas.has(c) && normalizaChave(c) === nome),
      )
      .find((c) => c !== undefined);
    if (coluna) {
      mapa[campo] = coluna;
      usadas.add(coluna);
    }
  }
  return mapa;
}

function celula(valor: unknown): string {
  if (valor instanceof Date) return parseData(valor) ?? "";
  return typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";
}

/** Reconhece o cabeçalho pelos nomes dos campos, mesmo depois de uma capa. */
export function matrizPpc(matriz: unknown[][]): {
  cabecalhos: string[];
  linhas: LinhaPpc[];
  mapa: MapaPpc;
  emPares: boolean;
} {
  let indice = -1;
  let pontos = 0;
  for (let i = 0; i < Math.min(matriz.length, 50); i++) {
    const mapa = sugereMapaPpc(Array.from(matriz[i] ?? [], celula));
    const atual = Object.keys(mapa).length;
    if (atual > pontos) {
      indice = i;
      pontos = atual;
    }
  }
  if (indice < 0 || pontos < 2)
    throw new Error(
      "Não foi possível identificar os cabeçalhos da programação nas primeiras 50 linhas.",
    );
  const vistos = new Map<string, number>();
  const cabecalhos = Array.from(matriz[indice] ?? [], (v, i) => {
    const nome = celula(v) || `Coluna ${i + 1}`;
    const n = (vistos.get(nome) ?? 0) + 1;
    vistos.set(nome, n);
    return n > 1 ? `${nome} (${n})` : nome;
  });
  const linhas: LinhaPpc[] = [];
  for (let i = indice + 1; i < matriz.length; i++) {
    const valores = Object.fromEntries(
      cabecalhos.map((h, c) => [h, celula(matriz[i]?.[c])]),
    );
    if (Object.values(valores).some(Boolean))
      linhas.push({ numero: i + 1, valores });
  }
  const colunaTipo = cabecalhos.find((c) => normalizaChave(c) === "TIPO");
  const emPares =
    !!colunaTipo &&
    linhas.some((l) =>
      ["PREVISTO", "REAL", "REALIZADO"].includes(
        normalizaChave(l.valores[colunaTipo] ?? ""),
      ),
    );
  const mapa = sugereMapaPpc(cabecalhos);
  if (!emPares || !colunaTipo)
    return { cabecalhos, linhas, mapa, emPares: false };

  const pares: LinhaPpc[] = [];
  // Na Programação os desvios estão sob os dias, no segundo cabeçalho.
  const colunasDesvio = Array.from(matriz[indice + 1] ?? [], (v, c) =>
    normalizaChave(celula(v)) === "DESVIO" ? c : -1,
  ).filter((c) => c >= 0);
  if (!mapa.desvio && colunasDesvio.length) {
    let nome = "Desvio";
    while (cabecalhos.includes(nome)) nome += " (dias)";
    cabecalhos.push(nome);
    mapa.desvio = nome;
  }
  const colunaSemana = mapa.semana;
  for (let i = 0; i < linhas.length; i++) {
    const prevista = linhas[i];
    const tipo = normalizaChave(prevista.valores[colunaTipo] ?? "");
    if (!tipo) {
      // Cabeçalhos auxiliares vêm antes do primeiro par, nunca são atividade.
      if (!pares.length) continue;
      throw new Error(
        `Linha ${prevista.numero}: informe Previsto ou Real na coluna TIPO.`,
      );
    }
    if (tipo !== "PREVISTO")
      throw new Error(
        `Linha ${prevista.numero}: linha Real sem uma linha Previsto correspondente.`,
      );
    const realizada = linhas[i + 1];
    if (
      !realizada ||
      realizada.numero !== prevista.numero + 1 ||
      !["REAL", "REALIZADO"].includes(
        normalizaChave(realizada.valores[colunaTipo] ?? ""),
      )
    ) {
      throw new Error(
        `Linha ${prevista.numero}: falta a linha Real logo abaixo da linha Previsto.`,
      );
    }
    if (
      colunaSemana &&
      realizada.valores[colunaSemana] &&
      prevista.valores[colunaSemana] !== realizada.valores[colunaSemana]
    ) {
      throw new Error(
        `Linhas ${prevista.numero} e ${realizada.numero}: as semanas do Previsto e Real não coincidem.`,
      );
    }
    // Os dados compartilhados ficam na linha superior do par mesclado.
    // Não levar ID, nome ou quantidade da atividade anterior para este par.
    if (mapa.desvio && colunasDesvio.length) {
      const motivos = colunasDesvio.flatMap((c) => {
        const coluna = cabecalhos[c];
        const valores = [
          ...new Set(
            [prevista.valores[coluna], realizada.valores[coluna]].filter(
              (v) => v && v !== "-",
            ),
          ),
        ];
        return valores.map(
          (v) => `${celula(matriz[indice]?.[c]) || "Dia"}: ${v}`,
        );
      });
      prevista.valores[mapa.desvio] = motivos.join("\n");
    }
    pares.push({
      ...prevista,
      real: { numero: realizada.numero, valores: realizada.valores },
    });
    i++;
  }
  const quantidade =
    cabecalhos.find((c) => normalizaChave(c) === "PPC") ??
    cabecalhos.find((c) =>
      ["QTD", "QUANTIDADE", "QTDE"].includes(normalizaChave(c)),
    );
  if (quantidade) {
    mapa.quantidade_prevista = quantidade;
    mapa.quantidade_realizada = quantidade;
  }
  return { cabecalhos, linhas: pares, mapa, emPares: true };
}

/** Números nativos do Excel usam ponto; texto brasileiro admite milhar e vírgula. */
export function quantidadePpc(valor: string): number | null {
  const limpo = valor.trim().replace(/\s/g, "");
  if (!limpo) return null;
  if (/^\d+(\.\d+)?$/.test(limpo)) return Number(limpo);
  if (/^(\d+|\d{1,3}(\.\d{3})+),\d+$/.test(limpo))
    return Number(limpo.replace(/\./g, "").replace(",", "."));
  return NaN;
}

export function traduzPpc(
  linhas: LinhaPpc[],
  mapa: MapaPpc,
  cabecalhos: string[],
): { atividades: AtividadePpc[]; erros: string[] } {
  const colunas = Object.values(mapa);
  if (
    mapaPpcReutilizaColuna(
      mapa,
      linhas.length > 0 && linhas.every((l) => !!l.real),
    ) ||
    colunas.some((c) => !cabecalhos.includes(c))
  ) {
    return {
      atividades: [],
      erros: ["Cada campo deve usar uma coluna existente e diferente."],
    };
  }
  const faltam = OBRIGATORIOS_PPC.filter((c) => !mapa[c]);
  if (faltam.length)
    return {
      atividades: [],
      erros: [
        `Identifique as colunas: ${faltam.map((c) => ROTULOS_PPC[c]).join(", ")}.`,
      ],
    };
  const atividades: AtividadePpc[] = [];
  const erros: string[] = [];
  const chaves = new Set<string>();
  for (const linha of linhas) {
    const valor = (c: CampoPpc) => valorMapeadoPpc(linha, c, mapa);
    if (!CAMPOS_PPC.some((c) => valor(c))) continue;
    const bruto = Object.fromEntries(CAMPOS_PPC.map((c) => [c, valor(c)]));
    const erroQuantidade = ["quantidade_prevista", "quantidade_realizada"].find(
      (c) => {
        const campo =
          c === "quantidade_prevista"
            ? "quantidade_prevista"
            : "quantidade_realizada";
        return valor(campo).startsWith("#");
      },
    );
    if (erroQuantidade) {
      const campo =
        erroQuantidade === "quantidade_prevista"
          ? "quantidade_prevista"
          : "quantidade_realizada";
      const numero =
        campo === "quantidade_realizada"
          ? (linha.real?.numero ?? linha.numero)
          : linha.numero;
      erros.push(
        `Linha ${numero}, coluna ${mapa[campo]}: ${valor(campo)} em ${ROTULOS_PPC[campo]}. Corrija a fórmula na planilha; o erro não será convertido em zero.`,
      );
      continue;
    }
    const parsed = atividadePpcSchema.safeParse({
      ...bruto,
      quantidade_prevista: quantidadePpc(valor("quantidade_prevista")),
      quantidade_realizada: quantidadePpc(valor("quantidade_realizada")),
      inicio_semana: parseData(valor("inicio_semana")),
      termino_semana: parseData(valor("termino_semana")),
    });
    if (!parsed.success) {
      const campo = CAMPOS_PPC.find(
        (c) => c === parsed.error.issues[0]?.path[0],
      );
      erros.push(
        `Linha ${linha.numero}: confira ${campo ? ROTULOS_PPC[campo] : "os campos"}. Use quantidades positivas ou zero e datas válidas; o término não pode vir antes do início.`,
      );
      continue;
    }
    const chave = chaveAtividadePpc(parsed.data);
    if (chaves.has(chave)) {
      erros.push(
        `Linha ${linha.numero}: ID ${parsed.data.id_atividade} repetido na mesma semana e data de início.`,
      );
      continue;
    }
    chaves.add(chave);
    atividades.push(parsed.data);
  }
  if (!atividades.length && !erros.length)
    erros.push("Nenhuma atividade encontrada na aba selecionada.");
  return { atividades, erros };
}
