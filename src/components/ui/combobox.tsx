"use client";

import { useId, useState } from "react";
import { filtraPorTermo } from "./busca";

export type OpcaoCombobox = {
  id: string;
  titulo: string;
  /** Segunda linha (ex.: e-mail). Também entra na busca. */
  detalhe?: string;
  /** Texto à direita (ex.: papel). */
  etiqueta?: string;
};

/**
 * Campo com busca e lista de sugestões (padrão ARIA combobox + listbox).
 * Setas navegam, Enter escolhe, Esc fecha. Serve para listas grandes em que
 * um `<select>` obriga a rolar sem poder digitar.
 */
export function Combobox({
  id,
  opcoes,
  selecionado,
  aoSelecionar,
  placeholder = "Digite para buscar",
  vazio = "Nada encontrado",
  disabled = false,
  "aria-describedby": descritoPor,
}: {
  id: string;
  opcoes: readonly OpcaoCombobox[];
  selecionado: OpcaoCombobox | null;
  aoSelecionar: (opcao: OpcaoCombobox | null) => void;
  placeholder?: string;
  vazio?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
}) {
  const idLista = `${useId()}-lista`;
  const [termo, setTermo] = useState("");
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(0);

  const filtradas = filtraPorTermo(opcoes, termo, (o) => [
    o.titulo,
    o.detalhe ?? "",
  ]);
  const indice = Math.min(ativo, Math.max(filtradas.length - 1, 0));
  const idOpcao = (i: number) => `${idLista}-${i}`;

  const escolhe = (o: OpcaoCombobox) => {
    aoSelecionar(o);
    setTermo("");
    setAberta(false);
  };

  const texto = aberta || !selecionado ? termo : selecionado.titulo;

  return (
    <div className="relative w-full">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={aberta}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={
          aberta && filtradas.length > 0 ? idOpcao(indice) : undefined
        }
        aria-describedby={descritoPor}
        autoComplete="off"
        disabled={disabled}
        placeholder={selecionado ? selecionado.titulo : placeholder}
        value={texto}
        onFocus={() => setAberta(true)}
        onClick={() => setAberta(true)}
        onBlur={() => setAberta(false)}
        onChange={(ev) => {
          setTermo(ev.target.value);
          setAtivo(0);
          setAberta(true);
          if (selecionado) aoSelecionar(null);
        }}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowDown") {
            ev.preventDefault();
            setAberta(true);
            setAtivo(Math.min(indice + 1, filtradas.length - 1));
          } else if (ev.key === "ArrowUp") {
            ev.preventDefault();
            setAtivo(Math.max(indice - 1, 0));
          } else if (ev.key === "Enter" && aberta) {
            const o = filtradas[indice];
            if (o) {
              ev.preventDefault();
              escolhe(o);
            }
          } else if (ev.key === "Escape" && aberta) {
            // Não deixa o Esc fechar um modal em volta.
            ev.preventDefault();
            ev.stopPropagation();
            setAberta(false);
          }
        }}
        className="w-full min-h-10 rounded-lg border-[1.5px] border-[var(--borda)] bg-white px-3 py-2 text-base text-[var(--tinta-forte)] transition placeholder:text-[var(--tinta-fraca)] focus:border-[var(--marca-terracotta)] focus:shadow-[0_0_0_3px_var(--marca-anel)] focus:outline-none disabled:bg-[var(--plano)] disabled:text-[var(--tinta-fraca)] sm:text-sm"
      />
      {aberta ? (
        <ul
          id={idLista}
          role="listbox"
          className="rolagem-fina absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-[var(--borda)] bg-white py-1 shadow-[var(--sombra-md)]"
        >
          {filtradas.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-[var(--tinta-fraca)]">
              {vazio}
            </li>
          ) : (
            filtradas.map((o, i) => (
              <li
                key={o.id}
                id={idOpcao(i)}
                role="option"
                aria-selected={selecionado?.id === o.id}
                // mousedown antes do blur do campo: senão a lista some antes
                // do clique chegar.
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  escolhe(o);
                }}
                onMouseMove={() => setAtivo(i)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 ${
                  i === indice ? "bg-[var(--marca-brand-50)]" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-[var(--tinta-forte)]">
                    {o.titulo}
                  </span>
                  {o.detalhe ? (
                    <span className="block truncate text-xs text-[var(--tinta-fraca)]">
                      {o.detalhe}
                    </span>
                  ) : null}
                </span>
                {o.etiqueta ? (
                  <span className="shrink-0 text-xs text-[var(--tinta-fraca)]">
                    {o.etiqueta}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
