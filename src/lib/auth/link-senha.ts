import { z } from "zod";

/**
 * Link que chega em /definir-senha (convite ou "esqueci minha senha"). O Auth
 * do Supabase manda a pessoa de volta em um de três formatos, conforme o
 * fluxo e o template de e-mail:
 *   - fragmento `#access_token=…&refresh_token=…&type=invite|recovery`
 *     (fluxo implícito, o padrão do `{{ .ConfirmationURL }}`);
 *   - `?code=…` (fluxo PKCE);
 *   - `?token_hash=…&type=…` (template que aponta direto para o app).
 * Erro (link vencido, já usado) vem como `error`/`error_code`, no fragmento
 * ou na query.
 */
export type LinkSenha =
  | { tipo: "sessao"; accessToken: string; refreshToken: string }
  | { tipo: "codigo"; codigo: string }
  | { tipo: "token"; tokenHash: string; tipoOtp: TipoOtp }
  | { tipo: "erro"; expirado: boolean }
  | { tipo: "nenhum" };

/**
 * Só convite e recuperação: outros tipos (magic link etc.) serviriam para
 * alguém mandar um link que loga a vítima na conta dele.
 */
const TIPOS_OTP = ["invite", "recovery"] as const;
export type TipoOtp = (typeof TIPOS_OTP)[number];

/** Parâmetros que só servem para abrir a sessão e não ficam na barra. */
const PARAMETROS_DO_LINK = [
  "code",
  "token_hash",
  "type",
  "error",
  "error_code",
  "error_description",
] as const;

const tokenSchema = z.string().trim().min(1).max(4096);

const sessaoSchema = z.object({
  accessToken: tokenSchema,
  refreshToken: tokenSchema,
  tipoOtp: z.enum(TIPOS_OTP),
});
const otpSchema = z.object({
  tokenHash: tokenSchema,
  tipoOtp: z.enum(TIPOS_OTP),
});

export function leLinkSenha(href: string): LinkSenha {
  const url = new URL(href);
  const fragmento = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = url.searchParams;
  const valor = (chave: string) => fragmento.get(chave) ?? query.get(chave);

  const codigoErro = valor("error_code");
  if (valor("error") !== null || codigoErro !== null) {
    return { tipo: "erro", expirado: codigoErro === "otp_expired" };
  }

  const sessao = sessaoSchema.safeParse({
    accessToken: fragmento.get("access_token"),
    refreshToken: fragmento.get("refresh_token"),
    tipoOtp: fragmento.get("type"),
  });
  if (sessao.success)
    return {
      tipo: "sessao",
      accessToken: sessao.data.accessToken,
      refreshToken: sessao.data.refreshToken,
    };

  const codigo = tokenSchema.safeParse(query.get("code"));
  if (codigo.success) return { tipo: "codigo", codigo: codigo.data };

  const otp = otpSchema.safeParse({
    tokenHash: query.get("token_hash"),
    tipoOtp: query.get("type"),
  });
  if (otp.success) return { tipo: "token", ...otp.data };

  // Tem pedaço de link, mas incompleto ou adulterado: trata como inválido.
  const temAlgo =
    fragmento.has("access_token") ||
    query.has("code") ||
    query.has("token_hash");
  return temAlgo ? { tipo: "erro", expirado: false } : { tipo: "nenhum" };
}

/**
 * Caminho sem o fragmento e sem os parâmetros do link: o token não pode
 * ficar no histórico, em favorito nem em captura de tela.
 */
export function caminhoSemLink(href: string): string {
  const url = new URL(href);
  for (const p of PARAMETROS_DO_LINK) url.searchParams.delete(p);
  const busca = url.searchParams.toString();
  return `${url.pathname}${busca ? `?${busca}` : ""}`;
}

export function mensagemErroLink(expirado: boolean): string {
  return expirado
    ? "Este link expirou ou já foi usado. Peça um novo convite ao administrador."
    : "Não foi possível validar este link. Peça um novo convite ao administrador.";
}
