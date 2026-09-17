import { describe, expect, it } from "vitest";
import { LINHA_ORIGEM, matrizParaLinhas, type MapaColunas } from "./mapa";
import {
  planejaImportacao,
  previaDaLinha,
  rotuloPosicao,
  travaVigente,
} from "./plano";

const MAPA: MapaColunas = {
  codigo: "ID",
  descricao: "Restrição",
  status: "Status",
  data_limite: "Prazo",
  responsavel_nome: "Quem",
};

const linha = (
  n: number,
  campos: Record<string, string | null>,
): Record<string, unknown> => ({ ...campos, [LINHA_ORIGEM]: n });

const LINHAS = [
  linha(3, { ID: "R-1", Restrição: "Falta projeto" }),
  linha(4, { ID: null, Restrição: "Sem código A" }),
  linha(5, { ID: null, Restrição: null }),
  linha(6, { ID: "R-1", Restrição: "Repetida" }),
  linha(7, { ID: null, Restrição: "Sem código A" }),
  linha(8, { ID: "R-9", Restrição: "Já existia" }),
];

describe("planejaImportacao", () => {
  it("lista linhas sem descrição como descartadas, com número e motivo", () => {
    const plano = planejaImportacao({
      linhas: LINHAS,
      mapa: MAPA,
      modo: "adicionar",
      existentes: new Map(),
    });
    expect(plano.descartadas).toEqual([
      { numero: 5, exato: true, motivo: "sem descrição" },
    ]);
  });

  it("ignora código já existente em 'adicionar' e repetido na planilha", () => {
    const plano = planejaImportacao({
      linhas: LINHAS,
      mapa: MAPA,
      modo: "adicionar",
      existentes: new Map([["R9", "id-9"]]),
    });
    expect(plano.ignoradas.map((i) => i.numero)).toEqual([6, 8]);
  });

  it("em 'atualizar' manda o código existente para atualização", () => {
    const plano = planejaImportacao({
      linhas: LINHAS,
      mapa: MAPA,
      modo: "atualizar",
      existentes: new Map([["R9", "id-9"]]),
    });
    expect(plano.atualizar.map((a) => a.id)).toEqual(["id-9"]);
  });

  it("na retomada não repete linhas sem código já gravadas", () => {
    const plano = planejaImportacao({
      linhas: LINHAS,
      mapa: MAPA,
      modo: "adicionar",
      existentes: new Map(),
      // A primeira tentativa gravou R-1 e UMA das duas "Sem código A".
      gravadas: [
        { codigo: "R-1", descricao: "Falta projeto" },
        { codigo: null, descricao: "Sem código A" },
      ],
    });
    expect({
      jaGravadas: plano.jaGravadas,
      novas: plano.novas.map((n) => n.posicao.numero),
    }).toEqual({ jaGravadas: 2, novas: [7, 8] });
  });

  it("sem gravação anterior, tudo que é válido e novo entra", () => {
    const plano = planejaImportacao({
      linhas: LINHAS,
      mapa: MAPA,
      modo: "adicionar",
      existentes: new Map(),
    });
    expect(plano.novas.map((n) => n.posicao.numero)).toEqual([3, 4, 7, 8]);
  });
});

describe("previaDaLinha", () => {
  it("mostra os valores como serão gravados", () => {
    const p = previaDaLinha(
      linha(3, {
        ID: "1",
        Restrição: "Falta projeto",
        Status: "Concluído com atraso",
        Prazo: "10/09/2026",
        Quem: "Ana",
      }),
      0,
      MAPA,
    );
    expect(p).toEqual({
      ok: true,
      posicao: { numero: 3, exato: true },
      descricao: "Falta projeto",
      responsavel: "Ana",
      status: "Concluída",
      prazo: "10/09/2026",
      avisos: [],
    });
  });

  it("avisa data e status que a conversão não reconheceu", () => {
    const p = previaDaLinha(
      linha(4, { Restrição: "X", Status: "Talvez", Prazo: "semana que vem" }),
      1,
      MAPA,
    );
    expect(p.ok && p.avisos).toEqual([
      "prazo “semana que vem” não é uma data reconhecida",
      "status “Talvez” não reconhecido, vira Pendente",
    ]);
  });

  it("linha sem descrição sai como descartada", () => {
    const p = previaDaLinha(linha(5, { Restrição: null }), 2, MAPA);
    expect(p).toEqual({
      ok: false,
      posicao: { numero: 5, exato: true },
      motivo: "sem descrição",
    });
  });

  it("rascunho antigo, sem número de linha, usa a posição como 'item'", () => {
    const p = previaDaLinha({ Restrição: null }, 2, MAPA);
    expect(rotuloPosicao(p.posicao)).toBe("item 3");
  });
});

describe("matrizParaLinhas guarda o número da linha na planilha", () => {
  it("conta título e linhas vazias antes do cabeçalho", () => {
    const { linhas } = matrizParaLinhas([
      ["Título"],
      [],
      ["ID", "Restrição", "Prazo"],
      [],
      ["1", "Falta projeto", "x"],
    ]);
    expect(linhas.map((l) => l[LINHA_ORIGEM])).toEqual([5]);
  });
});

describe("travaVigente", () => {
  const agora = 1_800_000_000_000;

  it("vale para marca recente", () => {
    expect(travaVigente(`gravando:${agora - 1000}`, agora)).toBe(true);
  });

  it("não vale para marca com data no futuro (forjada)", () => {
    expect(travaVigente("gravando:99999999999999", agora)).toBe(false);
  });

  it("não vale para marca expirada", () => {
    expect(travaVigente(`gravando:${agora - 11 * 60_000}`, agora)).toBe(false);
  });
});
