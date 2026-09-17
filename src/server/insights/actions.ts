"use server";

import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import {
  erroInterno,
  exigeMembro,
  falha,
  sucesso,
  type Resultado,
} from "@/server/auth";
import { hojeIso } from "@/lib/restricoes/dominio";
import {
  dadosParaIA,
  geraInsights,
  type DadosParaIA,
} from "@/lib/restricoes/insights";
import { permite } from "@/server/limite";
import { linhasInsights } from "./queries";
import { resumeSemanaComIA, resumoIADisponivel } from "./gemini";

class FalhaIA extends Error {}

/**
 * Mesmos números, mesmo resumo: o resultado fica guardado por 6 h com a
 * chave = hash dos dados agregados. O custo passa a depender de quantas vezes
 * os dados mudam, não de quantos cliques. Como a chave é o próprio conteúdo,
 * ninguém recebe resumo de dados que não enxerga. Erro não entra no cache.
 */
function resumoGuardado(dados: DadosParaIA): Promise<string> {
  const hash = createHash("sha256").update(JSON.stringify(dados)).digest("hex");
  return unstable_cache(
    async () => {
      const ia = await resumeSemanaComIA(dados);
      if (ia === null)
        throw new FalhaIA("Resumo por IA indisponível nesta instalação.");
      if ("erro" in ia) throw new FalhaIA(ia.erro);
      return ia.texto;
    },
    ["6wla-resumo-ia", hash],
    { revalidate: 6 * 3600 },
  )();
}

/**
 * Botão "Resumir a semana com IA". Sob demanda, nunca no carregamento da
 * página: cada clique é uma chamada paga ao Gemini. Qualquer membro da obra
 * pode pedir — só lê o que ele já vê na aba.
 */
export async function resumeSemana(
  obraId: unknown,
): Promise<Resultado<{ texto: string }>> {
  const id = z.guid().safeParse(obraId);
  if (!id.success) return falha("Obra inválida");
  const { supabase, perfil } = await exigeMembro(id.data);
  if (!resumoIADisponivel())
    return falha("Resumo por IA indisponível nesta instalação.");
  if (!permite(`ia:${perfil.id}`, 10, 60 * 60_000))
    return falha("Muitos resumos pedidos na última hora. Tente mais tarde.");

  try {
    const hoje = hojeIso();
    const linhas = await linhasInsights(supabase, id.data);
    if (linhas.length === 0)
      return falha("Ainda não há restrições para resumir.");
    const dados = dadosParaIA(
      linhas,
      hoje,
      geraInsights(linhas, hoje, id.data),
    );
    return sucesso({ texto: await resumoGuardado(dados) });
  } catch (e) {
    if (e instanceof FalhaIA) return falha(e.message);
    return erroInterno("resumeSemana", e);
  }
}
