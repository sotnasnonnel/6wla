"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  erroInterno,
  exigeAdminWs,
  falha,
  sucesso,
  type Resultado,
} from "@/server/auth";

const obraSchema = z.object({
  workspaceId: z.guid(),
  codigo: z.string().trim().min(2).max(30).toUpperCase(),
  nome: z.string().trim().min(2).max(120),
});

/** Admin do workspace cria obra dentro dele. */
export async function criaObra(
  form: FormData,
): Promise<Resultado<{ id: string }>> {
  const parsed = obraSchema.safeParse({
    workspaceId: form.get("workspaceId"),
    codigo: form.get("codigo"),
    nome: form.get("nome"),
  });
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { supabase } = await exigeAdminWs(parsed.data.workspaceId);
  const { data, error } = await supabase
    .from("6wla_obras")
    .insert({
      workspace_id: parsed.data.workspaceId,
      codigo: parsed.data.codigo,
      nome: parsed.data.nome,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return falha("Já existe obra com esse código neste workspace");
    return erroInterno("obras.criaObra", error);
  }
  revalidatePath("/obras");
  return sucesso({ id: data.id });
}
