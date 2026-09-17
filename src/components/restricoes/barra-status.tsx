"use client";

import {
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { atualizaRestricao } from "@/server/restricoes/actions";
import { STATUS, STATUS_ROTULO, type Status } from "@/lib/restricoes/dominio";
import { Alerta } from "@/components/ui/basicos";

/**
 * Barra de status clicável, no lugar do select do formulário (a barra de
 * estágios da Oportunidade no app-phd). O fluxo é Pendente → Em andamento →
 * Concluída; Cancelada fica à parte, porque não é um passo adiante.
 *
 * Mudar status não pede confirmação: é reversível e fica no histórico.
 *
 * Teclado segue o padrão de radiogroup: só a opção marcada entra no Tab, e as
 * setas movem (e escolhem) a vizinha. Durante o envio a barra fica travada
 * com `aria-disabled` em vez de `disabled`, para o foco não cair no corpo da
 * página.
 */
export function BarraStatus({
  restricaoId,
  status,
}: {
  restricaoId: string;
  status: Status;
}) {
  const router = useRouter();
  const [atual, muda] = useOptimistic(status);
  const [pendente, inicia] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const fluxo = STATUS.filter((s) => s !== "cancelada");
  const posicao = fluxo.indexOf(atual as (typeof fluxo)[number]);

  const botoes = useRef<Map<Status, HTMLButtonElement>>(new Map());

  const escolhe = (novo: Status) => {
    if (novo === atual || pendente) return;
    setErro(null);
    inicia(async () => {
      muda(novo);
      const res = await atualizaRestricao(restricaoId, { status: novo });
      if (!res.ok) setErro(res.erro);
      router.refresh();
    });
  };

  const setas = (ev: KeyboardEvent<HTMLDivElement>) => {
    const passo =
      ev.key === "ArrowRight" || ev.key === "ArrowDown"
        ? 1
        : ev.key === "ArrowLeft" || ev.key === "ArrowUp"
          ? -1
          : 0;
    if (passo === 0) return;
    ev.preventDefault();
    if (pendente) return;
    const i = STATUS.indexOf(atual);
    const alvo = STATUS[(i + passo + STATUS.length) % STATUS.length];
    if (!alvo) return;
    botoes.current.get(alvo)?.focus();
    escolhe(alvo);
  };

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Status da restrição"
        aria-busy={pendente}
        onKeyDown={setas}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {STATUS.map((s) => {
          const cancelada = s === "cancelada";
          const ehAtual = s === atual;
          const feito =
            !cancelada &&
            atual !== "cancelada" &&
            fluxo.indexOf(s as (typeof fluxo)[number]) < posicao;
          const estilo = ehAtual
            ? cancelada
              ? "border-[var(--borda-forte)] bg-[var(--marca-gelo)] text-[var(--tinta-media)]"
              : s === "concluida"
                ? "border-[#a7f3d0] bg-[#e6f7ef] text-[var(--sucesso-tinta)]"
                : "border-[var(--marca-brand-200)] bg-[#fff1e8] text-[var(--marca-terracotta)]"
            : feito
              ? "border-transparent bg-[#e6f7ef] text-[var(--sucesso-tinta)] hover:border-[#a7f3d0]"
              : "border-[var(--borda)] bg-white text-[var(--tinta-fraca)] hover:border-[var(--borda-forte)] hover:text-[var(--tinta-forte)]";
          return (
            <button
              key={s}
              type="button"
              role="radio"
              ref={(el) => {
                if (el) botoes.current.set(s, el);
                else botoes.current.delete(s);
              }}
              aria-checked={ehAtual}
              aria-disabled={pendente || undefined}
              tabIndex={ehAtual ? 0 : -1}
              onClick={() => escolhe(s)}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[0.78rem] font-extrabold tracking-[0.01em] transition aria-disabled:cursor-wait aria-disabled:opacity-70 ${estilo}`}
            >
              {feito ? <span aria-hidden>✓</span> : null}
              {ehAtual && !cancelada ? (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-current"
                />
              ) : null}
              {STATUS_ROTULO[s]}
            </button>
          );
        })}
      </div>
      {erro ? <Alerta>{erro}</Alerta> : null}
    </div>
  );
}
