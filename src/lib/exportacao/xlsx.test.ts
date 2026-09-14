import { describe, expect, it } from "vitest";
import { leXlsx } from "@/lib/importacao/xlsx";
import {
  dataParaSerial,
  geraXlsx,
  indiceParaColuna,
  nomeArquivo,
  saneiaNomeAba,
} from "./xlsx";

/**
 * O teste do escritor é a viagem de ida e volta: gera o arquivo e lê de volta
 * com o leitor da importação. Se o Excel do usuário lê o que a gente escreve é
 * o que importa — e o leitor é o parser mais parecido com ele que temos aqui.
 */
function ida(
  colunas: Parameters<typeof geraXlsx>[0]["colunas"],
  linhas: Parameters<typeof geraXlsx>[0]["linhas"],
  aba = "Restrições",
) {
  // O leitor pula aba de uma linha só quando ninguém pede uma; aqui a gente
  // sempre pede pelo nome, que é o caso do arquivo com cabeçalho e nada mais.
  return leXlsx(geraXlsx({ colunas, linhas, aba }), aba);
}

describe("geraXlsx", () => {
  it("volta com cabeçalho e valores nas posições certas", () => {
    const { aba, matriz } = ida(
      [
        { cabecalho: "Nº", tipo: "numero" },
        { cabecalho: "Restrição" },
        { cabecalho: "Prazo", tipo: "data" },
      ],
      [
        [12, "Liberar frente 3", "2026-09-10"],
        [13, "Aprovar projeto", null],
      ],
    );
    expect(aba).toBe("Restrições");
    expect(matriz[0]).toEqual(["Nº", "Restrição", "Prazo"]);
    expect(matriz[1]?.[0]).toBe(12);
    expect(matriz[1]?.[1]).toBe("Liberar frente 3");
    expect(matriz[2]?.[1]).toBe("Aprovar projeto");
  });

  it("data vira data de verdade, não texto", () => {
    const { matriz } = ida(
      [{ cabecalho: "Prazo", tipo: "data" }],
      [["2026-09-10"]],
    );
    const valor = matriz[1]?.[0];
    expect(valor).toBeInstanceOf(Date);
    expect((valor as Date).toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  it("data que não é ISO sai como texto em vez de sumir", () => {
    const { matriz } = ida(
      [{ cabecalho: "Prazo", tipo: "data" }],
      [["a combinar"]],
    );
    expect(matriz[1]?.[0]).toBe("a combinar");
  });

  it("escapa o que quebraria o XML", () => {
    const { matriz } = ida(
      [{ cabecalho: "Ação & risco" }],
      [['Comprar <cabo> "6mm" & testar']],
    );
    expect(matriz[0]?.[0]).toBe("Ação & risco");
    expect(matriz[1]?.[0]).toBe('Comprar <cabo> "6mm" & testar');
  });

  it("célula vazia não vira a string 'null'", () => {
    const { matriz } = ida(
      [{ cabecalho: "A" }, { cabecalho: "B" }],
      [
        [null, "x"],
        [undefined, "y"],
        ["", "z"],
      ],
    );
    expect(matriz[1]?.[0]).toBeUndefined();
    expect(matriz[1]?.[1]).toBe("x");
  });

  it("recusa exportação sem colunas", () => {
    expect(() => geraXlsx({ colunas: [], linhas: [] })).toThrow();
  });

  it("gera arquivo válido mesmo sem nenhuma linha", () => {
    const { matriz } = ida([{ cabecalho: "Nº" }], []);
    expect(matriz[0]).toEqual(["Nº"]);
  });
});

describe("auxiliares", () => {
  it("converte data para o serial do Excel", () => {
    // 1900-01-01 é o serial 2 no calendário (com o bug de 1900 do Excel).
    expect(dataParaSerial("1900-01-01")).toBe(2);
    expect(dataParaSerial("2026-09-03")).toBe(46268);
    expect(dataParaSerial("não é data")).toBeNull();
  });

  it("numera colunas além de Z", () => {
    expect(indiceParaColuna(0)).toBe("A");
    expect(indiceParaColuna(25)).toBe("Z");
    expect(indiceParaColuna(26)).toBe("AA");
    expect(indiceParaColuna(701)).toBe("ZZ");
  });

  it("corta nome de aba que o Excel recusaria", () => {
    expect(saneiaNomeAba("Obra: HRMS [2026]/geral")).toBe(
      "Obra  HRMS  2026  geral",
    );
    expect(saneiaNomeAba("x".repeat(40))).toHaveLength(31);
    expect(saneiaNomeAba("   ")).toBe("Dados");
  });

  it("nome de arquivo sem acento nem espaço", () => {
    expect(nomeArquivo("Restrições HRMS", "2026-09-08")).toBe(
      "restricoes-hrms-2026-09-08.xlsx",
    );
  });
});
