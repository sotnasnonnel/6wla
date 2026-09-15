"use client";

import type { ReactNode } from "react";
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
 *   - eixo e grade recuados, o dado é que tem contraste.
 */

const TINTA = { forte: "#0f172a", media: "#475569", fraca: "#64748b" } as const;

export function CartaoKpi({
  rotulo,
  valor,
  detalhe,
  cor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  cor?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`min-w-[calc(50%-0.25rem)] flex-1 rounded-lg border bg-white px-3 py-2 sm:min-w-[130px] ${
        destaque
          ? "border-[var(--marca-terracotta)] ring-1 ring-[var(--marca-terracotta)]"
          : "border-[var(--borda)]"
      }`}
      style={cor ? { borderLeftWidth: 4, borderLeftColor: cor } : undefined}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--tinta-fraca)]">
        {rotulo}
      </div>
      <div
        className="mt-0.5 text-2xl leading-tight font-semibold"
        style={{ color: TINTA.forte }}
      >
        {valor}
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
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
                className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-xs transition hover:bg-[var(--marca-gelo)] ${
                  ativa === s
                    ? "font-semibold text-[var(--tinta-forte)]"
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
  children,
  className = "",
}: {
  titulo: string;
  acessorio?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-[var(--borda)] bg-white p-2.5 sm:p-3 ${className}`}
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--tinta-forte)]">{titulo}</h2>
        {acessorio}
      </header>
      {children}
    </section>
  );
}

/**
 * Barras horizontais empilhadas por situação — a leitura principal do painel:
 * para cada área/setor/responsável, quanto já saiu e quanto ainda pesa.
 * Clicar filtra o painel inteiro por aquela linha.
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
  const maximo = Math.max(1, ...grupos.map((g) => g.total));
  if (grupos.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--tinta-fraca)]">
        Sem dados com os filtros atuais.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {grupos.map((g) => {
        const ativa = selecionada === g.chave;
        return (
          <li key={g.chave}>
            <button
              type="button"
              disabled={!aoClicar}
              onClick={() => aoClicar?.(g.chave)}
              aria-pressed={ativa}
              title={`${g.chave}: ${g.total}`}
              className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left transition ${
                aoClicar ? "hover:bg-[var(--marca-gelo)]" : "cursor-default"
              } ${ativa ? "bg-[var(--marca-brand-50)] ring-1 ring-[var(--marca-terracotta)]" : ""}`}
            >
              <span
                className="shrink-0 truncate text-xs text-[var(--tinta-media)]"
                style={{ width: larguraRotulo }}
                title={g.chave}
              >
                {g.chave}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="flex overflow-hidden"
                  style={{
                    width: `${(g.total / maximo) * 100}%`,
                    height: altura,
                    gap: 2,
                  }}
                >
                  {SITUACOES_EMPILHADAS.map((s) => {
                    const v = g.contagem[s];
                    if (v === 0) return null;
                    const largura = (v / g.total) * 100;
                    return (
                      <span
                        key={s}
                        className="flex items-center justify-center overflow-hidden first:rounded-l last:rounded-r"
                        style={{
                          width: `${largura}%`,
                          background: SITUACAO_COR[s],
                        }}
                        title={`${SITUACAO_ROTULO[s]}: ${v}`}
                      >
                        {/* Rótulo dentro só quando cabe; a cor sozinha não informa. */}
                        {largura > 9 && v > 0 ? (
                          <span
                            className="px-0.5 text-[10px] font-semibold tabular-nums"
                            style={{
                              color: s === "no_prazo" ? "#422006" : "#ffffff",
                            }}
                          >
                            {v}
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </span>
                <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--tinta-forte)]">
                  {g.total}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Barras simples de uma métrica contínua (média de dias, por exemplo). */
export function BarrasSimples({
  itens,
  cor = "#2f6ea8",
  sufixo = "",
  casas = 0,
  larguraRotulo = 150,
}: {
  itens: Array<{ chave: string; valor: number; detalhe?: string }>;
  cor?: string;
  sufixo?: string;
  casas?: number;
  larguraRotulo?: number;
}) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor));
  if (itens.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--tinta-fraca)]">
        Sem dados com os filtros atuais.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {itens.map((i) => (
        <li key={i.chave} className="flex items-center gap-2" title={i.detalhe}>
          <span
            className="shrink-0 truncate text-xs text-[var(--tinta-media)]"
            style={{ width: larguraRotulo }}
          >
            {i.chave}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="h-[14px] rounded-r-[4px]"
              style={{
                width: `${(i.valor / maximo) * 100}%`,
                background: cor,
                minWidth: 2,
              }}
            />
            <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--tinta-forte)]">
              {i.valor.toFixed(casas).replace(".", ",")}
              {sufixo}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
