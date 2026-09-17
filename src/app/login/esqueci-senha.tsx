"use client";

import { useActionState } from "react";
import { pedirLinkSenha, type EstadoEsqueci } from "./actions";
import { Alerta, Botao, Campo, Rotulo } from "@/components/ui/basicos";

/**
 * Pede o link de redefinição. A resposta é a mesma exista ou não a conta
 * (a action cuida disso).
 */
export function FormEsqueciSenha({
  emailInicial,
  aoVoltar,
}: {
  emailInicial: string;
  aoVoltar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<EstadoEsqueci, FormData>(
    pedirLinkSenha,
    {},
  );

  return (
    <form action={acao} className="space-y-4">
      <p className="text-sm text-[var(--tinta-media)]">
        Informe seu e-mail. Enviamos um link para você criar uma senha nova (ela
        vale também para o PHD View).
      </p>
      <div>
        <Rotulo htmlFor="esqueci-email">E-mail</Rotulo>
        <Campo
          id="esqueci-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          defaultValue={emailInicial}
          aria-invalid={estado.erro ? true : undefined}
        />
      </div>
      {estado.erro ? <Alerta>{estado.erro}</Alerta> : null}
      {estado.enviado ? (
        <Alerta tipo="ok">
          Se o e-mail estiver cadastrado, enviamos um link.
        </Alerta>
      ) : null}
      <Botao
        type="submit"
        disabled={pendente}
        className="w-full justify-center"
      >
        {pendente ? "Enviando…" : "Enviar link"}
      </Botao>
      <button
        type="button"
        onClick={aoVoltar}
        className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--marca-terracotta-escuro)] underline-offset-2 hover:underline"
      >
        Voltar para o login
      </button>
    </form>
  );
}
