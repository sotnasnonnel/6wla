"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { definirSenha, sair, type EstadoSenha } from "@/app/login/actions";
import {
  caminhoSemLink,
  leLinkSenha,
  mensagemErroLink,
  type LinkSenha,
} from "@/lib/auth/link-senha";
import { createClient } from "@/lib/supabase/client";
import { Alerta, Botao, Campo, Rotulo } from "@/components/ui/basicos";

type Cliente = ReturnType<typeof createClient>;

type Fase =
  | { fase: "abrindo" }
  | { fase: "outra-conta"; email: string | null }
  | { fase: "pronto"; email: string | null }
  | { fase: "erro"; mensagem: string };

const SEM_LINK =
  "Abra o link enviado por e-mail para criar sua senha. Se ele não chegou, peça um novo convite ao administrador.";

/**
 * Abre a sessão a partir do link. O cliente do navegador pode já ter tratado
 * o `?code=` sozinho ao iniciar; por isso, se a troca falhar, confere se a
 * sessão já existe antes de dar o link como inválido.
 */
async function abreSessao(supabase: Cliente, link: LinkSenha): Promise<Fase> {
  const invalido: Fase = { fase: "erro", mensagem: mensagemErroLink(true) };
  // Quem já está logado não tem a sessão trocada por um link: senão um link
  // forjado deixaria a pessoa trabalhando, sem perceber, na conta de outro.
  if (link.tipo !== "nenhum" && link.tipo !== "erro") {
    const {
      data: { user: atual },
    } = await supabase.auth.getUser();
    if (atual) return { fase: "outra-conta", email: atual.email ?? null };
  }
  switch (link.tipo) {
    case "erro":
      return { fase: "erro", mensagem: mensagemErroLink(link.expirado) };
    case "sessao": {
      const { error } = await supabase.auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      });
      if (error) return invalido;
      break;
    }
    case "codigo": {
      const { error } = await supabase.auth.exchangeCodeForSession(link.codigo);
      if (error) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return invalido;
      }
      break;
    }
    case "token": {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: link.tokenHash,
        type: link.tipoOtp,
      });
      if (error) return invalido;
      break;
    }
    case "nenhum":
      break;
  }
  // Valida no Auth (não só o cookie) e descobre de quem é a conta.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fase: "erro", mensagem: SEM_LINK };
  return { fase: "pronto", email: user.email ?? null };
}

export function FormDefinirSenha() {
  const [fase, setFase] = useState<Fase>({ fase: "abrindo" });
  // O código do link só vale uma vez: o StrictMode roda o efeito duas.
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    const href = window.location.href;
    const link = leLinkSenha(href);
    // Token fora da barra antes de qualquer coisa (histórico, favoritos).
    if (link.tipo !== "nenhum") {
      window.history.replaceState(
        window.history.state,
        "",
        caminhoSemLink(href),
      );
    }
    void abreSessao(createClient(), link).then(setFase);
  }, []);

  if (fase.fase === "abrindo") {
    return (
      <p role="status" className="text-sm text-[var(--tinta-fraca)]">
        Validando o link…
      </p>
    );
  }

  if (fase.fase === "erro") {
    return (
      <div className="space-y-4">
        <Alerta>{fase.mensagem}</Alerta>
        <Link
          href="/login"
          className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--marca-terracotta-escuro)] underline-offset-2 hover:underline"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  if (fase.fase === "outra-conta") {
    return (
      <div className="space-y-4">
        <Alerta tipo="info">
          Você já está conectado como {fase.email ?? "outra conta"}. Saia e
          abra o link do e-mail de novo.
        </Alerta>
        <form action={sair}>
          <Botao type="submit" className="w-full justify-center">
            Sair
          </Botao>
        </form>
      </div>
    );
  }

  return <FormNovaSenha email={fase.email} />;
}

function FormNovaSenha({ email }: { email: string | null }) {
  const [estado, acao, pendente] = useActionState<EstadoSenha, FormData>(
    definirSenha,
    {},
  );
  const [mostra, setMostra] = useState(false);
  const tipo = mostra ? "text" : "password";

  return (
    <>
      <form action={acao} className="space-y-4">
        {email ? (
          <p className="text-sm text-[var(--tinta-media)]">
            Conta: <strong className="break-all">{email}</strong>
          </p>
        ) : null}
        <div>
          <Rotulo htmlFor="senha">Nova senha</Rotulo>
          <div className="relative">
            <Campo
              id="senha"
              name="senha"
              type={tipo}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              autoFocus
              className="pr-20"
              aria-describedby="senha-dica"
              aria-invalid={estado.erro ? true : undefined}
            />
            <button
              type="button"
              onClick={() => setMostra((m) => !m)}
              aria-pressed={mostra}
              aria-controls="senha confirma"
              className="absolute inset-y-0 right-0 inline-flex min-w-10 items-center rounded-r-lg px-3 text-xs font-semibold text-[var(--tinta-media)] transition hover:text-[var(--tinta-forte)]"
            >
              {mostra ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          <p id="senha-dica" className="mt-1 text-xs text-[var(--tinta-fraca)]">
            Pelo menos 8 caracteres. A senha vale também para o PHD View.
          </p>
        </div>
        <div>
          <Rotulo htmlFor="confirma">Confirmar senha</Rotulo>
          <Campo
            id="confirma"
            name="confirma"
            type={tipo}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
          />
        </div>
        {estado.erro ? <Alerta>{estado.erro}</Alerta> : null}
        <Botao
          type="submit"
          disabled={pendente}
          className="w-full justify-center"
        >
          {pendente ? "Salvando…" : "Salvar e entrar"}
        </Botao>
      </form>
      {/* Link aberto num aparelho com a conta de outra pessoa: sair. */}
      <form
        action={sair}
        className="mt-5 border-t border-[var(--grade)] pt-4 text-sm text-[var(--tinta-fraca)]"
      >
        Não é {email ?? "você"}?{" "}
        <button
          type="submit"
          className="inline-flex min-h-10 items-center font-semibold text-[var(--marca-terracotta-escuro)] underline-offset-2 hover:underline"
        >
          Sair
        </button>
      </form>
    </>
  );
}
