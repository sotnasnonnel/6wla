"use client";

import { useActionState, useState } from "react";
import { entrar, type EstadoLogin } from "./actions";
import { FormEsqueciSenha } from "./esqueci-senha";
import { Alerta, Botao, Campo, Rotulo } from "@/components/ui/basicos";

export function FormLogin({
  proximo,
  avisoInicial,
}: {
  proximo: string;
  avisoInicial?: string;
}) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(
    entrar,
    {},
  );
  // Controlados: o React limpa campos não controlados depois de uma action,
  // e errar a senha não deveria obrigar a digitar o e-mail de novo.
  const [email, setEmail] = useState("");
  const [mostraSenha, setMostraSenha] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const erro = estado.erro ?? avisoInicial;

  if (esqueci) {
    return (
      <FormEsqueciSenha
        emailInicial={email}
        aoVoltar={() => setEsqueci(false)}
      />
    );
  }

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="proximo" value={proximo} />
      <div>
        <Rotulo htmlFor="email">E-mail</Rotulo>
        <Campo
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
        />
      </div>
      <div>
        <Rotulo htmlFor="senha">Senha</Rotulo>
        <div className="relative">
          <Campo
            id="senha"
            name="senha"
            type={mostraSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-20"
            aria-invalid={estado.erro ? true : undefined}
          />
          <button
            type="button"
            onClick={() => setMostraSenha((m) => !m)}
            aria-pressed={mostraSenha}
            aria-controls="senha"
            className="absolute inset-y-0 right-0 inline-flex min-w-10 items-center rounded-r-lg px-3 text-xs font-semibold text-[var(--tinta-media)] transition hover:text-[var(--tinta-forte)]"
          >
            {mostraSenha ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>
      {erro ? <Alerta>{erro}</Alerta> : null}
      <Botao
        type="submit"
        disabled={pendente}
        className="w-full justify-center"
      >
        {pendente ? "Entrando…" : "Entrar"}
      </Botao>
      <button
        type="button"
        onClick={() => setEsqueci(true)}
        className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--marca-terracotta-escuro)] underline-offset-2 hover:underline"
      >
        Esqueci minha senha
      </button>
    </form>
  );
}
