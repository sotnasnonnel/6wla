import { diasParaPrazo, estaAtrasada, STATUS_ABERTOS } from "./dominio";
import {
  caminhoTabela,
  FILTROS_PADRAO,
  RESP_SEM,
  serializaFiltros,
  type FiltrosGrade,
} from "./filtros";
import {
  formataDecimal,
  formataPercentual,
  porDimensao,
  resumo,
  SEM_VALOR,
  situacaoDe,
  tempoAtraso,
  type LinhaIndicador,
} from "./indicadores";

/**
 * Insights da obra: regras objetivas sobre as restrições, cada uma com o
 * número que a disparou e as restrições envolvidas. Nada de opinião aqui — o
 * que a IA escreve é só um resumo por cima destes números.
 *
 * Puro como `indicadores.ts`: recebe as linhas e o "hoje" e devolve a lista.
 * As fórmulas de situação, IRR e atraso são as de lá, não cópias.
 */

export type LinhaInsight = LinhaIndicador & {
  id: string;
  numero: number;
  /** Nome exibido: usuário do sistema ou o texto que veio da planilha. */
  responsavel: string | null;
  area: string | null;
  setor: string | null;
  causa_6m: string | null;
  /** Timestamp da última alteração da linha. */
  atualizado_em: string;
  reprogramacoes: number;
};

export const SEVERIDADES = ["alta", "media", "informativa"] as const;
export type Severidade = (typeof SEVERIDADES)[number];

export const SEVERIDADE_ROTULO: Record<Severidade, string> = {
  alta: "Alta",
  media: "Média",
  informativa: "Informativa",
};

export type RestricaoCitada = { id: string; numero: number };

/** Subgrupo de um insight (um responsável, uma causa), com link próprio. */
export type DetalheInsight = {
  rotulo: string;
  quantidade: number;
  link: string | null;
};

export type Insight = {
  id: string;
  severidade: Severidade;
  titulo: string;
  /** O número em destaque no cartão. */
  valor: string;
  frase: string;
  restricoes: RestricaoCitada[];
  /**
   * Tabela já filtrada com exatamente estas restrições. `null` quando os
   * filtros da tabela não conseguem expressar o recorte — aí a tela lista os
   * links para o detalhe de cada uma.
   */
  link: string | null;
  detalhes: DetalheInsight[];
};

/** Janela da semana, dias sem atualização e demais cortes das regras. */
export const JANELA_DIAS = 7;
export const DIAS_PARADA = 14;
export const MIN_REPROGRAMACOES = 2;
export const MIN_ATRASADAS_RESPONSAVEL = 2;
export const TOP_RESPONSAVEIS = 3;
export const PARCELA_CONCENTRACAO = 0.3;
export const MIN_CONCENTRACAO = 3;
/** Queda do IRR semanal (em pontos) que já merece atenção. */
export const QUEDA_IRR_RELEVANTE = 0.1;

const ORDEM_SEVERIDADE: Record<Severidade, number> = {
  alta: 0,
  media: 1,
  informativa: 2,
};

/** `2026-09-03` + 7 → `2026-09-10`. Aritmética em UTC para não pular dia. */
export function somaDias(iso: string, dias: number): string {
  const [a = 1970, m = 1, d = 1] = iso.slice(0, 10).split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d + dias));
  return data.toISOString().slice(0, 10);
}

/** Segunda-feira da semana ISO da data. */
export function segundaDaSemana(iso: string): string {
  const [a = 1970, m = 1, d = 1] = iso.slice(0, 10).split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay() || 7;
  return somaDias(iso, 1 - dia);
}

const aberta = (r: LinhaInsight) => STATUS_ABERTOS.includes(r.status);

const semResponsavel = (r: LinhaInsight) => !r.responsavel?.trim();

function cita(linhas: readonly LinhaInsight[]): RestricaoCitada[] {
  return linhas
    .map((r) => ({ id: r.id, numero: r.numero }))
    .sort((a, b) => a.numero - b.numero);
}

