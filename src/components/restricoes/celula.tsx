"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type TipoCelula = "texto" | "data" | "selecao";

type Props = {
  valor: string;
  tipo: TipoCelula;
  opcoes?: Array<{ valor: string; rotulo: string }>;
  /** Devolve mensagem de erro para exibir; `null` = salvo. */
  aoSalvar: (novo: string) => Promise<string | null>;
  exibicao?: React.ReactNode;
  /** Nome acessível do editor, por exemplo "Prazo de R-001". */
  rotulo?: string;
  className?: string;
  desabilitada?: boolean;
  titulo?: string;
};

/**
 * Célula estilo planilha: mostra o valor; clique (ou Enter) abre o editor;
 * Enter/blur salva, Esc cancela. Salva um campo por vez via Server Action.
 *
 * Três cuidados que a planilha exige e o formulário comum não:
 *
 *  - **uma gravação por vez.** Enter dispara o salvamento e, logo depois, o
 *    blur do campo dispararia de novo. A trava é uma ref (síncrona): estado
 *    do React só mudaria no próximo render, tarde demais.
 *  - **nunca ficar presa.** Se a Server Action rejeitar, o `finally` devolve
 *    a célula ao usuário em vez de deixá-la desabilitada para sempre.
 *  - **não perder o que foi digitado.** No erro, o rascunho fica na tela com
 *    "tentar de novo" e "cancelar"; ninguém redigita por causa de rede ruim.
 *
 * Quem sai da edição pelo teclado (Enter, Esc) ou pelos botões do erro volta
 * com o foco na célula, para seguir navegando; quem saiu clicando em outro
 * lugar não tem o foco puxado de volta.
 */
export function CelulaEditavel({
  valor,
  tipo,
  opcoes,
  aoSalvar,
  exibicao,
  rotulo,
  className = "",
  desabilitada = false,
  titulo,
}: Props) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(valor);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emVoo = useRef(false);
  const devolverFoco = useRef(false);
  const exibicaoRef = useRef<HTMLDivElement>(null);
  const ref = useRef<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >(null);

  useEffect(() => {
    if (editando) ref.current?.focus();
    else if (devolverFoco.current) {
      devolverFoco.current = false;
      exibicaoRef.current?.focus();
    }
  }, [editando]);

  // O marcador de "salvo" é um respiro visual, não um estado de negócio.
  useEffect(() => {
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(false), 1400);
    return () => clearTimeout(t);
  }, [salvo]);

  const abrir = () => {
    if (desabilitada) return;
    setRascunho(valor);
    setErro(null);
    setEditando(true);
  };

  const fechar = () => {
    setEditando(false);
    setErro(null);
  };

  const salvar = async () => {
    if (emVoo.current) return;
    if (rascunho === valor) {
      fechar();
      return;
    }
    emVoo.current = true;
    setSalvando(true);
    try {
      const e = await aoSalvar(rascunho);
      if (e) {
        setErro(e);
        return;
      }
      setErro(null);
      setEditando(false);
      setSalvo(true);
    } catch {
      // Exceção inesperada (rede, sessão) não pode sumir com a célula.
      setErro("Não foi possível salvar. Tente de novo.");
    } finally {
      emVoo.current = false;
      setSalvando(false);
    }
  };

  const teclas = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      devolverFoco.current = true;
      fechar();
    } else if (ev.key === "Enter" && !(tipo === "texto" && ev.shiftKey)) {
      ev.preventDefault();
      devolverFoco.current = true;
      void salvar();
    }
  };

  // Com erro na tela, sair do campo não tenta de novo sozinho: a pessoa
  // decide entre repetir e desistir, sem repetir a falha a cada clique.
  const aoSairDoCampo = () => {
    if (erro || salvando) return;
    void salvar();
  };

  if (!editando) {
    return (
      <div
        ref={exibicaoRef}
        role="button"
        tabIndex={desabilitada ? -1 : 0}
        title={titulo ?? (desabilitada ? undefined : "Clique para editar")}
        aria-label={rotulo}
        onClick={abrir}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === "F2") abrir();
        }}
        className={`relative min-h-[30px] w-full px-2 py-1 text-sm ${desabilitada ? "cursor-default text-[var(--tinta-fraca)]" : "cursor-text hover:bg-[var(--marca-brand-50)] focus:bg-[var(--marca-brand-50)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--marca-terracotta)]"} ${className}`}
      >
        {exibicao ??
          (valor ? (
            valor
          ) : (
            <span className="text-[var(--borda-forte)]">—</span>
          ))}
        {salvo ? (
          <span
            aria-hidden
            className="absolute right-1 top-1 text-[10px] font-bold text-[var(--sucesso-tinta)]"
          >
            ✓
          </span>
        ) : null}
      </div>
    );
  }

  const base =
    "w-full border-2 border-[var(--marca-terracotta)] bg-white px-1.5 py-0.5 text-sm text-[var(--tinta-forte)] focus:outline-none disabled:opacity-70";

  return (
    <div className="relative w-full">
      {tipo === "selecao" ? (
        <select
          ref={ref as React.RefObject<HTMLSelectElement>}
          value={rascunho}
          disabled={salvando}
          aria-label={rotulo}
          aria-busy={salvando}
          aria-invalid={erro ? true : undefined}
          onChange={(ev) => setRascunho(ev.target.value)}
          onBlur={aoSairDoCampo}
          onKeyDown={teclas}
          className={base}
        >
          {opcoes?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      ) : tipo === "data" ? (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type="date"
          value={rascunho}
          disabled={salvando}
          aria-label={rotulo}
          aria-busy={salvando}
          aria-invalid={erro ? true : undefined}
          onChange={(ev) => setRascunho(ev.target.value)}
          onBlur={aoSairDoCampo}
          onKeyDown={teclas}
          className={base}
        />
      ) : (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={rascunho}
          rows={Math.min(6, Math.max(1, Math.ceil(rascunho.length / 40)))}
          disabled={salvando}
          aria-label={rotulo}
          aria-busy={salvando}
          aria-invalid={erro ? true : undefined}
          onChange={(ev) => setRascunho(ev.target.value)}
          onBlur={aoSairDoCampo}
          onKeyDown={teclas}
          className={`${base} resize-none`}
        />
      )}
      {salvando ? (
        <span className="absolute right-1 top-1 text-[10px] text-[var(--tinta-fraca)]">
          salvando…
        </span>
      ) : null}
      {erro ? (
        <div
          role="alert"
          className="absolute left-0 top-full z-30 mt-0.5 w-max max-w-[260px] rounded bg-[var(--marca-terracotta-vermelho)] px-2 py-1 text-xs text-white shadow"
        >
          {erro}
          <span className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setErro(null);
                devolverFoco.current = true;
                void salvar();
              }}
              className="font-semibold underline"
            >
              Tentar de novo
            </button>
            <button
              type="button"
              onClick={() => {
                devolverFoco.current = true;
                fechar();
              }}
              className="underline"
            >
              Cancelar
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
