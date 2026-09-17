"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  SITUACAO_COR,
  SITUACAO_ROTULO,
  SITUACOES_EMPILHADAS,
  type GrupoSituacao,
  type Situacao,
} from "@/lib/restricoes/indicadores";

/**
 * Peças do painel de indicadores. Sem biblioteca de gráfico: barra empilhada é
 * flex, série semanal é SVG. Regras que valem em todas:
 *   - a cor nunca é o único canal (todo valor tem rótulo e a legenda é fixa);
 *   - 2px de respiro entre segmentos, para dois blocos vizinhos não virarem um;
 *   - eixo e grade recuados, o dado é que tem contraste;
 *   - todo alvo funciona por toque e teclado, não só por hover.
 */

const TINTA = { forte: "#0f172a", media: "#475569", fraca: "#64748b" } as const;

/** Situações que aparecem nas caixas de detalhe (cancelada só se houver). */
const SITUACOES_DETALHE: readonly Situacao[] = [
  "concluida_no_prazo",
  "concluida_com_atraso",
  "no_prazo",
  "atrasada",
];

/**
 * Largura real do container, para o SVG desenhar em pixels de verdade: com
 * `viewBox` fixo escalado, a fonte de 9px vira 4px num painel estreito.
 */
export function useLarguraContainer<T extends HTMLElement>(inicial: number) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver((entradas) => {
      const w = entradas[0]?.contentRect.width;
      if (w && w > 0) setLargura(Math.floor(w));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largura] as const;
}

/** Pulso curto quando o valor muda — só para quem não pediu menos movimento. */
function usePulsoAoMudar<T extends HTMLElement>(valor: string) {
  const ref = useRef<T>(null);
  const anterior = useRef(valor);
  useEffect(() => {
    if (anterior.current === valor) return;
    anterior.current = valor;
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [
        { opacity: 0.35, transform: "translateY(3px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 220, easing: "ease-out" },
    );
  }, [valor]);
  return ref;
}

/**
 * Ajuda de um indicador: botão "?" que abre a fórmula. Abre por clique ou
 * teclado, fecha com Esc ou clicando fora; o texto fica ligado ao botão.
 */
export function Ajuda({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  const caixa = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node))
        setAberta(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberta]);

  return (
    <span ref={caixa} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={aberta}
        aria-controls={id}
        aria-label={`Como é calculado: ${titulo}`}
        onClick={() => setAberta((a) => !a)}
        className="grid h-5 w-5 place-items-center rounded-full border border-[var(--borda-forte)] text-[11px] font-bold text-[var(--tinta-fraca)] transition hover:border-[var(--marca-azul)] hover:text-[var(--marca-azul)] focus-visible:outline-2 focus-visible:outline-[var(--marca-terracotta)]"
      >
        ?
      </button>
      <span
        id={id}
        role="note"
        hidden={!aberta}
        className="absolute top-6 right-0 z-30 w-64 max-w-[80vw] rounded-lg border border-[var(--borda)] bg-white p-2.5 text-left text-xs font-normal tracking-normal text-[var(--tinta-media)] normal-case shadow-[var(--sombra-md)]"
      >
        <span className="mb-1 block font-semibold text-[var(--tinta-forte)]">
          {titulo}
        </span>
        {children}
      </span>
    </span>
  );
}

export function CartaoKpi({
  rotulo,
  valor,
  unidade,
  detalhe,
  cor,
  ajuda,
  tamanho = "grande",
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  /** Unidade depois do número ("dias"), menor que ele. */
  unidade?: string;
  detalhe?: string;
  cor?: string;
  ajuda?: ReactNode;
  tamanho?: "grande" | "compacto";
  destaque?: boolean;
}) {
  const ref = usePulsoAoMudar<HTMLSpanElement>(valor);
  const grande = tamanho === "grande";
  return (
    <div
      className={`min-w-0 rounded-lg border bg-white ${grande ? "px-3 py-2.5" : "px-3 py-1.5"} ${
        destaque
          ? "border-[var(--marca-terracotta)] ring-1 ring-[var(--marca-terracotta)]"
          : "border-[var(--borda)]"
      }`}
      style={cor ? { borderLeftWidth: 4, borderLeftColor: cor } : undefined}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="text-[11px] font-medium tracking-wide text-[var(--tinta-fraca)] uppercase">
          {rotulo}
        </div>
        {ajuda ? <Ajuda titulo={rotulo}>{ajuda}</Ajuda> : null}
      </div>
      <div
        className={`leading-tight font-semibold tabular-nums ${grande ? "mt-0.5 text-3xl" : "text-lg"}`}
        style={{ color: TINTA.forte }}
      >
        <span ref={ref} className="inline-block">
          {valor}
        </span>
        {unidade ? (
          <span className="ml-1 text-sm font-medium text-[var(--tinta-fraca)]">
            {unidade}
          </span>
        ) : null}
      </div>
      {detalhe ? (
        <div className="text-[11px] text-[var(--tinta-fraca)]">{detalhe}</div>
      ) : null}
    </div>
  );
}

