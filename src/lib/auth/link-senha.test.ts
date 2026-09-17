import { describe, expect, it } from "vitest";
import { caminhoSemLink, leLinkSenha, mensagemErroLink } from "./link-senha";

const BASE = "https://6wla.exemplo.com/definir-senha";

describe("leLinkSenha", () => {
  it("lê a sessão do fragmento do convite", () => {
    expect(
      leLinkSenha(
        `${BASE}#access_token=aaa&expires_in=3600&refresh_token=rrr&token_type=bearer&type=invite`,
      ),
    ).toEqual({ tipo: "sessao", accessToken: "aaa", refreshToken: "rrr" });
  });

  it("lê o código do fluxo PKCE", () => {
    expect(leLinkSenha(`${BASE}?code=abc-123`)).toEqual({
      tipo: "codigo",
      codigo: "abc-123",
    });
  });

  it("lê token_hash com o tipo de recuperação", () => {
    expect(leLinkSenha(`${BASE}?token_hash=hhh&type=recovery`)).toEqual({
      tipo: "token",
      tokenHash: "hhh",
      tipoOtp: "recovery",
    });
  });

  it("marca como expirado o erro otp_expired no fragmento", () => {
    expect(
      leLinkSenha(
        `${BASE}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`,
      ),
    ).toEqual({ tipo: "erro", expirado: true });
  });

  it("trata erro na query sem código conhecido como não expirado", () => {
    expect(leLinkSenha(`${BASE}?error=server_error`)).toEqual({
      tipo: "erro",
      expirado: false,
    });
  });

  it("dá erro quando o fragmento vem sem refresh_token", () => {
    expect(leLinkSenha(`${BASE}#access_token=aaa&type=invite`)).toEqual({
      tipo: "erro",
      expirado: false,
    });
  });

  it("dá erro quando o fragmento é de magic link", () => {
    expect(
      leLinkSenha(`${BASE}#access_token=aaa&refresh_token=rrr&type=magiclink`),
    ).toEqual({ tipo: "erro", expirado: false });
  });

  it("dá erro quando token_hash vem com tipo fora de convite/recuperação", () => {
    expect(leLinkSenha(`${BASE}?token_hash=hhh&type=magiclink`)).toEqual({
      tipo: "erro",
      expirado: false,
    });
  });

  it("devolve nenhum quando a página abre sem link", () => {
    expect(leLinkSenha(BASE)).toEqual({ tipo: "nenhum" });
  });
});

describe("caminhoSemLink", () => {
  it("remove fragmento e parâmetros do link, mantendo os demais", () => {
    expect(
      caminhoSemLink(`${BASE}?code=abc&type=recovery&x=1#access_token=aaa`),
    ).toBe("/definir-senha?x=1");
  });
});

describe("mensagemErroLink", () => {
  it("pede novo convite quando o link expirou", () => {
    expect(mensagemErroLink(true)).toBe(
      "Este link expirou ou já foi usado. Peça um novo convite ao administrador.",
    );
  });
});
