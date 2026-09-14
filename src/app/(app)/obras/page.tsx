import { exigeWorkspaceAtual } from "@/server/auth";
import { listaObrasComResumo } from "@/server/obras/queries";
import { ListaObras } from "@/components/obras/lista-obras";

export const dynamic = "force-dynamic";

export default async function PaginaObras() {
  const { supabase, workspace, papel } = await exigeWorkspaceAtual();
  const obras = await listaObrasComResumo(supabase, workspace.id);

  return (
    <ListaObras
      obras={obras}
      podeCriar={papel === "admin"}
      workspaceId={workspace.id}
      workspaceNome={workspace.nome}
    />
  );
}
