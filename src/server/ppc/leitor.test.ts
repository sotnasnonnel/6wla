import { describe, expect, it, vi } from "vitest";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { geraXlsx } from "@/lib/exportacao/xlsx";
import { leArquivoPpc } from "./leitor";

vi.mock("server-only", () => ({}));

describe("leitor PPC com arquivo completo", () => {
  it.each(["xl/worksheets/sheet2.xml", "xl/media/image1.png"])(
    "não conta o tamanho de %s quando a aba escolhida é pequena",
    (nome) => {
      const arquivos = unzipSync(
        geraXlsx({
          aba: "PPC",
          colunas: [{ cabecalho: "ID" }, { cabecalho: "Nome da atividade" }],
          linhas: [["AT-001", "Montagem"]],
        }),
      );
      // Conteúdo repetitivo como XML/células formatadas: pequeno no disco,
      // grande depois de descompactado, embora a aba PPC tenha uma só linha.
      arquivos[nome] = new Uint8Array(129 * 1024 * 1024);
      const bytes = zipSync(arquivos, { level: 1 });
      expect(leArquivoPpc(bytes, "PPC").linhas).toHaveLength(1);
    },
    15000,
  );

  it("mantém limite para a própria aba selecionada", () => {
    const arquivos = unzipSync(
      geraXlsx({
        aba: "PPC",
        colunas: [{ cabecalho: "ID" }, { cabecalho: "Atividade" }],
        linhas: [["A", "B"]],
      }),
    );
    arquivos["xl/worksheets/sheet1.xml"] = new Uint8Array(129 * 1024 * 1024);
    expect(() => leArquivoPpc(zipSync(arquivos, { level: 1 }), "PPC")).toThrow(
      /128 MB/,
    );
  }, 15000);

  it("não descompacta uma aba não selecionada com XML inválido", () => {
    const arquivos = unzipSync(
      geraXlsx({
        aba: "Programação",
        colunas: [{ cabecalho: "ID" }, { cabecalho: "Atividade" }],
        linhas: [["A", "B"]],
      }),
    );
    arquivos["xl/worksheets/sheet2.xml"] = strToU8("aba não usada");
    expect(leArquivoPpc(zipSync(arquivos), "Programação").aba).toBe(
      "Programação",
    );
  });
});
