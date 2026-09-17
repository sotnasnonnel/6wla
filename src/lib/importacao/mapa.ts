import { z } from "zod";
import {
  PRIORIDADES,
  STATUS,
  type Prioridade,
  type Status,
} from "@/lib/restricoes/dominio";

/**
 * Tradução de uma planilha de restrições para o formato canônico do banco.
 *
 * As planilhas divergem entre obras (`Restrição`/`Ação`/`Data limite de
 * remoção` numa, `O QUÊ`/`PRAZO PARA SOLUÇÃO`/`ÁREA` noutra). Em vez de exigir
 * um formato, o importador SUGERE um de-para por apelidos (ou por IA, quando
 * os apelidos não bastam) e o gestor confere antes de confirmar. Tudo aqui é
 * puro e testável sem banco.
 */

export const CAMPOS_IMPORTAVEIS = [
  "codigo",
  "descricao",
  "acao",
  "responsavel_nome",
  "responsavel_email",
  "responsavel_telefone",
  "status",
  "prioridade",
  "descricao_status",
  "causa_6m",
  "classificacao",
  "area",
  "setor",
  "localizacao",
  "id_atividade",
  "atividade_impactada",
  "inicio_atividade",
  "data_criacao",
  "data_limite",
  "previsao_conclusao",
  "data_conclusao",
  "semana_programada",
  "observacoes",
] as const;
export type CampoImportavel = (typeof CAMPOS_IMPORTAVEIS)[number];

export const CAMPO_ROTULO: Record<CampoImportavel, string> = {
  codigo: "Código / ID",
  descricao: "Restrição (o quê)",
  acao: "Ação",
  responsavel_nome: "Responsável",
  responsavel_email: "E-mail do responsável",
  responsavel_telefone: "Telefone do responsável",
  status: "Status",
  prioridade: "Prioridade",
  descricao_status: "Descrição do status",
  causa_6m: "Causa 6M",
  classificacao: "Classificação",
  area: "Área",
  setor: "Setor",
  localizacao: "Local",
  id_atividade: "ID da atividade",
  atividade_impactada: "Atividade impactada",
  inicio_atividade: "Início da atividade",
  data_criacao: "Data de criação",
  data_limite: "Data limite (prazo)",
  previsao_conclusao: "Previsão de conclusão",
  data_conclusao: "Data real de conclusão",
  semana_programada: "Semana programada",
  observacoes: "Observações",
};

/** Descrição curta de cada campo, usada no prompt da IA e na tela de conferência. */
export const CAMPO_DESCRICAO: Record<CampoImportavel, string> = {
  codigo: "Identificador ou número da restrição na planilha de origem",
  descricao: "Texto da restrição: o que está impedindo a atividade",
  acao: "Ação ou plano para remover a restrição",
  responsavel_nome: "Nome da pessoa responsável por remover a restrição",
  responsavel_email: "E-mail da pessoa responsável",
  responsavel_telefone: "Telefone/WhatsApp da pessoa responsável",
  status:
    "Situação atual (pendente, em andamento, concluída, cancelada, no prazo, atrasada...)",
  prioridade: "Prioridade ou urgência (urgente, alta, média, baixa)",
  descricao_status: "Texto livre de acompanhamento da situação",
  causa_6m:
    "Causa raiz pelos 6M (método, material, máquina, mão de obra, medida, meio ambiente)",
  classificacao:
    "Classificação/tipo da restrição (projeto, suprimentos, segurança...)",
  area: "Área física ou sistema da obra (ex.: Secagem, Canteiro)",
  setor: "Setor/departamento responsável (Engenharia, Compras, SSMA...)",
  localizacao: "Local específico dentro da obra",
  id_atividade: "Código/EDT da atividade do cronograma afetada",
  atividade_impactada:
    "Nome da atividade do cronograma que a restrição impacta",
  inicio_atividade: "Data de início planejada da atividade impactada",
  data_criacao: "Data em que a restrição foi identificada/cadastrada",
  data_limite: "Prazo para remover a restrição (data limite de remoção)",
  previsao_conclusao: "Data prevista de conclusão informada pelo responsável",
  data_conclusao: "Data real em que a restrição foi removida/concluída",
  semana_programada:
    "Rótulo da semana/período de programação (ex.: S-20, Sem 05)",
  observacoes: "Observações ou anotações livres",
};

