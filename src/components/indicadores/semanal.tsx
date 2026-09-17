"use client";

import { useState, type KeyboardEvent } from "react";
import { tetoDoEixo, type PontoSemana } from "@/lib/restricoes/indicadores";
import { useLarguraContainer } from "./pecas";

/**
 * Previstas e concluídas por semana: barras do que foi concluído contra a linha do
 * que estava previsto para aquela semana. As duas séries contam restrições, na
 * mesma escala — um eixo só, nunca dois.
 */

const COR_CONCLUIDAS = "#00a49a";
const COR_PREVISTAS = "#26405d";
const GRADE = "#e2e8f0";
const EIXO = "#cbd5e1";
const TINTA_FRACA = "#64748b";

type Props = { pontos: PontoSemana[]; acumulado?: boolean };

/** `2026-W36` → `2026`, para o rótulo dizer de que ano é a semana. */
const anoDa = (chave: string) => chave.slice(0, 4);

export function SerieSemanal({ pontos, acumulado = false }: Props) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [caixa, largVisivel] = useLarguraContainer<HTMLDivElement>(560);

  if (pontos.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-[var(--tinta-fraca)]">
        Sem datas para montar a série semanal.
      </p>
    );
  }

  const valorC = (p: PontoSemana) =>
    acumulado ? p.acumuladoConcluidas : p.concluidas;
  const valorP = (p: PontoSemana) =>
    acumulado ? p.acumuladoPrevistas : p.previstas;

  const L = 38;
  const R = 12;
  const T = 14;
  const B = 52;
  const alturaPlot = 180;
  // Desenha na largura real do painel (texto em pixels de verdade); abaixo de
  // 26px por semana o eixo vira um borrão, então aí o container rola.
  const passo = Math.max(
    26,
    (largVisivel - L - R) / Math.max(1, pontos.length),
  );
  const largura = L + R + Math.max(1, pontos.length) * passo;
  const altura = T + alturaPlot + B;

  const maximo = Math.max(
    1,
    ...pontos.map((p) => Math.max(valorC(p), valorP(p))),
  );
  const teto = tetoDoEixo(maximo);
  const y = (v: number) => T + alturaPlot - (v / teto) * alturaPlot;
  const xCentro = (i: number) => L + i * passo + passo / 2;

  const marcas = [0, teto / 2, teto];
  const linha = pontos.map((p, i) => `${xCentro(i)},${y(valorP(p))}`).join(" ");
  // "S05" ocupa ~20px: com passo maior que isso o rótulo fica deitado e todos
  // cabem; apertado, gira e mostra 1 a cada N para não virar borrão.
  const deitado = passo >= 22;
  const passoRotulo = deitado ? 1 : Math.max(1, Math.ceil(20 / passo));
  const p0 = ativo !== null ? pontos[ativo] : null;

  // Faixa de meses: uma marca por bloco contíguo de semanas do mesmo mês.
  const faixasMes = pontos.reduce<Array<{ mes: string; de: number; ate: number }>>(
    (acc, p, i) => {
      const ultima = acc.at(-1);
      if (ultima && ultima.mes === p.mes) ultima.ate = i;
      else acc.push({ mes: p.mes, de: i, ate: i });
      return acc;
    },
    [],
  );

  return (
    <div className="relative">
      <div ref={caixa} className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${largura} ${altura}`}
          width={largura}
          height={altura}
          role="group"
          aria-label="Concluídas e previstas por semana"
          className="block"
          onPointerLeave={(e) => e.pointerType === "mouse" && setAtivo(null)}
        >
          {marcas.map((m) => (
            <g key={m}>
              <line
                x1={L}
                x2={largura - R}
                y1={y(m)}
                y2={y(m)}
                stroke={GRADE}
                strokeWidth={1}
              />
              <text
                x={L - 6}
                y={y(m) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill={TINTA_FRACA}
              >
                {Math.round(m)}
              </text>
            </g>
          ))}
          <line
            x1={L}
            x2={largura - R}
            y1={y(0)}
            y2={y(0)}
            stroke={EIXO}
            strokeWidth={1}
          />

          {pontos.map((p, i) => {
            const v = valorC(p);
            const h = Math.max(0, y(0) - y(v));
            const largBarra = Math.min(22, passo * 0.5);
            return (
              <g
                key={p.chave}
                role="img"
                tabIndex={0}
                aria-label={`${p.rotulo} de ${anoDa(p.chave)} (${p.mes}): ${valorC(p)} concluídas, ${valorP(p)} previstas`}
                onPointerEnter={(e) => e.pointerType === "mouse" && setAtivo(i)}
                onPointerDown={() => setAtivo(i)}
                onFocus={() => setAtivo(i)}
                onKeyDown={(e: KeyboardEvent<SVGGElement>) => {
                  if (e.key === "Escape") setAtivo(null);
                }}
                className="outline-none"
              >
                {/* Alvo de hover maior que a marca. */}
                <rect
                  x={xCentro(i) - passo / 2}
                  y={T}
                  width={passo}
                  height={alturaPlot}
                  fill={ativo === i ? "rgba(11,11,11,0.04)" : "transparent"}
                  // Contorno no item ativo: é o indicador de foco do teclado.
                  stroke={ativo === i ? COR_PREVISTAS : "none"}
                  strokeWidth={1}
                  rx={3}
                />
                {v > 0 ? (
                  <rect
                    x={xCentro(i) - largBarra / 2}
                    y={y(v)}
                    width={largBarra}
                    height={h}
                    rx={3}
                    fill={COR_CONCLUIDAS}
                  />
                ) : null}
                {i % passoRotulo === 0 ? (
                  <text
                    x={xCentro(i)}
                    y={y(0) + (deitado ? 14 : 12)}
                    textAnchor={deitado ? "middle" : "end"}
                    fontSize={9}
                    fill={ativo === i ? "#0f172a" : TINTA_FRACA}
                    fontWeight={ativo === i ? 600 : 400}
                    transform={
                      deitado ? undefined : `rotate(-45 ${xCentro(i)} ${y(0) + 12})`
                    }
                  >
                    {p.rotulo}
                  </text>
                ) : null}
              </g>
            );
          })}

          {faixasMes.map((fx) => {
            const x1 = L + fx.de * passo + 1;
            const x2 = L + (fx.ate + 1) * passo - 1;
            const yBase = y(0) + (deitado ? 24 : 34);
            return (
              <g key={`${fx.mes}-${fx.de}`}>
                <line x1={x1} x2={x2} y1={yBase} y2={yBase} stroke={GRADE} strokeWidth={1} />
                {x2 - x1 > 22 ? (
                  <text
                    x={(x1 + x2) / 2}
                    y={yBase + 11}
                    textAnchor="middle"
                    fontSize={9}
                    fill={TINTA_FRACA}
                  >
                    {fx.mes}
                  </text>
                ) : null}
              </g>
            );
          })}

          <polyline
            points={linha}
            fill="none"
            stroke={COR_PREVISTAS}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {pontos.map((p, i) => (
            <circle
              key={p.chave}
              cx={xCentro(i)}
              cy={y(valorP(p))}
              r={ativo === i ? 4.5 : 3}
              fill="#ffffff"
              stroke={COR_PREVISTAS}
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-[var(--borda)] bg-white px-2 py-1 text-xs shadow-sm"
        style={{ visibility: p0 ? "visible" : "hidden" }}
      >
        {p0 ? (
          <>
            <div className="font-semibold text-[var(--tinta-forte)]">
              {p0.rotulo} · {p0.mes}/{anoDa(p0.chave)}
            </div>
            <div className="flex items-center gap-1.5 text-[var(--tinta-media)]">
              <span
                className="inline-block h-2 w-2 rounded-[2px]"
                style={{ background: COR_CONCLUIDAS }}
              />
              Concluídas{" "}
              <span className="font-semibold tabular-nums">{valorC(p0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[var(--tinta-media)]">
              <span
                className="inline-block h-[2px] w-3"
                style={{ background: COR_PREVISTAS }}
              />
              Previstas{" "}
              <span className="font-semibold tabular-nums">{valorP(p0)}</span>
            </div>
          </>
        ) : null}
      </div>

      <ul className="mt-1 flex items-center justify-center gap-4 text-xs text-[var(--tinta-media)]">
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: COR_CONCLUIDAS }}
          />
          Concluídas
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-[2px] w-4"
            style={{ background: COR_PREVISTAS }}
          />
          Previstas (prazo na semana)
        </li>
      </ul>
    </div>
  );
}

