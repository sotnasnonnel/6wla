import { z } from "zod";
import { exigeAdmin } from "@/server/auth";
import { AdminUsuarios } from "@/components/admin/usuarios";
import { contasComConvitePendente } from "@/server/admin/convites";

export const dynamic = "force-dynamic";

/** `?workspace=<id>` vem de "Ver pessoas" em Workspaces; id inválido é ignorado. */
const filtroSchema = z.object({
  workspace: z.guid().optional().catch(undefined),
});

export default async function PaginaUsuarios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtro = filtroSchema.parse(await searchParams);
  const { supabase, perfil } = await exigeAdmin();
  const [{ data: usuarios }, { data: workspaces }] = await Promise.all([
    supabase
      .from("6wla_perfis")
      .select(
        "id, nome, email, admin, ativo, vinculo:6wla_membros_workspace(workspace_id, papel)",
      )
      .order("nome"),
    supabase.from("6wla_workspaces").select("id, codigo, nome").order("nome"),
  ]);

  // Depois do exigeAdmin: só o admin consulta o Auth com service_role.
  const pendentes = await contasComConvitePendente(
    (usuarios ?? []).map((u) => u.id),
  );

  const lista = (usuarios ?? []).map((u) => {
    // Um vínculo por pessoa (`user_id` único): vem objeto ou null.
    const vinculo = u.vinculo;
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      ativo: u.ativo,
      papel: u.admin ? ("admin" as const) : (vinculo?.papel ?? null),
      workspaceId: vinculo?.workspace_id ?? null,
      convitePendente: pendentes.has(u.id),
    };
  });

  const doFiltro =
    (workspaces ?? []).find((w) => w.id === filtro.workspace) ?? null;

  return (
    <div className="max-w-5xl">
      <AdminUsuarios
        usuarios={lista}
        workspaces={workspaces ?? []}
        meuId={perfil.id}
        filtroWorkspace={doFiltro}
      />
    </div>
  );
}
