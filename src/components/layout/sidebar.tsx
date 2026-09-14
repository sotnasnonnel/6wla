"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * Barra lateral de navegação, com dois modos:
 *
 *  - fora de uma obra, lista as obras do workspace e a administração;
 *  - dentro de uma obra (`/obras/<id>/...`), troca para o menu daquela obra.
 *
 * O modo sai da própria URL — a obra é o contexto de trabalho, não um filtro
 * que se escolhe de novo em cada tela.
 *
 * O estado colapsado vive num cookie lido pelo servidor (`COOKIE_SIDEBAR`):
 * assim o primeiro HTML já vem com a largura certa, sem o pisco de
 * expandir-e-encolher que o localStorage causaria.
 */

export const COOKIE_SIDEBAR = "6wla_sidebar";

/**
 * O estado de recolhido é único e mora aqui. O rodapé é montado no servidor e
 * entregue como prop, mas renderiza dentro deste provedor — assim conta,
 * notificações e sair encolhem no mesmo clique que a barra, sem depender de
 * uma segunda leitura do cookie.
 */
const ContextoMenu = createContext(false);

export function useMenuColapsado(): boolean {
  return useContext(ContextoMenu);
}

/** `true` na largura em que a barra vira gaveta (o `md` do Tailwind). */
function useEhCelular(): boolean {
  return useSyncExternalStore(
    (avisa) => {
      const mq = window.matchMedia("(max-width: 767px)");
      mq.addEventListener("change", avisa);
      return () => mq.removeEventListener("change", avisa);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    // No servidor não há largura: o desktop é o palpite que não esconde nada.
    () => false,
  );
}

export type Obra = { id: string; codigo: string; nome: string };

export type ItemMenu = {
  href: string;
  rotulo: string;
  icone: keyof typeof ICONES;
  prefixo?: boolean;
};

export type GrupoMenu = { titulo?: string; itens: ItemMenu[] };

export function Sidebar({
  obras,
  grupoAdmin,
  rodape,
  inicialColapsada = false,
  podeImportar = false,
}: {
  obras: Obra[];
  grupoAdmin: GrupoMenu | null;
  rodape: ReactNode;
  inicialColapsada?: boolean;
  podeImportar?: boolean;
}) {
  const [colapsada, setColapsada] = useState(inicialColapsada);
  const [gaveta, setGaveta] = useState<{ aberta: boolean; caminho: string }>({
    aberta: false,
    caminho: "",
  });
  const caminho = usePathname();
  const ehCelular = useEhCelular();
  const gatilho = useRef<HTMLButtonElement>(null);

  // Navegou: a gaveta fecha. Derivar do pathname no render evita um efeito só
  // para chamar setState (o compilador do React barra esse padrão).
  if (gaveta.aberta && gaveta.caminho !== caminho) {
    setGaveta({ aberta: false, caminho });
  }

  const fechaGaveta = (devolveFoco = false) => {
    setGaveta({ aberta: false, caminho });
    if (devolveFoco) gatilho.current?.focus();
  };

  // Esc fecha a gaveta de qualquer lugar dela e devolve o foco a quem abriu.
  useEffect(() => {
    if (!gaveta.aberta) return;
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      setGaveta((g) => ({ ...g, aberta: false }));
      gatilho.current?.focus();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [gaveta.aberta]);

  const alterna = () => {
    const novo = !colapsada;
    setColapsada(novo);
    try {
      document.cookie = `${COOKIE_SIDEBAR}=${novo ? "1" : "0"};path=/;max-age=31536000;samesite=lax`;
    } catch {
      // Sem cookie, a escolha vale só para esta navegação.
    }
  };

  const obraId = /^\/obras\/([0-9a-f-]{36})(\/|$)/i.exec(caminho)?.[1] ?? null;
  const obra = obraId ? (obras.find((o) => o.id === obraId) ?? null) : null;

  const grupos: GrupoMenu[] = obra
    ? [
        {
          itens: [
            {
              href: `/obras/${obra.id}/indicadores`,
              rotulo: "Indicadores",
              icone: "indicadores",
            },
            {
              href: `/obras/${obra.id}/tabela`,
              rotulo: "Tabela",
              icone: "tabela",
            },
            ...(podeImportar
              ? [
                  {
                    href: `/obras/${obra.id}/importar`,
                    rotulo: "Importar planilha",
                    icone: "importar" as const,
                    prefixo: true,
                  },
                ]
              : []),
          ],
        },
      ]
    : [{ itens: [{ href: "/obras", rotulo: "Obras", icone: "obras" }] }];

  if (grupoAdmin && grupoAdmin.itens.length > 0) grupos.push(grupoAdmin);

  // No celular a gaveta abre sempre larga: colapsar é escolha de desktop, e
  // uma gaveta de 60px sobre a tela inteira não ajuda ninguém.
  const largura = colapsada ? 60 : 216;

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        onClick={() => setGaveta({ aberta: true, caminho })}
        aria-label="Abrir menu"
        aria-controls="menu-lateral"
        aria-expanded={gaveta.aberta}
        className="fixed left-3 top-3 z-40 rounded-md bg-[var(--marca-azul)] p-2 text-white shadow-md md:hidden"
      >
        <Icone nome="menu" />
      </button>

      {gaveta.aberta ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => fechaGaveta(true)}
          className="fixed inset-0 z-40 bg-[#26405d]/45 md:hidden"
        />
      ) : null}

      <aside
        id="menu-lateral"
        // Gaveta fechada sai do caminho do teclado: sem isto, Tab passeia por
        // um menu invisível fora da tela.
        inert={ehCelular && !gaveta.aberta}
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[82vw] flex-col bg-[var(--marca-azul)] text-white transition-[width,transform] duration-200 ease-out md:sticky md:top-0 md:h-screen md:w-[var(--largura-menu)] md:max-w-none md:translate-x-0 ${
          gaveta.aberta ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ "--largura-menu": `${largura}px` } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => fechaGaveta(true)}
          aria-label="Fechar menu"
          className="absolute right-2 top-3.5 rounded-md p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white md:hidden"
        >
          <Icone nome="fechar" />
        </button>

        <Link
          href="/obras"
          title="Todas as obras"
          className="flex h-14 shrink-0 items-center gap-2.5 px-3 transition hover:bg-white/5"
        >
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--marca-terracotta)] text-sm font-bold"
          >
            6
          </span>
          <span
            className={`truncate text-sm leading-tight font-semibold ${colapsada ? "md:hidden" : ""}`}
          >
            Restrições
            <span className="block text-[11px] font-normal text-white/55">
              6WLA
            </span>
          </span>
        </Link>

        {/* Dentro de uma obra, o nome dela encabeça o menu. */}
        {obra ? (
          <div className="shrink-0 border-y border-white/10 bg-black/15 px-3 py-2">
            {colapsada ? (
              <div
                title={obra.nome}
                className="hidden h-7 place-items-center rounded bg-white/10 text-[11px] font-bold md:grid"
              >
                {obra.codigo.slice(0, 4)}
              </div>
            ) : null}
            <div className={colapsada ? "md:hidden" : ""}>
              <div className="truncate text-sm font-semibold" title={obra.nome}>
                {obra.nome}
              </div>
              <Link
                href="/obras"
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-white/55 transition hover:text-white"
              >
                <Icone nome="voltar" />
                Todas as obras
              </Link>
            </div>
          </div>
        ) : null}

        <nav className="rolagem-fina flex-1 overflow-y-auto px-2 py-2">
          {grupos.map((grupo, i) => (
            <div key={grupo.titulo ?? i} className={i > 0 ? "mt-4" : ""}>
              {grupo.titulo ? (
                <h2
                  className={`px-2 pb-1 text-[11px] font-medium text-white/40 ${colapsada ? "md:hidden" : ""}`}
                >
                  {grupo.titulo}
                </h2>
              ) : null}
              {grupo.titulo && colapsada ? (
                <div className="mx-2 mb-2 hidden border-t border-white/15 md:block" />
              ) : null}
              <ul className="space-y-0.5">
                {grupo.itens.map((item) => {
                  const ativo = item.prefixo
                    ? caminho === item.href ||
                      caminho.startsWith(`${item.href}/`)
                    : caminho === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={colapsada ? item.rotulo : undefined}
                        aria-current={ativo ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-md px-2 py-2.5 text-sm transition md:py-2 ${
                          ativo
                            ? "bg-[var(--marca-terracotta)] font-semibold text-white"
                            : "text-white/75 hover:bg-white/10 hover:text-white"
                        } ${colapsada ? "md:justify-center" : ""}`}
                      >
                        <Icone nome={item.icone} />
                        <span
                          className={`truncate ${colapsada ? "md:hidden" : ""}`}
                        >
                          {item.rotulo}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/15 px-2 py-2">
          <ContextoMenu.Provider value={colapsada}>
            {rodape}
          </ContextoMenu.Provider>
        </div>

        <button
          type="button"
          onClick={alterna}
          aria-label={colapsada ? "Expandir menu" : "Minimizar menu"}
          aria-expanded={!colapsada}
          title={colapsada ? "Expandir menu" : "Minimizar menu"}
          className="hidden h-9 shrink-0 items-center gap-2 border-t border-white/15 px-3 text-xs text-white/55 transition hover:bg-white/10 hover:text-white md:flex"
        >
          <span
            aria-hidden
            className={`transition-transform duration-200 ${colapsada ? "rotate-180" : ""}`}
          >
            <Icone nome="recolher" />
          </span>
          {!colapsada ? <span>Minimizar</span> : null}
        </button>
      </aside>
    </>
  );
}

export function ItemRodape({
  children,
  titulo,
  href,
  destaque,
}: {
  children: ReactNode;
  titulo?: string;
  href: string;
  destaque?: boolean;
}) {
  return (
    <Link
      href={href}
      title={titulo}
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition ${
        destaque ? "text-white" : "text-white/70"
      } hover:bg-white/10 hover:text-white`}
    >
      {children}
    </Link>
  );
}

const ICONES = {
  indicadores: "M3 3v18h18M7 15l3-4 3 3 5-7",
  tabela: "M3 5h18v14H3zM3 10h18M9 10v9M15 10v9",
  obras: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5",
  pessoas:
    "M16 20v-2a4 4 0 0 0-8 0v2M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 20v-2a3 3 0 0 0-2-2.8",
  workspaces: "M3 6h7v5H3zM14 6h7v5h-7zM3 15h7v5H3zM14 15h7v5h-7z",
  usuarios:
    "M4 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7",
  sino: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  conta:
    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  sair: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  recolher: "M15 18l-6-6 6-6",
  voltar: "M19 12H5M12 19l-7-7 7-7",
  menu: "M3 6h18M3 12h18M3 18h18",
  fechar: "M18 6 6 18M6 6l12 12",
  importar: "M12 3v12M8 11l4 4 4-4M4 21h16",
} as const;

export function Icone({ nome }: { nome: keyof typeof ICONES }) {
  return (
    <svg
      aria-hidden
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={ICONES[nome]} />
    </svg>
  );
}
