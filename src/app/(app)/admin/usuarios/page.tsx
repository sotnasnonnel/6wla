import { exigeAdmin } from "@/server/auth";
import { AdminUsuarios } from "@/components/admin/usuarios";
import { CabecalhoPagina } from "@/components/ui/basicos";

export const dynamic = "force-dynamic";

export default async function PaginaUsuarios() {
  const { supabase, perfil } = await exigeAdmin();
  const { data: usuarios } = await supabase
    .from("perfis")
    .select(
      "id, nome, email, admin, ativo, criado_em, membros:membros_workspace(workspace:workspaces(codigo))",
    )
    .order("nome");

  const lista = (usuarios ?? []).map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    admin: u.admin,
    ativo: u.ativo,
    criado_em: u.criado_em,
    workspaces: u.membros.map((m) => m.workspace.codigo).sort(),
  }));

  return (
    <div className="max-w-4xl space-y-4">
      <CabecalhoPagina
        titulo="Usuários"
        apoio="Todas as contas do sistema. Para cadastrar alguém num workspace, use Pessoas."
      />
      <AdminUsuarios usuarios={lista} meuId={perfil.id} />
    </div>
  );
}