function linkTabela(obraId: string, filtros: Partial<FiltrosGrade>): string {
  const qs = serializaFiltros({ ...FILTROS_PADRAO, ...filtros });
  return qs ? `${caminhoTabela(obraId)}?${qs}` : caminhoTabela(obraId);
}

/** "1 restrição" / "3 restrições". */
export function plural(
  n: number,
  singular: string,
  pluralTexto: string,
): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/**
 * Estava atrasada numa data passada? Reconstrói o estado a partir das datas:
 * já existia, não tinha sido concluída até ali e o prazo já tinha vencido.
 * Cancelada fica de fora — não se sabe quando foi cancelada.
 */
function atrasadaEm(r: LinhaInsight, data: string): boolean {
  if (r.status === "cancelada") return false;
  if (r.data_criacao > data) return false;
  if (r.data_conclusao && r.data_conclusao <= data) return false;
  if (r.status === "concluida" && !r.data_conclusao) return false;
  return !!r.data_limite && r.data_limite < data;
}

/** Mesma normalização de grafia do agrupamento dos indicadores. */
function normaliza(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function regraAtrasadas(
  linhas: readonly LinhaInsight[],
  hoje: string,
  obraId: string,
): Insight | null {
  const atrasadas = linhas.filter((r) => situacaoDe(r, hoje) === "atrasada");
  if (atrasadas.length === 0) return null;
  const inicio = somaDias(hoje, -JANELA_DIAS);
  const antes = linhas.filter((r) => atrasadaEm(r, inicio)).length;
  // Passou a atrasar na janela: o prazo venceu entre uma semana atrás e ontem.
  const novas = atrasadas.filter(
    (r) => r.data_limite !== null && r.data_limite >= inicio,
  ).length;
  const variacao = atrasadas.length - antes;
  const sinal = variacao > 0 ? `+${variacao}` : String(variacao);
  return {
    id: "atrasadas",
    severidade: "alta",
    titulo: "Restrições atrasadas",
    valor: String(atrasadas.length),
    frase:
      `${plural(atrasadas.length, "restrição em aberto está", "restrições em aberto estão")} com o prazo vencido ` +
      `(${sinal} em relação a 7 dias atrás, quando eram ${antes}). ` +
      (novas > 0
        ? `${plural(novas, "passou", "passaram")} a atrasar nesta semana.`
        : "Nenhuma passou a atrasar nesta semana."),
    restricoes: cita(atrasadas),
    link: linkTabela(obraId, { atrasadas: true }),
    detalhes: [],
  };
}

function regraVencemEmBreve(
  linhas: readonly LinhaInsight[],
  hoje: string,
): Insight | null {
  const limite = somaDias(hoje, JANELA_DIAS);
  const lista = linhas.filter(
    (r) =>
      aberta(r) &&
      r.data_limite !== null &&
      r.data_limite >= hoje &&
      r.data_limite <= limite,
  );
  if (lista.length === 0) return null;
  const hojeMesmo = lista.filter((r) => r.data_limite === hoje).length;
  return {
    id: "vencem-7-dias",
    severidade: "media",
    titulo: "Prazos nos próximos 7 dias",
    valor: String(lista.length),
    frase:
      `${plural(lista.length, "restrição em aberto vence", "restrições em aberto vencem")} até ${limite.split("-").reverse().join("/")}` +
      (hojeMesmo > 0 ? `, ${hojeMesmo} delas hoje.` : "."),
    restricoes: cita(lista),
    link: null,
    detalhes: [],
  };
}

function regraReprogramadas(linhas: readonly LinhaInsight[]): Insight | null {
  const lista = linhas.filter(
    (r) => aberta(r) && r.reprogramacoes >= MIN_REPROGRAMACOES,
  );
  if (lista.length === 0) return null;
  const maximo = Math.max(...lista.map((r) => r.reprogramacoes));
  return {
    id: "reprogramadas",
    severidade: "media",
    titulo: "Reprogramadas várias vezes",
    valor: String(lista.length),
    frase: `${plural(lista.length, "restrição em aberto já teve", "restrições em aberto já tiveram")} o prazo reprogramado ${MIN_REPROGRAMACOES} vezes ou mais (a mais adiada, ${maximo} vezes).`,
    restricoes: cita(lista),
    link: null,
    detalhes: [],
  };
}

function regraSemResponsavel(
  linhas: readonly LinhaInsight[],
  obraId: string,
): Insight | null {
  const lista = linhas.filter((r) => aberta(r) && semResponsavel(r));
  if (lista.length === 0) return null;
  return {
    id: "sem-responsavel",
    severidade: "media",
    titulo: "Sem responsável",
    valor: String(lista.length),
    frase: `${plural(lista.length, "restrição em aberto não tem", "restrições em aberto não têm")} responsável definido — sem dono, ninguém remove.`,
    restricoes: cita(lista),
    link: linkTabela(obraId, { resp: RESP_SEM }),
    detalhes: [],
  };
}

function regraParadas(
  linhas: readonly LinhaInsight[],
  hoje: string,
): Insight | null {
  const lista = linhas.filter((r) => {
    if (!aberta(r)) return false;
    const dias = diasParaPrazo(hoje, r.atualizado_em.slice(0, 10));
    return dias !== null && dias >= DIAS_PARADA;
  });
  if (lista.length === 0) return null;
  return {
    id: "paradas",
    severidade: "media",
    titulo: "Paradas",
    valor: String(lista.length),
    frase: `${plural(lista.length, "restrição em aberto está", "restrições em aberto estão")} sem nenhuma atualização há ${DIAS_PARADA} dias ou mais.`,
    restricoes: cita(lista),
    link: null,
    detalhes: [],
  };
}

function regraResponsaveis(
  linhas: readonly LinhaInsight[],
  hoje: string,
  obraId: string,
): Insight | null {
  const grupos = new Map<string, LinhaInsight[]>();
  for (const r of linhas) {
    const nome = r.responsavel?.trim();
    if (!nome || !estaAtrasada(r, hoje)) continue;
    grupos.set(nome, [...(grupos.get(nome) ?? []), r]);
  }
  const top = [...grupos.entries()]
    .filter(([, lista]) => lista.length >= MIN_ATRASADAS_RESPONSAVEL)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, TOP_RESPONSAVEIS);
  if (top.length === 0) return null;
  const envolvidas = top.flatMap(([, lista]) => lista);
  const nomes = top.map(([nome, lista]) => `${nome} (${lista.length})`);
  return {
    id: "responsaveis-atrasadas",
    severidade: "media",
    titulo: "Responsáveis com mais atrasadas",
    valor: String(envolvidas.length),
    frase: `${plural(envolvidas.length, "atrasada está", "atrasadas estão")} com ${nomes.join(", ")}.`,
    restricoes: cita(envolvidas),
    link: null,
    detalhes: top.map(([nome, lista]) => ({
      rotulo: nome,
      quantidade: lista.length,
      link: linkTabela(obraId, { resp: nome, atrasadas: true }),
    })),
  };
}

