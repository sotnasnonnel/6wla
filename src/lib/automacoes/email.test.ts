import { describe, expect, it } from "vitest";
import { COLUNAS_PLANILHA, dataEmail } from "./colunas";
import {
  agrupaPorResponsavel,
  escapaHtml,
  montaAssunto,
  montaEmails,
  montaEmailTeste,
  situacaoEmail,
  type ContextoEmail,
  type RestricaoComPerfil,
} from "./email";
import { automacaoSchema, modeloPlanilha } from "./schema";

const HOJE = "2026-09-16";

let seq = 0;
function restricao(p: Partial<RestricaoComPerfil> = {}): RestricaoComPerfil {
  seq += 1;
  return {
    id: `id-${seq}`,
    numero: seq,
    codigo: null,
    descricao: `Restrição ${seq}`,
    acao: null,
    status: "pendente",
    prioridade: "media",
    data_criacao: "2026-09-01",
    data_limite: "2026-09-10",
    prazo_original: null,
    previsao_conclusao: null,
    data_conclusao: null,
    atividade_impactada: null,
    id_atividade: null,
    inicio_atividade: null,
    classificacao: null,
    localizacao: null,
    setor: null,
    area: null,
    causa_6m: null,
    descricao_status: null,
    observacoes: null,
    semana_programada: null,
    responsavel_id: "u-ana",
    responsavel_nome: null,
    responsavel_email: null,
    responsavel: { nome: "Ana", email: "ana@phd.com" },
    ...p,
  };
}

function contexto(
  config: Partial<ContextoEmail["config"]> = {},
): ContextoEmail {
  return {
    obra: { id: "obra-1", codigo: "HRMS", nome: "Hospital" },
    site: "https://6wla.exemplo.com",
    hoje: HOJE,
    config: { ...modeloPlanilha(), ...config },
  };
}

describe("situacaoEmail", () => {
  it("classifica aberta vencida como atrasada", () => {
    expect(situacaoEmail(restricao({ data_limite: "2026-09-15" }), HOJE)).toBe(
      "atrasada",
    );
  });

  it("classifica prazo de hoje como no prazo", () => {
    expect(situacaoEmail(restricao({ data_limite: HOJE }), HOJE)).toBe(
      "no_prazo",
    );
  });

  it("classifica aberta sem data limite como sem prazo", () => {
    expect(situacaoEmail(restricao({ data_limite: null }), HOJE)).toBe(
      "sem_prazo",
    );
  });

  it("ignora concluída", () => {
    expect(
      situacaoEmail(
        restricao({ status: "concluida", data_conclusao: HOJE }),
        HOJE,
      ),
    ).toBeNull();
  });
});

describe("agrupaPorResponsavel", () => {
  it("junta as restrições do mesmo perfil num grupo só", () => {
    const grupos = agrupaPorResponsavel(
      [
        restricao(),
        restricao({ responsavel: { nome: "Ana Souza", email: "ANA@phd.com" } }),
      ],
      ["atrasada"],
      HOJE,
    );
    expect(grupos.map((g) => [g.email, g.itens.length])).toEqual([
      ["ana@phd.com", 2],
    ]);
  });

  it("usa o e-mail da coluna da planilha quando não há usuário vinculado", () => {
    const grupos = agrupaPorResponsavel(
      [
        restricao({
          responsavel_id: null,
          responsavel: null,
          responsavel_nome: "Caio",
          responsavel_email: " Caio@Obra.com ",
        }),
      ],
      ["atrasada"],
      HOJE,
    );
    expect(grupos.map((g) => g.email)).toEqual(["caio@obra.com"]);
  });

  it("prefere o e-mail do usuário vinculado ao digitado", () => {
    const grupos = agrupaPorResponsavel(
      [restricao({ responsavel_email: "outro@obra.com" })],
      ["atrasada"],
      HOJE,
    );
    expect(grupos.map((g) => g.email)).toEqual(["ana@phd.com"]);
  });

  it("deixa de fora as situações não escolhidas", () => {
    const grupos = agrupaPorResponsavel(
      [restricao({ data_limite: "2026-12-01" })],
      ["atrasada"],
      HOJE,
    );
    expect(grupos).toEqual([]);
  });
});

