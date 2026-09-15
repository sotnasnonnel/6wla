import { describe, expect, it } from "vitest";
import { criaTarefaSchema, textoTarefaSchema } from "./schemas";

describe("textoTarefaSchema", () => {
  it("apara espaços do texto da tarefa", () => {
    expect(textoTarefaSchema.parse("  pedir orçamento  ")).toBe(
      "pedir orçamento",
    );
  });
  it("recusa tarefa só com espaços", () => {
    expect(textoTarefaSchema.safeParse("   ").success).toBe(false);
  });
  it("recusa tarefa com mais de 500 caracteres", () => {
    expect(textoTarefaSchema.safeParse("a".repeat(501)).success).toBe(false);
  });
});

describe("criaTarefaSchema", () => {
  it("recusa restrição com identificador inválido", () => {
    expect(
      criaTarefaSchema.safeParse({ restricaoId: "abc", texto: "x" }).success,
    ).toBe(false);
  });
});