/** Legenda das situações. Sempre visível: identidade nunca depende só da cor. */
export function Legenda({
  situacoes = SITUACOES_EMPILHADAS,
  ativa,
  aoClicar,
}: {
  situacoes?: readonly Situacao[];
  ativa?: Situacao | null;
  aoClicar?: (s: Situacao) => void;
}) {
  return (
    <ul
      aria-label="Legenda das situações"
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      {situacoes.map((s) => {
        const conteudo = (
          <>
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: SITUACAO_COR[s] }}
            />
            <span>{SITUACAO_ROTULO[s]}</span>
          </>
        );
        return (
          <li key={s}>
            {aoClicar ? (
              <button
                type="button"
                onClick={() => aoClicar(s)}
                aria-pressed={ativa === s}
                className={`flex min-h-7 items-center gap-1.5 rounded px-1 py-0.5 text-xs transition hover:bg-[var(--marca-gelo)] ${
                  ativa === s
                    ? "font-semibold text-[var(--tinta-forte)] ring-1 ring-[var(--marca-terracotta)]"
                    : "text-[var(--tinta-media)]"
                }`}
              >
                {conteudo}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-1 py-0.5 text-xs text-[var(--tinta-media)]">
                {conteudo}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Painel({
  titulo,
  acessorio,
  nota,
  children,
  id,
  className = "",
}: {
  titulo: string;
  acessorio?: ReactNode;
  /** Linha de apoio sob o título (recorte, corte top N...). */
  nota?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      className={`flex min-w-0 scroll-mt-32 flex-col rounded-lg border border-[var(--borda)] bg-white p-2.5 outline-none sm:p-3 md:scroll-mt-20 ${className}`}
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h2 className="text-sm font-semibold text-[var(--tinta-forte)]">
          {titulo}
        </h2>
        {acessorio}
        {nota ? (
          <p className="basis-full text-[11px] text-[var(--tinta-fraca)]">
            {nota}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** Aviso de corte: o gráfico mostra só os N primeiros. */
export function AvisoCorte({
  ocultos,
  mostrados,
  singular,
  plural,
  feminino = false,
}: {
  ocultos: number;
  mostrados: number;
  singular: string;
  plural: string;
  feminino?: boolean;
}) {
  if (ocultos <= 0) return null;
  return (
    <p className="mt-1.5 text-[11px] text-[var(--tinta-fraca)]">
      + {ocultos} {ocultos === 1 ? singular : plural} — o gráfico mostra só{" "}
      {feminino ? "as" : "os"} {mostrados} {feminino ? "primeiras" : "primeiros"}.
    </p>
  );
}

/** Texto completo de um grupo, para leitor de tela e caixa de detalhe. */
export function descreveGrupo(g: GrupoSituacao): string {
  const partes = SITUACOES_DETALHE.map(
    (s) => `${g.contagem[s]} ${SITUACAO_ROTULO[s].toLowerCase()}`,
  );
  if (g.contagem.cancelada > 0)
    partes.push(`${g.contagem.cancelada} cancelada(s)`);
  return `${g.chave}: ${g.total} restrições — ${partes.join(", ")}`;
}

/**
 * Caixa com todas as situações de um item — a alternativa ao `title`, que não
 * existe no toque. Anunciada com educação, sem roubar o foco.
 */
export function CaixaDetalhe({
  titulo,
  contagem,
  extra,
  vazio = "Toque, clique ou use Tab numa barra para ver os números.",
}: {
  titulo?: string;
  contagem?: Record<Situacao, number>;
  extra?: ReactNode;
  vazio?: string;
}) {
  return (
    <div
      aria-live="polite"
      className="mt-2 min-h-[2.75rem] rounded-lg bg-[var(--plano)] px-2.5 py-1.5 text-xs"
    >
      {titulo && contagem ? (
        <>
          <div className="font-semibold break-words text-[var(--tinta-forte)]">
            {titulo}
            {extra ? (
              <span className="font-normal text-[var(--tinta-media)]">
                {" "}
                · {extra}
              </span>
            ) : null}
          </div>
          <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--tinta-media)]">
            {[
              ...SITUACOES_DETALHE,
              ...(contagem.cancelada > 0 ? (["cancelada"] as const) : []),
            ].map((s) => (
              <li key={s} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-[2px]"
                  style={{ background: SITUACAO_COR[s] }}
                />
                {SITUACAO_ROTULO[s]}{" "}
                <b className="tabular-nums text-[var(--tinta-forte)]">
                  {contagem[s]}
                </b>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <span className="text-[var(--tinta-fraca)]">{vazio}</span>
      )}
    </div>
  );
}

/** Largura mínima (em % da faixa inteira) para o número caber no segmento. */
const MINIMO_ROTULO_DENTRO = 8;

/**
 * Barras horizontais empilhadas por situação — a leitura principal do painel:
 * para cada área/setor/responsável, quanto já saiu e quanto ainda pesa.
 * Clicar filtra o painel inteiro por aquela linha.
 *
 * No celular o rótulo vai acima da barra (a coluna fixa de 150px comeria a
 * barra); segmento estreito demais para o número mostra o valor ao lado.
 */
export function BarrasEmpilhadas({
  grupos,
  aoClicar,
  selecionada,
  larguraRotulo = 150,
  altura = 18,
}: {
  grupos: GrupoSituacao[];
  aoClicar?: (chave: string) => void;
  selecionada?: string | null;
  larguraRotulo?: number;
  altura?: number;
}) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const maximo = Math.max(1, ...grupos.map((g) => g.total));
  if (grupos.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--tinta-fraca)]">
        Sem dados com os filtros atuais.
      </p>
    );
  }
  const g0 = grupos.find((g) => g.chave === ativo) ?? null;
  const estiloRotulo = {
    "--largura-rotulo": `${larguraRotulo}px`,
  } as CSSProperties;

  return (
    <div>
      <ul
        className="space-y-1"
        onPointerLeave={(e) => e.pointerType === "mouse" && setAtivo(null)}
      >
        {grupos.map((g) => {
          const selecionado = selecionada === g.chave;
          const estreitos = SITUACOES_EMPILHADAS.filter(
            (s) =>
              g.contagem[s] > 0 &&
              (g.contagem[s] / maximo) * 100 < MINIMO_ROTULO_DENTRO,
          );
          return (
            <li key={g.chave}>
              <button
                type="button"
                disabled={!aoClicar}
                onClick={() => aoClicar?.(g.chave)}
                onFocus={() => setAtivo(g.chave)}
                onPointerDown={() => setAtivo(g.chave)}
                onPointerEnter={(e) =>
                  e.pointerType === "mouse" && setAtivo(g.chave)
                }
                aria-pressed={aoClicar ? selecionado : undefined}
                aria-label={descreveGrupo(g)}
                title={`${g.chave}: ${g.total}`}
                style={estiloRotulo}
                className={`flex w-full flex-col gap-0.5 rounded px-1 py-1 text-left transition sm:flex-row sm:items-center sm:gap-2 sm:py-0.5 ${
                  aoClicar ? "hover:bg-[var(--marca-gelo)]" : "cursor-default"
                } ${selecionado ? "bg-[var(--marca-brand-50)] ring-1 ring-[var(--marca-terracotta)]" : ""} ${
                  ativo === g.chave && !selecionado
                    ? "bg-[var(--marca-gelo)]"
                    : ""
                }`}
              >
                <span className="w-full truncate text-xs text-[var(--tinta-media)] sm:w-[var(--largura-rotulo)] sm:shrink-0">
                  {g.chave}
                </span>
                <span className="flex w-full min-w-0 flex-1 items-center gap-2">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span
                      className="flex overflow-hidden"
                      style={{
                        width: `${(g.total / maximo) * 100}%`,
                        height: altura,
                        gap: 2,
                        minWidth: 3,
                      }}
                    >
                      {SITUACOES_EMPILHADAS.map((s) => {
                        const v = g.contagem[s];
                        if (v === 0) return null;
                        const cabe = (v / maximo) * 100 >= MINIMO_ROTULO_DENTRO;
                        return (
                          <span
                            key={s}
                            className="flex items-center justify-center overflow-hidden first:rounded-l last:rounded-r"
                            style={{
                              width: `${(v / g.total) * 100}%`,
                              background: SITUACAO_COR[s],
                            }}
                          >
                            {cabe ? (
                              <span
                                aria-hidden
                                className="px-0.5 text-[11px] font-semibold tabular-nums"
                                style={{
                                  color:
                                    s === "no_prazo" ? "#422006" : "#ffffff",
                                }}
                              >
                                {v}
                              </span>
                            ) : null}
                          </span>
                        );
                      })}
                    </span>
                    {/* O que não coube dentro vem logo depois, com a cor ao lado. */}
                    {estreitos.length > 0 ? (
                      <span
                        aria-hidden
                        className="flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-[var(--tinta-media)]"
                      >
                        {estreitos.map((s) => (
                          <span key={s} className="flex items-center gap-0.5">
                            <span
                              className="inline-block h-2 w-2 rounded-[2px]"
                              style={{ background: SITUACAO_COR[s] }}
                            />
                            {g.contagem[s]}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden
                    className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--tinta-forte)]"
                  >
                    {g.total}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <CaixaDetalhe
        {...(g0
          ? {
              titulo: g0.chave,
              contagem: g0.contagem,
              extra: `${g0.total} restrições`,
            }
          : {})}
      />
    </div>
  );
}
