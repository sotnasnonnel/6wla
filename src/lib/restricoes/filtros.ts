import { z } from "zod";
import { STATUS, estaAtrasada, formataNumero, type Status } from "./dominio";

/**
 * Recorte da grade de restrições (busca, filtros e ordenação) e sua forma na
 * URL. Puro, para a grade e a página de detalhe concordarem sobre o que é "a
 * lista filtrada" — o detalhe usa isso para o anterior/próxima e para o link
 * de volta.
 */

export type FiltroStatus = "abertas" | "todas" | Status;

export type Ordem = { id: string; desc: boolean };

export type FiltrosGrade = {
  busca: string;
  status: FiltroStatus;
  /** Nome do responsável exibido, `__sem__` para "sem responsável" ou vazio. */
  resp: string;
  atrasadas: boolean;
  ordem: Ordem | null;
};

export const RESP_SEM = "__sem__";

export const ORDEM_PADRAO: Ordem = { id: "numero", desc: true };

export const FILTROS_PADRAO: FiltrosGrade = {
  busca: "",
  status: "abertas",
  resp: "",
  atrasadas: false,
  ordem: ORDEM_PADRAO,
};

const statusSchema = z.enum(["abertas", "todas", ...STATUS]);
const textoSchema = z.string().max(200);
// Só identificador de coluna: letras minúsculas e sublinhado.
const ordemSchema = z
  .string()
  .regex(/^[a-z_]{1,40}\.(asc|desc)$/)
  .transform((v): Ordem => {
    const [id = "", sentido] = v.split(".");
    return { id, desc: sentido === "desc" };
  });

type Parametros =
  URLSearchParams | Record<string, string | string[] | undefined>;

