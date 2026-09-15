"use client";

import { useState } from "react";
import {
  tetoDoEixo,
  SITUACAO_COR,
  SITUACAO_ROTULO,
  SITUACOES_EMPILHADAS,
  type GrupoSituacao,
} from "@/lib/restricoes/indicadores";

/**
 * Pareto das causas: barras ordenadas da maior para a menor com a linha do
 * percentual acumulado, para separar as poucas causas que respondem pela
 * maior parte das restrições.
 *
 * Sobre os dois eixos: aqui eles não são duas medidas independentes com
 * alinhamento arbitrário (o defeito clássico do eixo duplo). A linha É a soma
 * das barras — o topo da escala da direita (100%) é, por construção, o total
 * das barras da esquerda. O alinhamento é derivado, não escolhido.
 */

const GRADE = "#e2e8f0";
const TINTA_FRACA = "#64748b";
const LINHA_ACUM = "#26405d";
const CORTE = "#c44a28";

/** Fração acumulada que define as "poucas vitais". */
const ALVO = 0.8;

export function ParetoCausas({
  grupos,
  selecionada,
  aoClicar,
}: {
  grupos: GrupoSituacao[];
  selecionada?: string | null;
  aoClicar?: (chave: string) => void;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);

  if (grupos.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-[var(--tinta-fraca)]">
        Sem dados com os filtros atuais.
      </p>
    );
  }

  const ordenados = [...grupos].sort((a, b) => b.total - a.total);
  const total = ordenados.reduce((s, g) => s + g.total, 0) || 1;

  // `reduce` em vez de somar numa variável solta: o React Compiler proíbe
  // mutação durante o render, e o acumulado é justamente uma soma corrida.
  const pontos = ordenados.reduce<Array<{ grupo: GrupoSituacao; acumulado: number }>>(
    (acc, g) => {
      const anterior = acc.at(-1)?.acumulado ?? 0;
      acc.push({ grupo: g, acumulado: anterior + g.total / total });
      return acc;
    },
    [],
  );
  // Quantas causas bastam para cobrir 80% — o corte que o Pareto existe para achar.
  const dentroDoCorte = pontos.findIndex((p) => p.acumulado >= ALVO) + 1;

  const L = 40;
  const R = 46;
  const T = 28;
  const B = 58;
  const alturaPlot = 200;
  // Largura de referência fixa: o SVG escala para o container (width 100%), em
  // vez de deixar metade do painel vazia quando há poucas causas.
  const LARGURA_ALVO = 1180;
  const passo = Math.max(58, (LARGURA_ALVO - L - R) / pontos.length);
  const largura = L + R + pontos.length * passo;
  const altura = T + alturaPlot + B;

  const teto = tetoDoEixo(Math.max(...ordenados.map((g) => g.total)));
  const yValor = (v: number) => T + alturaPlot - (v / teto) * alturaPlot;
  const yPct = (p: number) => T + alturaPlot - p * alturaPlot;
  const xCentro = (i: number) => L + i * passo + passo / 2;
  const largBarra = Math.min(38, passo - 14);

  const linha = pontos
    .map((p, i) => `${xCentro(i)},${yPct(p.acumulado)}`)
    .join(" ");
  const p0 = ativo !== null ? pontos[ativo] : null;

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${largura} ${altura}`}
          role="img"
          aria-label="Pareto das causas 6M"
          className="w-full"
          style={{ minWidth: pontos.length * 58, height: "auto" }}
          onMouseLeave={() => setAtivo(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line
                x1={L}
                x2={largura - R}
                y1={yPct(p)}
                y2={yPct(p)}
                stroke={GRADE}
                strokeWidth={1}
              />
              <text
                x={L - 6}
                y={yPct(p) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill={TINTA_FRACA}
              >
                {Math.round(p * teto)}
              </text>
              <text
                x={largura - R + 6}
                y={yPct(p) + 3.5}
                fontSize={10}
                fill={TINTA_FRACA}
              >
                {Math.round(p * 100)}%
              </text>
            </g>
          ))}

          {/* Linha de corte dos 80%. */}
          <line
            x1={L}
            x2={largura - R}
            y1={yPct(ALVO)}
            y2={yPct(ALVO)}
            stroke={CORTE}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <text
            x={largura - R + 6}
            y={yPct(ALVO) - 5}
            fontSize={9}
            fill={CORTE}
            fontWeight={600}
          >
            80%
          </text>

          {pontos.map((p, i) => {
            const g = p.grupo;
            const dentro = i < dentroDoCorte;
            const selecionadoAqui = selecionada === g.chave;
            // Altura acumulada de cada segmento, calculada antes de desenhar.
            const segmentos = SITUACOES_EMPILHADAS.filter((s) => g.contagem[s] > 0);
            const topos = segmentos.reduce<Array<{ s: (typeof segmentos)[number]; y: number; h: number }>>(
              (acc, s) => {
                const h = (g.contagem[s] / teto) * alturaPlot;
                const base = acc.at(-1)?.y ?? yValor(0);
                acc.push({ s, y: base - h, h });
                return acc;
              },
              [],
            );
            return (
              <g
                key={g.chave}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => aoClicar?.(g.chave)}
                style={{ cursor: aoClicar ? "pointer" : "default" }}
              >
                <rect
                  x={xCentro(i) - passo / 2}
                  y={T}
                  width={passo}
                  height={alturaPlot}
                  fill={
                    selecionadoAqui
                      ? "rgba(195,94,30,0.12)"
                      : ativo === i
                        ? "rgba(38,64,93,0.05)"
                        : "transparent"
                  }
                />
                {topos.map(({ s, y, h }) => (
                  <rect
                    key={s}
                    x={xCentro(i) - largBarra / 2}
                    // 1px de folga entre segmentos: dois blocos vizinhos não viram um só.
                    y={y + 0.5}
                    width={largBarra}
                    height={Math.max(0, h - 1)}
                    fill={SITUACAO_COR[s]}
                  >
                    <title>{`${SITUACAO_ROTULO[s]}: ${g.contagem[s]}`}</title>
                  </rect>
                ))}
                <text
                  x={xCentro(i)}
                  y={yValor(g.total) - 5}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {g.total}
                </text>
                <text
                  x={xCentro(i)}
                  y={T + alturaPlot + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill={dentro ? "#0f172a" : TINTA_FRACA}
                  fontWeight={dentro ? 600 : 400}
                >
                  {encurta(g.chave, Math.floor(passo / 5.2))}
                </text>
              </g>
            );
          })}

          <polyline
            points={linha}
            fill="none"
            stroke={LINHA_ACUM}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {pontos.map((p, i) => {
            // Quando o ponto do acumulado cai dentro da barra, o rótulo sai de
            // cima dela e vai para o lado — halo branco resolve legibilidade,
            // mas número em cima de barra colorida continua confuso.
            const dentroDaBarra = yPct(p.acumulado) > yValor(p.grupo.total);
            return (
            <g key={p.grupo.chave}>
              <circle
                cx={xCentro(i)}
                cy={yPct(p.acumulado)}
                r={ativo === i ? 5 : 3.5}
                fill="#ffffff"
                stroke={LINHA_ACUM}
                strokeWidth={2}
              />
              <text
                x={xCentro(i) + (dentroDaBarra ? largBarra / 2 + 6 : 0)}
                y={yPct(p.acumulado) + (dentroDaBarra ? 3.5 : -10)}
                textAnchor={dentroDaBarra ? "start" : "middle"}
                fontSize={10}
                fontWeight={600}
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {Math.round(p.acumulado * 100)}%
              </text>
            </g>
            );
          })}
        </svg>
      </div>

      <div
        className="pointer-events-none absolute right-2 top-0 rounded-lg border border-[var(--borda)] bg-white px-2 py-1 text-xs shadow-sm"
        style={{ visibility: p0 ? "visible" : "hidden" }}
      >
        {p0 ? (
          <>
            <div className="font-semibold text-[var(--tinta-forte)]">{p0.grupo.chave}</div>
            <div className="tabular-nums text-[var(--tinta-media)]">
              {p0.grupo.total} restrições · {Math.round(p0.acumulado * 100)}%
              acumulado
            </div>
          </>
        ) : null}
      </div>

      <p className="mt-1 text-center text-xs text-[var(--tinta-fraca)]">
        {dentroDoCorte === 1 ? (
          <>
            <strong className="text-[var(--tinta-forte)]">{ordenados[0]?.chave}</strong>{" "}
            sozinha responde por {Math.round((pontos[0]?.acumulado ?? 0) * 100)}
            % das restrições.
          </>
        ) : (
          <>
            <strong className="text-[var(--tinta-forte)]">{dentroDoCorte} causas</strong>{" "}
            de {pontos.length} respondem por{" "}
            {Math.round((pontos[dentroDoCorte - 1]?.acumulado ?? 0) * 100)}% das
            restrições. A linha é o acumulado.
          </>
        )}
      </p>
    </div>
  );
}

function encurta(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s;
}

