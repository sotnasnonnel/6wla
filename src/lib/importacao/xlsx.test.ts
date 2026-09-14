import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { colunaParaIndice, decodeXml, ehXlsx, leXlsx } from "./xlsx";
import { matrizParaLinhas } from "./mapa";

/** Monta um .xlsx mínimo em memória, no mesmo formato que o Excel grava. */
function montaXlsx(opcoes: { definedNames?: number } = {}): Uint8Array {
  const nomes = Array.from(
    { length: opcoes.definedNames ?? 0 },
    (_, i) => `<definedName name="_n${i}">Plan!$A$${i + 1}</definedName>`,
  ).join("");
  const workbook = `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Capa" sheetId="1" r:id="rId1"/><sheet name="6WLA" sheetId="2" r:id="rId2"/></sheets><definedNames>${nomes}</definedNames></workbook>`;
  const rels = `<?xml version="1.0"?><Relationships><Relationship Id="rId2" Type="x" Target="worksheets/sheet2.xml"/><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>`;
  const shared = `<?xml version="1.0"?><sst count="4"><si><t>ID</t></si><si><t>Restri&#xE7;&#xE3;o</t></si><si><r><t>Pra</t></r><r><t>zo</t></r></si><si><t xml:space="preserve">Falta &amp; sobra</t></si></sst>`;
  const styles = `<?xml version="1.0"?><styleSheet><numFmts count="1"><numFmt numFmtId="165" formatCode="[$-416]dd/mm/yyyy;@"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="165"/></cellXfs></styleSheet>`;
  const capa = `<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Capa</t></is></c></row></sheetData></worksheet>`;
  const aba = `<?xml version="1.0"?><worksheet><sheetData>
    <row r="1"><c r="B1" t="s"><v>1</v></c></row>
    <row r="3"><c r="B3" t="s"><v>0</v></c><c r="C3" t="s"><v>1</v></c><c r="D3" t="s"><v>2</v></c><c r="E3" t="inlineStr"><is><t>Ok?</t></is></c></row>
    <row r="4"><c r="B4"><v>1</v></c><c r="C4" t="s"><v>3</v></c><c r="D4" s="1"><v>46010</v></c><c r="E4" t="b"><v>1</v></c></row>
    <row r="5"><c r="B5"><v>2</v></c><c r="C5" t="str"><v>Concat &lt;x&gt;</v></c><c r="D5" s="2"><v>46011.5</v></c><c r="E5" t="e"><v>#N/A</v></c></row>
  </sheetData></worksheet>`;
  return zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(rels),
    "xl/sharedStrings.xml": strToU8(shared),
    "xl/styles.xml": strToU8(styles),
    "xl/worksheets/sheet1.xml": strToU8(capa),
    "xl/worksheets/sheet2.xml": strToU8(aba),
  });
}

describe("leXlsx", () => {
  it("reconhece a assinatura zip", () => {
    expect(ehXlsx(montaXlsx())).toBe(true);
    expect(ehXlsx(strToU8("PK nada a ver"))).toBe(false);
    expect(() => leXlsx(strToU8("<html>"))).toThrow(/não é um \.xlsx/);
  });

  it("lê a aba pedida com strings compartilhadas, rich text, datas e booleanos", () => {
    const { aba, abas, matriz } = leXlsx(montaXlsx(), "6WLA");
    expect(aba).toBe("6WLA");
    expect(abas).toEqual(["Capa", "6WLA"]);
    expect(matriz[2]).toEqual(
      [undefined, "ID", "Restrição", "Prazo", "Ok?"]
        .map((v) => v ?? null)
        .map((v, i) => (i === 0 ? undefined : v)),
    );
    expect(matriz[3]?.[1]).toBe(1);
    expect(matriz[3]?.[2]).toBe("Falta & sobra");
    expect(matriz[3]?.[3]).toBeInstanceOf(Date);
    expect((matriz[3]?.[3] as Date).toISOString().slice(0, 10)).toBe(
      "2025-12-19",
    );
    expect(matriz[3]?.[4]).toBe("True");
    expect(matriz[4]?.[2]).toBe("Concat <x>");
    expect((matriz[4]?.[3] as Date).toISOString().slice(0, 10)).toBe(
      "2025-12-20",
    );
    expect(matriz[4]?.[4]).toBeUndefined();
  });

  it("sem aba pedida, escolhe a primeira com mais de uma linha", () => {
    expect(leXlsx(montaXlsx()).aba).toBe("6WLA");
  });

  it("aba inexistente dá erro listando as abas", () => {
    expect(() => leXlsx(montaXlsx(), "Nada")).toThrow(/Abas: Capa, 6WLA/);
  });

  it("não engasga com dezenas de milhares de nomes definidos", () => {
    const inicio = Date.now();
    const { matriz } = leXlsx(montaXlsx({ definedNames: 100_000 }), "6WLA");
    expect(matriz).toHaveLength(5);
    expect(Date.now() - inicio).toBeLessThan(5000);
  });

  it("aborta cedo acima do limite de linhas", () => {
    expect(() => leXlsx(montaXlsx(), "6WLA", 2)).toThrow(/mais de 2 linhas/);
  });

  it("encaixa com matrizParaLinhas", () => {
    const { matriz } = leXlsx(montaXlsx(), "6WLA");
    const { cabecalhos, linhas } = matrizParaLinhas(matriz);
    expect(cabecalhos).toEqual(["Coluna 1", "ID", "Restrição", "Prazo", "Ok?"]);
    expect(linhas[0]).toMatchObject({
      ID: "1",
      Restrição: "Falta & sobra",
      Prazo: "2025-12-19",
      "Ok?": "True",
    });
  });
});

describe("utilitários", () => {
  it("colunaParaIndice", () => {
    expect(colunaParaIndice("A")).toBe(0);
    expect(colunaParaIndice("Z")).toBe(25);
    expect(colunaParaIndice("AA")).toBe(26);
    expect(colunaParaIndice("AG")).toBe(32);
  });
  it("decodeXml", () => {
    expect(decodeXml("a &amp; b &lt;c&gt; &#xE7; &#231; &quot;x&quot;")).toBe(
      'a & b <c> ç ç "x"',
    );
  });
});
