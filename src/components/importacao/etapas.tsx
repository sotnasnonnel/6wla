const ETAPAS = [
  { chave: "arquivo", rotulo: "Arquivo" },
  { chave: "conferencia", rotulo: "Conferência" },
  { chave: "resultado", rotulo: "Resultado" },
] as const;

export type EtapaImportacao = (typeof ETAPAS)[number]["chave"];

/**
 * Percurso da importação: onde o gestor está, para qual obra vai e de qual
 * arquivo. Destino sempre à vista — importar na obra errada é o erro caro.
 */
export function EtapasImportacao({
  atual,
  obra,
  arquivo,
}: {
  atual: EtapaImportacao;
  obra: string;
  arquivo?: string;
}) {
  const indiceAtual = ETAPAS.findIndex((e) => e.chave === atual);
  return (
    <div className="space-y-2">
      <ol
        aria-label="Etapas da importação"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
      >
        {ETAPAS.map((etapa, i) => {
          const feita = i < indiceAtual;
          const agora = i === indiceAtual;
          return (
            <li key={etapa.chave} className="flex items-center gap-2">
              {i > 0 ? (
                <span aria-hidden className="text-[var(--tinta-apagada)]">
                  →
                </span>
              ) : null}
              <span
                aria-current={agora ? "step" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${
                  agora
                    ? "bg-[var(--marca-brand-50)] font-semibold text-[var(--marca-terracotta)]"
                    : feita
                      ? "text-[var(--tinta-media)]"
                      : "text-[var(--tinta-fraca)]"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${
                    agora
                      ? "bg-[var(--marca-terracotta)] text-white"
                      : feita
                        ? "bg-[var(--sucesso-fundo)] text-[var(--sucesso-tinta)]"
                        : "bg-[var(--marca-gelo)] text-[var(--tinta-fraca)]"
                  }`}
                >
                  {feita ? "✓" : i + 1}
                </span>
                {etapa.rotulo}
                {feita ? <span className="sr-only"> (concluída)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-[var(--tinta-fraca)]">
        Destino: <b className="text-[var(--tinta-forte)]">{obra}</b>
        {arquivo ? (
          <>
            {" "}
            · Arquivo:{" "}
            <b className="break-all text-[var(--tinta-forte)]">{arquivo}</b>
          </>
        ) : null}
      </p>
    </div>
  );
}
