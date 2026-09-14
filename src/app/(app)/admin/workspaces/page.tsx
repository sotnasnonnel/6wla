import { exigeAdmin } from "@/server/auth";
import { listaWorkspacesAdmin } from "@/server/workspaces/queries";
import { ListaWorkspaces } from "@/components/workspaces/lista-workspaces";

export const dynamic = "force-dynamic";

export default async function PaginaWorkspaces() {
  const { supabase } = await exigeAdmin();
  const workspaces = await listaWorkspacesAdmin(supabase);
  return (
    <div className="max-w-4xl">
      <ListaWorkspaces workspaces={workspaces} />
    </div>
  );
}
