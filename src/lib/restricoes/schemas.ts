import { z } from 'zod';
import { PRIORIDADES, STATUS } from './dominio';

const textoOpcional = z
  .string()
  .trim()
  .max(4000)
  .transform((v) => (v.length === 0 ? null : v))
  .nullable();

const dataOpcional = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data inválida (use aaaa-mm-dd)');

const dataObrigatoria = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use aaaa-mm-dd)');

const uuidOpcional = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .refine((v) => v === null || z.guid().safeParse(v).success, 'Identificador inválido');

/** Campos que o usuário edita na grade e no formulário. */
export const restricaoEditavelSchema = z.object({
  codigo: textoOpcional,
  descricao: z.string().trim().min(1, 'Descreva a restrição').max(4000),
  acao: textoOpcional,
  responsavel_id: uuidOpcional,
  responsavel_nome: textoOpcional,
  responsavel_email: textoOpcional,
  responsavel_telefone: textoOpcional,
  status: z.enum(STATUS),
  prioridade: z.enum(PRIORIDADES),
  descricao_status: textoOpcional,
  causa_6m: textoOpcional,
  classificacao: textoOpcional,
  area: textoOpcional,
  setor: textoOpcional,
  localizacao: textoOpcional,
  id_atividade: textoOpcional,
  atividade_impactada: textoOpcional,
  inicio_atividade: dataOpcional,
  data_criacao: dataObrigatoria,
  data_limite: dataOpcional,
  previsao_conclusao: dataOpcional,
  data_conclusao: dataOpcional,
  semana_programada: textoOpcional,
  observacoes: textoOpcional,
});

export type RestricaoEditavel = z.infer<typeof restricaoEditavelSchema>;

export const CAMPOS_EDITAVEIS = Object.keys(restricaoEditavelSchema.shape) as Array<
  keyof RestricaoEditavel
>;

/** Um único campo alterado na grade (edição de célula). */
export const atualizaCampoSchema = z.object({
  restricaoId: z.guid(),
  campo: z.enum(CAMPOS_EDITAVEIS as [keyof RestricaoEditavel, ...Array<keyof RestricaoEditavel>]),
  valor: z.string().max(4000),
});

export const criaRestricaoSchema = z.object({
  obraId: z.guid(),
  descricao: z.string().trim().min(1, 'Descreva a restrição').max(4000),
  acao: textoOpcional.optional(),
  responsavel_id: uuidOpcional.optional(),
  responsavel_nome: textoOpcional.optional(),
  prioridade: z.enum(PRIORIDADES).default('media'),
  data_criacao: dataOpcional.optional(),
  data_limite: dataOpcional.optional(),
  previsao_conclusao: dataOpcional.optional(),
  causa_6m: textoOpcional.optional(),
  classificacao: textoOpcional.optional(),
  area: textoOpcional.optional(),
  setor: textoOpcional.optional(),
  localizacao: textoOpcional.optional(),
  id_atividade: textoOpcional.optional(),
  atividade_impactada: textoOpcional.optional(),
  inicio_atividade: dataOpcional.optional(),
  semana_programada: textoOpcional.optional(),
  observacoes: textoOpcional.optional(),
});

export const comentarioSchema = z.object({
  restricaoId: z.guid(),
  texto: z.string().trim().min(1, 'Escreva algo').max(4000),
  mencoes: z.array(z.guid()).max(50).default([]),
});
