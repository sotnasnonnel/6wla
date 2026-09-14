"use client";

import { useState } from "react";
import { tetoDoEixo, type PontoSemana } from "@/lib/restricoes/indicadores";

/**
 * Índice de remoção por semana: barras do que foi concluído contra a linha do
 * que estava previsto para aquela semana. As duas séries contam restrições, na
 * mesma escala — um eixo só, nunca dois.
 */

const COR_CONCLUIDAS = "#00a49a";
const COR_PREVISTAS = "#26405d";
const GRADE = "#e4e2df";
const EIXO = "#cfccc8";
const TINTA_FRACA = "#7a7a7a";

type Props = { pontos: PontoSemana[]; acumulado?: boolean };

export function SerieSemanal({ pontos, acumulado = false }: Props) {
  const [ativo, setAtivo] = useState<number | null>(null);

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
  // Estica para preencher o painel; abaixo de 26px por semana o eixo vira
  // um borrão, então aí o container rola na horizontal.
  const LARGURA_ALVO = 1180;
  const passo = Math.max(26, (LARGURA_ALVO - L - R) / Math.max(1, pontos.length));
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
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${largura} ${altura}`}
          role="img"
          aria-label="Concluídas e previstas por semana"
          className="w-full"
          style={{ minWidth: Math.max(1, pontos.length) * 26, height: "auto" }}
          onMouseLeave={() => setAtivo(null)}
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
              <g key={p.chave} onMouseEnter={() => setAtivo(i)}>
                {/* Alvo de hover maior que a marca. */}
                <rect
                  x={xCentro(i) - passo / 2}
                  y={T}
                  width={passo}
                  height={alturaPlot}
                  fill={ativo === i ? "rgba(11,11,11,0.04)" : "transparent"}
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
                    fill={ativo === i ? "#1b1b1b" : TINTA_FRACA}
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
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-[var(--borda)] bg-white px-2 py-1 text-xs shadow-sm"
        style={{ visibility: p0 ? "visible" : "hidden" }}
      >
        {p0 ? (
          <>
            <div className="font-semibold text-[var(--tinta-forte)]">
              {p0.rotulo} · {p0.mes}
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

