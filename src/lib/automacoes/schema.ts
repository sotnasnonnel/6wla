import { z } from "zod";
import { FUSO_PADRAO, fusoValido } from "./agenda";
import type { Tables } from "@/lib/database.types";
import { CHAVES_COLUNAS, COLUNAS_PLANILHA, colunasValidas } from "./colunas";

/** Situações que um relatório pode listar (todas de restrição aberta). */
export const SITUACOES_EMAIL = ["atrasada", "no_prazo", "sem_prazo"] as const;
export type SituacaoEmail = (typeof SITUACOES_EMAIL)[number];

export const DESTINOS = ["responsaveis", "lista"] as const;
export type Destino = (typeof DESTINOS)[number];

export const LIMITES = {
  nome: 80,
  assunto: 150,
  colunas: 30,
  destinatarios: 50,
  copias: 20,
} as const;

/**
 * E-mail aceito para envio. Minúsculo e sem espaço/quebra de linha (nada que
 * possa virar cabeçalho extra no n8n).
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail longo demais")
  .pipe(z.email("E-mail inválido"));

export function emailValido(v: string): boolean {
  return emailSchema.safeParse(v).success;
}

const listaEmails = (max: number, rotulo: string) =>
  z
    .array(emailSchema)
    .max(max, `No máximo ${max} ${rotulo}`)
    .transform((l) => [...new Set(l)]);

export const automacaoSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, "Dê um nome à automação")
      .max(LIMITES.nome, `Nome com até ${LIMITES.nome} caracteres`),
    ativa: z.boolean(),
    dias_semana: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Escolha ao menos um dia")
      .transform((l) => [...new Set(l)].sort((a, b) => a - b)),
    hora: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (use HH:MM)"),
    fuso: z
      .string()
      .min(1)
      .max(64)
      .refine(fusoValido, "Fuso horário inválido")
      .default(FUSO_PADRAO),
    situacoes: z
      .array(z.enum(SITUACOES_EMAIL))
      .min(1, "Escolha ao menos uma situação")
      .transform((l) => SITUACOES_EMAIL.filter((s) => l.includes(s))),
    colunas: z
      .array(z.enum(CHAVES_COLUNAS))
      .min(1, "Escolha ao menos uma coluna")
      .max(LIMITES.colunas)
      .transform((l) => [...new Set(l)]),
    destino: z.enum(DESTINOS),
    destinatarios: listaEmails(LIMITES.destinatarios, "destinatários"),
    copias: listaEmails(LIMITES.copias, "cópias"),
    assunto: z
      .string()
      .trim()
      .min(1, "Escreva o assunto")
      .max(LIMITES.assunto, `Assunto com até ${LIMITES.assunto} caracteres`)
      .refine(
        (v) => !/[\r\n]/.test(v),
        "O assunto não pode ter quebra de linha",
      ),
    agrupar_por_responsavel: z.boolean(),
  })
  .refine((a) => a.destino !== "lista" || a.destinatarios.length > 0, {
    message: "Informe ao menos um e-mail de destino",
    path: ["destinatarios"],
  });

export type AutomacaoEntrada = z.input<typeof automacaoSchema>;
export type AutomacaoConfig = z.output<typeof automacaoSchema>;

/** Marcadores aceitos no assunto. */
export const MARCADORES_ASSUNTO = [
  "{responsavel}",
  "{obra}",
  "{data}",
] as const;

/** Modelo "Lista de restrições (como a planilha)": o fluxo n8n original. */
export function modeloPlanilha(): AutomacaoConfig {
  return {
    nome: "Lista de restrições (como a planilha)",
    ativa: true,
    dias_semana: [1, 2, 3, 4, 5],
    hora: "07:30",
    fuso: FUSO_PADRAO,
    situacoes: ["atrasada", "no_prazo"],
    colunas: [...COLUNAS_PLANILHA],
    destino: "responsaveis",
    destinatarios: [],
    copias: [],
    assunto: "Relatório de restrições – {responsavel}",
    agrupar_por_responsavel: true,
  };
}

type LinhaAutomacao = Pick<
  Tables<"6wla_automacoes">,
  | "nome"
  | "ativa"
  | "dias_semana"
  | "hora"
  | "fuso"
  | "situacoes"
  | "colunas"
  | "destino"
  | "destinatarios"
  | "copias"
  | "assunto"
  | "agrupar_por_responsavel"
>;

const ehSituacao = (v: string): v is SituacaoEmail =>
  (SITUACOES_EMAIL as readonly string[]).includes(v);

/**
 * Linha do banco → configuração, descartando o que não vale (a tabela aceita
 * escrita direta pela API, então nada chega aqui sem nova filtragem).
 */
export function configDoBanco(linha: LinhaAutomacao): AutomacaoConfig {
  const normaliza = (l: readonly string[]) => [
    ...new Set(l.map((e) => e.trim().toLowerCase()).filter(emailValido)),
  ];
  return {
    nome: linha.nome,
    ativa: linha.ativa,
    dias_semana: linha.dias_semana.filter((d) => d >= 0 && d <= 6),
    hora: linha.hora.slice(0, 5),
    fuso: fusoValido(linha.fuso) ? linha.fuso : FUSO_PADRAO,
    situacoes: SITUACOES_EMAIL.filter((s) => linha.situacoes.filter(ehSituacao).includes(s)),
    colunas: colunasValidas(linha.colunas),
    destino: linha.destino === "lista" ? "lista" : "responsaveis",
    destinatarios: normaliza(linha.destinatarios),
    copias: normaliza(linha.copias).slice(0, LIMITES.copias),
    assunto: linha.assunto.replace(/[\r\n]+/g, " "),
    agrupar_por_responsavel: linha.agrupar_por_responsavel,
  };
}