function regraConcentracao(
  linhas: readonly LinhaInsight[],
  hoje: string,
  campo: "causa_6m" | "area",
): Insight | null {
  const atrasadas = linhas.filter((r) => situacaoDe(r, hoje) === "atrasada");
  if (atrasadas.length < MIN_CONCENTRACAO) return null;
  const grupos = porDimensao(atrasadas, campo, { hoje }).filter(
    (g) =>
      g.chave !== SEM_VALOR &&
      g.total >= MIN_CONCENTRACAO &&
      g.total / atrasadas.length >= PARCELA_CONCENTRACAO,
  );
  const maior = grupos[0];
  if (!maior) return null;
  const chave = normaliza(maior.chave);
  const envolvidas = atrasadas.filter(
    (r) => normaliza(r[campo] ?? "") === chave,
  );
  const parcela = formataPercentual(maior.total / atrasadas.length, 0);
  const nomeCampo = campo === "area" ? "área" : "causa 6M";
  return {
    id: `concentracao-${campo}`,
    severidade: "media",
    titulo:
      campo === "area"
        ? "Atrasos concentrados numa área"
        : "Causa 6M dominante",
    valor: parcela,
    frase: `${plural(maior.total, "atrasada é", "atrasadas são")} da ${nomeCampo} "${maior.chave}" — ${parcela} das ${atrasadas.length} atrasadas da obra.`,
    restricoes: cita(envolvidas),
    link: null,
    detalhes: [],
  };
}

