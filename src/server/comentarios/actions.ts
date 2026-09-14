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

export async function comenta(
  entrada: unknown,
): Promise<Resultado<{ id: string }>> {
  const parsed = comentarioSchema.safeParse(entrada);
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const { restricaoId, texto, mencoes } = parsed.data;

  const { supabase, perfil } = await exigeUsuario();
  const { data: r } = await supabase
    .from("restricoes")
    .select("obra_id")
    .eq("id", restricaoId)
    .maybeSingle();
  if (!r) return falha("Restrição não encontrada");
  const { obra } = await exigeMembro(r.obra_id);

  // Só membro do workspace pode ser mencionado (o gatilho também filtra).
  const { data: membros } = await supabase
    .from("membros_workspace")
    .select("user_id")
    .eq("workspace_id", obra.workspace_id);
  const permitidos = new Set((membros ?? []).map((m) => m.user_id));
  const mencoesValidas = [...new Set(mencoes)].filter((id) =>
    permitidos.has(id),
  );

  const { data, error } = await supabase
    .from("restricao_comentarios")
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
