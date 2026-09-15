import { describe, expect, it } from "vitest";
import { CAMPOS_PPC, ROTULOS_PPC } from "./dominio";
import {
  matrizPpc,
  quantidadePpc,
  sugereMapaPpc,
  traduzPpc,
} from "./importacao";
import { geraXlsx } from "@/lib/exportacao/xlsx";
import { leXlsx } from "@/lib/importacao/xlsx";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

const cabecalhos = CAMPOS_PPC.map((c) => ROTULOS_PPC[c]);
const valores = [
  "AT-001",
  "Montagem de tubulação",
  "S-38",
  "1.200,50",
  "0",
  "Planejada",
  "Aguardar liberação",
  "Material",
  "Líder A",
  "Encarregado B",
  "Responsável C",
  "Mecânica",
  "14/09/2026",
  "20/09/2026",
];
const mapa = sugereMapaPpc(cabecalhos);
const linha = (numero = 4, alteracoes: Record<string, string> = {}) => ({
  numero,
  valores: {
    ...Object.fromEntries(cabecalhos.map((h, i) => [h, valores[i] ?? ""])),
    ...alteracoes,
  },
});

describe("importação PPC", () => {
  it("identifica todos os campos solicitados, incluindo grafias alternativas", () => {
    const alternativos = cabecalhos.map((c) =>
      c === "Disciplina"
        ? "Dsciplina"
        : c === "Status Planejamento"
          ? "Status Planjemaneto"
          : c,
    );
    expect(Object.keys(sugereMapaPpc(alternativos))).toHaveLength(
      CAMPOS_PPC.length,
    );
  });
  it("encontra cabeçalhos após a capa e preserva o número real da linha", () => {
    const dados = matrizPpc([["Relatório semanal"], [], cabecalhos, valores]);
    expect(dados.linhas[0]).toEqual(linha());
  });
  it("converte quantidades brasileiras e datas, preservando zero realizado", () => {
    expect(traduzPpc([linha()], mapa, cabecalhos).atividades[0]).toMatchObject({
      quantidade_prevista: 1200.5,
      quantidade_realizada: 0,
      inicio_semana: "2026-09-14",
      termino_semana: "2026-09-20",
    });
  });
  it("distingue realizado não informado de realizado zero", () => {
    expect(
      traduzPpc([linha(4, { "Quantidade realizada": "" })], mapa, cabecalhos)
        .atividades[0]?.quantidade_realizada,
    ).toBeNull();
  });
  it.each(["31/02/2026", "13/09/2026"])(
    "recusa término inválido ou anterior ao início: %s",
    (termino) => {
      expect(
        traduzPpc(
          [linha(4, { "Término da semana": termino })],
          mapa,
          cabecalhos,
        ).erros,
      ).toHaveLength(1);
    },
  );
  it("recusa quantidades negativas ou texto sem substituir por zero", () => {
    expect(
      traduzPpc(
        [
          linha(4, { "Quantidade realizada": "-2" }),
          linha(5, { "Quantidade realizada": "dez" }),
        ],
        mapa,
        cabecalhos,
      ).erros,
    ).toHaveLength(2);
  });
  it("recusa duplicata de ID na mesma semana e início", () => {
    expect(traduzPpc([linha(), linha(5)], mapa, cabecalhos).erros[0]).toContain(
      "repetido",
    );
  });
  it("permite a mesma atividade na semana de outro ano", () => {
    expect(
      traduzPpc(
        [
          linha(),
          linha(5, {
            "Início da semana": "20/09/2027",
            "Término da semana": "26/09/2027",
          }),
        ],
        mapa,
        cabecalhos,
      ).atividades,
    ).toHaveLength(2);
  });
  it("exige mapeamento dos campos de identificação e planejamento", () => {
    expect(traduzPpc([linha()], {}, cabecalhos).erros[0]).toContain(
      "Identifique as colunas",
    );
  });
  it("rejeita reutilização da mesma coluna em campos diferentes", () => {
    expect(
      traduzPpc(
        [linha()],
        { ...mapa, quantidade_realizada: mapa.quantidade_prevista },
        cabecalhos,
      ).erros[0],
    ).toContain("diferente");
  });
  it.each(["PPC", "Programação"])(
    "lê os campos de um arquivo Excel com aba %s",
    (aba) => {
      const bytes = geraXlsx({
        aba,
        colunas: cabecalhos.map((c) => ({ cabecalho: c })),
        linhas: [valores.map((v, i) => (i === 4 ? null : v))],
      });
      const dados = matrizPpc(leXlsx(bytes, aba).matriz);
      expect(
        traduzPpc(dados.linhas, dados.mapa, dados.cabecalhos).atividades,
      ).toHaveLength(1);
    },
  );
  it("aceita decimal nativo do Excel sem multiplicar por mil", () => {
    expect(quantidadePpc("1.234")).toBe(1.234);
  });
  it.each(["A4294967294", "ZZZZZZZ1"])(
    "recusa referência esparsa %s antes de expandir a matriz",
    (referencia) => {
      const arquivos = unzipSync(
        geraXlsx({
          aba: "PPC",
          colunas: [{ cabecalho: "ID" }],
          linhas: [["AT-001"]],
        }),
      );
      arquivos["xl/worksheets/sheet1.xml"] = strToU8(
        strFromU8(arquivos["xl/worksheets/sheet1.xml"]).replace(
          'r="A1"',
          `r="${referencia}"`,
        ),
      );
      expect(() => leXlsx(zipSync(arquivos), "PPC")).toThrow(
        /Referência de célula fora dos limites/,
      );
    },
  );
});
