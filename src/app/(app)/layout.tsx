import { cookies } from "next/headers";
import {
  ehGestor,
  exigeUsuario,
  workspaceAtual,
  papelNoWorkspace,
} from "@/server/auth";
import { contaNaoLidas } from "@/server/notificacoes/queries";
import { listaObras } from "@/server/obras/queries";
import {
  COOKIE_SIDEBAR,
  Sidebar,
  type GrupoMenu,
} from "@/components/layout/sidebar";
import { RodapeSidebar } from "@/components/layout/rodape-sidebar";
import { SeletorWorkspace } from "@/components/workspaces/seletor";

const PAPEL_ROTULO = {
  admin: "Administrador",
  gestor: "Gestor",
  membro: "Membro",
} as const;

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const { perfil, supabase } = await exigeUsuario();
  const [naoLidas, { atual, lista }, biscoitos] = await Promise.all([
    contaNaoLidas(supabase, perfil.id),
    workspaceAtual(supabase, perfil),
    cookies(),
  ]);
  // Lido no servidor para o primeiro HTML já sair com a largura certa.
  const colapsada = biscoitos.get(COOKIE_SIDEBAR)?.value === "1";

  const [obras, papel] = atual
    ? await Promise.all([
        listaObras(supabase, atual.id),
        papelNoWorkspace(supabase, perfil, atual.id),
      ])
    : [[], null];

  const grupoAdmin: GrupoMenu = { titulo: "Administração", itens: [] };
  if (papel === "admin") {
    grupoAdmin.itens.push({
      href: "/workspace/pessoas",
      rotulo: "Pessoas",
      icone: "pessoas",
    });
  }
  if (perfil.admin) {
    grupoAdmin.itens.push(
      { href: "/admin/workspaces", rotulo: "Workspaces", icone: "workspaces" },
      { href: "/admin/usuarios", rotulo: "Usuários", icone: "usuarios" },
    );
  }

  const rotuloPapel = perfil.admin
    ? "Administrador geral"
    : papel
      ? PAPEL_ROTULO[papel]
      : "Sem workspace";

  return (
    <div className="flex min-h-screen bg-[var(--plano)]">
      <Sidebar
        obras={obras.map((o) => ({ id: o.id, codigo: o.codigo, nome: o.nome }))}
        grupoAdmin={grupoAdmin.itens.length > 0 ? grupoAdmin : null}
        podeImportar={ehGestor(papel)}
        inicialColapsada={colapsada}
        workspace={
          atual ? (
            <SeletorWorkspace
              atualId={atual.id}
              lista={lista.map((w) => ({
                id: w.id,
                codigo: w.codigo,
                nome: w.nome,
              }))}
            />
          ) : null
        }
        rodape={
          <RodapeSidebar
            nome={perfil.nome}
            papel={rotuloPapel}
            naoLidas={naoLidas}
            userId={perfil.id}
          />
        }
      />
      {/* Sem topbar no desktop, como no app-phd: a página começa no título. */}
      <main className="min-w-0 flex-1 px-4 pt-[4.5rem] pb-6 sm:px-6 md:px-8 md:pt-7 md:pb-8">
        {children}
      </main>
    </div>
  );
}
