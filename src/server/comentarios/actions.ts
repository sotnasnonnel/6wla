"use server";

import { revalidatePath } from "next/cache";
import { comentarioSchema } from "@/lib/restricoes/schemas";
import {
  erroInterno,
  exigeMembro,
  exigeUsuario,
  falha,
  sucesso,
  type Resultado,
} from "@/server/auth";
import { listaMembros } from "@/server/obras/queries";

export async function comenta(
  entrada: unknown,
): Promise<Resultado<{ id: string }>> {
  const parsed = comentarioSchema.safeParse(entrada);
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const { restricaoId, texto, mencoes } = parsed.data;

  const { supabase, perfil } = await exigeUsuario();
  const { data: r } = await supabase
    .from("6wla_restricoes")
    .select("obra_id")
    .eq("id", restricaoId)
    .maybeSingle();
  if (!r) return falha("Restrição não encontrada");
  const { obra } = await exigeMembro(r.obra_id);

  // Só quem está na equipe da obra pode ser mencionado (o gatilho também
  // filtra; aqui evita gravar ids que seriam ignorados).
  const equipe = await listaMembros(supabase, obra.id);
  const permitidos = new Set(equipe.map((m) => m.id));
  const mencoesValidas = [...new Set(mencoes)].filter((id) =>
    permitidos.has(id),
  );

  const { data, error } = await supabase
    .from("6wla_restricao_comentarios")
    .insert({
      restricao_id: restricaoId,
      autor_id: perfil.id,
      texto,
      mencoes: mencoesValidas,
    })
    .select("id")
    .single();
  if (error) return erroInterno("comentarios", error);
  revalidatePath(`/obras/${r.obra_id}/restricoes/${restricaoId}`);
  return sucesso({ id: data.id });
}
