"use client";

import { useId, useState } from "react";
import { emailValido } from "@/lib/automacoes/schema";

/**
 * Lista de e-mails em chips. Enter, vírgula, ponto e vírgula ou sair do campo
 * adicionam; colar vários de uma vez também funciona. E-mail inválido não
 * entra e o motivo aparece logo abaixo.
 */
export function CampoEmails({
  id,
  rotulo,
  dica,
  valor,
  aoMudar,
  maximo,
  erro,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  valor: string[];
  aoMudar: (v: string[]) => void;
  maximo: number;
  erro?: string | undefined;
}) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const idAviso = useId();
  const mensagem = aviso ?? erro ?? null;

  const adiciona = (bruto: string) => {
    const partes = bruto
      .split(/[\s,;]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (partes.length === 0) return;
    const invalidos = partes.filter((p) => !emailValido(p));
    const novos = partes.filter((p) => emailValido(p) && !valor.includes(p));
    const lista = [...valor, ...new Set(novos)].slice(0, maximo);
    if (lista.length !== valor.length) aoMudar(lista);
    if (invalidos.length > 0) {
      setAviso(`E-mail inválido: ${invalidos.join(", ")}`);
      setTexto(invalidos.join(", "));
    } else if (valor.length + novos.length > maximo) {
      setAviso(`No máximo ${maximo} e-mails.`);
      setTexto("");
    } else {
      setAviso(null);
      setTexto("");
    }
  };

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-medium text-[var(--tinta-media)]"
      >
        {rotulo}
        {dica ? (
          <span className="ml-1.5 font-normal text-[var(--tinta-fraca)]">
            {dica}
          </span>
        ) : null}
      </label>
      <div
        className={`flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border-[1.5px] bg-white px-2 py-1.5 focus-within:border-[var(--marca-terracotta)] focus-within:shadow-[0_0_0_3px_var(--marca-anel)] ${
          mensagem ? "border-[var(--perigo)]" : "border-[var(--borda)]"
        }`}
      >
        <ul
          className="contents"
          aria-label={`${rotulo}: ${valor.length} e-mail(s)`}
        >
          {valor.map((email) => (
            <li
              key={email}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--marca-gelo)] py-0.5 pr-0.5 pl-2.5 text-sm text-[var(--tinta-forte)]"
            >
              {email}
              <button
                type="button"
                onClick={() => aoMudar(valor.filter((e) => e !== email))}
                aria-label={`Remover ${email}`}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--tinta-fraca)] transition hover:bg-[var(--borda)] hover:text-[var(--tinta-forte)]"
              >
                <svg
                  aria-hidden
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={texto}
          placeholder={valor.length === 0 ? "nome@empresa.com.br" : ""}
          aria-invalid={mensagem ? true : undefined}
          aria-describedby={mensagem ? idAviso : undefined}
          onChange={(e) => {
            setAviso(null);
            const v = e.target.value;
            if (/[,;\s]$/.test(v)) adiciona(v);
            else setTexto(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adiciona(texto);
            } else if (
              e.key === "Backspace" &&
              texto === "" &&
              valor.length > 0
            ) {
              aoMudar(valor.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            adiciona(`${texto} ${e.clipboardData.getData("text")}`);
          }}
          onBlur={() => adiciona(texto)}
          className="min-h-8 min-w-[12rem] flex-1 border-0 bg-transparent px-1 text-base text-[var(--tinta-forte)] outline-none placeholder:text-[var(--tinta-apagada)] sm:text-sm"
        />
      </div>
      {mensagem ? (
        <p id={idAviso} className="mt-1 text-xs text-[var(--perigo)]">
          {mensagem}
        </p>
      ) : null}
    </div>
  );
}
