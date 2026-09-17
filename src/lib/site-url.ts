/**
 * Origem pública do app, usada nos links que o Supabase manda por e-mail.
 * Prioridade: a env configurada; sem ela, o host da própria requisição.
 *
 * O Host vem do cliente: um atacante pode forjá-lo para o link apontar para
 * outro domínio. Quem barra isso é o Supabase, que só aceita `redirectTo`
 * presente na allowlist do painel (Authentication → URL Configuration →
 * Redirect URLs); fora dela, cai na Site URL. Por isso a allowlist deve ter
 * só os domínios do 6wla, e em produção a env deve estar definida.
 */
export function origemDoSite({
  configurada,
  proto,
  host,
}: {
  configurada: string | undefined;
  proto: string | null;
  host: string | null;
}): string | null {
  if (configurada) return new URL(configurada).origin;

  // Proxies mandam listas ("a, b"): vale o primeiro, que é o do cliente.
  const hostLimpo = host?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/.test(hostLimpo)) return null;

  const protoLimpo = proto?.split(",")[0]?.trim().toLowerCase();
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(hostLimpo);
  const esquema =
    protoLimpo === "http" || protoLimpo === "https"
      ? protoLimpo
      : local
        ? "http"
        : "https";
  return `${esquema}://${hostLimpo}`;
}

/** Rota que recebe o link de convite e o de redefinição de senha. */
export const CAMINHO_DEFINIR_SENHA = "/definir-senha";
