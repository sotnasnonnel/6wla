"use client";

import { useEffect, useState } from "react";

/**
 * Atalho fixo "Atividades (N)" do celular. No telefone as colunas empilham e
 * a conversa fica lá embaixo, depois de todos os cards; o botão leva direto a
 * ela e some enquanto o painel já está na tela, para não cobrir o campo de
 * mensagem.
 */
export function AtalhoAtividades({
  alvoId,
  total,
}: {
  alvoId: string;
  total: number;
}) {
  const [alvoVisivel, setAlvoVisivel] = useState(false);

  useEffect(() => {
    const alvo = document.getElementById(alvoId);
    if (!alvo || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(
      ([entrada]) => setAlvoVisivel(entrada?.isIntersecting ?? false),
      { threshold: 0.15 },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [alvoId]);

  if (alvoVisivel) return null;

  return (
    <a
      href={`#${alvoId}`}
      onClick={(ev) => {
        const alvo = document.getElementById(alvoId);
        if (!alvo) return;
        ev.preventDefault();
        const reduzido = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        alvo.scrollIntoView({
          behavior: reduzido ? "auto" : "smooth",
          block: "start",
        });
        // Leva o foco junto, para o leitor de tela continuar dali.
        alvo.focus({ preventScroll: true });
      }}
      className="fixed right-4 bottom-4 z-30 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--marca-azul)] px-4 text-sm font-semibold text-white shadow-[var(--sombra-xl)] transition active:opacity-90 lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      Atividades ({total})<span aria-hidden>↓</span>
    </a>
  );
}