/** Apelidos conhecidos, em ordem de preferência. Comparação é normalizada. */
const APELIDOS: Record<CampoImportavel, string[]> = {
  codigo: ["ID", "Código", "Cod", "Item", "No", "Num", "Número", "EDT", "WBS"],
  descricao: [
    "Restrição",
    "Restricao",
    "O QUÊ",
    "O QUE",
    "Descrição",
    "Nome da tarefa",
    "Tarefa",
    "Título",
    "Pendência",
  ],
  acao: ["Ação", "Acao", "Plano de ação", "Como", "Solução", "Tratativa"],
  responsavel_nome: [
    "Responsável",
    "Responsavel",
    "Quem",
    "Atribuído a",
    "Atribuido a",
    "Dono",
  ],
  responsavel_email: [
    "E-mail Responsável",
    "Email Responsavel",
    "E-mail",
    "Email",
  ],
  responsavel_telefone: ["Telefone", "Celular", "WhatsApp", "Fone", "Contato"],
  status: ["Status", "Situação", "Situacao", "Andamento"],
  prioridade: ["Prioridade", "Urgência", "Urgencia"],
  descricao_status: [
    "Descrição do status",
    "Descricao do status",
    "Comentário do status",
    "Acompanhamento",
  ],
  causa_6m: ["Causa 6M", "6M", "Causa", "Causa raiz"],
  classificacao: [
    "Classificação",
    "Classificacao",
    "Classe",
    "Natureza",
    "Tipo",
    "Categoria",
  ],
  area: ["Área", "Area", "Sistema", "Disciplina"],
  setor: ["Setor", "Gerência", "Gerencia", "Departamento"],
  localizacao: ["Local", "Localização", "Localizacao", "Onde", "Frente"],
  id_atividade: [
    "ID Atividade",
    "ID da atividade",
    "Código da atividade",
    "EDT Atividade",
  ],
  atividade_impactada: [
    "Atividade Impactada",
    "Atividade",
    "Impacto",
    "Atividade afetada",
  ],
  inicio_atividade: [
    "Início da atividade impactada",
    "Inicio da atividade impactada",
    "Início da atividade",
    "Inicio da atividade",
    "Data de início da atividade",
  ],
  data_criacao: [
    "Data de criação",
    "Data criação",
    "Criado em",
    "Data de abertura",
    "Abertura",
    "Data de início",
    "Data início",
    "Quando",
  ],
  data_limite: [
    "Data limite de remoção",
    "Data limite",
    "Prazo para solução",
    "Prazo",
    "Data de conclusão prevista",
    "Vencimento",
    "Data fim",
    "Término",
    "Data de vencimento",
  ],
  previsao_conclusao: [
    "Previsão de conclusão",
    "Previsao de conclusao",
    "Previsão",
    "Nova previsão",
  ],
  data_conclusao: [
    "Data real de conclusão",
    "Data real de conclusao",
    "Data de conclusão",
    "Concluído em",
    "Concluido em",
    "Data conclusão real",
    "Data real",
  ],
  semana_programada: [
    "Semana",
    "Semana programada",
    "Rótulo",
    "Rotulo",
    "Label",
    "Sprint",
  ],
  observacoes: [
    "Observações",
    "Observacoes",
    "Obs",
    "Anotações",
    "Anotacoes",
    "Comentários",
    "Comentarios",
    "Notas",
  ],
};

/** `{ descricao: 'Restrição', data_limite: 'Prazo' }` — coluna real por campo. */
export const mapaColunasSchema = z.partialRecord(
  z.enum(CAMPOS_IMPORTAVEIS),
  z.string().min(1),
);
export type MapaColunas = z.infer<typeof mapaColunasSchema>;

export type LinhaPlanilha = Record<string, unknown>;

/**
 * Chave reservada, gravada em cada linha lida, com o número da linha na
 * planilha original (1 = primeira linha da aba). Não é coluna: fica fora dos
 * extras e da amostra. Rascunhos antigos não a têm — ver `numeroDaLinha`.
 */
export const LINHA_ORIGEM = "__linha_planilha__";

/**
 * Número da linha na planilha, para o gestor achar o problema no arquivo.
 * Rascunho gravado antes de `LINHA_ORIGEM` existir cai na posição da lista
 * (1-based), que não conta cabeçalho nem linhas vazias — por isso o
 * chamador deve dizer "item", não "linha", quando `exato` for falso.
 */
export function numeroDaLinha(
  linha: LinhaPlanilha,
  indice: number,
): { numero: number; exato: boolean } {
  const n = linha[LINHA_ORIGEM];
  return typeof n === "number" && Number.isInteger(n) && n > 0
    ? { numero: n, exato: true }
    : { numero: indice + 1, exato: false };
}

