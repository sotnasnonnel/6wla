"use client";

import { useActionState } from "react";
import { trocarSenha, type EstadoSenha } from "@/app/login/actions";
import { Alerta, Botao, Campo, Rotulo } from "@/components/ui/basicos";

export function FormSenha() {
  const [estado, acao, pendente] = useActionState<EstadoSenha, FormData>(
    trocarSenha,
    {},
  );
  return (
    <form action={acao} className="space-y-3">
      <div>
        <Rotulo htmlFor="senha">Nova senha</Rotulo>
        <Campo
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      <div>
        <Rotulo htmlFor="confirma">Confirmar</Rotulo>
        <Campo
          id="confirma"
          name="confirma"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {estado.erro ? <Alerta>{estado.erro}</Alerta> : null}
      {estado.ok ? <Alerta tipo="ok">Senha alterada.</Alerta> : null}
      <Botao type="submit" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar"}
      </Botao>
    </form>
  );
}
