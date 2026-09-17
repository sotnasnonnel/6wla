import Link from "next/link";
import { Etiqueta } from "@/components/ui/basicos";
import { formataNumero } from "@/lib/restricoes/dominio";
import { caminhoDetalhe } from "@/lib/restricoes/filtros";
import {
  plural,
  SEVERIDADE_ROTULO,
  type Insight,
  type Severidade,
} from "@/lib/restricoes/insights";

/**
 * Lista de insights. Cada severidade tem cor, ícone e texto — a cor nunca é o
 * único canal. Server Component: a única interação é abrir a lista de
 * restrições, e o `<details>` nativo resolve sem JavaScript.
 */

/** Mais que isso numa lista aberta vira parede de links; a tabela resolve. */
const MAX_LINKS = 40;

const ESTILO: Record<
  Severidade,
  { tom: "vermelho" | "amarelo" | "azul"; borda: string; icone: string }
> = {
  alta: {
    tom: "vermelho",
    borda: "border-l-[var(--perigo)]",
    // Triângulo de alerta.
    icone: "M12 3 2 20h20L12 3zM12 10v4M12 17h.01",
  },
  media: {
    tom: "amarelo",
    borda: "border-l-[#d97706]",
    // Círculo com exclamação.
    icone: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01",
  },
  informativa: {
    tom: "azul",
    borda: "border-l-[#2f6ea8]",
    // Círculo com "i".
    icone: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  },
};

const LINK =
  "inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-[var(--marca-terracotta-escuro)] transition hover:bg-[var(--marca-gelo)] focus-visible:outline-2 focus-visible:outline-[var(--marca-terracotta)]";

export function ListaInsights({
  insights,
  obraId,
}: {
  insights: Insight[];
  obraId: string;
}) {
  return (
    <ul className="space-y-3" aria-label="Insights da obra">
      {insights.map((i) => (
        <li key={i.id}>
          <CartaoInsight insight={i} obraId={obraId} />
        </li>
      ))}
    </ul>
  );
}

function CartaoInsight({
  insight: i,
  obraId,
}: {
  insight: Insight;
  obraId: string;
}) {
  const estilo = ESTILO[i.severidade];
  const n = i.restricoes.length;
  return (
    <article
      aria-labelledby={`insight-${i.id}`}
      className={`rounded-xl border border-l-4 border-[var(--borda)] bg-white p-4 shadow-[var(--sombra-sm)] sm:px-5 ${estilo.borda}`}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-[4.5rem] text-3xl leading-none font-bold tracking-tight text-[var(--tinta-forte)] tabular-nums">
          {i.valor}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id={`insight-${i.id}`}
              className="text-base font-semibold text-[var(--tinta-forte)]"
            >
              {i.titulo}
            </h2>
            <Etiqueta tom={estilo.tom}>
              <svg
                aria-hidden
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <path d={estilo.icone} />
              </svg>
              <span className="sr-only">Severidade: </span>
              {SEVERIDADE_ROTULO[i.severidade]}
            </Etiqueta>
          </div>
          <p className="mt-1 text-sm text-[var(--tinta-media)]">{i.frase}</p>

          {i.detalhes.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1">
              {i.detalhes.map((d) => (
                <li key={d.rotulo}>
                  {d.link ? (
                    <Link href={d.link} className={LINK}>
                      {d.rotulo}: ver{" "}
                      {plural(d.quantidade, "restrição", "restrições")}
                    </Link>
                  ) : (
                    <span className="text-sm">
                      {d.rotulo}: {d.quantidade}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {n > 0 && i.link ? (
            <Link href={i.link} className={`${LINK} mt-2 -ml-3`}>
              Ver {plural(n, "restrição", "restrições")}
            </Link>
          ) : null}

          {n > 0 && !i.link ? (
            <details className="group mt-2">
              <summary
                className={`${LINK} -ml-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
              >
                <span className="group-open:hidden">
                  Ver {plural(n, "restrição", "restrições")}
                </span>
                <span className="hidden group-open:inline">Ocultar lista</span>
              </summary>
              <ul className="mt-1 flex flex-wrap gap-1">
                {i.restricoes.slice(0, MAX_LINKS).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={caminhoDetalhe(obraId, r.id, "")}
                      className="inline-flex min-h-10 items-center rounded-lg border border-[var(--borda)] px-3 font-mono text-xs font-semibold text-[var(--marca-azul)] transition hover:bg-[var(--plano)]"
                    >
                      {formataNumero(r.numero)}
                    </Link>
                  </li>
                ))}
              </ul>
              {n > MAX_LINKS ? (
                <p className="mt-1 text-xs text-[var(--tinta-fraca)]">
                  Mostrando {MAX_LINKS} de {n}.
                </p>
              ) : null}
            </details>
          ) : null}
        </div>
      </div>
    </article>
  );
}
