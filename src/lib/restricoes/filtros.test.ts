import { describe, expect, it } from "vitest";
import {
  FILTROS_PADRAO,
  caminhoDetalhe,
  caminhoVolta,
  comParametro,
  filtraRestricoes,
  lerFiltros,
  ordenaRestricoes,
  serializaFiltros,
  vizinhos,
  type LinhaFiltravel,
} from "./filtros";

const OBRA = "11111111-1111-1111-1111-111111111111";

function linha(
  p: Partial<LinhaFiltravel> & { numero: number },
): LinhaFiltravel {
  return {
    id: `id-${p.numero}`,
    status: "pendente",
    data_limite: null,
    responsavel_id: null,
    responsavel_nome: null,
    descricao: `Restrição ${p.numero}`,
    acao: null,
    codigo: null,
    setor: null,
    area: null,
    atividade_impactada: null,
    classificacao: null,
    causa_6m: null,
    ...p,
  };
}

describe("serializaFiltros / lerFiltros", () => {
  it("padrão vira query string vazia", () => {
    expect(serializaFiltros(FILTROS_PADRAO)).toBe("");
  });

  it("ida e volta preserva o recorte", () => {
    const f = {
      busca: "concreto armado",
      status: "concluida" as const,
      resp: "Ana Souza",
      atrasadas: true,
      ordem: { id: "data_limite", desc: false },
    };
    expect(lerFiltros(new URLSearchParams(serializaFiltros(f)))).toEqual(f);
  });

  it("sem ordenação sobrevive à ida e volta", () => {
    const f = { ...FILTROS_PADRAO, ordem: null };
    expect(
      lerFiltros(new URLSearchParams(serializaFiltros(f))).ordem,
    ).toBeNull();
  });

  it("parâmetro inválido cai no padrão sem derrubar os outros", () => {
    const f = lerFiltros({
      status: "apagada",
      ordem: "numero;drop",
      q: "bloco",
    });
    expect(f).toEqual({ ...FILTROS_PADRAO, busca: "bloco" });
  });

  it("aceita o formato de searchParams do Next com valor repetido", () => {
    expect(lerFiltros({ status: ["todas", "concluida"] }).status).toBe("todas");
  });
});

describe("caminhoVolta", () => {
  it("sem volta leva à tabela da obra", () => {
    expect(caminhoVolta(OBRA, undefined)).toBe(`/obras/${OBRA}/tabela`);
  });

  it("reescreve a query só com filtros conhecidos", () => {
    expect(caminhoVolta(OBRA, "status=todas&next=https://mal.com")).toBe(
      `/obras/${OBRA}/tabela?status=todas`,
    );
  });

  it("endereço externo no volta não vira destino", () => {
    const destino = caminhoVolta(OBRA, "//mal.com/obras");
    expect(destino).toBe(`/obras/${OBRA}/tabela`);
  });
});

describe("caminhoDetalhe e comParametro", () => {
  it("leva o recorte codificado no volta", () => {
    const href = caminhoDetalhe(OBRA, "abc", "status=todas&q=a b");
    const url = new URL(href, "http://x");
    expect(url.searchParams.get("volta")).toBe("status=todas&q=a b");
  });

  it("acrescenta parâmetro com o separador certo", () => {
    expect(comParametro("/a", "excluida", "7")).toBe("/a?excluida=7");
    expect(comParametro("/a?q=1", "excluida", "7")).toBe("/a?q=1&excluida=7");
  });
});

describe("filtraRestricoes", () => {
  const nomePorId = new Map([["u1", "Carlos Lima"]]);
  const ctx = { nomePorId, hoje: "2026-09-16" };

  it("busca casa com o nome do membro responsável", () => {
    const linhas = [
      linha({ numero: 1, responsavel_id: "u1" }),
      linha({ numero: 2 }),
    ];
    const r = filtraRestricoes(
      linhas,
      { ...FILTROS_PADRAO, busca: "carlos" },
      ctx,
    );
    expect(r.map((x) => x.numero)).toEqual([1]);
  });

  it("abertas esconde concluídas e só atrasadas filtra pelo prazo", () => {
    const linhas = [
      linha({ numero: 1, status: "concluida" }),
      linha({ numero: 2, data_limite: "2026-09-01" }),
      linha({ numero: 3, data_limite: "2026-10-01" }),
    ];
    const r = filtraRestricoes(
      linhas,
      { ...FILTROS_PADRAO, atrasadas: true },
      ctx,
    );
    expect(r.map((x) => x.numero)).toEqual([2]);
  });
});

describe("ordenaRestricoes e vizinhos", () => {
  const linhas = [
    linha({ numero: 1, data_limite: "2026-09-10" }),
    linha({ numero: 2, data_limite: null }),
    linha({ numero: 3, data_limite: "2026-09-05" }),
  ];

  it("ordena por data com vazio no fim", () => {
    const r = ordenaRestricoes(
      linhas,
      { id: "data_limite", desc: false },
      new Map(),
    );
    expect(r.map((x) => x.numero)).toEqual([3, 1, 2]);
  });

  it("coluna desconhecida mantém o número decrescente", () => {
    const r = ordenaRestricoes(
      linhas,
      { id: "nao_existe", desc: false },
      new Map(),
    );
    expect(r.map((x) => x.numero)).toEqual([3, 2, 1]);
  });

  it("acha anterior e próxima na lista", () => {
    const v = vizinhos(linhas, "id-2");
    expect([v.anterior?.numero, v.proxima?.numero]).toEqual([1, 3]);
  });
});
