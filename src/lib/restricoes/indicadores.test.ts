import { describe, expect, it } from "vitest";
import {
  tetoDoEixo,
  formataDecimal,
  formataPercentual,
  mediaResolucaoPor,
  porDimensao,
  porSemana,
  rankingConclusao,
  resumo,
  SEM_VALOR,
  semanaDe,
  situacaoDe,
  tempoAtraso,
  tempoResolucao,
  type LinhaIndicador,
} from "./indicadores";
import type { Status } from "./dominio";

const HOJE = "2026-09-03";

function linha(
  p: Partial<LinhaIndicador> & { status?: Status } = {},
): LinhaIndicador {
  return {
    status: "pendente",
    data_criacao: "2026-08-01",
    data_limite: "2026-09-10",
    data_conclusao: null,
    ...p,
  };
}

describe("situacaoDe", () => {
  it("concluída antes do prazo é concluída no prazo", () => {
    const r = linha({
      status: "concluida",
      data_limite: "2026-08-20",
      data_conclusao: "2026-08-18",
    });
    expect(situacaoDe(r, HOJE)).toBe("concluida_no_prazo");
  });

  it("concluída no dia do prazo ainda é no prazo", () => {
    const r = linha({
      status: "concluida",
      data_limite: "2026-08-20",
      data_conclusao: "2026-08-20",
    });
    expect(situacaoDe(r, HOJE)).toBe("concluida_no_prazo");
  });

  it("concluída depois do prazo é concluída com atraso", () => {
    const r = linha({
      status: "concluida",
      data_limite: "2026-08-20",
      data_conclusao: "2026-08-25",
    });
    expect(situacaoDe(r, HOJE)).toBe("concluida_com_atraso");
  });

  it("concluída sem prazo não conta como atraso", () => {
    const r = linha({
      status: "concluida",
      data_limite: null,
      data_conclusao: "2026-08-25",
    });
    expect(situacaoDe(r, HOJE)).toBe("concluida_no_prazo");
  });

  it("aberta com prazo futuro está no prazo; vencido, atrasada", () => {
    expect(situacaoDe(linha({ data_limite: "2026-09-10" }), HOJE)).toBe(
      "no_prazo",
    );
    expect(situacaoDe(linha({ data_limite: "2026-09-02" }), HOJE)).toBe(
      "atrasada",
    );
    expect(situacaoDe(linha({ data_limite: "2026-09-03" }), HOJE)).toBe(
      "no_prazo",
    );
  });

  it("em andamento segue a mesma regra de prazo", () => {
    expect(
      situacaoDe(
        linha({ status: "em_andamento", data_limite: "2026-08-01" }),
        HOJE,
      ),
    ).toBe("atrasada");
  });

  it("cancelada é situação própria, mesmo com prazo vencido", () => {
    expect(
      situacaoDe(
        linha({ status: "cancelada", data_limite: "2026-01-01" }),
        HOJE,
      ),
    ).toBe("cancelada");
  });

  it("aberta sem prazo nunca é atrasada", () => {
    expect(situacaoDe(linha({ data_limite: null }), HOJE)).toBe("no_prazo");
  });
});

describe("tempoResolucao e tempoAtraso", () => {
  it("resolução conta da criação até a conclusão", () => {
    const r = linha({
      status: "concluida",
      data_criacao: "2026-08-01",
      data_conclusao: "2026-08-14",
    });
    expect(tempoResolucao(r)).toBe(13);
  });

  it("resolução é nula enquanto não concluída", () => {
    expect(tempoResolucao(linha())).toBeNull();
  });

  it("atraso de concluída é o quanto passou do prazo", () => {
    const r = linha({
      status: "concluida",
      data_limite: "2026-08-20",
      data_conclusao: "2026-08-25",
    });
    expect(tempoAtraso(r, HOJE)).toBe(5);
  });

  it("concluída no prazo não tem atraso", () => {
    const r = linha({
      status: "concluida",
      data_limite: "2026-08-25",
      data_conclusao: "2026-08-20",
    });
    expect(tempoAtraso(r, HOJE)).toBeNull();
  });

  it("aberta atrasada conta o atraso até hoje", () => {
    expect(tempoAtraso(linha({ data_limite: "2026-08-31" }), HOJE)).toBe(3);
  });

  it("sem prazo não há atraso", () => {
    expect(tempoAtraso(linha({ data_limite: null }), HOJE)).toBeNull();
  });
});