describe("montaEmails por responsável", () => {
  it("manda um e-mail por pessoa com o nome dela no assunto", () => {
    const { emails } = montaEmails(
      [
        restricao(),
        restricao({
          responsavel_id: "u-bruno",
          responsavel: { nome: "Bruno", email: "bruno@phd.com" },
        }),
      ],
      contexto({ copias: ["chefe@phd.com"] }),
    );
    expect(emails.map((e) => [e.destinatario, e.assunto, e.copias])).toEqual([
      ["ana@phd.com", "Relatório de restrições – Ana", ["chefe@phd.com"]],
      ["bruno@phd.com", "Relatório de restrições – Bruno", ["chefe@phd.com"]],
    ]);
  });

  it("põe o gestor dono da obra em cópia de todo e-mail", () => {
    const { emails } = montaEmails([restricao()], {
      ...contexto({ copias: ["chefe@phd.com"] }),
      copiasFixas: ["Gestor@phd.com"],
    });
    expect(emails.map((e) => e.copias)).toEqual([
      ["chefe@phd.com", "gestor@phd.com"],
    ]);
  });

  it("conta quem não tem e-mail em vez de enviar", () => {
    const r = montaEmails(
      [
        restricao({
          responsavel_id: null,
          responsavel: null,
          responsavel_nome: "Caio",
          responsavel_email: "e-mail inválido",
        }),
      ],
      contexto(),
    );
    expect([r.emails.length, r.semEmail]).toEqual([
      0,
      [{ nome: "Caio", total: 1 }],
    ]);
  });

  it("não monta e-mail vazio", () => {
    expect(montaEmails([], contexto()).emails).toEqual([]);
  });

  it("escapa o texto vindo do banco", () => {
    const { emails } = montaEmails(
      [restricao({ descricao: '<script>alert("x")</script>' })],
      contexto(),
    );
    expect(emails[0]?.html).not.toContain("<script>");
  });

  it("mostra as datas no formato dd-mm-aaaa", () => {
    const { emails } = montaEmails([restricao()], contexto());
    expect(emails[0]?.html).toContain("10-09-2026");
  });

  it("usa a logo e o link do site por URL absoluta", () => {
    const html = montaEmails([restricao()], contexto()).emails[0]?.html ?? "";
    expect([
      html.includes("https://6wla.exemplo.com/logo-phd.png"),
      html.includes("https://6wla.exemplo.com/obras/obra-1/tabela"),
    ]).toEqual([true, true]);
  });

  it("omite logo e link sem site configurado", () => {
    const ctx = { ...contexto(), site: null };
    const html = montaEmails([restricao()], ctx).emails[0]?.html ?? "";
    expect(html).not.toContain("<img");
  });
});

describe("montaEmails para lista fixa", () => {
  it("manda um e-mail só, com todos os responsáveis", () => {
    const { emails } = montaEmails(
      [
        restricao(),
        restricao({ responsavel: null, responsavel_nome: "Bruno" }),
      ],
      contexto({
        destino: "lista",
        destinatarios: ["x@phd.com", "y@phd.com"],
        copias: ["x@phd.com", "z@phd.com"],
      }),
    );
    expect(
      emails.map((e) => [
        e.destinatario,
        e.copias,
        e.total,
        e.html.includes("Bruno"),
      ]),
    ).toEqual([["x@phd.com, y@phd.com", ["z@phd.com"], 2, true]]);
  });
});

describe("montaEmailTeste", () => {
  it("vai só para quem pediu, marcado como teste", () => {
    const e = montaEmailTeste(
      [restricao()],
      contexto({ copias: ["c@phd.com"] }),
      "g@phd.com",
    );
    expect([e?.destinatario, e?.copias, e?.assunto]).toEqual([
      "g@phd.com",
      [],
      "[Teste] Relatório de restrições – Todos",
    ]);
  });
});

describe("utilidades", () => {
  it("escapa aspas e sinais", () => {
    expect(escapaHtml(`<a href="x">'&`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;",
    );
  });

  it("troca os marcadores e remove quebra de linha do assunto", () => {
    expect(
      montaAssunto("{obra} {data}\r\n{responsavel}", {
        responsavel: "Ana",
        obra: { id: "o", codigo: "HRMS", nome: "H" },
        hoje: HOJE,
      }),
    ).toBe("HRMS 16-09-2026 Ana");
  });

  it("formata data no padrão do relatório", () => {
    expect(dataEmail("2026-01-02")).toBe("02-01-2026");
  });
});

describe("automacaoSchema", () => {
  it("aceita o modelo da planilha", () => {
    expect(automacaoSchema.safeParse(modeloPlanilha()).success).toBe(true);
  });

  it("recusa coluna fora do catálogo", () => {
    const r = automacaoSchema.safeParse({
      ...modeloPlanilha(),
      colunas: ["senha"],
    });
    expect(r.success).toBe(false);
  });

  it("recusa lista fixa sem destinatário", () => {
    const r = automacaoSchema.safeParse({
      ...modeloPlanilha(),
      destino: "lista",
    });
    expect(r.success).toBe(false);
  });

  it("recusa e-mail inválido nas cópias", () => {
    const r = automacaoSchema.safeParse({
      ...modeloPlanilha(),
      copias: ["a@b.com\nBcc: x"],
    });
    expect(r.success).toBe(false);
  });

  it("normaliza e-mails e remove repetidos", () => {
    const r = automacaoSchema.parse({
      ...modeloPlanilha(),
      copias: ["A@phd.com", "a@phd.com "],
    });
    expect(r.copias).toEqual(["a@phd.com"]);
  });

  it("modelo tem as 9 colunas da planilha", () => {
    expect(modeloPlanilha().colunas).toEqual(COLUNAS_PLANILHA);
  });
});
