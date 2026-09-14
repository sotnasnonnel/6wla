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

  return (
    <div className="flex min-h-screen bg-[var(--plano)]">
      <Sidebar
        obras={obras.map((o) => ({ id: o.id, codigo: o.codigo, nome: o.nome }))}
        grupoAdmin={grupoAdmin.itens.length > 0 ? grupoAdmin : null}
        podeImportar={ehGestor(papel)}
        inicialColapsada={colapsada}
        rodape={
          <RodapeSidebar
            nome={perfil.nome}
            naoLidas={naoLidas}
            userId={perfil.id}
          />
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--borda)] bg-white px-4 pl-14 md:pl-4">
          {atual ? (
            <SeletorWorkspace
              atualId={atual.id}
              lista={lista.map((w) => ({
                id: w.id,
                codigo: w.codigo,
                nome: w.nome,
              }))}
            />
          ) : null}
        </header>
        <main className="min-w-0 flex-1 px-3 py-4 sm:px-4 sm:py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
