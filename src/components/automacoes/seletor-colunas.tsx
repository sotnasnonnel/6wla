"use client";

import { useRef, useState } from "react";
import {
  CHAVES_COLUNAS,
  COLUNAS,
  type ChaveColuna,
} from "@/lib/automacoes/colunas";

/**
 * Colunas do relatório: marcar/desmarcar e reordenar com ↑/↓ (teclado e
 * toque). As marcadas vêm primeiro, na ordem em que saem no e-mail; as
 * desmarcadas ficam embaixo, na ordem do catálogo.
 */
export function SeletorColunas({
  valor,
  aoMudar,
  erro,
}: {
  valor: ChaveColuna[];
  aoMudar: (v: ChaveColuna[]) => void;
  erro?: string | undefined;
}) {
  const [anuncio, setAnuncio] = useState("");
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const fora = CHAVES_COLUNAS.filter((c) => !valor.includes(c));

  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    const a = valor[i];
    const b = valor[j];
    if (a === undefined || b === undefined) return;
    const nova = [...valor];
    nova[i] = b;
    nova[j] = a;
    aoMudar(nova);
    setAnuncio(`${COLUNAS[a].rotulo}: posição ${j + 1} de ${valor.length}`);
    // O botão some na borda da lista; o foco segue a coluna movida.
    const chave = `${a}:${delta === -1 ? "sobe" : "desce"}`;
    const alternativa = `${a}:${delta === -1 ? "desce" : "sobe"}`;
    requestAnimationFrame(() => {
      const alvo = refs.current.get(chave);
      (alvo && !alvo.disabled ? alvo : refs.current.get(alternativa))?.focus();
    });
  };

  const botaoMover = (c: ChaveColuna, i: number, delta: -1 | 1) => {
    const desabilitado = delta === -1 ? i === 0 : i === valor.length - 1;
    const rotulo = COLUNAS[c].rotulo;
    return (
      <button
        type="button"
        ref={(el) => {
          const k = `${c}:${delta === -1 ? "sobe" : "desce"}`;
          if (el) refs.current.set(k, el);
          else refs.current.delete(k);
        }}
        onClick={() => move(i, delta)}
        disabled={desabilitado}
        aria-label={`${delta === -1 ? "Subir" : "Descer"} ${rotulo}`}
        className="grid h-10 w-10 place-items-center rounded-lg text-[var(--tinta-media)] transition hover:bg-[var(--marca-gelo)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <span aria-hidden>{delta === -1 ? "↑" : "↓"}</span>
      </button>
    );
  };

  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-[var(--tinta-media)]">
        Colunas do e-mail
        <span className="ml-1.5 font-normal text-[var(--tinta-fraca)]">
          {valor.length} marcada(s), na ordem da tabela
        </span>
      </legend>
      <ol
        className={`divide-y divide-[var(--grade)] rounded-lg border ${
          erro ? "border-[var(--perigo)]" : "border-[var(--borda)]"
        }`}
      >
        {valor.map((c, i) => (
          <li key={c} className="flex items-center gap-1 pr-1 pl-3">
            <label className="flex min-h-10 flex-1 cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked
                onChange={() => aoMudar(valor.filter((v) => v !== c))}
                className="h-4 w-4 accent-[var(--marca-terracotta)]"
              />
              <span className="w-5 text-right text-xs text-[var(--tinta-fraca)] tabular-nums">
                {i + 1}.
              </span>
              <span className="font-medium text-[var(--tinta-forte)]">
                {COLUNAS[c].rotulo}
              </span>
            </label>
            {botaoMover(c, i, -1)}
            {botaoMover(c, i, 1)}
          </li>
        ))}
        {fora.map((c) => (
          <li key={c} className="px-3">
            <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-[var(--tinta-media)]">
              <input
                type="checkbox"
                checked={false}
                onChange={() => aoMudar([...valor, c])}
                className="h-4 w-4 accent-[var(--marca-terracotta)]"
              />
              {COLUNAS[c].rotulo}
            </label>
          </li>
        ))}
      </ol>
      {erro ? (
        <p className="mt-1 text-xs text-[var(--perigo)]">{erro}</p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
    </fieldset>
  );
}
