"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./actions";
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
  const erro = estado.erro ?? avisoInicial;

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
          required
          autoFocus
        />
      </div>
      <div>
        <Rotulo htmlFor="senha">Senha</Rotulo>
        <Campo
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {erro ? <Alerta>{erro}</Alerta> : null}
      <Botao
        type="submit"
        disabled={pendente}
        className="w-full justify-center"
      >
        {pendente ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}
