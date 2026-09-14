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
      <div
        className="-mx-2.5 overflow-auto border-y border-[var(--borda)] sm:mx-0 sm:rounded-md sm:border"
        style={{ maxHeight: 420 }}
      >
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10 bg-[var(--marca-gelo)]">
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
                "Resolução",
                "Atraso",
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
                <tr key={r.id} className="odd:bg-white even:bg-[#faf9f8]">
                  <td className="whitespace-nowrap border-b border-[#eceae7] px-2 py-1">
                    <Link
                      href={`/obras/${r.obra_id}/restricoes/${r.id}`}
                      className="font-mono font-semibold text-[var(--marca-terracotta)] hover:underline"
                    >
                      {formataNumero(r.numero)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap border-b border-[#eceae7] px-2 py-1 tabular-nums text-[var(--tinta-media)]">
                    {formataData(r.data_limite)}
                  </td>
                  <td className="whitespace-nowrap border-b border-[#eceae7] px-2 py-1 tabular-nums text-[var(--tinta-media)]">
                    {formataData(r.previsao_conclusao)}
                  </td>
                  <td className="whitespace-nowrap border-b border-[#eceae7] px-2 py-1 tabular-nums text-[var(--tinta-media)]">
                    {formataData(r.data_conclusao)}
                  </td>
                  <td
                    className="max-w-[190px] truncate border-b border-[#eceae7] px-2 py-1 text-[var(--tinta-media)]"
                    title={r.atividade_impactada ?? ""}
                  >
                    {r.atividade_impactada}
                  </td>
                  <td
                    className="max-w-[130px] truncate border-b border-[#eceae7] px-2 py-1 text-[var(--tinta-media)]"
                    title={r.responsavel ?? ""}
                  >
                    {r.responsavel}
                  </td>
                  <td
                    className="max-w-[230px] truncate border-b border-[#eceae7] px-2 py-1 text-[var(--tinta-forte)]"
                    title={r.descricao}
                  >
                    {r.descricao}
                  </td>
                  <td
                    className="max-w-[230px] truncate border-b border-[#eceae7] px-2 py-1 text-[var(--tinta-media)]"
                    title={r.acao ?? ""}
                  >
                    {r.acao}
                  </td>
                  <td className="whitespace-nowrap border-b border-[#eceae7] px-2 py-1">
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
                  <td className="border-b border-[#eceae7] px-2 py-1 text-right tabular-nums text-[var(--tinta-media)]">
                    {resolucao ?? ""}
                  </td>
                  <td className="border-b border-[#eceae7] px-2 py-1 text-right tabular-nums font-semibold text-[var(--marca-terracotta-vermelho)]">
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
          onClick={() => setMostrando((m) => m + PAGINA * 4)}
          className="mt-2 w-full rounded-md border border-[var(--borda)] bg-white py-1.5 text-xs font-medium text-[var(--tinta-media)] hover:bg-[var(--marca-gelo)]"
        >
          Mostrar mais ({linhas.length - mostrando} restantes)
        </button>
      ) : null}
    </div>
  );
}
