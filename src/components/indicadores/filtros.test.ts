import { describe, expect, it } from "vitest";
import {
  alternaDimensao,
  escreveFiltros,
  FILTROS_VAZIOS,
  leFiltros,
  temRecorte,
  type Filtros,
} from "./filtros";

const COMPLETO: Filtros = {
  semana: "2026-W36",
  situacao: "atrasada",
  dimensoes: { area: "Secagem", responsavel: "Ana Lima", causa_6m: "MÉTODO" },
  busca: "guindaste",
};

describe("filtros na URL", () => {
  it("ida e volta preserva todos os filtros", () => {
    const qs = escreveFiltros(COMPLETO);
    expect(leFiltros(new URLSearchParams(qs))).toEqual(COMPLETO);
  });

  it("gera sempre a mesma query, sem parâmetros vazios", () => {
    expect(
      escreveFiltros({
        ...FILTROS_VAZIOS,
        dimensoes: { setor: "Compras", area: "" },
        busca: "  ",
      }),
    ).toBe("setor=Compras");
  });

  it("filtros vazios viram query vazia", () => {
    expect(escreveFiltros(FILTROS_VAZIOS)).toBe("");
  });

  it("ignora valores inválidos em vez de quebrar", () => {
    const f = leFiltros(
      new URLSearchParams("semana=ontem&situacao=perdida&area=%20&q=ok"),
    );
    expect(f).toEqual({ ...FILTROS_VAZIOS, busca: "ok" });
  });

  it("codifica acentos e espaços", () => {
    const qs = escreveFiltros({
      ...FILTROS_VAZIOS,
      dimensoes: { causa_6m: "MÃO DE OBRA" },
    });
    expect(leFiltros(new URLSearchParams(qs)).dimensoes.causa_6m).toBe(
      "MÃO DE OBRA",
    );
  });
});

describe("alternaDimensao", () => {
  it("clicar de novo na mesma barra remove o filtro", () => {
    const uma = alternaDimensao(FILTROS_VAZIOS, "area", "Secagem");
    expect(alternaDimensao(uma, "area", "Secagem").dimensoes).toEqual({});
  });

  it("clicar em outra barra troca o valor", () => {
    const uma = alternaDimensao(FILTROS_VAZIOS, "area", "Secagem");
    expect(alternaDimensao(uma, "area", "Canteiro").dimensoes).toEqual({
      area: "Canteiro",
    });
  });
});

describe("temRecorte", () => {
  it("só semana e busca não contam como recorte de gráfico", () => {
    expect(
      temRecorte({ ...FILTROS_VAZIOS, semana: "2026-W01", busca: "x" }),
    ).toBe(false);
  });

  it("situação ou dimensão contam", () => {
    expect(temRecorte({ ...FILTROS_VAZIOS, situacao: "no_prazo" })).toBe(true);
  });
});