function pega(params: Parametros, chave: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(chave) ?? undefined;
  const v = params[chave];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Lê o recorte da URL. Cada parâmetro inválido cai no padrão sozinho: um
 * link velho ou editado à mão não derruba a página nem os outros filtros.
 */
export function lerFiltros(params: Parametros): FiltrosGrade {
  const busca = textoSchema.safeParse(pega(params, "q"));
  const status = statusSchema.safeParse(pega(params, "status"));
  const resp = textoSchema.safeParse(pega(params, "resp"));
  const bruto = pega(params, "ordem");
  const ordem =
    bruto === "nenhuma"
      ? null
      : (ordemSchema.safeParse(bruto).data ?? ORDEM_PADRAO);
  return {
    busca: busca.data ?? FILTROS_PADRAO.busca,
    status: status.data ?? FILTROS_PADRAO.status,
    resp: resp.data ?? FILTROS_PADRAO.resp,
    atrasadas: pega(params, "atrasadas") === "1",
    ordem,
  };
}

/** Query string (sem `?`) só com o que difere do padrão. */
export function serializaFiltros(f: FiltrosGrade): string {
  const p = new URLSearchParams();
  if (f.busca.trim()) p.set("q", f.busca.slice(0, 200));
  if (f.status !== FILTROS_PADRAO.status) p.set("status", f.status);
  if (f.resp) p.set("resp", f.resp.slice(0, 200));
  if (f.atrasadas) p.set("atrasadas", "1");
  if (!f.ordem) p.set("ordem", "nenhuma");
  else if (f.ordem.id !== ORDEM_PADRAO.id || f.ordem.desc !== ORDEM_PADRAO.desc)
    p.set("ordem", `${f.ordem.id}.${f.ordem.desc ? "desc" : "asc"}`);
  return p.toString();
}

/** Quantos filtros (fora a busca e a ordem) estão diferentes do padrão. */
export function contaFiltros(f: FiltrosGrade): number {
  return (
    (f.status !== FILTROS_PADRAO.status ? 1 : 0) +
    (f.resp ? 1 : 0) +
    (f.atrasadas ? 1 : 0)
  );
}

export function caminhoTabela(obraId: string): string {
  return `/obras/${encodeURIComponent(obraId)}/tabela`;
}

/**
 * Link de volta do detalhe para a tabela. O `volta` vem da URL, então não é
 * usado como endereço: é lido como filtros e reescrito do zero. O destino é
 * sempre a tabela da própria obra — não existe open redirect a explorar.
 */
export function caminhoVolta(
  obraId: string,
  volta: string | undefined,
): string {
  const qs = volta
    ? serializaFiltros(lerFiltros(new URLSearchParams(volta)))
    : "";
  return qs ? `${caminhoTabela(obraId)}?${qs}` : caminhoTabela(obraId);
}

/** Link da linha da grade para o detalhe, levando o recorte atual. */
export function caminhoDetalhe(
  obraId: string,
  restricaoId: string,
  qs: string,
): string {
  const base = `/obras/${encodeURIComponent(obraId)}/restricoes/${encodeURIComponent(restricaoId)}`;
  return qs ? `${base}?${new URLSearchParams({ volta: qs }).toString()}` : base;
}

/** Acrescenta um parâmetro a um caminho relativo que talvez já tenha query. */
export function comParametro(
  caminho: string,
  chave: string,
  valor: string,
): string {
  const sep = caminho.includes("?") ? "&" : "?";
  return `${caminho}${sep}${new URLSearchParams({ [chave]: valor }).toString()}`;
}

/** O mínimo de uma restrição que o filtro e a ordenação leem. */
export type LinhaFiltravel = {
  id: string;
  numero: number;
  status: Status;
  data_limite: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  descricao: string;
  acao: string | null;
  codigo: string | null;
  setor: string | null;
  area: string | null;
  atividade_impactada: string | null;
  classificacao: string | null;
  causa_6m: string | null;
};

type Contexto = { nomePorId: Map<string, string>; hoje: string };

/** Nome que a grade mostra na coluna Responsável. */
export function nomeResponsavel(
  r: Pick<LinhaFiltravel, "responsavel_id" | "responsavel_nome">,
  nomePorId: Map<string, string>,
): string | null {
  if (r.responsavel_id)
    return nomePorId.get(r.responsavel_id) ?? "Usuário indisponível";
  return r.responsavel_nome;
}

export function filtraRestricoes<T extends LinhaFiltravel>(
  linhas: readonly T[],
  f: FiltrosGrade,
  { nomePorId, hoje }: Contexto,
): T[] {
  const termo = f.busca.trim().toLowerCase();
  return linhas.filter((r) => {
    if (
      f.status === "abertas" &&
      !(r.status === "pendente" || r.status === "em_andamento")
    )
      return false;
    if (f.status !== "abertas" && f.status !== "todas" && r.status !== f.status)
      return false;
    if (f.atrasadas && !estaAtrasada(r, hoje)) return false;
    const nome = nomeResponsavel(r, nomePorId);
    if (f.resp) {
      if (f.resp === RESP_SEM ? !!nome : nome !== f.resp) return false;
    }
    if (termo) {
      const alvo = [
        r.descricao,
        r.acao,
        r.codigo,
        r.responsavel_nome,
        // O nome que aparece na tela, também para quem é usuário do sistema.
        r.responsavel_id ? nome : null,
        r.setor,
        r.area,
        r.atividade_impactada,
        r.classificacao,
        r.causa_6m,
        formataNumero(r.numero),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });
}

function valorOrdenavel(
  r: LinhaFiltravel,
  id: string,
  nomePorId: Map<string, string>,
): string | number {
  if (id === "responsavel") return nomeResponsavel(r, nomePorId) ?? "";
  const v: unknown = (r as Record<string, unknown>)[id];
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  return "";
}

const COLADOR = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

/**
 * Ordena como a grade: vazio vai para o fim nos dois sentidos, empate cai no
 * número (mais novo primeiro). Coluna desconhecida mantém a ordem por número.
 */
export function ordenaRestricoes<T extends LinhaFiltravel>(
  linhas: readonly T[],
  ordem: Ordem | null,
  nomePorId: Map<string, string>,
): T[] {
  const copia = [...linhas];
  if (!ordem) return copia;
  const sinal = ordem.desc ? -1 : 1;
  return copia.sort((a, b) => {
    const va = valorOrdenavel(a, ordem.id, nomePorId);
    const vb = valorOrdenavel(b, ordem.id, nomePorId);
    if (va === "" && vb !== "") return 1;
    if (vb === "" && va !== "") return -1;
    let c = 0;
    if (typeof va === "number" && typeof vb === "number") c = va - vb;
    else c = COLADOR.compare(String(va), String(vb));
    return c !== 0 ? c * sinal : b.numero - a.numero;
  });
}

/** Vizinhos de uma restrição na lista já filtrada e ordenada. */
export function vizinhos<T extends { id: string }>(
  lista: readonly T[],
  id: string,
): { anterior: T | null; proxima: T | null; posicao: number } {
  const i = lista.findIndex((x) => x.id === id);
  if (i < 0) return { anterior: null, proxima: null, posicao: -1 };
  return {
    anterior: lista[i - 1] ?? null,
    proxima: lista[i + 1] ?? null,
    posicao: i,
  };
}
