"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Modal sobre `<dialog>` nativo: foco preso, Esc fecha e fundo inerte vêm do
 * navegador, sem biblioteca nem armadilha de acessibilidade escrita à mão.
 *
 * Fechado, o conteúdo continua montado (o `<dialog>` só some da tela): um
 * toque fora sem querer não apaga o que já foi digitado. Quem quer começar do
 * zero limpa o próprio formulário ao concluir.
 *
 * `bloqueado` segura o modal aberto enquanto algo está sendo enviado: Esc,
 * clique no fundo e o X não fecham no meio da gravação.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  largura = 720,
  children,
  rodape,
  bloqueado = false,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  largura?: number;
  children: ReactNode;
  rodape?: ReactNode;
  bloqueado?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Dois modais montados ao mesmo tempo não podem dividir o mesmo id: o
  // leitor de tela leria o título errado.
  const idBase = useId();
  const idTitulo = `${idBase}-titulo`;
  const idDescricao = `${idBase}-descricao`;

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) {
      dialogo.showModal();
      // O conteúdo fica montado mesmo fechado, e o `autoFocus` do React não
      // grava atributo no DOM: quem quer o foco inicial marca
      // `data-autofocus`; sem marca, vai para o primeiro campo.
      const primeiro =
        dialogo.querySelector<HTMLElement>("[data-autofocus]") ??
        dialogo.querySelector<HTMLElement>(
          "input:not([type=hidden]), textarea, select",
        );
      primeiro?.focus();
    }
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!bloqueado) aoFechar();
      }}
      onClick={(e) => {
        // Clique fora do conteúdo fecha; dentro, não.
        if (e.target === ref.current && !bloqueado) aoFechar();
      }}
      onClose={() => {
        // O Chrome fecha à força num segundo Esc mesmo com o cancel barrado.
        // O diálogo segue a prop: reabre e deixa quem controla decidir.
        const dialogo = ref.current;
        if (!aberto || !dialogo || dialogo.open) return;
        dialogo.showModal();
        if (!bloqueado) aoFechar();
      }}
      aria-busy={bloqueado || undefined}
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      className="modal m-auto w-[calc(100vw-1.5rem)] rounded-2xl border-0 bg-white p-0 text-[var(--tinta-forte)] shadow-[var(--sombra-xl)] sm:w-[calc(100vw-2rem)]"
      style={{ maxWidth: largura }}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-lg font-bold tracking-[-0.01em]">
              {titulo}
            </h2>
            {descricao ? (
              <p
                id={idDescricao}
                className="mt-0.5 text-sm text-[var(--tinta-fraca)]"
              >
                {descricao}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            disabled={bloqueado}
            aria-label="Fechar"
            className="grid h-10 w-10 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-lg bg-[var(--marca-gelo)] text-[var(--tinta-fraca)] transition hover:bg-[var(--borda)] hover:text-[var(--tinta-forte)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-7">
          {children}
        </div>

        {rodape ? (
          <footer className="flex items-center justify-end gap-2 px-5 pt-3 pb-5 sm:px-7 sm:pb-7">
            {rodape}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
