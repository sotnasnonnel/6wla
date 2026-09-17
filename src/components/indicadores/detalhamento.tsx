"use client";

import Link from "next/link";
import { useState } from "react";
import { formataData, formataNumero } from "@/lib/restricoes/dominio";
import {
  situacaoDe,
  SITUACAO_COR,
  SITUACAO_ROTULO,
  tempoAtraso,
  tempoResolucao,
} from "@/lib/restricoes/indicadores";
import type { LinhaPainel } from "./painel";

const PAGINA = 50;

/**
 * Tabela de detalhamento — o "drill-through" do relatório. Também é a visão
 * alternativa exigida pelos gráficos: todo número mostrado ali pode ser
 * conferido linha a linha aqui.
 */
export function Detalhamento({
  linhas,
  hoje,
}: {
  linhas: LinhaPainel[];
  hoje: string;
}) {
  const [mostrando, setMostrando] = useState(PAGINA);
  const visiveis = linhas.slice(0, mostrando);

  return (
    <div>
      {/* Celular: cartões. Onze colunas não cabem em 360px sem virar rolagem
          dupla; o cartão mostra o mesmo conteúdo, em leitura vertical. */}
      <ul className="space-y-2 md:hidden">
        {visiveis.map((r) => {
          const s = situacaoDe(r, hoje);
          const resolucao = tempoResolucao(r);
          const atraso = tempoAtraso(r, hoje);
          return (
            <li
              key={r.id}
              className="rounded-lg border border-[var(--borda)] p-2.5 text-xs"
              style={{ borderLeftWidth: 4, borderLeftColor: SITUACAO_COR[s] }}
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/obras/${r.obra_id}/restricoes/${r.id}`}
                  className="font-mono font-semibold text-[var(--marca-terracotta)] hover:underline"
                >
                  {formataNumero(r.numero)}
                </Link>
                <span className="text-[var(--tinta-media)]">
                  {SITUACAO_ROTULO[s]}
                </span>
              </div>
              <p className="mt-1 text-sm break-words text-[var(--tinta-forte)]">
                {r.descricao}
              </p>
              {r.acao ? (
                <p className="mt-0.5 break-words text-[var(--tinta-media)]">
                  Ação: {r.acao}
                </p>
              ) : null}
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[var(--tinta-media)]">
                <Dado rotulo="Responsável" valor={r.responsavel} />
                <Dado rotulo="Prazo" valor={formataData(r.data_limite)} />
                <Dado rotulo="Previsão" valor={formataData(r.previsao_conclusao)} />
                <Dado rotulo="Conclusão" valor={formataData(r.data_conclusao)} />
                <Dado
                  rotulo="Resolução"
                  valor={resolucao !== null ? `${resolucao} dias` : null}
                />
                <Dado
                  rotulo="Atraso"
                  valor={atraso !== null ? `${atraso} dias` : null}
                />
                {r.atividade_impactada ? (
                  <div className="col-span-2">
                    <Dado rotulo="Atividade" valor={r.atividade_impactada} />
                  </div>
                ) : null}
              </dl>
            </li>
          );
        })}
        {linhas.length === 0 ? (
          <li className="px-3 py-8 text-center text-xs text-[var(--tinta-fraca)]">
            Nenhuma restrição com os filtros atuais.
          </li>
        ) : null}
      </ul>

      <div
        className="hidden overflow-auto rounded-lg border border-[var(--borda)] md:block"
        style={{ maxHeight: 420 }}
      >
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10 bg-[var(--plano)]">
            <tr>
              {[
                "Nº",
                "Prazo",
                "Previsão",
                "Conclusão",
                "Atividade impactada",
                "Responsável",
                "Restrição",
                "Ação",
                "Situação",
                "Resolução (dias)",
                "Atraso (dias)",
              ].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b border-[var(--borda)] px-2 py-1.5 text-left font-semibold text-[var(--tinta-media)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r) => {
              const s = situacaoDe(r, hoje);
              const resolucao = tempoResolucao(r);
              const atraso = tempoAtraso(r, hoje);
              return (
                <tr key={r.id} className="odd:bg-white even:bg-[#fcfcfd]">
                  <td className="whitespace-nowrap border-b border-[var(--grade)] px-2 py-1">
                    <Link
                      href={`/obras/${r.obra_id}/restricoes/${r.id}`}
                      className="font-mono font-semibold text-[var(--marca-terracotta)] hover:underline"
                    >
                      {formataNumero(r.numero)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--grade)] px-2 py-1 tabular-nums text-[var(--tinta-media)]">
                    {formataData(r.data_limite)}
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--grade)] px-2 py-1 tabular-nums text-[var(--tinta-media)]">
                    {formataData(r.previsao_conclusao)}
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--grade)] px-2 py-1 tabular-nums text-[var(--tinta-media)]">
                    {formataData(r.data_conclusao)}
                  </td>
                  <td
                    className="max-w-[190px] truncate border-b border-[var(--grade)] px-2 py-1 text-[var(--tinta-media)]"
                    title={r.atividade_impactada ?? ""}
                  >
                    {r.atividade_impactada}
                  </td>
                  <td
                    className="max-w-[130px] truncate border-b border-[var(--grade)] px-2 py-1 text-[var(--tinta-media)]"
                    title={r.responsavel ?? ""}
                  >
                    {r.responsavel}
                  </td>
                  <td
                    className="max-w-[230px] truncate border-b border-[var(--grade)] px-2 py-1 text-[var(--tinta-forte)]"
                    title={r.descricao}
                  >
                    {r.descricao}
                  </td>
                  <td
                    className="max-w-[230px] truncate border-b border-[var(--grade)] px-2 py-1 text-[var(--tinta-media)]"
                    title={r.acao ?? ""}
                  >
                    {r.acao}
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--grade)] px-2 py-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                        style={{ background: SITUACAO_COR[s] }}
                      />
                      <span className="text-[var(--tinta-media)]">
                        {SITUACAO_ROTULO[s]}
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-[var(--grade)] px-2 py-1 text-right tabular-nums text-[var(--tinta-media)]">
                    {resolucao ?? ""}
                  </td>
                  <td className="border-b border-[var(--grade)] px-2 py-1 text-right tabular-nums font-semibold text-[var(--marca-terracotta-vermelho)]">
                    {atraso ?? ""}
                  </td>
                </tr>
              );
            })}
            {linhas.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-3 py-8 text-center text-[var(--tinta-fraca)]"
                >
                  Nenhuma restrição com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {mostrando < linhas.length ? (
        <button
          type="button"
          onClick={() => setMostrando((m) => m + PAGINA)}
          className="mt-2 min-h-10 w-full rounded-lg border border-[var(--borda)] bg-white py-1.5 text-xs font-medium text-[var(--tinta-media)] hover:bg-[var(--marca-gelo)] sm:min-h-8"
        >
          Mostrar mais {Math.min(PAGINA, linhas.length - mostrando)} (
          {linhas.length - mostrando} restantes)
        </button>
      ) : null}
    </div>
  );
}

/** Par rótulo/valor do cartão; ausência de dado aparece como "—", não some. */
function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="inline text-[var(--tinta-fraca)]">{rotulo}: </dt>
      <dd className="inline break-words">{valor || "—"}</dd>
    </div>
  );
}
