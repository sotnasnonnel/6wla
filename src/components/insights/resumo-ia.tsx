"use client";

import { useState, useTransition } from "react";
import { Alerta, Botao, Cartao, TituloSecao } from "@/components/ui/basicos";
import { resumeSemana } from "@/server/insights/actions";

/**
 * Card do resumo da semana escrito pela IA. Gera só quando pedem: cada clique
 * é uma chamada ao Gemini, e o texto não é guardado — some ao recarregar.
 */
export function ResumoIA({
  obraId,
  disponivel,
}: {
  obraId: string;
  disponivel: boolean;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, inicia] = useTransition();

  const gera = () => {
    setErro(null);
    inicia(async () => {
      const r = await resumeSemana(obraId);
      if (r.ok) setTexto(r.dados.texto);
      else setErro(r.erro);
    });
  };

  return (
    <Cartao className="mb-5">
      <section aria-labelledby="resumo-ia-titulo" aria-busy={gerando}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TituloSecao>
            <span id="resumo-ia-titulo">Resumo da semana</span>
          </TituloSecao>
          {disponivel ? (
            <Botao
              variante={texto ? "secundario" : "primario"}
              onClick={gera}
              disabled={gerando}
            >
              {gerando
                ? "Resumindo…"
                : texto
                  ? "Gerar de novo"
                  : "Resumir a semana com IA"}
            </Botao>
          ) : null}
        </div>

        {!disponivel ? (
          <p className="mt-2 text-sm text-[var(--tinta-fraca)]">
            Resumo por IA indisponível nesta instalação. Os alertas abaixo
            continuam valendo — são calculados direto dos números da obra.
          </p>
        ) : null}

        {disponivel && !texto && !gerando && !erro ? (
          <p className="mt-2 text-sm text-[var(--tinta-fraca)]">
            A IA lê só os números, categorias e nomes de responsáveis desta
            aba (nunca as descrições das restrições) e escreve um parágrafo
            com o que mais pede atenção.
          </p>
        ) : null}

        <div aria-live="polite">
          {gerando ? (
            <div className="mt-3 space-y-2" role="status">
              <span className="sr-only">Gerando resumo…</span>
              {["w-full", "w-11/12", "w-3/4"].map((w) => (
                <div
                  key={w}
                  aria-hidden
                  className={`h-4 animate-pulse rounded bg-[var(--grade)] motion-reduce:animate-none ${w}`}
                />
              ))}
            </div>
          ) : texto ? (
            <>
              <p className="mt-3 text-[0.95rem] leading-relaxed whitespace-pre-line text-[var(--tinta-forte)]">
                {texto}
              </p>
              <p className="mt-2 text-xs text-[var(--tinta-fraca)]">
                Gerado por IA a partir dos números da obra; confira antes de
                decidir.
              </p>
            </>
          ) : null}
        </div>

        {erro ? (
          <div className="mt-3">
            <Alerta>{erro}</Alerta>
          </div>
        ) : null}
      </section>
    </Cartao>
  );
}