/** Remove acentos (NFD + faixa de diacríticos combinantes). */
function semAcento(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Chave normalizada para comparação: sem acento, sem pontuação, caixa alta.
 * `"E-mail  Responsável"` e `"EMAIL RESPONSAVEL"` batem.
 */
export function normalizaChave(valor: string): string {
  return semAcento(valor)
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}

/**
 * Sugere o de-para a partir dos cabeçalhos. Cada coluna é usada no máximo uma
 * vez; campos sem apelido correspondente ficam de fora (o gestor completa).
 */
export function sugereMapa(cabecalhos: string[]): MapaColunas {
  const mapa: MapaColunas = {};
  const usadas = new Set<string>();
  const porChave = new Map<string, string>();
  for (const c of cabecalhos) {
    const k = normalizaChave(c);
    if (k && !porChave.has(k)) porChave.set(k, c);
  }
  for (const campo of CAMPOS_IMPORTAVEIS) {
    for (const apelido of APELIDOS[campo]) {
      const real = porChave.get(normalizaChave(apelido));
      if (real && !usadas.has(real)) {
        mapa[campo] = real;
        usadas.add(real);
        break;
      }
    }
  }
  return mapa;
}

/** Valida um mapa vindo de fora (formulário ou IA): só colunas que existem. */
export function saneiaMapa(bruto: unknown, cabecalhos: string[]): MapaColunas {
  const parsed = mapaColunasSchema.safeParse(bruto);
  if (!parsed.success) return {};
  const validas = new Set(cabecalhos);
  const usadas = new Set<string>();
  const mapa: MapaColunas = {};
  for (const campo of CAMPOS_IMPORTAVEIS) {
    const coluna = parsed.data[campo];
    if (coluna && validas.has(coluna) && !usadas.has(coluna)) {
      mapa[campo] = coluna;
      usadas.add(coluna);
    }
  }
  return mapa;
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return parseData(valor);
  if (typeof valor === "object") {
    // exceljs devolve rich text / fórmula / hyperlink como objeto.
    const o = valor as {
      text?: unknown;
      result?: unknown;
      richText?: Array<{ text: string }>;
    };
    if (Array.isArray(o.richText))
      return texto(o.richText.map((r) => r.text).join(""));
    if (o.result !== undefined) return texto(o.result);
    if (o.text !== undefined) return texto(o.text);
    return null;
  }
  const s = String(valor).trim();
  return s.length > 0 ? s : null;
}

/**
 * Datas chegam como Date (exceljs), serial do Excel (dias desde 1899-12-30)
 * ou texto `dd/mm/aaaa`. Devolve ISO `aaaa-mm-dd`.
 */
export function parseData(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return iso(
      valor.getUTCFullYear(),
      valor.getUTCMonth() + 1,
      valor.getUTCDate(),
    );
  }

  if (typeof valor === "number" && Number.isFinite(valor)) {
    if (valor < 1 || valor > 120000) return null;
    const ms = Math.round((valor - 25569) * 86_400_000);
    const d = new Date(ms);
    // Serial pequeno ("6", "13") é contagem de dias, não data: cai no ano de 1900 e é rejeitado.
    return valida(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  if (typeof valor === "object") return parseData(texto(valor));

  const s = String(valor).trim();
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s);
  if (br) {
    const dia = Number(br[1]);
    const mes = Number(br[2]);
    const anoTxt = br[3] ?? "";
    const ano = anoTxt.length === 2 ? 2000 + Number(anoTxt) : Number(anoTxt);
    return valida(ano, mes, dia);
  }
  const isoM = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoM) return valida(Number(isoM[1]), Number(isoM[2]), Number(isoM[3]));
  return null;
}

function valida(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1990 || ano > 2100)
    return null;
  return iso(ano, mes, dia);
}

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const STATUS_APELIDOS: Array<[string[], Status]> = [
  [
    [
      "concluida",
      "concluido",
      "ok",
      "feito",
      "resolvida",
      "resolvido",
      "removida",
      "fechada",
      "fechado",
      "done",
      "100",
    ],
    "concluida",
  ],
  [
    ["cancelada", "cancelado", "descartada", "nao se aplica", "n/a"],
    "cancelada",
  ],
  [
    [
      "em andamento",
      "andamento",
      "em tratativa",
      "tratativa",
      "iniciada",
      "iniciado",
      "in progress",
      "em execucao",
    ],
    "em_andamento",
  ],
  [
    [
      "pendente",
      "no prazo",
      "atrasado",
      "atrasada",
      "aberta",
      "aberto",
      "nao iniciado",
      "nao iniciada",
      "a fazer",
      "to do",
      "programada",
    ],
    "pendente",
  ],
];