/**
 * IRR de uma semana (segunda a domingo): das restrições com prazo na semana,
 * quantas estavam concluídas no fim dela. Usa o `resumo` dos indicadores,
 * com o que foi concluído depois tratado como ainda pendente naquela data.
 */
export function irrDaSemana(
  linhas: readonly LinhaInsight[],
  segunda: string,
): { irr: number; previstas: number } | null {
  const domingo = somaDias(segunda, 6);
  const naSemana = linhas
    .filter(
      (r) =>
        r.status !== "cancelada" &&
        r.data_limite !== null &&
        r.data_limite >= segunda &&
        r.data_limite <= domingo,
    )
    .map((r): LinhaIndicador =>
      r.status === "concluida" &&
      (!r.data_conclusao || r.data_conclusao > domingo)
        ? { ...r, status: "pendente", data_conclusao: null }
        : r,
    );
  if (naSemana.length === 0) return null;
  return { irr: resumo(naSemana, domingo).irr, previstas: naSemana.length };
}

function regraIrrSemanal(
  linhas: readonly LinhaInsight[],
  hoje: string,
): Insight | null {
  const segundaAtual = segundaDaSemana(hoje);
  const ultima = somaDias(segundaAtual, -7);
  const atual = irrDaSemana(linhas, ultima);
  if (!atual) return null;
  const anteriores = [1, 2, 3, 4]
    .map((n) => irrDaSemana(linhas, somaDias(ultima, -7 * n)))
    .filter((s) => s !== null);
  if (anteriores.length === 0) return null;
  const media =
    anteriores.reduce((soma, s) => soma + s.irr, 0) / anteriores.length;
  const diferenca = atual.irr - media;
  const pontos = formataDecimal(Math.abs(diferenca) * 100, 0);
  const comparacao =
    Math.abs(diferenca) < 0.005
      ? "igual à"
      : diferenca > 0
        ? `${pontos} p.p. acima da`
        : `${pontos} p.p. abaixo da`;
  return {
    id: "irr-semanal",
    severidade: diferenca <= -QUEDA_IRR_RELEVANTE ? "alta" : "informativa",
    titulo: "IRR da última semana",
    valor: formataPercentual(atual.irr, 0),
    frase: `Das ${plural(atual.previstas, "restrição prevista", "restrições previstas")} para a semana passada, ${formataPercentual(atual.irr, 0)} foram removidas — ${comparacao} média das ${plural(anteriores.length, "semana anterior", "semanas anteriores")} (${formataPercentual(media, 0)}).`,
    restricoes: [],
    link: null,
    detalhes: [],
  };
}

function regraConcluidasComAtraso(
  linhas: readonly LinhaInsight[],
  hoje: string,
): Insight | null {
  const inicio = somaDias(hoje, -JANELA_DIAS);
  const lista = linhas.filter(
    (r) =>
      r.data_conclusao !== null &&
      r.data_conclusao > inicio &&
      r.data_conclusao <= hoje &&
      situacaoDe(r, hoje) === "concluida_com_atraso",
  );
  if (lista.length === 0) return null;
  const atrasos = lista
    .map((r) => tempoAtraso(r, hoje))
    .filter((d) => d !== null);
  const media =
    atrasos.length > 0
      ? atrasos.reduce((a, b) => a + b, 0) / atrasos.length
      : null;
  return {
    id: "concluidas-com-atraso",
    severidade: "informativa",
    titulo: "Concluídas com atraso na semana",
    valor: String(lista.length),
    frase:
      `${plural(lista.length, "restrição foi concluída", "restrições foram concluídas")} nos últimos 7 dias depois do prazo` +
      (media !== null
        ? `, em média ${formataDecimal(media)} dias além. Vale entender o que segurou.`
        : "."),
    restricoes: cita(lista),
    link: null,
    detalhes: [],
  };
}