describe("resumo", () => {
  const linhas: LinhaIndicador[] = [
    linha({
      status: "concluida",
      data_criacao: "2026-08-01",
      data_limite: "2026-08-20",
      data_conclusao: "2026-08-11",
    }),
    linha({
      status: "concluida",
      data_criacao: "2026-08-01",
      data_limite: "2026-08-20",
      data_conclusao: "2026-08-21",
    }),
    linha({ data_limite: "2026-09-30" }),
    linha({ data_limite: "2026-08-01" }),
    linha({ status: "cancelada", data_limite: "2026-08-01" }),
  ];
  const r = resumo(linhas, HOJE);

  it("conta cada situação", () => {
    expect(r).toMatchObject({
      total: 5,
      concluidas: 2,
      concluidasNoPrazo: 1,
      concluidasComAtraso: 1,
      noPrazo: 1,
      atrasadas: 1,
      canceladas: 1,
      abertas: 2,
    });
  });

  it("IRR ignora canceladas no denominador", () => {
    expect(r.irr).toBeCloseTo(2 / 4);
  });

  it("aderência ao prazo é sobre as concluídas", () => {
    expect(r.aderenciaPrazo).toBeCloseTo(0.5);
  });

  it("média de resolução usa só as concluídas", () => {
    expect(r.mediaResolucao).toBeCloseTo((10 + 20) / 2);
  });

  it("média de atraso usa só as abertas atrasadas", () => {
    expect(r.mediaAtrasoAbertas).toBe(33);
  });

  it("lista vazia não divide por zero", () => {
    const vazio = resumo([], HOJE);
    expect(vazio).toMatchObject({
      total: 0,
      irr: 0,
      aderenciaPrazo: 0,
      mediaResolucao: null,
    });
  });
});

describe("porDimensao", () => {
  const linhas = [
    {
      ...linha({
        status: "concluida",
        data_limite: "2026-08-20",
        data_conclusao: "2026-08-10",
      }),
      setor: "Engenharia",
    },
    { ...linha({ data_limite: "2026-08-01" }), setor: "Engenharia" },
    { ...linha({ data_limite: "2026-09-30" }), setor: "Compras" },
    { ...linha({ data_limite: "2026-09-30" }), setor: "  " },
  ];

  it("agrupa e conta situações, do maior para o menor", () => {
    const g = porDimensao(linhas, "setor", { hoje: HOJE });
    // (sem informação) desce para o fim mesmo empatando em contagem.
    expect(g.map((x) => x.chave)).toEqual(["Engenharia", "Compras", SEM_VALOR]);
    expect(g[0]).toMatchObject({ total: 2 });
    expect(g[0]?.contagem).toMatchObject({
      concluida_no_prazo: 1,
      atrasada: 1,
    });
  });

  it("respeita o limite de linhas", () => {
    expect(
      porDimensao(linhas, "setor", { hoje: HOJE, limite: 1 }),
    ).toHaveLength(1);
  });

  it("junta variações de grafia e usa a forma mais frequente", () => {
    const variacoes = [
      { ...linha(), causa: "MÉTODO" },
      { ...linha(), causa: "MÉTODO" },
      { ...linha(), causa: "Método" },
      { ...linha(), causa: "metodo " },
    ];
    const g = porDimensao(variacoes, "causa", { hoje: HOJE });
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ chave: "MÉTODO", total: 4 });
  });

  it("campo inexistente cai todo em (sem informação)", () => {
    const g = porDimensao(linhas, "nao_existe", { hoje: HOJE });
    expect(g).toHaveLength(1);
    expect(g[0]?.chave).toBe(SEM_VALOR);
  });
});

describe("semanaDe", () => {
  it("usa a semana ISO e o mês da quinta-feira", () => {
    // 2026-09-03 é quinta; a semana começa em 31/ago mas pertence a setembro.
    expect(semanaDe("2026-09-03")).toMatchObject({
      chave: "2026-W36",
      rotulo: "S36",
      mes: "set",
    });
  });

  it("vira o ano corretamente na semana 1", () => {
    // 2027-01-01 é sexta; a semana ISO 53 de 2026 vai até 2027-01-03.
    expect(semanaDe("2027-01-01")?.chave).toBe("2026-W53");
  });

  it("rejeita data inválida", () => {
    expect(semanaDe("nada")).toBeNull();
  });
});

describe("porSemana", () => {
  const linhas: LinhaIndicador[] = [
    linha({
      status: "concluida",
      data_limite: "2026-08-05",
      data_conclusao: "2026-08-05",
    }),
    linha({
      status: "concluida",
      data_limite: "2026-08-05",
      data_conclusao: "2026-08-12",
    }),
    linha({ data_limite: "2026-08-12" }),
  ];

  it("separa concluídas por conclusão e previstas por prazo", () => {
    const s = porSemana(linhas);
    expect(s.map((p) => p.rotulo)).toEqual(["S32", "S33"]);
    expect(s[0]).toMatchObject({ concluidas: 1, previstas: 2 });
    expect(s[1]).toMatchObject({ concluidas: 1, previstas: 1 });
  });

  it("acumula as duas séries", () => {
    const s = porSemana(linhas);
    expect(s[1]).toMatchObject({
      acumuladoConcluidas: 2,
      acumuladoPrevistas: 3,
    });
  });

  it("ignora linhas sem data", () => {
    expect(porSemana([linha({ data_limite: null })])).toEqual([]);
  });

  it("não conta restrição cancelada como prevista na semana do prazo", () => {
    const s = porSemana([
      linha({ status: "cancelada", data_limite: "2026-09-02" }),
    ]);
    expect(s.map((p) => p.previstas)).toEqual([]);
  });
});

