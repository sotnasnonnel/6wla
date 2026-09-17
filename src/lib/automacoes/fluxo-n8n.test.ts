import { describe, expect, it } from "vitest";
import { montaFluxo, nomeDoFluxo } from "./fluxo-n8n";

const BASE = {
  obraId: "0b1a0000-0000-4000-8000-000000000001",
  codigoObra: "IMCS-CT09-PLAN",
  site: "https://restricoes.phdengenharia.tech/",
  credencialSmtpId: "smtp1",
  credencialTokenId: "tok1",
};

function no(nome: string) {
  const n = montaFluxo(BASE).nodes.find((x) => x.name === nome);
  if (!n) throw new Error(`nó ${nome} ausente`);
  return n as { parameters: Record<string, unknown> };
}

describe("nomeDoFluxo", () => {
  it("segue o padrão '<código> - Restrições'", () => {
    expect(nomeDoFluxo(" IMCS-CT09-PLAN ")).toBe("IMCS-CT09-PLAN - Restrições");
  });
});

describe("montaFluxo", () => {
  it("pede ao 6wla só os e-mails da própria obra", () => {
    expect(no("Buscar e-mails pendentes").parameters).toMatchObject({
      url: "https://restricoes.phdengenharia.tech/api/automacoes/pendentes",
      queryParameters: { parameters: [{ name: "obra", value: BASE.obraId }] },
    });
  });

  it("liga a saída de erro do SMTP à confirmação de falha", () => {
    const fluxo = montaFluxo(BASE);
    expect(fluxo.connections["Enviar e-mail"]).toEqual({
      main: [
        [{ node: "Confirmar envio", type: "main", index: 0 }],
        [{ node: "Confirmar falha", type: "main", index: 0 }],
      ],
    });
  });

  it("não coloca o token do 6wla em nenhum parâmetro do fluxo", () => {
    const texto = JSON.stringify(montaFluxo(BASE));
    expect(texto).not.toMatch(/Bearer|authorization/i);
  });

  it("gera os mesmos ids de nó a cada montagem", () => {
    const ids = (f: ReturnType<typeof montaFluxo>) => f.nodes.map((n) => n.id);
    expect(ids(montaFluxo(BASE))).toEqual(ids(montaFluxo(BASE)));
  });
});
