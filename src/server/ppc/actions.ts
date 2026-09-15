"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigeGestor, falha, sucesso, erroInterno } from "@/server/auth";
import { atividadePpcSchema, mapaPpcSchema } from "@/lib/ppc/dominio";
import { traduzPpc } from "@/lib/ppc/importacao";
import { leArquivoPpc } from "./leitor";

const uploadSchema = z.object({
  obraId: z.guid(),
  aba: z.enum(["PPC", "Programação"]),
  arquivo: z
    .file()
    .min(4)
    .max(15 * 1024 * 1024)
    .refine(
      (f) => /\.xlsx$/i.test(f.name),
      "Envie um arquivo .xlsx de até 15 MB.",
    ),
});
const importaSchema = uploadSchema.extend({ mapa: mapaPpcSchema });

export async function inspecionaPpc(form: FormData) {
  const parsed = uploadSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return falha("Confira o arquivo .xlsx (até 15 MB) e a aba selecionada.");
  await exigeGestor(parsed.data.obraId);
  try {
    const dados = leArquivoPpc(
      new Uint8Array(await parsed.data.arquivo.arrayBuffer()),
      parsed.data.aba,
    );
    return sucesso({
      aba: dados.aba,
      cabecalhos: dados.cabecalhos,
      mapa: dados.mapa,
      amostra: dados.linhas.slice(0, 5),
      total: dados.linhas.length,
      emPares: dados.emPares,
    });
  } catch (erro) {
    return falha(
      erro instanceof Error ? erro.message : "Não foi possível ler a planilha.",
    );
  }
}

export async function importaPpc(form: FormData) {
  let mapa: unknown;
  try {
    mapa = JSON.parse(String(form.get("mapa")));
  } catch {
    return falha("Confira o mapeamento das colunas.");
  }
  const parsed = importaSchema.safeParse({ ...Object.fromEntries(form), mapa });
  if (!parsed.success)
    return falha("Confira o arquivo, a aba e o mapeamento das colunas.");
  const { supabase, perfil } = await exigeGestor(parsed.data.obraId);
  let resultado;
  try {
    const dados = leArquivoPpc(
      new Uint8Array(await parsed.data.arquivo.arrayBuffer()),
      parsed.data.aba,
    );
    resultado = traduzPpc(dados.linhas, parsed.data.mapa, dados.cabecalhos);
  } catch (erro) {
    return falha(
      erro instanceof Error ? erro.message : "Não foi possível ler a planilha.",
    );
  }
  if (resultado.erros.length)
    return falha(
      `${resultado.erros.length} problema(s). Nada foi importado. ${resultado.erros.slice(0, 5).join(" ")}`,
    );
  const { error, count } = await supabase.from("atividades_ppc").upsert(
    resultado.atividades.map((a) => ({
      ...a,
      obra_id: parsed.data.obraId,
      criado_por: perfil.id,
    })),
    {
      onConflict: "obra_id,id_atividade,semana,inicio_semana",
      ignoreDuplicates: true,
      count: "exact",
    },
  );
  if (error) return erroInterno("importaPpc", error);
  revalidatePath(`/obras/${parsed.data.obraId}/check-in-check-out`);
  revalidatePath(`/obras/${parsed.data.obraId}/tabela-importacao`);
  return sucesso({
    importadas: count ?? 0,
    existentes: resultado.atividades.length - (count ?? 0),
  });
}

const edicaoSchema = z.object({
  obraId: z.guid(),
  id: z.guid(),
  atividade: atividadePpcSchema,
});
const conferenciaSchema = z.object({
  obraId: z.guid(),
  id: z.guid(),
  conferido: z.boolean(),
  versao: z.string().min(1).max(100),
});
export async function confereAtividadePpc(entrada: unknown) {
  const parsed = conferenciaSchema.safeParse(entrada);
  if (!parsed.success) return falha("Confira a atividade selecionada.");
  const { supabase } = await exigeGestor(parsed.data.obraId);
  const { data, error } = await supabase
    .from("atividades_ppc")
    .update({ conferido: parsed.data.conferido })
    .eq("obra_id", parsed.data.obraId)
    .eq("id", parsed.data.id)
    .eq("atualizado_em", parsed.data.versao)
    .select("id")
    .maybeSingle();
  if (error) return erroInterno("confereAtividadePpc", error);
  if (!data)
    return falha(
      "Esta atividade foi alterada. Atualize a página e confira novamente.",
    );
  revalidatePath(`/obras/${parsed.data.obraId}/check-in-check-out`);
  return sucesso(null);
}
export async function salvaAtividadePpc(entrada: unknown) {
  const parsed = edicaoSchema.safeParse(entrada);
  if (!parsed.success)
    return falha(
      "Confira os campos: ID, nome, semana, quantidades e datas válidas. O término deve ser posterior ou igual ao início.",
    );
  const { supabase } = await exigeGestor(parsed.data.obraId);
  const { data, error } = await supabase
    .from("atividades_ppc")
    .update(parsed.data.atividade)
    .eq("obra_id", parsed.data.obraId)
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error?.code === "23505")
    return falha(
      "Já existe uma atividade com esse ID, semana e data de início.",
    );
  if (error) return erroInterno("salvaAtividadePpc", error);
  if (!data) return falha("Atividade não encontrada nesta obra.");
  revalidatePath(`/obras/${parsed.data.obraId}/check-in-check-out`);
  revalidatePath(`/obras/${parsed.data.obraId}/tabela-importacao`);
  return sucesso(null);
}
