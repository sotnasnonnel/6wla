import { unzipSync, strFromU8 } from "fflate";

/**
 * Leitor mínimo de .xlsx: só o que a importação precisa (nomes de aba,
 * strings compartilhadas, estilos para saber o que é data, e as células).
 *
 * Por que não uma biblioteca: a planilha real da obra tem ~97 mil nomes
 * definidos no workbook.xml e o exceljs estourou 4 GB de heap tentando
 * montar o grafo disso. Aqui a gente lê as células com expressões regulares
 * sobre o XML, que para o formato do Excel é regular o bastante, e ignora o
 * resto do arquivo.
 */

export const ASSINATURA_ZIP = [0x50, 0x4b, 0x03, 0x04] as const;

export type PlanilhaXlsx = {
  aba: string;
  abas: string[];
  /** Matriz linha × coluna, indexada a partir de 0; célula vazia = null. */
  matriz: unknown[][];
};

export function ehXlsx(bytes: Uint8Array): boolean {
  return ASSINATURA_ZIP.every((b, i) => bytes[i] === b);
}

/**
 * Lê a aba pedida (ou a primeira com dados). `limiteLinhas` aborta cedo em
 * planilhas gigantes, antes de materializar tudo.
 */
export function leXlsx(
  bytes: Uint8Array,
  abaPreferida?: string,
  limiteLinhas = 5000,
  preservarErros = false,
): PlanilhaXlsx {
  if (!ehXlsx(bytes)) throw new Error("O arquivo não é um .xlsx válido.");

  // O .xlsx completo pode conter centenas de MB em abas não selecionadas.
  // Primeiro lemos os nomes; só então descompactamos a aba pedida. O limite
  // protege a memória sem contar imagens, anexos e outras planilhas.
  let tamanhoLido = 0;
  const extrai = (nomes: string[]) =>
    unzipSync(bytes, {
      filter: (arquivo) => {
        if (!nomes.includes(arquivo.name)) return false;
        tamanhoLido += arquivo.originalSize;
        if (tamanhoLido > 128 * 1024 * 1024) {
          throw new Error(
            "Os dados da aba selecionada e suas referências excedem 128 MB. Reduza os dados dessa aba para importar.",
          );
        }
        return true;
      },
    });
  const arquivos = extrai(["xl/workbook.xml", "xl/_rels/workbook.xml.rels"]);
  const texto = (nome: string): string | null => {
    const bin = arquivos[nome];
    return bin ? strFromU8(bin) : null;
  };

  const workbook = texto("xl/workbook.xml");
  const rels = texto("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("Arquivo .xlsx sem workbook.");

  const abas = listaAbas(workbook, rels);
  if (abas.length === 0) throw new Error("A planilha não tem abas.");

  const candidatas = abaPreferida
    ? abas.filter(
        (a) =>
          a.nome.trim().toLowerCase() === abaPreferida.trim().toLowerCase(),
      )
    : abas;
  if (abaPreferida && candidatas.length === 0) {
    throw new Error(
      `Aba "${abaPreferida}" não existe. Abas: ${abas.map((a) => a.nome).join(", ")}.`,
    );
  }

  Object.assign(arquivos, extrai(["xl/sharedStrings.xml", "xl/styles.xml"]));
  const compartilhadas = leSharedStrings(texto("xl/sharedStrings.xml") ?? "");
  const estiloEhData = leEstilosData(texto("xl/styles.xml") ?? "");

  for (const aba of candidatas) {
    const caminho = `xl/${aba.caminho}`;
    const bin = extrai([caminho])[caminho];
    if (!bin) continue;
    const xml = strFromU8(bin);
    const matriz = leCelulas(
      xml,
      compartilhadas,
      estiloEhData,
      limiteLinhas,
      preservarErros,
    );
    if (matriz.length > 1 || abaPreferida) {
      return { aba: aba.nome, abas: abas.map((a) => a.nome), matriz };
    }
  }
  const primeira = abas[0];
  if (!primeira) throw new Error("A planilha não tem abas.");
  return { aba: primeira.nome, abas: abas.map((a) => a.nome), matriz: [] };
}

function listaAbas(
  workbook: string,
  rels: string,
): Array<{ nome: string; caminho: string }> {
  const alvoPorId = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = m[1] ?? "";
    const id = atributo(attrs, "Id");
    const target = atributo(attrs, "Target");
    if (id && target)
      alvoPorId.set(id, target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const abas: Array<{ nome: string; caminho: string }> = [];
  // `<sheets>` fica antes dos definedNames; cortar ali evita varrer 10 MB.
  const fim = workbook.indexOf("</sheets>");
  const trecho = fim >= 0 ? workbook.slice(0, fim) : workbook;
  for (const m of trecho.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const attrs = m[1] ?? "";
    const nome = atributo(attrs, "name");
    const rid = atributo(attrs, "r:id") ?? atributo(attrs, "id");
    const caminho = rid ? alvoPorId.get(rid) : undefined;
    if (nome && caminho) abas.push({ nome: decodeXml(nome), caminho });
  }
  return abas;
}

function leSharedStrings(xml: string): string[] {
  const lista: string[] = [];
  for (const m of xml.matchAll(/<si\b[^>]*>(.*?)<\/si>/gs)) {
    const partes: string[] = [];
    for (const t of (m[1] ?? "").matchAll(/<t\b[^>]*>(.*?)<\/t>/gs))
      partes.push(decodeXml(t[1] ?? ""));
    lista.push(partes.join(""));
  }
  return lista;
}

/** Formatos embutidos do Excel que representam data/hora. */
const NUMFMT_DATA_EMBUTIDO = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58,
]);

