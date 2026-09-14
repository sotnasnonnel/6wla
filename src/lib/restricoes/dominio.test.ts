import { describe, expect, it } from "vitest";
import {
  diasParaPrazo,
  estaAtrasada,
  formataData,
  formataNumero,
} from "./dominio";

describe("estaAtrasada", () => {
  const hoje = "2026-09-03";
  it("aberta com prazo vencido está atrasada", () => {
    expect(
      estaAtrasada({ status: "pendente", data_limite: "2026-09-02" }, hoje),
    ).toBe(true);
    expect(
      estaAtrasada({ status: "em_andamento", data_limite: "2026-08-01" }, hoje),
    ).toBe(true);
  });
  it("vence hoje não está atrasada", () => {
    expect(
      estaAtrasada({ status: "pendente", data_limite: "2026-09-03" }, hoje),
    ).toBe(false);
  });
  it("concluída ou cancelada nunca está atrasada", () => {
    expect(
      estaAtrasada({ status: "concluida", data_limite: "2026-01-01" }, hoje),
    ).toBe(false);
    expect(
      estaAtrasada({ status: "cancelada", data_limite: "2026-01-01" }, hoje),
    ).toBe(false);
  });
  it("sem prazo não está atrasada", () => {
    expect(estaAtrasada({ status: "pendente", data_limite: null }, hoje)).toBe(
      false,
    );
  });
});

describe("diasParaPrazo", () => {
  it("conta dias, negativo quando vencido", () => {
    expect(diasParaPrazo("2026-09-10", "2026-09-03")).toBe(7);
    expect(diasParaPrazo("2026-09-01", "2026-09-03")).toBe(-2);
    expect(diasParaPrazo(null, "2026-09-03")).toBeNull();
  });
});

describe("formatação", () => {
  it("data e número", () => {
    expect(formataData("2026-09-03")).toBe("03/09/2026");
    expect(formataData(null)).toBe("");
    expect(formataNumero(7)).toBe("R-007");
  });
});
