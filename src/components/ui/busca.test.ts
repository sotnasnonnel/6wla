import { describe, expect, it } from "vitest";
import { filtraPorTermo, normalizaBusca } from "./busca";

const PESSOAS = [
  { nome: "João Silva", email: "joao@phd.com" },
  { nome: "Maria Souza", email: "maria@obra.com" },
];
const campos = (p: (typeof PESSOAS)[number]) => [p.nome, p.email];

describe("normalizaBusca", () => {
  it("remove acentos, caixa e espaços das pontas", () => {
    expect(normalizaBusca("  CONCEIÇÃO ")).toBe("conceicao");
  });
});

describe("filtraPorTermo", () => {
  it("acha nome acentuado digitado sem acento", () => {
    expect(filtraPorTermo(PESSOAS, "joao s", campos)).toEqual([PESSOAS[0]]);
  });

  it("acha pelo e-mail", () => {
    expect(filtraPorTermo(PESSOAS, "OBRA.com", campos)).toEqual([PESSOAS[1]]);
  });

  it("termo vazio devolve todos", () => {
    expect(filtraPorTermo(PESSOAS, "   ", campos)).toEqual(PESSOAS);
  });

  it("termo sem correspondência devolve lista vazia", () => {
    expect(filtraPorTermo(PESSOAS, "pedro", campos)).toEqual([]);
  });
});