describe("mediaResolucaoPor", () => {
  const linhas = [
    {
      ...linha({
        status: "concluida",
        data_criacao: "2026-08-01",
        data_conclusao: "2026-08-11",
      }),
      responsavel_nome: "Ana",
    },
    {
      ...linha({
        status: "concluida",
        data_criacao: "2026-08-01",
        data_conclusao: "2026-08-21",
      }),
      responsavel_nome: "Ana",
    },
    {
      ...linha({
        status: "concluida",
        data_criacao: "2026-08-01",
        data_conclusao: "2026-08-06",
      }),
      responsavel_nome: "Beto",
    },
    { ...linha({ data_limite: "2026-09-30" }), responsavel_nome: "Beto" },
  ];

  it("calcula a média só das concluídas, da maior para a menor", () => {
    const m = mediaResolucaoPor(linhas, "responsavel_nome");
    expect(m).toEqual([
      { chave: "Ana", dias: 15, concluidas: 2 },
      { chave: "Beto", dias: 5, concluidas: 1 },
    ]);
  });

  it("quem não concluiu nada fica de fora", () => {
    const m = mediaResolucaoPor(
      [{ ...linha(), responsavel_nome: "Ciça" }],
      "responsavel_nome",
    );
    expect(m).toEqual([]);
  });
});

describe("formatação", () => {
  it("percentual e decimal em português", () => {
    expect(formataPercentual(0.901875, 2)).toBe("90,19%");
    expect(formataDecimal(12.4567)).toBe("12,5");
    expect(formataDecimal(null)).toBe("—");
  });
});

describe("tetoDoEixo", () => {
  it("fica logo acima do maior valor, em número redondo", () => {
    expect(tetoDoEixo(272)).toBe(300);
    expect(tetoDoEixo(130)).toBe(150);
    expect(tetoDoEixo(693)).toBe(800);
    expect(tetoDoEixo(100)).toBe(100);
    expect(tetoDoEixo(7)).toBe(8);
  });

  it("nunca devolve zero", () => {
    expect(tetoDoEixo(0)).toBe(1);
  });
});

describe("rankingConclusao", () => {
  const linhas = [
    // Ana: 3 concluídas (2 no prazo), 1 aberta.
    { ...linha({ status: "concluida", data_limite: "2026-08-20", data_conclusao: "2026-08-10" }), responsavel: "Ana" },
    { ...linha({ status: "concluida", data_limite: "2026-08-20", data_conclusao: "2026-08-15" }), responsavel: "ana" },
    { ...linha({ status: "concluida", data_limite: "2026-08-20", data_conclusao: "2026-08-25" }), responsavel: "ANA " },
    { ...linha({ data_limite: "2026-09-30" }), responsavel: "Ana" },
    // Bruno: 3 concluídas, todas no prazo — empata em volume e ganha no critério.
    { ...linha({ status: "concluida", data_limite: "2026-08-20", data_conclusao: "2026-08-01" }), responsavel: "Bruno" },
    { ...linha({ status: "concluida", data_limite: "2026-08-20", data_conclusao: "2026-08-02" }), responsavel: "Bruno" },
    { ...linha({ status: "concluida", data_limite: "2026-08-20", data_conclusao: "2026-08-03" }), responsavel: "Bruno" },
    // Célia: muito volume, pouca conclusão.
    { ...linha({ data_limite: "2026-08-01" }), responsavel: "Célia" },
    { ...linha({ data_limite: "2026-08-01" }), responsavel: "Célia" },
    { ...linha({ status: "concluida", data_limite: "2026-08-20", data_conclusao: "2026-08-19" }), responsavel: "Célia" },
    { ...linha({ status: "cancelada" }), responsavel: "Célia" },
    // Sem responsável: não entra no pódio.
    { ...linha({ status: "concluida", data_limite: "2026-08-20", data_conclusao: "2026-08-05" }), responsavel: null },
  ];
  const ranking = rankingConclusao(linhas, "responsavel", { hoje: HOJE });

  it("ordena por concluídas e desempata por conclusão no prazo", () => {
    expect(ranking.map((i) => [i.posicao, i.chave])).toEqual([
      [1, "Bruno"],
      [2, "Ana"],
      [3, "Célia"],
    ]);
  });

  it("agrupa grafias diferentes do mesmo nome", () => {
    expect(ranking[1]).toMatchObject({ chave: "Ana", concluidas: 3, concluidasNoPrazo: 2, concluidasComAtraso: 1, total: 4, abertas: 1 });
  });

  it("não ranqueia quem não tem responsável", () => {
    expect(ranking.map((i) => i.chave)).not.toContain(SEM_VALOR);
  });

  it("IRR de cada um ignora as canceladas dele", () => {
    expect(ranking[2]).toMatchObject({ chave: "Célia", total: 4 });
    expect(ranking[2]?.irr).toBeCloseTo(1 / 3);
    expect(ranking[2]?.aderencia).toBeCloseTo(1);
  });

  it("respeita o limite", () => {
    expect(rankingConclusao(linhas, "responsavel", { hoje: HOJE, limite: 2 })).toHaveLength(2);
  });
});
