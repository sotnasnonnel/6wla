import { formataData, STATUS_ROTULO } from "@/lib/restricoes/dominio";
import {
  chaveCodigo,
  numeroDaLinha,
  reconheceStatus,
  traduzLinha,
  type LinhaPlanilha,
  type MapaColunas,
  type RestricaoImportada,
} from "./mapa";

/**
 * Plano de uma importação: o que cada linha da planilha vai virar, calculado
 * do mesmo jeito na tela de conferência e na action que grava. Puro — quem
 * chama traz do banco os códigos existentes e o que esta importação já gravou.
 */

export type ModoImportacao = "adicionar" | "atualizar";

/** Onde a linha está na planilha. `exato` falso = posição na lista (rascunho antigo). */
export type PosicaoLinha = { numero: number; exato: boolean };

export type LinhaNaoGravada = PosicaoLinha & { motivo: string };

export type PlanoImportacao = {
  novas: Array<{ posicao: PosicaoLinha; restricao: RestricaoImportada }>;
  atualizar: Array<{
    posicao: PosicaoLinha;
    id: string;
    restricao: RestricaoImportada;
  }>;
  /** Válidas, mas que não entram (código já existe, código repetido). */
  ignoradas: LinhaNaoGravada[];
  /** Inválidas: não viram restrição de jeito nenhum (ex.: sem descrição). */
  descartadas: LinhaNaoGravada[];
  /** Já gravadas numa tentativa anterior desta mesma importação. */
  jaGravadas: number;
};

/** O que esta importação já inseriu: basta para reconhecer a linha de novo. */
export type GravadaAntes = { codigo: string | null; descricao: string };

/**
 * Impressão digital de uma restrição importada. Código e descrição juntos:
 * linha sem código (o caso crítico) ainda é reconhecida pela descrição, e
 * duas linhas iguais contam duas vezes (multiconjunto), então só é pulada a
 * quantidade que de fato entrou.
 */
export function digital(codigo: string | null, descricao: string): string {
  return `${chaveCodigo(codigo) ?? ""}|${descricao.trim()}`;
}

export function planejaImportacao({
  linhas,
  mapa,
  modo,
  existentes,
  gravadas = [],
}: {
  linhas: LinhaPlanilha[];
  mapa: MapaColunas;
  modo: ModoImportacao;
  /**
   * Código normalizado → id, das restrições da obra que NÃO vieram desta
   * importação. As desta importação são tratadas por `gravadas`: se
   * entrassem aqui, a retomada as contaria como "já existiam".
   */
  existentes: ReadonlyMap<string, string>;
  gravadas?: readonly GravadaAntes[];
}): PlanoImportacao {
  const restantes = new Map<string, number>();
  for (const g of gravadas) {
    const k = digital(g.codigo, g.descricao);
    restantes.set(k, (restantes.get(k) ?? 0) + 1);
  }

  const plano: PlanoImportacao = {
    novas: [],
    atualizar: [],
    ignoradas: [],
    descartadas: [],
    jaGravadas: 0,
  };
  const novosCodigos = new Set<string>();

  linhas.forEach((linha, i) => {
    const posicao = numeroDaLinha(linha, i);
    const t = traduzLinha(linha, mapa);
    if (!t.ok) {
      plano.descartadas.push({ ...posicao, motivo: t.motivo });
      return;
    }
    const r = t.restricao;
    const chave = chaveCodigo(r.codigo);
    const jaExiste = chave ? existentes.get(chave) : undefined;

    if (jaExiste) {
      if (modo === "adicionar")
        plano.ignoradas.push({
          ...posicao,
          motivo: `código ${r.codigo ?? ""} já existe na obra`,
        });
      else plano.atualizar.push({ posicao, id: jaExiste, restricao: r });
      return;
    }
    // Código repetido dentro da própria planilha: a primeira linha manda, as
    // seguintes são ruído de planilha, não restrições diferentes.
    if (chave && novosCodigos.has(chave)) {
      plano.ignoradas.push({
        ...posicao,
        motivo: `código ${r.codigo ?? ""} repetido na planilha`,
      });
      return;
    }
    if (chave) novosCodigos.add(chave);

    const k = digital(r.codigo, r.descricao);
    const sobra = restantes.get(k) ?? 0;
    if (sobra > 0) {
      restantes.set(k, sobra - 1);
      plano.jaGravadas += 1;
      return;
    }
    plano.novas.push({ posicao, restricao: r });
  });

  return plano;
}

/** Como a linha aparece na prévia: os valores já convertidos. */
export type LinhaPrevia =
  | {
      ok: true;
      posicao: PosicaoLinha;
      descricao: string;
      responsavel: string;
      status: string;
      prazo: string;
      avisos: string[];
    }
  | { ok: false; posicao: PosicaoLinha; motivo: string };

/**
 * Prévia legível da conversão, com a MESMA `traduzLinha` usada ao gravar.
 * Os avisos apontam o que a conversão fez sem pedir: data que não foi
 * reconhecida (vira vazia) e status desconhecido (vira Pendente).
 */
export function previaDaLinha(
  linha: LinhaPlanilha,
  indice: number,
  mapa: MapaColunas,
): LinhaPrevia {
  const posicao = numeroDaLinha(linha, indice);
  const t = traduzLinha(linha, mapa);
  if (!t.ok) return { ok: false, posicao, motivo: t.motivo };
  const r = t.restricao;

  const avisos: string[] = [];
  const bruto = (coluna: string | undefined): string | null => {
    if (coluna === undefined) return null;
    const v = linha[coluna];
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length > 0 ? s : null;
  };
  const prazoBruto = bruto(mapa.data_limite);
  if (prazoBruto !== null && r.data_limite === null)
    avisos.push(`prazo “${prazoBruto}” não é uma data reconhecida`);
  const statusBruto = bruto(mapa.status);
  if (statusBruto !== null && reconheceStatus(statusBruto) === null)
    avisos.push(`status “${statusBruto}” não reconhecido, vira Pendente`);

  return {
    ok: true,
    posicao,
    descricao: r.descricao,
    responsavel: r.responsavel_nome ?? r.responsavel_email ?? "Sem responsável",
    status: STATUS_ROTULO[r.status],
    prazo: r.data_limite ? formataData(r.data_limite) : "Sem prazo",
    avisos,
  };
}

/** "linha 12" quando o número é da planilha; "item 12" quando é só a posição. */
export function rotuloPosicao(p: PosicaoLinha): string {
  return `${p.exato ? "linha" : "item"} ${p.numero}`;
}

/** Marca de "gravando agora" em `mapa_origem`, com o instante do início. */
export const GRAVANDO = "gravando:";
/** Depois disso, uma marca de gravação é de uma tentativa que morreu. */
const TRAVA_EXPIRA_MS = 10 * 60 * 1000;

export function travaVigente(
  mapaOrigem: string,
  agora: number = Date.now(),
): boolean {
  if (!mapaOrigem.startsWith(GRAVANDO)) return false;
  const inicio = Number(mapaOrigem.slice(GRAVANDO.length));
  // Marca no futuro (relógio adiantado tolerado em 1 min) não vale: senão uma
  // marca forjada travaria a importação para sempre.
  return (
    Number.isFinite(inicio) &&
    inicio <= agora + 60_000 &&
    agora - inicio < TRAVA_EXPIRA_MS
  );
}
