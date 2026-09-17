"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  abreNotificacao,
  marcaLida,
  marcaTodasLidasForm,
} from "@/server/notificacoes/actions";

const TEXTO = {
  mencao: "mencionou você em",
  atribuicao: "atribuiu a você",
  comentario: "comentou em",
} as const;

export type ItemNotificacaoDados = {
  id: string;
  tipo: keyof typeof TEXTO;
  lida: boolean;
  autor: string;
  numero: string;
  descricao: string;
  obra: string;
  comentario: string | null;
  quando: string;
  href: string;
};

/**
 * Uma notificação. A linha inteira abre a restrição e marca como lida (pela
 * Server Action, que também decide o destino). O `href` real fica no link para
 * abrir em nova aba com Ctrl/⌘ ou botão do meio.
 */
export function ItemNotificacao({ n }: { n: ItemNotificacaoDados }) {
  const [abrindo, iniciaAbrir] = useTransition();
  const [marcando, iniciaMarcar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [lidaLocal, setLidaLocal] = useState(false);
  const lida = n.lida || lidaLocal;

  return (
    <li
      className={`relative flex items-start gap-3 px-4 py-3 text-sm transition ${
        lida ? "bg-white" : "bg-[#eff6ff]"
      } ${abrindo ? "opacity-70" : ""} hover:bg-[var(--plano)]`}
    >
      {/* Não lida: ponto + texto, não só a cor de fundo. */}
      <span
        aria-hidden
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          lida ? "bg-transparent" : "bg-[var(--marca-terracotta)]"
        }`}
      />
      <div className="min-w-0 flex-1">
        {!lida ? (
          <span className="mb-0.5 block text-[0.7rem] font-semibold tracking-[0.04em] text-[var(--marca-terracotta-escuro)] uppercase">
            Não lida
          </span>
        ) : null}
        <Link
          href={n.href}
          prefetch={false}
          onClick={(ev) => {
            if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
            ev.preventDefault();
            setErro(null);
            iniciaAbrir(async () => {
              const r = await abreNotificacao(n.id);
              // Só volta aqui se não redirecionou.
              if (!r.ok) setErro(r.erro);
            });
          }}
          className="block text-[var(--tinta-forte)] after:absolute after:inset-0"
        >
          <span className="font-medium">{n.autor}</span> {TEXTO[n.tipo]}{" "}
          <span className="font-mono text-[var(--marca-terracotta-escuro)]">
            {n.numero}
          </span>{" "}
          <span className="text-[var(--tinta-media)]">{n.descricao}</span>
        </Link>
        {n.comentario ? (
          <p className="mt-1 line-clamp-2 rounded bg-[var(--marca-gelo)] px-2 py-1 text-xs text-[var(--tinta-media)]">
            {n.comentario}
          </p>
        ) : null}
        <div className="mt-1 text-xs text-[var(--tinta-fraca)]">
          {n.obra} · {n.quando}
          {abrindo ? " · Abrindo…" : ""}
        </div>
        {erro ? (
          <p role="alert" className="mt-1 text-xs text-[var(--perigo-tinta)]">
            {erro}
          </p>
        ) : null}
      </div>
      {!lida ? (
        <button
          type="button"
          disabled={marcando}
          onClick={() =>
            iniciaMarcar(async () => {
              const r = await marcaLida(n.id);
              if (r.ok) setLidaLocal(true);
              else setErro(r.erro);
            })
          }
          // Acima do link esticado, com alvo de toque de 40px.
          className="relative z-10 -my-1 inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-medium text-[var(--tinta-media)] transition hover:bg-[var(--marca-gelo)] hover:text-[var(--tinta-forte)] disabled:opacity-60"
        >
          {marcando ? "Marcando…" : "Marcar lida"}
        </button>
      ) : null}
    </li>
  );
}

export function FormMarcarTodas() {
  return (
    <form action={marcaTodasLidasForm}>
      <BotaoMarcarTodas />
    </form>
  );
}

function BotaoMarcarTodas() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 items-center rounded-lg border border-[var(--borda)] bg-white px-3 text-sm font-medium text-[var(--tinta-media)] transition hover:border-[var(--marca-terracotta)] hover:text-[var(--marca-terracotta)] disabled:opacity-60"
    >
      {pending ? "Marcando…" : "Marcar todas como lidas"}
    </button>
  );
}
