import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let cabecalhos = new Headers();
vi.mock("next/headers", () => ({ headers: async () => cabecalhos }));

const { ipDaRequisicao } = await import("./limite");

describe("ipDaRequisicao", () => {
  beforeEach(() => {
    cabecalhos = new Headers();
  });

  it("ignora o IP forjado pelo cliente no início do X-Forwarded-For", async () => {
    cabecalhos.set("x-forwarded-for", "6.6.6.6, 200.1.2.3");
    expect(await ipDaRequisicao()).toBe("200.1.2.3");
  });

  it("prefere o X-Real-IP gravado pelo proxy", async () => {
    cabecalhos.set("x-forwarded-for", "6.6.6.6, 200.1.2.3");
    cabecalhos.set("x-real-ip", "200.9.9.9");
    expect(await ipDaRequisicao()).toBe("200.9.9.9");
  });

  it("devolve ? sem nenhum cabeçalho de proxy", async () => {
    expect(await ipDaRequisicao()).toBe("?");
  });
});
