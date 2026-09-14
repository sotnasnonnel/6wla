import { describe, expect, it } from "vitest";
import {
  achaLinhaCabecalho,
  matrizParaLinhas,
  normalizaChave,
  parseData,
  parsePrioridade,
  parseStatus,
  saneiaMapa,
  sugereMapa,
  traduzLinha,
} from "./mapa";

/** Cabeçalhos reais da planilha 6wla.xlsx (linha 6 da aba 6WLA). */
const CABECALHOS_6WLA = [
  "Coluna 1",
  "ID",
  "Status",
  "Considera data limite?",
  "Considera data conclusão?",
  "Semana da data limite",
  "Semana da conclusão",
  "Semana de início da atividade impactada",
  "Previsibilidade",
  "!",
  "Data de criação",
  "ID Atividade",
  "Causa 6M",
  "Restrição",
  "Ação",
  "Data limite de remoção",
  "Atividade Impactada",
  "Início da atividade impactada",
  "AREA ",
  "Local",
  "RESPONSAVEL ",
  "SETOR ",
  "Classificação",
  "Concluído?",
  "Data real de conclusão",
  "Previsão de conclusão",
  "Descrição do status",
  "Impeditivo?",
  "6M",
  "E-mail Responsável",
  "Telefone",
  "Período",
  "Tempo de Resolução",
];

describe("normalizaChave", () => {
  it("ignora acento, pontuação, espaços e caixa", () => {
    expect(normalizaChave("E-mail  Responsável ")).toBe(
      normalizaChave("EMAIL RESPONSAVEL"),
    );
    expect(normalizaChave("O QUÊ")).toBe("OQUE");
  });
});

describe("sugereMapa com a planilha 6WLA real", () => {
  const mapa = sugereMapa(CABECALHOS_6WLA);

  it("acha os campos principais", () => {
    expect(mapa).toMatchObject({
      codigo: "ID",
      status: "Status",
      descricao: "Restrição",
      acao: "Ação",
      data_criacao: "Data de criação",
      data_limite: "Data limite de remoção",
      atividade_impactada: "Atividade Impactada",
      inicio_atividade: "Início da atividade impactada",
      area: "AREA ",
      localizacao: "Local",
      responsavel_nome: "RESPONSAVEL ",
      setor: "SETOR ",
      classificacao: "Classificação",
      data_conclusao: "Data real de conclusão",
      previsao_conclusao: "Previsão de conclusão",
      descricao_status: "Descrição do status",
      responsavel_email: "E-mail Responsável",
      responsavel_telefone: "Telefone",
      id_atividade: "ID Atividade",
      causa_6m: "Causa 6M",
    });
  });

  it("não usa a mesma coluna em dois campos", () => {
    const colunas = Object.values(mapa);
    expect(new Set(colunas).size).toBe(colunas.length);
  });

  it("deixa colunas calculadas de fora", () => {
    const colunas = Object.values(mapa);
    expect(colunas).not.toContain("Previsibilidade");
    expect(colunas).not.toContain("!");
    expect(colunas).not.toContain("Semana da data limite");
  });
});

describe("sugereMapa com planilha em outro padrão", () => {
  it("reconhece O QUÊ / PRAZO PARA SOLUÇÃO / GERÊNCIA", () => {
    const mapa = sugereMapa([
      "O QUÊ",
      "RESPONSÁVEL",
      "PRAZO PARA SOLUÇÃO",
      "GERÊNCIA",
      "Status",
    ]);
    expect(mapa).toMatchObject({
      descricao: "O QUÊ",
      responsavel_nome: "RESPONSÁVEL",
      data_limite: "PRAZO PARA SOLUÇÃO",
      setor: "GERÊNCIA",
      status: "Status",
    });
  });
});

describe("saneiaMapa", () => {
  it("descarta coluna inexistente e duplicada", () => {
    const mapa = saneiaMapa(
      { descricao: "Restrição", acao: "Restrição", setor: "Não existe" },
      ["Restrição", "Setor"],
    );
    expect(mapa).toEqual({ descricao: "Restrição" });
  });
  it("devolve vazio para lixo", () => {
    expect(saneiaMapa("x", ["A"])).toEqual({});
  });
});

describe("parseData", () => {
  it("serial do Excel", () => {
    expect(parseData(46000)).toBe("2025-12-09");
  });
  it("Date em UTC", () => {
    expect(parseData(new Date(Date.UTC(2026, 2, 5)))).toBe("2026-03-05");
  });
  it("texto dd/mm/aaaa e ISO", () => {
    expect(parseData("05/03/2026")).toBe("2026-03-05");
    expect(parseData("2026-03-05 00:00:00")).toBe("2026-03-05");
  });
  it("rejeita lixo", () => {
    expect(parseData("amanhã")).toBeNull();
    expect(parseData(3)).toBeNull();
    expect(parseData("32/13/2026")).toBeNull();
  });
});

