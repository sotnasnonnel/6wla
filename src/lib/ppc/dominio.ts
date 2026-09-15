import { z } from "zod";

export const CAMPOS_PPC = [
  "id_atividade",
  "nome_atividade",
  "semana",
  "quantidade_prevista",
  "quantidade_realizada",
  "status_planejamento",
  "observacoes",
  "causa_6ms",
  "lider_imediato",
  "encarregado",
  "responsavel",
  "disciplina",
  "inicio_semana",
  "termino_semana",
  "desvio",
  "unidade",
] as const;
export type CampoPpc = (typeof CAMPOS_PPC)[number];
export const ROTULOS_PPC: Record<CampoPpc, string> = {
  id_atividade: "ID",
  nome_atividade: "Nome da atividade",
  semana: "Semana",
  quantidade_prevista: "Quantidade prevista",
  quantidade_realizada: "Quantidade realizada",
  status_planejamento: "Status Planejamento",
  observacoes: "Observações",
  causa_6ms: "6M+S",
  lider_imediato: "Líder imediato",
  encarregado: "Encarregado",
  responsavel: "Responsável",
  disciplina: "Disciplina",
  inicio_semana: "Início da semana",
  termino_semana: "Término da semana",
  desvio: "Desvio",
  unidade: "Unidade",
};
const texto = z.string().trim().max(500);
const data = z.iso.date();
const quantidade = z.number().finite().min(0).max(999999999999);
export const atividadePpcSchema = z
  .object({
    id_atividade: texto.min(1, "Informe o ID da atividade."),
    nome_atividade: z
      .string()
      .trim()
      .min(1, "Informe o nome da atividade.")
      .max(2000),
    semana: texto.min(1, "Informe a semana."),
    quantidade_prevista: quantidade,
    quantidade_realizada: quantidade.nullable(),
    status_planejamento: texto,
    observacoes: z.string().trim().max(5000),
    desvio: z.string().trim().max(5000).default(""),
    unidade: z.string().trim().max(50).default(""),
    causa_6ms: texto,
    lider_imediato: texto,
    encarregado: texto,
    responsavel: texto,
    disciplina: texto,
    inicio_semana: data,
    termino_semana: data,
  })
  .refine((v) => v.termino_semana >= v.inicio_semana, {
    message: "O término da semana deve ser igual ou posterior ao início.",
    path: ["termino_semana"],
  });
export type AtividadePpc = z.infer<typeof atividadePpcSchema>;
export const mapaPpcSchema = z.partialRecord(
  z.enum(CAMPOS_PPC),
  z.string().min(1).max(500),
);
export type MapaPpc = z.infer<typeof mapaPpcSchema>;
export const OBRIGATORIOS_PPC: CampoPpc[] = [
  "id_atividade",
  "nome_atividade",
  "semana",
  "quantidade_prevista",
  "inicio_semana",
  "termino_semana",
];

/** Uma atividade pode aparecer em semanas diferentes, inclusive em outro ano. */
export function chaveAtividadePpc(v: AtividadePpc): string {
  return JSON.stringify([v.id_atividade, v.semana, v.inicio_semana]);
}
