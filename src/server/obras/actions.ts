"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  ehDonoObra,
  erroInterno,
  exigeMembro,
  exigeUsuario,
  falha,
  papelNoWorkspace,
  sucesso,
  type Resultado,
} from "@/server/auth";

const obraSchema = z.object({
  workspaceId: z.guid(),
  codigo: z.string().trim().min(2).max(30).toUpperCase(),
  nome: z.string().trim().min(2).max(120),
});

/**
 * Gestor cria obra no próprio workspace e vira dono dela; admin cria em
 * qualquer workspace.
 */
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

  const { supabase, perfil } = await exigeUsuario();
  const papel = await papelNoWorkspace(
    supabase,
    perfil,
    parsed.data.workspaceId,
  );
  if (papel !== "admin" && papel !== "gestor")
    return falha("Só gestor cria obra.");

  const { data, error } = await supabase
    .from("6wla_obras")
    .insert({
      workspace_id: parsed.data.workspaceId,
      codigo: parsed.data.codigo,
      nome: parsed.data.nome,
      criado_por: perfil.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return falha("Já existe obra com esse código neste workspace");
    return erroInterno("obras.criaObra", error);
  }
  revalidatePath("/obras", "layout");
  return sucesso({ id: data.id });
}

const equipeSchema = z.object({ obraId: z.guid(), userId: z.guid() });

async function exigeDono(obraId: string) {
  const ctx = await exigeMembro(obraId);
  return ehDonoObra(ctx.perfil, ctx.papel, ctx.obra) ? ctx : null;
}

/** Dono inclui na equipe alguém do workspace da obra (a RLS confere de novo). */
export async function adicionaNaEquipe(form: FormData): Promise<Resultado> {
  const parsed = equipeSchema.safeParse({
    obraId: form.get("obraId"),
    userId: form.get("userId"),
  });
  if (!parsed.success) return falha("Dados inválidos");
  const ctx = await exigeDono(parsed.data.obraId);
  if (!ctx) return falha("Só quem criou a obra monta a equipe.");

  const { error } = await ctx.supabase.from("6wla_membros_obra").insert({
    obra_id: parsed.data.obraId,
    user_id: parsed.data.userId,
    adicionado_por: ctx.perfil.id,
  });
  if (error) {
    if (error.code === "23505") return falha("Essa pessoa já está na equipe.");
    // 42501: a policy barrou — a pessoa não é do workspace da obra.
    if (error.code === "42501")
      return falha("Só dá para incluir pessoas do mesmo workspace da obra.");
    return erroInterno("obras.adicionaNaEquipe", error);
  }
  revalidatePath(`/obras/${parsed.data.obraId}`, "layout");
  return sucesso(undefined);
}

export async function removeDaEquipe(form: FormData): Promise<Resultado> {
  const parsed = equipeSchema.safeParse({
    obraId: form.get("obraId"),
    userId: form.get("userId"),
  });
  if (!parsed.success) return falha("Dados inválidos");
  const ctx = await exigeDono(parsed.data.obraId);
  if (!ctx) return falha("Só quem criou a obra monta a equipe.");

  const { error } = await ctx.supabase
    .from("6wla_membros_obra")
    .delete()
    .eq("obra_id", parsed.data.obraId)
    .eq("user_id", parsed.data.userId);
  if (error) return erroInterno("obras.removeDaEquipe", error);
  revalidatePath(`/obras/${parsed.data.obraId}`, "layout");
  return sucesso(undefined);
}
