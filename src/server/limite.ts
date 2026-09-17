import "server-only";

import { headers } from "next/headers";

/**
 * Limite de frequência simples, em memória. Vale por instância do servidor
 * (em serverless, cada instância tem o seu), então é um freio contra abuso
 * óbvio, não uma garantia: a defesa de verdade do Auth é o CAPTCHA do painel.
 */
const baldes = new Map<string, number[]>();

export function permite(
  chave: string,
  maximo: number,
  janelaMs: number,
): boolean {
  const agora = Date.now();
  const recentes = (baldes.get(chave) ?? []).filter(
    (t) => agora - t < janelaMs,
  );
  if (recentes.length >= maximo) {
    baldes.set(chave, recentes);
    return false;
  }
  recentes.push(agora);
  baldes.set(chave, recentes);
  // Não deixa o mapa crescer sem fim com chaves velhas.
  if (baldes.size > 5000) {
    for (const [k, ts] of baldes) {
      if (ts.every((t) => agora - t >= janelaMs)) baldes.delete(k);
    }
  }
  return true;
}

/**
 * IP de quem chamou, como o proxy informa. X-Real-IP é gravado pelo proxy;
 * no X-Forwarded-For só o último item é confiável, porque o proxy acrescenta
 * o IP real ao fim do valor que o cliente mandou (o primeiro é forjável).
 */
export async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const lista =
    h
      .get("x-forwarded-for")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return lista.at(-1) ?? "?";
}
