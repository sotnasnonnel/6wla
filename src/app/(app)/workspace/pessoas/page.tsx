import { redirect } from "next/navigation";
import { exigeWorkspaceAtual } from "@/server/auth";
import { listaMembrosWorkspace } from "@/server/workspaces/queries";
import { PessoasWorkspace } from "@/components/workspaces/pessoas";

export const dynamic = "force-dynamic";

export default async function PaginaPessoas() {
  const { supabase, perfil, workspace, papel } = await exigeWorkspaceAtual();
  if (papel !== "admin") redirect("/obras");
  const membros = await listaMembrosWorkspace(supabase, workspace.id);

  return (
    <div className="max-w-4xl">
      <PessoasWorkspace
        workspaceId={workspace.id}
        workspaceNome={workspace.nome}
        membros={membros}
        meuId={perfil.id}
        souAdminGlobal={perfil.admin}
      />
    </div>
  );
}
