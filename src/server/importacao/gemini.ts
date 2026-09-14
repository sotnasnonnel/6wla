import "server-only";

import { z } from "zod";
import { serverEnv } from "@/env";
import {
  CAMPOS_IMPORTAVEIS,
  CAMPO_DESCRICAO,
  saneiaMapa,
  type LinhaPlanilha,
  type MapaColunas,
} from "@/lib/importacao/mapa";

const respostaSchema = z.object({
  mapa: z.array(
    z.object({
      campo: z.enum(CAMPOS_IMPORTAVEIS),
      coluna: z.string(),
    }),
  ),
});

const geminiSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() })),
        }),
      }),
    )
    .min(1),
});

/** Só chama a IA se houver chave configurada. */
export function iaDisponivel(): boolean {
  return serverEnv().GEMINI_API_KEY !== undefined;
}

/**
 * Pede ao Gemini o de-para entre cabeçalhos da planilha e os campos do
 * sistema. Manda só cabeçalhos + amostra de 5 linhas (sem a planilha inteira).
 * Devolve `null` quando a chave não existe ou a chamada falha — o chamador
 * cai para a detecção por apelidos.
 */
export async function sugereMapaComIA(
  cabecalhos: string[],
  linhas: LinhaPlanilha[],
): Promise<{ mapa: MapaColunas } | { erro: string } | null> {
  const { GEMINI_API_KEY, GEMINI_MODEL } = serverEnv();
  if (!GEMINI_API_KEY) return null;

  const amostra = linhas
    .slice(0, 5)
    .map((l) => Object.fromEntries(cabecalhos.map((c) => [c, resume(l[c])])));

  const campos = CAMPOS_IMPORTAVEIS.map(
    (c) => `- ${c}: ${CAMPO_DESCRICAO[c]}`,
  ).join("\n");

  const prompt = [
    "Você mapeia colunas de planilhas de controle de restrições de obras (Last Planner System, 6WLA) para os campos de um sistema.",
    "Cada campo do sistema recebe NO MÁXIMO uma coluna e cada coluna é usada no máximo uma vez.",
    'Ignore colunas calculadas (semanas derivadas, contadores, flags "considera...?", indicadores como "!" ou "Previsibilidade").',
    "Só mapeie quando tiver confiança razoável; deixe de fora o que não corresponder.",
    'Use EXATAMENTE o texto do cabeçalho como "coluna".',
    "",
    "Campos do sistema:",
    campos,
    "",
    `Cabeçalhos da planilha: ${JSON.stringify(cabecalhos)}`,
    "",
    `Amostra de linhas: ${JSON.stringify(amostra)}`,
  ].join("\n");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              mapa: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    campo: { type: "string", enum: [...CAMPOS_IMPORTAVEIS] },
                    coluna: { type: "string" },
                  },
                  required: ["campo", "coluna"],
                },
              },
            },
            required: ["mapa"],
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resposta.ok) {
      return { erro: `Gemini respondeu ${resposta.status}` };
    }
    const corpo = geminiSchema.safeParse(await resposta.json());
    if (!corpo.success) return { erro: "Resposta da IA em formato inesperado" };
    const texto = corpo.data.candidates[0]?.content.parts[0]?.text ?? "";
    const json = respostaSchema.safeParse(JSON.parse(texto));
    if (!json.success) return { erro: "A IA devolveu um mapeamento inválido" };

    const bruto: Record<string, string> = {};
    for (const { campo, coluna } of json.data.mapa) bruto[campo] = coluna;
    return { mapa: saneiaMapa(bruto, cabecalhos) };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao chamar a IA" };
  }
}

function resume(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor);
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}
