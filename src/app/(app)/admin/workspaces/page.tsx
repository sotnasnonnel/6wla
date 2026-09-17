import { z } from "zod";
import { exigeAdmin, workspaceAtual } from "@/server/auth";
import { listaWorkspacesAdmin } from "@/server/workspaces/queries";
import { ListaWorkspaces } from "@/components/workspaces/lista-workspaces";

export const dynamic = "force-dynamic";

/** `?novo=1` abre o cadastro (CTA do estado vazio de /sem-workspace). */
const parametrosSchema = z.object({
  novo: z.literal("1").optional().catch(undefined),
});

export default async function PaginaWorkspaces({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { novo } = parametrosSchema.parse(await searchParams);
  const { supabase, perfil } = await exigeAdmin();
  const [workspaces, { atual }] = await Promise.all([
    listaWorkspacesAdmin(supabase),
    workspaceAtual(supabase, perfil),
  ]);
  return (
    <div className="max-w-4xl">
      <ListaWorkspaces
        workspaces={workspaces}
        atualId={atual?.id ?? null}
        abrirCriacao={novo === "1"}
      />
    </div>
  );
}