/** Texto livre da planilha → status, ou `null` se não reconhecer o texto. */
export function reconheceStatus(valor: unknown): Status | null {
  const s = texto(valor);
  if (!s) return null;
  const k = semAcento(s).toLowerCase().trim();
  if ((STATUS as readonly string[]).includes(k)) return k as Status;
  for (const [apelidos, status] of STATUS_APELIDOS) {
    if (apelidos.some((a) => k === a || k.startsWith(a))) return status;
  }
  return null;
}

/** Texto livre da planilha → status. Sem correspondência = `pendente`. */
export function parseStatus(valor: unknown): Status {
  return reconheceStatus(valor) ?? "pendente";
}

const PRIORIDADE_APELIDOS: Array<[string[], Prioridade]> = [
  [["urgente", "critica", "critico", "urgent", "1"], "urgente"],
  [["alta", "importante", "high", "2"], "alta"],
  [["media", "medio", "normal", "medium", "3"], "media"],
  [["baixa", "baixo", "low", "4"], "baixa"],
];

export function parsePrioridade(valor: unknown): Prioridade {
  const s = texto(valor);
  if (!s) return "media";
  const k = semAcento(s).toLowerCase().trim();
  if ((PRIORIDADES as readonly string[]).includes(k)) return k as Prioridade;
  for (const [apelidos, p] of PRIORIDADE_APELIDOS) {
    if (apelidos.some((a) => k === a || k.startsWith(a))) return p;
  }
  return "media";
}

export type RestricaoImportada = {
  codigo: string | null;
  descricao: string;
  acao: string | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
  responsavel_telefone: string | null;
  status: Status;
  prioridade: Prioridade;
  descricao_status: string | null;
  causa_6m: string | null;
  classificacao: string | null;
  area: string | null;
  setor: string | null;
  localizacao: string | null;
  id_atividade: string | null;
  atividade_impactada: string | null;
  inicio_atividade: string | null;
  data_criacao: string | null;
  data_limite: string | null;
  previsao_conclusao: string | null;
  data_conclusao: string | null;
  semana_programada: string | null;
  observacoes: string | null;
  /** Colunas não mapeadas, preservadas como vieram. */
  extras: Record<string, string>;
};

export type ResultadoLinha =
  { ok: true; restricao: RestricaoImportada } | { ok: false; motivo: string };

/** Aplica o de-para a uma linha. Linha sem descrição é descartada com motivo. */
export function traduzLinha(
  linha: LinhaPlanilha,
  mapa: MapaColunas,
): ResultadoLinha {
  const pega = (campo: CampoImportavel): unknown => {
    const coluna = mapa[campo];
    return coluna === undefined ? undefined : linha[coluna];
  };

  const descricao = texto(pega("descricao"));
  if (!descricao) return { ok: false, motivo: "sem descrição" };

  const mapeadas = new Set(Object.values(mapa));
  const extras: Record<string, string> = {};
  for (const [coluna, valor] of Object.entries(linha)) {
    if (mapeadas.has(coluna) || coluna === LINHA_ORIGEM) continue;
    const v = texto(valor);
    if (v !== null) extras[coluna] = v;
  }

  const status = parseStatus(pega("status"));
  const dataConclusao = parseData(pega("data_conclusao"));

  return {
    ok: true,
    restricao: {
      codigo: texto(pega("codigo")),
      descricao,
      acao: texto(pega("acao")),
      responsavel_nome: texto(pega("responsavel_nome")),
      responsavel_email:
        texto(pega("responsavel_email"))?.toLowerCase() ?? null,
      responsavel_telefone: texto(pega("responsavel_telefone")),
      status,
      prioridade: parsePrioridade(pega("prioridade")),
      descricao_status: texto(pega("descricao_status")),
      causa_6m: texto(pega("causa_6m")),
      classificacao: texto(pega("classificacao")),
      area: texto(pega("area")),
      setor: texto(pega("setor")),
      localizacao: texto(pega("localizacao")),
      id_atividade: texto(pega("id_atividade")),
      atividade_impactada: texto(pega("atividade_impactada")),
      inicio_atividade: parseData(pega("inicio_atividade")),
      data_criacao: parseData(pega("data_criacao")),
      data_limite: parseData(pega("data_limite")),
      previsao_conclusao: parseData(pega("previsao_conclusao")),
      // Concluída sem data real: o banco exige data; usa a previsão ou fica
      // para o gatilho preencher com hoje.
      data_conclusao:
        dataConclusao ??
        (status === "concluida" ? parseData(pega("previsao_conclusao")) : null),
      semana_programada: texto(pega("semana_programada")),
      observacoes: texto(pega("observacoes")),
      extras,
    },
  };
}

