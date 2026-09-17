"use client";

import { useState, type CSSProperties } from "react";
import {
  formataPercentual,
  SITUACAO_COR,
  type ItemRanking,
} from "@/lib/restricoes/indicadores";
import { CaixaDetalhe } from "./pecas";

/** Texto completo de uma posição, para leitor de tela. */
function descreve(i: ItemRanking): string {
  return `${i.posicao}º ${i.chave}: ${i.concluidas} concluída(s) de ${i.total} (${formataPercentual(i.irr, 0)}) — ${i.concluidasNoPrazo} no prazo, ${i.concluidasComAtraso} com atraso, ${i.abertas} em aberto, das quais ${i.atrasadas} atrasada(s)`;
}

/**
 * Pódio de quem mais concluiu restrições. Difere das barras por dimensão de
 * propósito: lá a barra é o volume recebido, aqui é o que saiu — a barra
 * mostra só as concluídas (no prazo + com atraso) e o que ficou aberto vira
 * texto ao lado, para a leitura "quem entrega" não competir com "quem tem
 * mais coisa na mão".
 *
 * Clicar recorta o painel inteiro pela pessoa, como qualquer outro gráfico.
 */
export function RankingConclusao({
  itens,
  aoClicar,
  selecionada,
  larguraRotulo = 150,
}: {
  itens: ItemRanking[];
  aoClicar?: (chave: string) => void;
  selecionada?: string | null;
  larguraRotulo?: number;
}) {
  const [ativo, setAtivo] = useState<string | null>(null);
  if (itens.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--tinta-fraca)]">
        Ninguém com responsável definido nos filtros atuais.
      </p>
    );
  }
  const maximo = Math.max(1, ...itens.map((i) => i.concluidas));
  const i0 = itens.find((i) => i.chave === ativo) ?? null;
  const estiloRotulo = {
    "--largura-rotulo": `${larguraRotulo}px`,
  } as CSSProperties;

  return (
    <div>
      <ol
        className="space-y-1"
        onPointerLeave={(e) => e.pointerType === "mouse" && setAtivo(null)}
      >
        {itens.map((i) => {
          const selecionado = selecionada === i.chave;
          const resumo = `${formataPercentual(i.irr, 0)}${i.abertas > 0 ? ` · ${i.abertas} aberta(s)` : ""}`;
          return (
            <li key={i.chave}>
              <button
                type="button"
                disabled={!aoClicar}
                onClick={() => aoClicar?.(i.chave)}
                onFocus={() => setAtivo(i.chave)}
                onPointerDown={() => setAtivo(i.chave)}
                onPointerEnter={(e) =>
                  e.pointerType === "mouse" && setAtivo(i.chave)
                }
                aria-pressed={aoClicar ? selecionado : undefined}
                aria-label={descreve(i)}
                style={estiloRotulo}
                className={`grid w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 rounded px-1 py-1 text-left transition sm:flex sm:py-0.5 ${
                  aoClicar ? "hover:bg-[var(--marca-gelo)]" : "cursor-default"
                } ${selecionado ? "bg-[var(--marca-brand-50)] ring-1 ring-[var(--marca-terracotta)]" : ""} ${
                  ativo === i.chave && !selecionado ? "bg-[var(--marca-gelo)]" : ""
                }`}
              >
                <span
                  className={`shrink-0 text-right text-xs font-semibold tabular-nums sm:w-5 ${
                    i.posicao <= 3
                      ? "text-[var(--marca-terracotta)]"
                      : "text-[var(--tinta-fraca)]"
                  }`}
                >
                  {i.posicao}º
                </span>
                <span className="flex min-w-0 items-baseline justify-between gap-2 sm:w-[var(--largura-rotulo)] sm:shrink-0">
                  <span className="truncate text-xs text-[var(--tinta-media)]">
                    {i.chave}
                  </span>
                  {/* No celular, % e abertas numa segunda leitura ao lado do nome. */}
                  <span className="shrink-0 text-[11px] tabular-nums text-[var(--tinta-fraca)] sm:hidden">
                    {resumo}
                  </span>
                </span>
                <span className="col-start-2 flex min-w-0 flex-1 items-center gap-2">
                  {/* A barra ocupa a faixa inteira e cresce por dentro: assim o
                      total e o percentual ficam em colunas alinhadas, e não
                      dançando atrás de barras de tamanhos diferentes. */}
                  <span className="min-w-0 flex-1">
                    <span
                      className="flex h-[18px] overflow-hidden"
                      style={{
                        width: `${(i.concluidas / maximo) * 100}%`,
                        gap: 2,
                        minWidth: 2,
                      }}
                    >
                      {(
                        [
                          ["concluida_no_prazo", i.concluidasNoPrazo],
                          ["concluida_com_atraso", i.concluidasComAtraso],
                        ] as const
                      ).map(([situacao, valor]) => {
                        if (valor === 0) return null;
                        const largura = (valor / i.concluidas) * 100;
                        return (
                          <span
                            key={situacao}
                            className="flex items-center justify-center overflow-hidden first:rounded-l last:rounded-r"
                            style={{
                              width: `${largura}%`,
                              background: SITUACAO_COR[situacao],
                            }}
                          >
                            {(valor / maximo) * 100 >= 8 ? (
                              <span
                                aria-hidden
                                className="px-0.5 text-[11px] font-semibold tabular-nums text-white"
                              >
                                {valor}
                              </span>
                            ) : null}
                          </span>
                        );
                      })}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--tinta-forte)]"
                  >
                    {i.concluidas}
                  </span>
                  <span
                    aria-hidden
                    className="hidden w-28 shrink-0 text-right text-[11px] tabular-nums text-[var(--tinta-fraca)] sm:inline"
                  >
                    {resumo}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <CaixaDetalhe
        {...(i0
          ? {
              titulo: `${i0.posicao}º ${i0.chave}`,
              extra: `${i0.concluidas} de ${i0.total} concluídas (${formataPercentual(i0.irr, 0)})`,
              contagem: {
                concluida_no_prazo: i0.concluidasNoPrazo,
                concluida_com_atraso: i0.concluidasComAtraso,
                no_prazo: i0.abertas - i0.atrasadas,
                atrasada: i0.atrasadas,
                cancelada: i0.total - i0.concluidas - i0.abertas,
              },
            }
          : {})}
      />
    </div>
  );
}
