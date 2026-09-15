import { describe, it, expect } from "vitest";
import { resumoQuantidades } from "./resumo";
describe("resumo das quantidades", () => {
  it("separa unidades e não soma quantidade sem unidade", () => {
    const r = resumoQuantidades([
      { unidade: "m", quantidade_prevista: 10, quantidade_realizada: 5 },
      { unidade: "t", quantidade_prevista: 2, quantidade_realizada: 1 },
      { unidade: " M ", quantidade_prevista: 7, quantidade_realizada: null },
      { unidade: "", quantidade_prevista: 999, quantidade_realizada: 99 },
    ]);
    expect(r.find((g) => g.unidade === "m")).toMatchObject({
      prevista: 17,
      realizada: 5,
      semReal: 1,
    });
    expect(r.find((g) => g.unidade === "t")).toMatchObject({
      prevista: 2,
      realizada: 1,
    });
    expect(r.find((g) => g.unidade === "Sem unidade")).toMatchObject({
      prevista: null,
      realizada: null,
    });
  });
  it("calcula média de percentuais e distingue real zero de ausente", () => {
    expect(
      resumoQuantidades([
        { unidade: "%", quantidade_prevista: 100, quantidade_realizada: 0 },
        { unidade: "%", quantidade_prevista: 50, quantidade_realizada: null },
      ])[0],
    ).toMatchObject({ media: true, prevista: 75, realizada: 0, semReal: 1 });
  });
});
