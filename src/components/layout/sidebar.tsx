"use client";

import Image from "next/image";
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
  workspace,
  inicialColapsada = false,
  podeImportar = false,
}: {
  obras: Obra[];
  grupoAdmin: GrupoMenu | null;
  rodape: ReactNode;
  /** Seletor de workspace, montado no servidor. */
  workspace: ReactNode;
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
          titulo: "Obra",
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
    : [
        {
          titulo: "Módulos",
          itens: [{ href: "/obras", rotulo: "Obras", icone: "obras" }],
        },
      ];

  if (grupoAdmin && grupoAdmin.itens.length > 0) grupos.push(grupoAdmin);

  // Largura do app-phd: 256px, recolhe para 64px. No celular a gaveta abre
  // sempre larga — colapsar é escolha de desktop.
  const largura = colapsada ? 64 : 256;
  const soLargo = colapsada ? "md:hidden" : "";

  return (
    <>
      {/* Celular: barra fina com menu e logo (a `.mobile-topbar` do PHD). */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--borda)] bg-white px-3 md:hidden">
        <button
          ref={gatilho}
          type="button"
          onClick={() => setGaveta({ aberta: true, caminho })}
          aria-label="Abrir menu"
          aria-controls="menu-lateral"
          aria-expanded={gaveta.aberta}
          className="grid h-9 w-9 place-items-center rounded-lg text-[var(--tinta-media)] transition hover:bg-[var(--marca-gelo)]"
        >
          <Icone nome="menu" />
        </button>
        <Logo />
      </div>

      {gaveta.aberta ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => fechaGaveta(true)}
          className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.5)] backdrop-blur-[2px] md:hidden"
        />
      ) : null}

      <aside
        id="menu-lateral"
        // Gaveta fechada sai do caminho do teclado: sem isto, Tab passeia por
        // um menu invisível fora da tela.
        inert={ehCelular && !gaveta.aberta}
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] max-w-[85vw] flex-col border-r border-[var(--borda)] bg-white text-[var(--tinta-forte)] transition-[width,transform] duration-200 ease-out md:sticky md:top-0 md:h-screen md:w-[var(--largura-menu)] md:max-w-none md:translate-x-0 ${
          gaveta.aberta
            ? "translate-x-0 shadow-[var(--sombra-xl)]"
            : "-translate-x-full"
        }`}
        style={{ "--largura-menu": `${largura}px` } as React.CSSProperties}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--grade)] px-4">
          <Link
            href="/obras"
            title="Todas as obras"
            className={`flex min-w-0 flex-1 items-center gap-3 ${colapsada ? "md:justify-center" : ""}`}
          >
            <span className={soLargo}>
              <Logo />
            </span>
            {colapsada ? (
              <span
                aria-hidden
                className="hidden h-6 w-1 rounded-sm bg-[var(--marca-terracotta)] md:block"
              />
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => fechaGaveta(true)}
            aria-label="Fechar menu"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--tinta-fraca)] transition hover:bg-[var(--marca-gelo)] hover:text-[var(--tinta-forte)] md:hidden"
          >
            <Icone nome="fechar" />
          </button>
        </div>

        {/* Contexto: workspace e, dentro de uma obra, a obra. */}
        {workspace || obra ? (
          <div
            className={`shrink-0 space-y-2 border-b border-[var(--grade)] px-3 py-3 ${soLargo}`}
          >
            {workspace}
            {obra ? (
              <div className="rounded-lg bg-[var(--plano)] px-3 py-2">
                <div
                  className="truncate text-sm font-semibold text-[var(--tinta-forte)]"
                  title={obra.nome}
                >
                  {obra.nome}
                </div>
                <Link
                  href="/obras"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--tinta-fraca)] transition hover:text-[var(--marca-terracotta)]"
                >
                  <Icone nome="voltar" tamanho={13} />
                  Todas as obras
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
        {obra && colapsada ? (
          <div
            title={obra.nome}
            className="mx-2 mt-3 hidden h-8 place-items-center rounded-lg bg-[var(--plano)] text-[11px] font-bold text-[var(--tinta-media)] md:grid"
          >
            {obra.codigo.slice(0, 4)}
          </div>
        ) : null}

        <nav className="rolagem-fina flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
          {grupos.map((grupo, i) => (
            <div key={grupo.titulo ?? i} className={i > 0 ? "mt-3" : ""}>
              {grupo.titulo ? (
                <h2
                  className={`px-3 pt-1.5 pb-1 text-[0.625rem] font-semibold tracking-[0.05em] whitespace-nowrap text-[var(--tinta-apagada)] uppercase ${soLargo}`}
                >
                  {grupo.titulo}
                </h2>
              ) : null}
              {grupo.titulo && colapsada && i > 0 ? (
                <div className="mx-3 mb-2 hidden border-t border-[var(--grade)] md:block" />
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
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm whitespace-nowrap transition md:py-2 ${
                          ativo
                            ? "bg-[var(--marca-brand-50)] font-semibold text-[var(--marca-terracotta-escuro)]"
                            : "font-medium text-[var(--tinta-media)] hover:bg-[var(--plano)] hover:text-[var(--tinta-forte)]"
                        } ${colapsada ? "md:justify-center md:px-0" : ""}`}
                      >
                        <Icone nome={item.icone} />
                        <span className={`truncate ${soLargo}`}>
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

        <div className="hidden shrink-0 border-t border-[var(--grade)] p-2 md:block">
          <button
            type="button"
            onClick={alterna}
            aria-label={colapsada ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!colapsada}
            title={colapsada ? "Expandir menu" : "Recolher menu"}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[0.78rem] font-medium whitespace-nowrap text-[var(--tinta-fraca)] transition hover:bg-[var(--marca-gelo)] hover:text-[var(--tinta-forte)] ${colapsada ? "justify-center" : ""}`}
          >
            <span
              aria-hidden
              className={`transition-transform duration-200 ${colapsada ? "rotate-180" : ""}`}
            >
              <Icone nome="recolher" />
            </span>
            {!colapsada ? <span>Recolher</span> : null}
          </button>
        </div>

        <div className="shrink-0 border-t border-[var(--grade)]">
          <ContextoMenu.Provider value={colapsada}>
            {rodape}
          </ContextoMenu.Provider>
        </div>
      </aside>
    </>
  );
}

/** Logo da PHD (já vem em terracota; sem o filtro de cor que o PHD usa). */
function Logo() {
  return (
    <Image
      src="/logo-phd.png"
      alt="PHD Engenharia · Restrições"
      width={1586}
      height={226}
      priority
      className="h-auto w-[148px] max-w-none"
    />
  );
}

export function ItemRodape({
  children,
  titulo,
  href,
}: {
  children: ReactNode;
  titulo?: string;
  href: string;
}) {
  const colapsada = useMenuColapsado();
  return (
    <Link
      href={href}
      title={titulo}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap text-[var(--tinta-media)] transition hover:bg-[var(--plano)] hover:text-[var(--tinta-forte)] ${colapsada ? "md:justify-center md:px-0" : ""}`}
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

export function Icone({
  nome,
  tamanho = 18,
}: {
  nome: keyof typeof ICONES;
  tamanho?: number;
}) {
  return (
    <svg
      aria-hidden
      width={tamanho}
      height={tamanho}
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
