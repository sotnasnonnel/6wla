import "server-only";

import { headers } from "next/headers";
import { env } from "@/env";
import { CAMINHO_DEFINIR_SENHA, origemDoSite } from "@/lib/site-url";
import { createClienteSemSessao } from "@/lib/supabase/sem-sessao";

/**
 * URL de /definir-senha para o `redirectTo` do convite e da redefinição.
 * Usa NEXT_PUBLIC_SITE_URL; sem ela, só fora de produção, a origem da
 * requisição (x-forwarded-proto/host). O Supabase só respeita o redirect se ele estiver
 * na allowlist de Redirect URLs do painel — senão manda para a Site URL.
 * `null` quando não dá para saber a origem (host ausente ou inválido).
 */
export async function urlDefinirSenha(): Promise<string | null> {
  // Em produção o host da requisição não serve: vem do cliente, e um curinga
  // na allowlist do Supabase deixaria o link de senha apontar para outro
  // domínio (a conta vale também no PHD View). Sem a env, não envia.
  if (process.env.NODE_ENV === "production" && !env.NEXT_PUBLIC_SITE_URL) {
    console.error(
      "[links-senha] NEXT_PUBLIC_SITE_URL não definida em produção; link de senha não enviado.",
    );
    return null;
  }
  const h = await headers();
  const origem = origemDoSite({
    configurada: env.NEXT_PUBLIC_SITE_URL,
    proto: h.get("x-forwarded-proto"),
    host: h.get("x-forwarded-host") ?? h.get("host"),
  });
  return origem ? `${origem}${CAMINHO_DEFINIR_SENHA}` : null;
}

/**
 * E-mail de "redefinir senha": também leva a /definir-senha. Sai pelo
 * cliente anon, sem service_role (o Auth aplica o limite de envio). Quem
 * chama decide se pode expor o erro: na tela pública, não.
 */
export async function enviaLinkRedefinicao(email: string, redirectTo: string) {
  const { error } = await createClienteSemSessao().auth.resetPasswordForEmail(
    email,
    { redirectTo },
  );
  return error;
}
