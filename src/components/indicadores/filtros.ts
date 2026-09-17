import { z } from "zod";
import { SITUACOES, type Situacao } from "@/lib/restricoes/indicadores";

/**
 * Filtros do painel de indicadores e a ida e volta com a URL. Na URL para o
 * recorte poder ser compartilhado e o "voltar" do navegador desfazer o último
 * clique. Puro: nada de React nem de `window` aqui.
 */

export const DIMENSOES_FILTRO = [
  "area",
  "setor",
  "responsavel",
  "causa_6m",
  "classificacao",
] as const;
export type Dimensao = (typeof DIMENSOES_FILTRO)[number];

export type Filtros = {
  semana: string;
  situacao: Situacao | "";
  dimensoes: Partial<Record<Dimensao, string>>;
  busca: string;
};

export const FILTROS_VAZIOS: Filtros = {
  semana: "",
  situacao: "",
  dimensoes: {},
  busca: "",
};

/** Nome curto de cada filtro na URL. */
const PARAMETRO: Record<Dimensao, string> = {
  area: "area",
  setor: "setor",
  responsavel: "resp",
  causa_6m: "causa",
  classificacao: "classe",
};

const texto = z.string().trim().min(1).max(200);
const semanaSchema = z.string().regex(/^\d{4}-W\d{2}$/);
const situacaoSchema = z.enum(SITUACOES);

type LeitorParametros = { get(nome: string): string | null };

/** Lê da URL; o que não passa na validação é ignorado, não quebra a tela. */
export function leFiltros(params: LeitorParametros): Filtros {
  const pega = <T>(nome: string, schema: z.ZodType<T>): T | undefined => {
    const r = schema.safeParse(params.get(nome) ?? undefined);
    return r.success ? r.data : undefined;
  };
  const dimensoes: Partial<Record<Dimensao, string>> = {};
  for (const d of DIMENSOES_FILTRO) {
    const v = pega(PARAMETRO[d], texto);
    if (v !== undefined) dimensoes[d] = v;
  }
  return {
    semana: pega("semana", semanaSchema) ?? "",
    situacao: pega("situacao", situacaoSchema) ?? "",
    dimensoes,
    busca: pega("q", texto) ?? "",
  };
}

/**
 * Filtros → query string, em ordem fixa e sem parâmetros vazios: o mesmo
 * recorte gera sempre o mesmo link. Devolve sem o `?`.
 */
export function escreveFiltros(f: Filtros): string {
  const p = new URLSearchParams();
  if (f.semana) p.set("semana", f.semana);
  if (f.situacao) p.set("situacao", f.situacao);
  for (const d of DIMENSOES_FILTRO) {
    const v = f.dimensoes[d]?.trim();
    if (v) p.set(PARAMETRO[d], v);
  }
  const busca = f.busca.trim();
  if (busca) p.set("q", busca);
  return p.toString();
}

/** Algum filtro vindo de clique (situação ou dimensão) está ativo? */
export function temRecorte(f: Filtros): boolean {
  return (
    f.situacao !== "" ||
    Object.values(f.dimensoes).some((v) => v !== undefined && v !== "")
  );
}

/** Liga/desliga o valor de uma dimensão (clicar de novo na mesma barra solta). */
export function alternaDimensao(
  f: Filtros,
  campo: Dimensao,
  chave: string,
): Filtros {
  const dimensoes = { ...f.dimensoes };
  if (dimensoes[campo] === chave) delete dimensoes[campo];
  else dimensoes[campo] = chave;
  return { ...f, dimensoes };
}

export function semDimensao(f: Filtros, campo: Dimensao): Filtros {
  const dimensoes = { ...f.dimensoes };
  delete dimensoes[campo];
  return { ...f, dimensoes };
}
