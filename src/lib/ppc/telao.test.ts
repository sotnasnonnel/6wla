import { it, expect } from "vitest";
import { paginasTelao } from "./telao";
it("divide as atividades de cada encarregado sem perder ou repetir registros", () => {
  const registros = [
    { id: 1, encarregado: "João" },
    { id: 2, encarregado: " Ana " },
    { id: 3, encarregado: "Ana" },
    { id: 4, encarregado: "ANA" },
    { id: 5, encarregado: "" },
  ];
  const paginas = paginasTelao(registros, 2);
  expect(paginas).toHaveLength(4);
  expect(paginas.every((p) => p.atividades.length <= 2)).toBe(true);
  expect(paginas.flatMap((p) => p.atividades.map((a) => a.id)).sort()).toEqual([
    1, 2, 3, 4, 5,
  ]);
  expect(
    paginas.filter((p) => p.encarregado === "Ana").map((p) => p.parte),
  ).toEqual([1, 2]);
  expect(paginasTelao(registros, 1)).toHaveLength(5);
  expect(paginasTelao([])).toEqual([]);
});
