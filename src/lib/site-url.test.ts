import { describe, expect, it } from "vitest";
import { origemDoSite } from "./site-url";

describe("origemDoSite", () => {
  it("prefere a URL configurada, sem caminho", () => {
    expect(
      origemDoSite({
        configurada: "https://6wla.exemplo.com/qualquer",
        proto: "http",
        host: "outro.exemplo.com",
      }),
    ).toBe("https://6wla.exemplo.com");
  });

  it("usa o primeiro proto e host encaminhados pelo proxy", () => {
    expect(
      origemDoSite({
        configurada: undefined,
        proto: "https, http",
        host: "6wla.exemplo.com, interno:3000",
      }),
    ).toBe("https://6wla.exemplo.com");
  });

  it("assume http no localhost sem proto", () => {
    expect(
      origemDoSite({
        configurada: undefined,
        proto: null,
        host: "localhost:3000",
      }),
    ).toBe("http://localhost:3000");
  });

  it("assume https fora do localhost sem proto", () => {
    expect(
      origemDoSite({
        configurada: undefined,
        proto: null,
        host: "app.exemplo.com",
      }),
    ).toBe("https://app.exemplo.com");
  });

  it("recusa host com caracteres de URL", () => {
    expect(
      origemDoSite({
        configurada: undefined,
        proto: "https",
        host: "evil.com/@6wla.exemplo.com",
      }),
    ).toBeNull();
  });

  it("devolve null sem host", () => {
    expect(
      origemDoSite({ configurada: undefined, proto: "https", host: null }),
    ).toBeNull();
  });
});