/** Devolve, por índice de estilo (`s="N"`), se a célula numérica é data. */
function leEstilosData(xml: string): boolean[] {
  const custom = new Map<number, boolean>();
  for (const m of xml.matchAll(/<numFmt\b([^>]*)\/?>/g)) {
    const attrs = m[1] ?? "";
    const id = Number(atributo(attrs, "numFmtId"));
    const codigo = decodeXml(atributo(attrs, "formatCode") ?? "");
    if (Number.isFinite(id)) custom.set(id, pareceFormatoData(codigo));
  }
  const bloco = /<cellXfs\b[^>]*>(.*?)<\/cellXfs>/s.exec(xml)?.[1] ?? "";
  const resultado: boolean[] = [];
  for (const m of bloco.matchAll(/<xf\b([^>]*)\/?>/g)) {
    const id = Number(atributo(m[1] ?? "", "numFmtId") ?? "0");
    resultado.push(NUMFMT_DATA_EMBUTIDO.has(id) || (custom.get(id) ?? false));
  }
  return resultado;
}

function pareceFormatoData(codigo: string): boolean {
  // Tira trechos literais ("R$", [$-416]) e vê se sobra d/m/y/h.
  const limpo = codigo
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .toLowerCase();
  return /[dmyh]/.test(limpo) && !/[#0]/.test(limpo);
}

function leCelulas(
  xml: string,
  compartilhadas: string[],
  estiloEhData: boolean[],
  limiteLinhas: number,
  preservarErros: boolean,
): unknown[][] {
  const matriz: unknown[][] = [];
  let linhasVistas = 0;
  let ultimaLinha = -1;

  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
    const attrs = m[1] ?? "";
    const corpo = m[2] ?? "";
    const ref = atributo(attrs, "r");
    if (!ref) continue;
    const pos = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!pos) continue;
    const linha = Number(pos[2]) - 1;
    const coluna = colunaParaIndice(pos[1] ?? "A");
    if (linha !== ultimaLinha) {
      ultimaLinha = linha;
      linhasVistas += 1;
      if (linhasVistas > limiteLinhas) {
        throw new Error(
          `A aba tem mais de ${limiteLinhas} linhas; o limite por importação é ${limiteLinhas}.`,
        );
      }
    }

    const valor = valorCelula(
      attrs,
      corpo,
      compartilhadas,
      estiloEhData,
      preservarErros,
    );
    if (valor === null) continue;
    // Uma célula isolada pode apontar para um índice enorme. Verificar antes
    // de expandir os arrays, não apenas contar as linhas presentes no XML.
    if (
      !Number.isSafeInteger(linha) ||
      linha < 0 ||
      linha >= Math.max(10000, limiteLinhas * 2) ||
      !Number.isSafeInteger(coluna) ||
      coluna < 0 ||
      coluna >= 512
    ) {
      throw new Error(
        "Referência de célula fora dos limites da importação (linhas ou colunas muito distantes).",
      );
    }
    (matriz[linha] ??= [])[coluna] = valor;
  }
  for (let i = 0; i < matriz.length; i++) matriz[i] ??= [];
  return matriz;
}

function valorCelula(
  attrs: string,
  corpo: string,
  compartilhadas: string[],
  estiloEhData: boolean[],
  preservarErros: boolean,
): unknown {
  const tipo = atributo(attrs, "t");
  if (tipo === "inlineStr") {
    const partes: string[] = [];
    for (const t of corpo.matchAll(/<t\b[^>]*>(.*?)<\/t>/gs))
      partes.push(decodeXml(t[1] ?? ""));
    return partes.join("") || null;
  }
  const v = /<v>(.*?)<\/v>/s.exec(corpo)?.[1];
  if (v === undefined) return null;
  switch (tipo) {
    case "s":
      return compartilhadas[Number(v)] ?? null;
    case "str":
      return decodeXml(v);
    case "b":
      return v === "1" ? "True" : "False";
    case "e":
      return preservarErros ? decodeXml(v) : null;
    default: {
      const n = Number(v);
      if (!Number.isFinite(n)) return decodeXml(v);
      const estilo = Number(atributo(attrs, "s") ?? "-1");
      if (estilo >= 0 && estiloEhData[estilo]) return serialParaData(n);
      return n;
    }
  }
}

/** Serial do Excel (dias desde 1899-12-30) → Date em UTC, sem fuso. */
export function serialParaData(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86_400_000));
}

export function colunaParaIndice(letras: string): number {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function atributo(attrs: string, nome: string): string | undefined {
  const re = new RegExp(`(?:^|\\s)${nome.replace(":", "\\:")}="([^"]*)"`);
  return re.exec(attrs)?.[1];
}

export function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
