import { describe, expect, it } from "vitest";
import { matrizPpc, traduzPpc, valorMapeadoPpc } from "./importacao";

const cabecalho = [
  "ID CRONOGRAMA",
  "ATIVIDADES",
  "TIPO",
  "QTD.",
  "PPC",
  "SEMANA",
  "INÍCIO SEMANA",
  "TÉRMINO SEMANA",
  "ENCARREGADO / LIDER",
];
const prevista = [
  "A4180",
  "Segregação das vigas",
  "Previsto",
  27.12,
  13.06,
  "S26",
  "2026-07-05",
  "2026-07-11",
  "Encarregado A",
];
const realizada = [
  null,
  null,
  "Real",
  26.12,
  13.06,
  "S26",
  "2026-07-05",
  "2026-07-11",
  null,
];

describe("pares Previsto e Real", () => {
  it("reúne os desvios por dia e por par, sem carregar a atividade anterior", () => {
    const dados = matrizPpc([
      [...cabecalho, "seg", "ter"],
      [...cabecalho.map(() => null), "DESVIO", "DESVIO"],
      [...prevista, "Falta de material", null],
      [...realizada, null, "Chuva"],
      [
        ...prevista.slice(0, 1).map(() => "B"),
        ...prevista.slice(1),
        null,
        null,
      ],
      [...realizada, null, null],
    ]);
    expect(dados.linhas[0].valores[dados.mapa.desvio ?? ""]).toBe(
      "seg: Falta de material\nter: Chuva",
    );
    expect(dados.linhas[1].valores[dados.mapa.desvio ?? ""]).toBe("");
  });
  it("prioriza as datas da semana mesmo com datas da atividade antes delas", () => {
    const dados = matrizPpc([
      ["INÍCIO", "TÉRMINO", ...cabecalho],
      ["2026-01-01", "2026-12-31", ...prevista],
      [null, null, ...realizada],
    ]);
    expect(dados.mapa.inicio_semana).toBe("INÍCIO SEMANA");
    expect(dados.mapa.termino_semana).toBe("TÉRMINO SEMANA");
    expect(
      traduzPpc(dados.linhas, dados.mapa, dados.cabecalhos).atividades[0],
    ).toMatchObject({
      inicio_semana: "2026-07-05",
      termino_semana: "2026-07-11",
    });
  });
  it("uma coluna PPC gera as duas quantidades, mantendo o encarregado do par", () => {
    const dados = matrizPpc([cabecalho, prevista, realizada]);
    expect(traduzPpc(dados.linhas, dados.mapa, dados.cabecalhos)).toMatchObject(
      {
        erros: [],
        atividades: [
          {
            id_atividade: "A4180",
            quantidade_prevista: 13.06,
            quantidade_realizada: 13.06,
            encarregado: "Encarregado A",
          },
        ],
      },
    );
  });
  it("selecionar QTD. muda o previsto e o real para seus respectivos valores", () => {
    const dados = matrizPpc([cabecalho, prevista, realizada]);
    const mapa = {
      ...dados.mapa,
      quantidade_prevista: "QTD.",
      quantidade_realizada: "QTD.",
    };
    expect(
      traduzPpc(dados.linhas, mapa, dados.cabecalhos).atividades[0],
    ).toMatchObject({
      quantidade_prevista: 27.12,
      quantidade_realizada: 26.12,
    });
  });
  it("a prévia usa a linha Real sem repetir o previsto", () => {
    const dados = matrizPpc([cabecalho, prevista, realizada]);
    expect(
      valorMapeadoPpc(dados.linhas[0], "quantidade_realizada", {
        quantidade_realizada: "QTD.",
      }),
    ).toBe("26.12");
  });
  it("realizado vazio permanece não informado", () => {
    const dados = matrizPpc([
      cabecalho,
      prevista,
      realizada.map((v, i) => (i === 4 ? null : v)),
    ]);
    expect(
      traduzPpc(dados.linhas, dados.mapa, dados.cabecalhos).atividades[0]
        ?.quantidade_realizada,
    ).toBeNull();
  });
  it("não preenche o ID de um novo par com o ID da atividade anterior", () => {
    const dados = matrizPpc([
      cabecalho,
      prevista,
      realizada,
      prevista.map((v, i) => (i === 0 ? null : v)),
      realizada,
    ]);
    expect(dados.linhas.map((l) => l.valores["ID CRONOGRAMA"])).toEqual([
      "A4180",
      "",
    ]);
  });
  it("preserva erro no previsto e identifica a linha de origem", () => {
    const dados = matrizPpc([
      cabecalho,
      prevista.map((v, i) => (i === 4 ? "#VALUE!" : v)),
      realizada,
    ]);
    expect(
      traduzPpc(dados.linhas, dados.mapa, dados.cabecalhos).erros[0],
    ).toContain("Linha 2, coluna PPC: #VALUE!");
  });
  it("identifica erro na linha Real correta", () => {
    const dados = matrizPpc([
      cabecalho,
      prevista,
      realizada.map((v, i) => (i === 4 ? "#DIV/0!" : v)),
    ]);
    expect(
      traduzPpc(dados.linhas, dados.mapa, dados.cabecalhos).erros[0],
    ).toContain("Linha 3, coluna PPC: #DIV/0!");
  });
  it("não agrupa previsto e real de semanas diferentes", () => {
    expect(() =>
      matrizPpc([
        cabecalho,
        prevista,
        realizada.map((v, i) => (i === 5 ? "S27" : v)),
      ]),
    ).toThrow(/semanas.*não coincidem/);
  });
  it("não usa a atividade seguinte como real se falta uma linha", () => {
    expect(() => matrizPpc([cabecalho, prevista, prevista, realizada])).toThrow(
      /falta a linha Real/,
    );
  });
});