describe("parseStatus", () => {
  it('"Concluído com atraso" e "Concluído no prazo" viram concluida', () => {
    expect(parseStatus("Concluído com atraso")).toBe("concluida");
    expect(parseStatus("Concluído no prazo")).toBe("concluida");
  });
  it('"No Prazo" e "Atrasado" viram pendente (atraso é cálculo, não status)', () => {
    expect(parseStatus("No Prazo")).toBe("pendente");
    expect(parseStatus("Atrasado")).toBe("pendente");
  });
  it("em andamento e cancelada", () => {
    expect(parseStatus("Em tratativa")).toBe("em_andamento");
    expect(parseStatus("Cancelada")).toBe("cancelada");
  });
  it("desconhecido é pendente", () => {
    expect(parseStatus("Aguardando cliente")).toBe("pendente");
    expect(parseStatus(null)).toBe("pendente");
  });
});

describe("parsePrioridade", () => {
  it("mapeia rótulos do Planner", () => {
    expect(parsePrioridade("Urgente")).toBe("urgente");
    expect(parsePrioridade("Importante")).toBe("alta");
    expect(parsePrioridade("Médio")).toBe("media");
    expect(parsePrioridade(null)).toBe("media");
  });
});

describe("traduzLinha", () => {
  const mapa = sugereMapa(CABECALHOS_6WLA);
  const linha = {
    ID: 1,
    Status: "Concluído no prazo",
    "Data de criação": "2026-03-03",
    "ID Atividade": "GERAL",
    "Causa 6M": "MATERIAL ",
    Restrição: "Tenda área de vivência",
    Ação: "Necessidade de 1 Tenda 4x4",
    "Data limite de remoção": "2026-03-05",
    "Atividade Impactada": "Mobilização",
    "Início da atividade impactada": "2026-03-06",
    "AREA ": "Canteiro",
    Local: "Canteiro de Obras",
    "RESPONSAVEL ": "Daniel Souza",
    "SETOR ": "Compras",
    Classificação: "Suprimentos / Material",
    "Concluído?": "True",
    "Data real de conclusão": "2026-03-05",
    "E-mail Responsável": "Daniel.Souza@Empresa.com.br",
    Previsibilidade: 2,
    "!": -181,
  };

  it("traduz a linha real da 6WLA", () => {
    const r = traduzLinha(linha, mapa);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.restricao).toMatchObject({
      codigo: "1",
      status: "concluida",
      descricao: "Tenda área de vivência",
      acao: "Necessidade de 1 Tenda 4x4",
      data_criacao: "2026-03-03",
      data_limite: "2026-03-05",
      data_conclusao: "2026-03-05",
      inicio_atividade: "2026-03-06",
      area: "Canteiro",
      setor: "Compras",
      causa_6m: "MATERIAL",
      responsavel_nome: "Daniel Souza",
      responsavel_email: "daniel.souza@empresa.com.br",
    });
    expect(r.restricao.extras).toMatchObject({
      "Concluído?": "True",
      Previsibilidade: "2",
      "!": "-181",
    });
    expect(r.restricao.extras).not.toHaveProperty("Restrição");
  });

  it("descarta linha sem descrição", () => {
    const r = traduzLinha({ ...linha, Restrição: "   " }, mapa);
    expect(r).toEqual({ ok: false, motivo: "sem descrição" });
  });

  it("concluída sem data real usa a previsão", () => {
    const r = traduzLinha(
      {
        ...linha,
        "Data real de conclusão": null,
        "Previsão de conclusão": "2026-04-01",
      },
      mapa,
    );
    expect(r.ok && r.restricao.data_conclusao).toBe("2026-04-01");
  });
});

describe("matrizParaLinhas", () => {
  const matriz: unknown[][] = [
    [null, "CONTROLE DE RESTRIÇÕES"],
    [],
    [
      null,
      "Data de atualização:",
      null,
      new Date(Date.UTC(2026, 8, 3)),
      null,
      "Controle necessário",
      "Verificar",
    ],
    [null, "ID", "Status", "Restrição", "Prazo"],
    [null, 1, "Pendente", "Falta projeto", new Date(Date.UTC(2026, 8, 10))],
    [null, null, null, null, null],
    [null, 2, "No Prazo", "Falta material", 46010],
  ];

  it("acha o cabeçalho pulando título e linha de metadados com 4 células", () => {
    expect(achaLinhaCabecalho(matriz)).toBe(3);
  });

  it("gera objetos por cabeçalho e ignora linhas vazias", () => {
    const { cabecalhos, linhas } = matrizParaLinhas(matriz);
    expect(cabecalhos).toEqual([
      "Coluna 1",
      "ID",
      "Status",
      "Restrição",
      "Prazo",
    ]);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      ID: "1",
      Restrição: "Falta projeto",
      Prazo: "2026-09-10",
    });
    expect(linhas[1]).toMatchObject({ Prazo: "46010" });
  });
});
