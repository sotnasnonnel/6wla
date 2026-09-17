import Link from "next/link";
import type { ItemRelatorio } from "@/server/importacao/queries";
import { rotuloPosicao } from "@/lib/importacao/plano";
import { Alerta, Cartao } from "@/components/ui/basicos";

/**
 * Etapa final: números da operação que de fato aconteceu (gravados pela
 * action ao concluir) e a lista das linhas que não viraram restrição.
 */
export function ResultadoImportacao({
  obraId,
  totalLinhas,
  importadas,
  atualizadas,
  ignoradas,
  relatorio,
}: {
  obraId: string;
  totalLinhas: number;
  importadas: number;
  atualizadas: number;
  ignoradas: number;
  relatorio: ItemRelatorio[];
}) {
  const descartadas = relatorio.filter((r) => r.tipo === "descartada").length;
  const numeros = [
    { rotulo: "Adicionadas", valor: importadas },
    { rotulo: "Atualizadas", valor: atualizadas },
    {
      rotulo: "Ignoradas",
      valor: ignoradas,
      dica: "código já existente ou repetido",
    },
    { rotulo: "Descartadas", valor: descartadas, dica: "linhas inválidas" },
  ];

  return (
    <div className="space-y-4">
      <Alerta tipo="ok">
        {importadas} restrição(ões) adicionada(s)
        {atualizadas > 0 ? ` e ${atualizadas} atualizada(s)` : ""} a partir de{" "}
        {totalLinhas} linha(s) lida(s).
      </Alerta>

      <Cartao>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {numeros.map((n) => (
            <div key={n.rotulo} className="rounded-lg bg-[var(--plano)] p-3">
              <dt className="text-xs text-[var(--tinta-fraca)]">{n.rotulo}</dt>
              <dd className="text-2xl font-bold tabular-nums text-[var(--tinta-forte)]">
                {n.valor}
              </dd>
              {n.dica ? (
                <dd className="text-[11px] leading-tight text-[var(--tinta-fraca)]">
                  {n.dica}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/obras/${obraId}/tabela`}
            className="inline-flex min-h-10 items-center rounded-lg bg-[var(--marca-terracotta)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--marca-terracotta-escuro)] sm:min-h-9"
          >
            Abrir tabela
          </Link>
          <Link
            href={`/obras/${obraId}/importar`}
            className="inline-flex min-h-10 items-center rounded-lg border border-[var(--borda)] bg-white px-4 py-2 text-sm font-semibold text-[var(--marca-azul)] transition hover:bg-[var(--plano)] sm:min-h-9"
          >
            Importar outra planilha
          </Link>
        </div>
      </Cartao>

      {relatorio.length > 0 ? (
        <Cartao>
          <h2 className="mb-2 text-sm font-semibold text-[var(--tinta-forte)]">
            Linhas que não viraram restrição ({relatorio.length})
          </h2>
          <ListaProblemas itens={relatorio} />
        </Cartao>
      ) : null}
    </div>
  );
}

/** Lista "linha N — motivo", compartilhada com a conferência. */
export function ListaProblemas({
  itens,
  total,
}: {
  itens: ItemRelatorio[];
  /** Quando a lista veio cortada, o total real. */
  total?: number;
}) {
  return (
    <>
      <ul className="max-h-72 divide-y divide-[var(--grade)] overflow-auto text-sm">
        {itens.map((p) => (
          <li
            key={`${p.tipo}-${p.numero}`}
            className="flex flex-wrap gap-x-2 py-1.5"
          >
            <span className="w-20 shrink-0 font-medium tabular-nums text-[var(--tinta-forte)]">
              {rotuloPosicao(p)}
            </span>
            <span
              className={
                p.tipo === "descartada"
                  ? "text-[var(--perigo-tinta)]"
                  : "text-[var(--tinta-media)]"
              }
            >
              {p.tipo === "descartada" ? "Descartada" : "Ignorada"}: {p.motivo}
            </span>
          </li>
        ))}
      </ul>
      {total !== undefined && total > itens.length ? (
        <p className="mt-1 text-xs text-[var(--tinta-fraca)]">
          Mostrando {itens.length} de {total}.
        </p>
      ) : null}
      {itens.some((p) => !p.exato) ? (
        <p className="mt-1 text-xs text-[var(--tinta-fraca)]">
          “Item” é a posição entre as linhas com dados, não o número da linha no
          Excel (planilha enviada antes desta versão).
        </p>
      ) : null}
    </>
  );
}