/**
 * Acha a linha de cabeçalho: entre as 30 primeiras, a que tem MAIS células
 * preenchidas (mínimo 3). Planilhas de obra têm título, "Data de
 * atualização:" e afins antes do cabeçalho de verdade, mas nenhuma dessas
 * linhas chega perto da largura da tabela.
 */
export function achaLinhaCabecalho(linhas: unknown[][]): number {
  let melhor = 0;
  let maior = 0;
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    const preenchidas = (linhas[i] ?? []).filter(pareceRotulo).length;
    if (preenchidas > maior) {
      maior = preenchidas;
      melhor = i;
    }
  }
  return maior >= 3 ? melhor : 0;
}

/** Célula que parece rótulo de coluna: texto, não número nem data. */
function pareceRotulo(c: unknown): boolean {
  if (c instanceof Date || typeof c === "number") return false;
  const t = texto(c);
  if (t === null) return false;
  return !/^-?\d+([.,]\d+)?$/.test(t) && parseData(t) === null;
}

/** Converte a matriz da aba em objetos `{ cabecalho: valor }`. */
export function matrizParaLinhas(matriz: unknown[][]): {
  cabecalhos: string[];
  linhas: LinhaPlanilha[];
} {
  const idx = achaLinhaCabecalho(matriz);
  const brutos = matriz[idx] ?? [];
  const cabecalhos: string[] = [];
  const vistos = new Map<string, number>();
  // `for` e não `forEach`: a matriz pode ser esparsa (colunas vazias viram
  // buracos) e `forEach` pularia o índice, desalinhando cabeçalho e valor.
  for (let i = 0; i < brutos.length; i++) {
    const c = brutos[i];
    let nome = texto(c) ?? `Coluna ${i + 1}`;
    const n = vistos.get(nome) ?? 0;
    vistos.set(nome, n + 1);
    if (n > 0) nome = `${nome} (${n + 1})`;
    cabecalhos.push(nome);
  }

  const linhas: LinhaPlanilha[] = [];
  for (let r = idx + 1; r < matriz.length; r++) {
    const row = matriz[r] ?? [];
    const obj: LinhaPlanilha = {};
    let vazia = true;
    cabecalhos.forEach((h, i) => {
      const v = row[i];
      const t = texto(v);
      if (t !== null) vazia = false;
      // Guarda Date como ISO para serializar em JSON sem perder o dia.
      obj[h] = v instanceof Date ? parseData(v) : (t ?? null);
    });
    // A matriz é indexada pela linha da aba (0 = linha 1 do Excel).
    if (!vazia) linhas.push({ ...obj, [LINHA_ORIGEM]: r + 1 });
  }
  return { cabecalhos, linhas };
}

/**
 * Chave de casamento de código: sem espaço nas pontas, sem caixa, sem
 * pontuação. `"R-012"`, `"r 012"` e `"R012"` são o mesmo código — a planilha
 * de obra passa por muita mão até chegar aqui.
 */
export function chaveCodigo(valor: unknown): string | null {
  const bruto = texto(valor);
  if (bruto === null) return null;
  const chave = normalizaChave(bruto);
  return chave.length > 0 ? chave : null;
}

export type Casamento = {
  /** Linhas cujo código já existe na obra. */
  existentes: number;
  /** Linhas sem código nessa coluna: nunca casam, sempre entram como novas. */
  semCodigo: number;
  /** Códigos repetidos dentro da própria planilha. */
  duplicados: number;
};

/**
 * Para CADA coluna da planilha, quantas linhas casariam com restrições que já
 * existem se aquela coluna fosse o código. Calculado no servidor uma vez só,
 * porque a coluna de código é escolhida na tela e a conta precisa acompanhar
 * a escolha sem ida e volta ao banco.
 */
export function contaCasamentos(
  linhas: LinhaPlanilha[],
  cabecalhos: string[],
  codigosExistentes: Iterable<string>,
): Record<string, Casamento> {
  const existentes = new Set(codigosExistentes);
  const resultado: Record<string, Casamento> = {};
  for (const coluna of cabecalhos) {
    const vistos = new Set<string>();
    const conta: Casamento = { existentes: 0, semCodigo: 0, duplicados: 0 };
    for (const linha of linhas) {
      const chave = chaveCodigo(linha[coluna]);
      if (chave === null) {
        conta.semCodigo += 1;
        continue;
      }
      if (vistos.has(chave)) conta.duplicados += 1;
      else vistos.add(chave);
      if (existentes.has(chave)) conta.existentes += 1;
    }
    resultado[coluna] = conta;
  }
  return resultado;
}