/** Todas as regras, das mais graves para as informativas. */
export function geraInsights(
  linhas: readonly LinhaInsight[],
  hoje: string,
  obraId: string,
): Insight[] {
  const lista = [
    regraAtrasadas(linhas, hoje, obraId),
    regraIrrSemanal(linhas, hoje),
    regraVencemEmBreve(linhas, hoje),
    regraResponsaveis(linhas, hoje, obraId),
    regraConcentracao(linhas, hoje, "causa_6m"),
    regraConcentracao(linhas, hoje, "area"),
    regraReprogramadas(linhas),
    regraSemResponsavel(linhas, obraId),
    regraParadas(linhas, hoje),
    regraConcluidasComAtraso(linhas, hoje),
  ].filter((i) => i !== null);
  // `sort` é estável: dentro da mesma severidade vale a ordem acima.
  return lista.sort(
    (a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade],
  );
}

export type DadosParaIA = {
  dataReferencia: string;
  totais: {
    restricoes: number;
    abertas: number;
    atrasadas: number;
    concluidas: number;
    canceladas: number;
    irrGeral: string;
  };
  ultimos7Dias: {
    criadas: number;
    concluidas: number;
    passaramAAtrasar: number;
  };
  atrasadasPorArea: Array<{ rotulo: string; quantidade: number }>;
  atrasadasPorSetor: Array<{ rotulo: string; quantidade: number }>;
  atrasadasPorCausa6M: Array<{ rotulo: string; quantidade: number }>;
  atrasadasPorResponsavel: Array<{ rotulo: string; quantidade: number }>;
  alertas: Array<{
    severidade: Severidade;
    titulo: string;
    valor: string;
    frase: string;
  }>;
};

/**
 * O que vai para a IA: só contagens, percentuais e rótulos de categoria
 * (área, setor, causa, responsável). Descrição, ação e observações das
 * restrições nunca saem daqui — as frases dos alertas também só carregam
 * números e rótulos.
 */
/**
 * Rótulos (área, setor, causa, responsável) são texto livre digitado ou
 * importado e vão para a IA: sem aspas, barras e caracteres de controle, e
 * curtos, para não carregarem instruções.
 */
export function rotuloSeguro(s: string): string {
  return s
    .replace(/[\p{Cc}"\\`]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function dadosParaIA(
  linhas: readonly LinhaInsight[],
  hoje: string,
  insights: readonly Insight[],
): DadosParaIA {
  const r = resumo([...linhas], hoje);
  const inicio = somaDias(hoje, -JANELA_DIAS);
  const atrasadas = linhas.filter((l) => situacaoDe(l, hoje) === "atrasada");
  const top = (campo: "area" | "setor" | "causa_6m" | "responsavel") =>
    porDimensao(atrasadas, campo, { hoje, limite: 5 }).map((g) => ({
      rotulo: rotuloSeguro(g.chave),
      quantidade: g.total,
    }));
  return {
    dataReferencia: hoje,
    totais: {
      restricoes: r.total,
      abertas: r.abertas,
      atrasadas: r.atrasadas,
      concluidas: r.concluidas,
      canceladas: r.canceladas,
      irrGeral: formataPercentual(r.irr),
    },
    ultimos7Dias: {
      criadas: linhas.filter(
        (l) => l.data_criacao > inicio && l.data_criacao <= hoje,
      ).length,
      concluidas: linhas.filter(
        (l) =>
          l.status === "concluida" &&
          l.data_conclusao !== null &&
          l.data_conclusao > inicio &&
          l.data_conclusao <= hoje,
      ).length,
      passaramAAtrasar: atrasadas.filter(
        (l) => l.data_limite !== null && l.data_limite >= inicio,
      ).length,
    },
    atrasadasPorArea: top("area"),
    atrasadasPorSetor: top("setor"),
    atrasadasPorCausa6M: top("causa_6m"),
    atrasadasPorResponsavel: top("responsavel"),
    alertas: insights.map((i) => ({
      severidade: i.severidade,
      titulo: i.titulo,
      valor: i.valor,
      frase: i.frase,
    })),
  };
}
