"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Modal sobre `<dialog>` nativo: foco preso, Esc fecha e fundo inerte vêm do
 * navegador, sem biblioteca nem armadilha de acessibilidade escrita à mão.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  largura = 720,
  children,
  rodape,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  largura?: number;
  children: ReactNode;
  rodape?: ReactNode;
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
      // O conteúdo só existe depois que o diálogo abre, então o autofoco
      // nativo não acha o primeiro campo: coloca o cursor nele na mão.
      const primeiro = dialogo.querySelector<HTMLElement>(
        "[autofocus], input:not([type=hidden]), textarea, select",
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
        aoFechar();
      }}
      onClick={(e) => {
        // Clique fora do conteúdo fecha; dentro, não.
        if (e.target === ref.current) aoFechar();
      }}
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      className="m-auto w-[calc(100vw-1.5rem)] rounded-lg sm:w-[calc(100vw-2rem)] border border-[var(--borda)] bg-white p-0 text-[var(--tinta-forte)] shadow-xl backdrop:bg-[#26405d]/45"
      style={{ maxWidth: largura }}
    >
      {aberto ? (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--borda)] px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <h2 id={idTitulo} className="text-base font-semibold">
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
              aria-label="Fechar"
              className="-mr-1 -mt-1 rounded p-1.5 text-[var(--tinta-fraca)] transition hover:bg-[var(--marca-gelo)] hover:text-[var(--tinta-forte)]"
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

          <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {children}
          </div>

          {rodape ? (
            <footer className="flex items-center justify-end gap-2 border-t border-[var(--borda)] bg-[#fbfaf9] px-4 py-3 sm:px-5">
              {rodape}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
