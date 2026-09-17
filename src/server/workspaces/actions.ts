"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  COOKIE_WORKSPACE,
  erroInterno,
  exigeAdmin,
  exigeUsuario,
  falha,
  papelNoWorkspace,
  sucesso,
  type Resultado,
} from "@/server/auth";

/** Seletor do topo: guarda o workspace escolhido em cookie e volta para /obras. */
export async function selecionaWorkspace(form: FormData): Promise<void> {
  const id = z.guid().safeParse(form.get("workspaceId"));
  if (!id.success) return;
  const { supabase, perfil } = await exigeUsuario();
  const papel = await papelNoWorkspace(supabase, perfil, id.data);
  if (!papel) return;
  (await cookies()).set(COOKIE_WORKSPACE, id.data, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/obras");
}

const workspaceSchema = z.object({
  codigo: z.string().trim().min(2).max(30).toUpperCase(),
  nome: z.string().trim().min(2).max(120),
});

/**
 * Admin cria o workspace. As pessoas entram depois, em Usuários, já com o
 * workspace escolhido.
 */
export async function criaWorkspace(
  form: FormData,
): Promise<Resultado<{ id: string }>> {
  const parsed = workspaceSchema.safeParse({
    codigo: form.get("codigo"),
    nome: form.get("nome"),
  });
  if (!parsed.success)
    return falha(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { supabase } = await exigeAdmin();
  const { data, error } = await supabase
    .from("6wla_workspaces")
    .insert({ codigo: parsed.data.codigo, nome: parsed.data.nome })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return falha("Já existe workspace com esse código");
    return erroInterno("workspaces.cria", error);
  }
  revalidatePath("/admin/workspaces");
  return sucesso({ id: data.id });
}
