"use client";

import {
  formataPercentual,
  SITUACAO_COR,
  SITUACAO_ROTULO,
  type ItemRanking,
} from "@/lib/restricoes/indicadores";

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
  if (itens.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--tinta-fraca)]">
        Ninguém com responsável definido nos filtros atuais.
      </p>
    );
  }
  const maximo = Math.max(1, ...itens.map((i) => i.concluidas));

  return (
    <ol className="space-y-1">
      {itens.map((i) => {
        const ativa = selecionada === i.chave;
        return (
          <li key={i.chave}>
            <button
              type="button"
              disabled={!aoClicar}
              onClick={() => aoClicar?.(i.chave)}
              aria-pressed={ativa}
              title={`${i.chave}: ${i.concluidas} concluída(s) de ${i.total} · ${i.abertas} em aberto`}
              className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left transition ${
                aoClicar ? "hover:bg-[var(--marca-gelo)]" : "cursor-default"
              } ${ativa ? "bg-[#fbeedd] ring-1 ring-[var(--marca-terracotta)]" : ""}`}
            >
              <span
                className={`w-5 shrink-0 text-right text-xs font-semibold tabular-nums ${
                  i.posicao <= 3
                    ? "text-[var(--marca-terracotta)]"
                    : "text-[var(--tinta-fraca)]"
                }`}
              >
                {i.posicao}º
              </span>
              <span
                className="shrink-0 truncate text-xs text-[var(--tinta-media)]"
                style={{ width: larguraRotulo }}
                title={i.chave}
              >
                {i.chave}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
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
                          title={`${SITUACAO_ROTULO[situacao]}: ${valor}`}
                        >
                          {largura > 14 ? (
                            <span className="px-0.5 text-[10px] font-semibold tabular-nums text-white">
                              {valor}
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </span>
                </span>
                <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--tinta-forte)]">
                  {i.concluidas}
                </span>
                <span
                  className="hidden w-24 shrink-0 text-right text-[11px] tabular-nums text-[var(--tinta-fraca)] sm:inline"
                  title="Concluídas sobre o que coube a ele (fora canceladas) · restrições ainda em aberto"
                >
                  {formataPercentual(i.irr, 0)}
                  {i.abertas > 0 ? ` · ${i.abertas} aberta(s)` : ""}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
