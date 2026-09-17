import "server-only";

import { z } from "zod";
import type { FluxoN8n } from "@/lib/automacoes/fluxo-n8n";

/**
 * Cliente mínimo da API pública do n8n (/api/v1). Só o que a sincronização
 * de fluxos usa. A chave vem de quem chama, lida de serverEnv().
 */

export type ConexaoN8n = { url: string; chave: string };

export class ErroN8n extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroN8n";
  }
}

const fluxoSchema = z.object({ id: z.string().min(1) });

async function chama(
  c: ConexaoN8n,
  metodo: "GET" | "POST" | "PUT" | "DELETE",
  caminho: string,
  corpo?: unknown,
): Promise<unknown> {
  const url = new URL(`/api/v1${caminho}`, c.url);
  const resposta = await fetch(url, {
    method: metodo,
    headers: {
      "X-N8N-API-KEY": c.chave,
      Accept: "application/json",
      ...(corpo === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) {
    // Corpo do erro só para o log do servidor; nunca vai para a tela.
    const texto = (await resposta.text()).slice(0, 500);
    throw new ErroN8n(
      resposta.status,
      `n8n ${metodo} ${caminho}: ${resposta.status} ${texto}`,
    );
  }
  return resposta.status === 204 ? null : resposta.json();
}

export async function criaFluxo(
  c: ConexaoN8n,
  fluxo: FluxoN8n,
): Promise<string> {
  const r = fluxoSchema.parse(await chama(c, "POST", "/workflows", fluxo));
  return r.id;
}

/** `false` se o fluxo não existe mais no n8n (apagado à mão). */
export async function atualizaFluxo(
  c: ConexaoN8n,
  id: string,
  fluxo: FluxoN8n,
): Promise<boolean> {
  try {
    await chama(c, "PUT", `/workflows/${encodeURIComponent(id)}`, fluxo);
    return true;
  } catch (e) {
    if (e instanceof ErroN8n && e.status === 404) return false;
    throw e;
  }
}

export async function ligaFluxo(
  c: ConexaoN8n,
  id: string,
  ativo: boolean,
): Promise<void> {
  await chama(
    c,
    "POST",
    `/workflows/${encodeURIComponent(id)}/${ativo ? "activate" : "deactivate"}`,
  );
}

/** Apagar o que já não existe conta como sucesso. */
export async function apagaFluxo(c: ConexaoN8n, id: string): Promise<void> {
  try {
    await chama(c, "DELETE", `/workflows/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof ErroN8n && e.status === 404) return;
    throw e;
  }
}
