/**
 * Fluxo n8n de uma obra, no formato da API pública do n8n
 * (POST/PUT /api/v1/workflows). O fluxo só entrega: a cada 15 min pede ao
 * 6wla os e-mails da obra, envia pelo SMTP e confirma cada um.
 */

export const REMETENTE_PADRAO = "sistema@phdengenharia.eng.br";

export type ParametrosFluxo = {
  obraId: string;
  codigoObra: string;
  /** Origem pública do 6wla, sem barra no fim. */
  site: string;
  credencialSmtpId: string;
  credencialTokenId: string;
  remetente?: string;
};

export type FluxoN8n = {
  name: string;
  nodes: Record<string, unknown>[];
  connections: Record<string, unknown>;
  settings: Record<string, unknown>;
};

export function nomeDoFluxo(codigoObra: string): string {
  return `${codigoObra.trim()} - Restrições`;
}

const N = {
  gatilho: "A cada 15 min",
  buscar: "Buscar e-mails pendentes",
  filtrar: "Só e-mails válidos",
  enviar: "Enviar e-mail",
  ok: "Confirmar envio",
  falha: "Confirmar falha",
} as const;

export function montaFluxo(p: ParametrosFluxo): FluxoN8n {
  const site = p.site.replace(/\/+$/, "");
  const auth = {
    authentication: "genericCredentialType",
    genericAuthType: "httpHeaderAuth",
  };
  const credToken = {
    httpHeaderAuth: { id: p.credencialTokenId, name: "6wla – automações" },
  };
  const confirmar = (nome: string, corpo: string, x: number, y: number) => ({
    id: idNo(nome),
    name: nome,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [x, y],
    // Falha ao confirmar não derruba o resto do lote.
    onError: "continueRegularOutput",
    credentials: credToken,
    parameters: {
      method: "POST",
      url: `${site}/api/automacoes/confirmar`,
      ...auth,
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: corpo,
      options: {},
    },
  });
  // O item que chega ao "Enviar e-mail" é o da API; depois dele o $json é a
  // resposta do SMTP, então o envioId vem pelo item pareado.
  const envioId = `$('${N.filtrar}').item.json.envioId`;

  return {
    name: nomeDoFluxo(p.codigoObra),
    nodes: [
      {
        id: idNo(N.gatilho),
        name: N.gatilho,
        type: "n8n-nodes-base.scheduleTrigger",
        typeVersion: 1.2,
        position: [0, 0],
        parameters: {
          rule: { interval: [{ field: "minutes", minutesInterval: 15 }] },
        },
      },
      {
        id: idNo(N.buscar),
        name: N.buscar,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [220, 0],
        credentials: credToken,
        parameters: {
          method: "GET",
          url: `${site}/api/automacoes/pendentes`,
          ...auth,
          sendQuery: true,
          specifyQuery: "keypair",
          queryParameters: {
            parameters: [{ name: "obra", value: p.obraId }],
          },
          options: {
            response: { response: { responseFormat: "json" } },
          },
        },
      },
      {
        // Lista vazia não pode virar um e-mail sem destinatário.
        id: idNo(N.filtrar),
        name: N.filtrar,
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [440, 0],
        parameters: {
          jsCode:
            "return $input.all().filter((i) => typeof i.json.envioId === 'string' && typeof i.json.to === 'string' && i.json.to !== '');",
        },
      },
      {
        id: idNo(N.enviar),
        name: N.enviar,
        type: "n8n-nodes-base.emailSend",
        typeVersion: 2.1,
        position: [660, 0],
        onError: "continueErrorOutput",
        credentials: { smtp: { id: p.credencialSmtpId, name: "SMTP" } },
        parameters: {
          fromEmail: p.remetente ?? REMETENTE_PADRAO,
          toEmail: "={{ $json.to }}",
          subject: "={{ $json.subject }}",
          emailFormat: "html",
          html: "={{ $json.html }}",
          options: {
            appendAttribution: false,
            ccEmail: "={{ $json.cc }}",
          },
        },
      },
      confirmar(
        N.ok,
        `={{ JSON.stringify({ envioId: ${envioId}, ok: true }) }}`,
        900,
        -100,
      ),
      confirmar(
        N.falha,
        `={{ JSON.stringify({ envioId: ${envioId}, ok: false, erro: String($json.error?.message ?? $json.error ?? 'Falha no SMTP.').slice(0, 2000) }) }}`,
        900,
        100,
      ),
    ],
    connections: {
      [N.gatilho]: { main: [[{ node: N.buscar, type: "main", index: 0 }]] },
      [N.buscar]: { main: [[{ node: N.filtrar, type: "main", index: 0 }]] },
      [N.filtrar]: { main: [[{ node: N.enviar, type: "main", index: 0 }]] },
      [N.enviar]: {
        main: [
          [{ node: N.ok, type: "main", index: 0 }],
          [{ node: N.falha, type: "main", index: 0 }],
        ],
      },
    },
    settings: {
      executionOrder: "v1",
      timezone: "America/Sao_Paulo",
      // Execução sem e-mail a cada 15 min só enche o histórico.
      saveDataSuccessExecution: "none",
      saveDataErrorExecution: "all",
    },
  };
}

/** Id estável por nó: o PUT não troca ids a cada sincronização. */
function idNo(nome: string): string {
  let h = 0x811c9dc5;
  for (const ch of nome) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, "0");
  return `6a1a${hex}-0000-4000-8000-${hex}0000`;
}
