import {
  diasParaPrazo,
  estaAtrasada,
  hojeIso,
  STATUS_ABERTOS,
  type Status,
} from "./dominio";

/**
 * Indicadores do controle de restrições (o que hoje é feito à mão no Power BI).
 *
 * A peça central é a SITUAÇÃO: o cruzamento de status com prazo que a planilha
 * guardava numa coluna só. Aqui ela é sempre calculada, nunca digitada — é o
 * que garante que "atrasada" não dependa de alguém lembrar de trocar o status.
 *
 * Tudo neste módulo é puro: recebe as linhas e devolve números. Sem banco, sem
 * React — dá para testar cada regra isolada.
 */

export const SITUACOES = [
  "concluida_no_prazo",
  "concluida_com_atraso",
  "no_prazo",
  "atrasada",
  "cancelada",
] as const;
export type Situacao = (typeof SITUACOES)[number];

export const SITUACAO_ROTULO: Record<Situacao, string> = {
  concluida_no_prazo: "Concluída no prazo",
  concluida_com_atraso: "Concluída com atraso",
  no_prazo: "No prazo",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

/**
 * Cores das situações, derivadas da paleta da marca e validadas para
 * daltonismo (script `validate_palette.js` da skill dataviz: todas as
 * adjacências passam em protanopia, deuteranopia e tritanopia).
 *
 * O verde e o terracota avermelhado são os da marca. O azul foi clareado (o
 * `#26405d` da marca lê como cinza quando vira barra) e o âmbar foi puxado do
 * terracotta (que fica a uma distância de 4,5 do terracota avermelhado —
 * indistinguíveis lado a lado). Frio = fechado, quente = aberto.
 *
 * Verde e âmbar ficam abaixo de 3:1 de contraste, por isso toda barra leva
 * rótulo visível e existe a tabela de detalhamento: a cor nunca é o único
 * canal de informação.
 */
export const SITUACAO_COR: Record<Situacao, string> = {
  concluida_no_prazo: "#00a49a",
  concluida_com_atraso: "#2f6ea8",
  no_prazo: "#e5a72c",
  atrasada: "#b85236",
  cancelada: "#9a9793",
};

/** Ordem de empilhamento nas barras: do melhor desfecho para o pior. */
export const SITUACOES_EMPILHADAS: readonly Situacao[] = [
  "concluida_no_prazo",
  "concluida_com_atraso",
  "no_prazo",
  "atrasada",
  "cancelada",
];

export type LinhaIndicador = {
  status: Status;
  data_criacao: string;
  data_limite: string | null;
  data_conclusao: string | null;
};

/**
 * Situação de uma restrição. Concluída depende de ter estourado o prazo;
 * aberta depende de o prazo já ter vencido.
 */
export function situacaoDe(
  r: LinhaIndicador,
  hoje: string = hojeIso(),
): Situacao {
  if (r.status === "cancelada") return "cancelada";
  if (r.status === "concluida") {
    const atrasou =
      !!r.data_conclusao && !!r.data_limite && r.data_conclusao > r.data_limite;
    return atrasou ? "concluida_com_atraso" : "concluida_no_prazo";
  }
  return estaAtrasada(r, hoje) ? "atrasada" : "no_prazo";
}

export function estaConcluida(s: Situacao): boolean {
  return s === "concluida_no_prazo" || s === "concluida_com_atraso";
}

export function estaAberta(s: Situacao): boolean {
  return s === "no_prazo" || s === "atrasada";
}

/** Dias entre a criação e a conclusão. `null` enquanto não concluída. */
export function tempoResolucao(r: LinhaIndicador): number | null {
  if (!r.data_conclusao) return null;
  return diasParaPrazo(r.data_conclusao, r.data_criacao);
}

/**
 * Dias de atraso: para concluída, quanto passou do prazo; para aberta, há
 * quanto tempo está vencida. `null` quando não há atraso ou não há prazo.
 */
export function tempoAtraso(
  r: LinhaIndicador,
  hoje: string = hojeIso(),
): number | null {
  if (!r.data_limite) return null;
  const referencia =
    r.data_conclusao ?? (STATUS_ABERTOS.includes(r.status) ? hoje : null);
  if (!referencia) return null;
  const dias = diasParaPrazo(referencia, r.data_limite);
  return dias !== null && dias > 0 ? dias : null;
}

export type Resumo = {
  total: number;
  concluidas: number;
  concluidasNoPrazo: number;
  concluidasComAtraso: number;
  noPrazo: number;
  atrasadas: number;
  canceladas: number;
  abertas: number;
  /** Índice de Remoção de Restrições: concluídas sobre o total considerado. */
  irr: number;
  /** Percentual de concluídas que fecharam dentro do prazo. */
  aderenciaPrazo: number;
  /** Média de dias entre criação e conclusão (só das concluídas). */
  mediaResolucao: number | null;
  /** Média de dias de atraso das que estão atrasadas agora. */
  mediaAtrasoAbertas: number | null;
};

/**
 * Totais do topo do painel. Canceladas entram no total mas ficam fora do IRR:
 * restrição cancelada não foi removida nem está pendente.
 */
export function resumo(
  linhas: LinhaIndicador[],
  hoje: string = hojeIso(),
): Resumo {
  const contagem: Record<Situacao, number> = {
    concluida_no_prazo: 0,
    concluida_com_atraso: 0,
    no_prazo: 0,
    atrasada: 0,
    cancelada: 0,
  };
  let somaResolucao = 0;
  let comResolucao = 0;
  let somaAtraso = 0;
  let comAtraso = 0;

  for (const r of linhas) {
    const s = situacaoDe(r, hoje);
    contagem[s] += 1;
    const resolucao = tempoResolucao(r);
    if (estaConcluida(s) && resolucao !== null) {
      somaResolucao += resolucao;
      comResolucao += 1;
    }
    if (s === "atrasada") {
      const atraso = tempoAtraso(r, hoje);
      if (atraso !== null) {
        somaAtraso += atraso;
        comAtraso += 1;
      }
    }
  }

  const concluidas =
    contagem.concluida_no_prazo + contagem.concluida_com_atraso;
  const consideradas = linhas.length - contagem.cancelada;

  return {
    total: linhas.length,
    concluidas,
    concluidasNoPrazo: contagem.concluida_no_prazo,
    concluidasComAtraso: contagem.concluida_com_atraso,
    noPrazo: contagem.no_prazo,
    atrasadas: contagem.atrasada,
    canceladas: contagem.cancelada,
    abertas: contagem.no_prazo + contagem.atrasada,
    irr: consideradas > 0 ? concluidas / consideradas : 0,
    aderenciaPrazo:
      concluidas > 0 ? contagem.concluida_no_prazo / concluidas : 0,
    mediaResolucao: comResolucao > 0 ? somaResolucao / comResolucao : null,
    mediaAtrasoAbertas: comAtraso > 0 ? somaAtraso / comAtraso : null,
  };
}

export type GrupoSituacao = {
  chave: string;
  total: number;
  contagem: Record<Situacao, number>;
};

/** `(sem)` é o rótulo de linha sem valor na dimensão — some se ninguém cair nela. */
export const SEM_VALOR = "(sem informação)";

/**
 * Chave de agrupamento: sem acento, sem caixa, sem espaço sobrando. Planilha
 * de obra tem "MÉTODO", "Método" e "metodo " na mesma coluna, e três barras
 * para a mesma causa não é informação, é ruído.
 */
function chaveAgrupamento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Agrupa por uma dimensão (área, setor, responsável, causa 6M...) contando as
 * situações de cada grupo. Variações de grafia caem no mesmo grupo, que fica
 * com a forma mais usada. Ordenado do maior para o menor, com corte opcional.
 */
export function porDimensao(
  linhas: Array<LinhaIndicador & Record<string, unknown>>,
  campo: string,
  opcoes: { hoje?: string; limite?: number } = {},
): GrupoSituacao[] {
  const hoje = opcoes.hoje ?? hojeIso();
  const mapa = new Map<string, GrupoSituacao & { grafias: Map<string, number> }>();

  for (const r of linhas) {
    const bruto = r[campo];
    const rotulo =
      typeof bruto === "string" && bruto.trim().length > 0
        ? bruto.trim()
        : SEM_VALOR;
    const chave = rotulo === SEM_VALOR ? SEM_VALOR : chaveAgrupamento(rotulo);
    let grupo = mapa.get(chave);
    if (!grupo) {
      grupo = {
        chave: rotulo,
        grafias: new Map(),
        total: 0,
        contagem: {
          concluida_no_prazo: 0,
          concluida_com_atraso: 0,
          no_prazo: 0,
          atrasada: 0,
          cancelada: 0,
        },
      };
      mapa.set(chave, grupo);
    }
    grupo.grafias.set(rotulo, (grupo.grafias.get(rotulo) ?? 0) + 1);
    grupo.total += 1;
    grupo.contagem[situacaoDe(r, hoje)] += 1;
  }

  // O grupo aparece com a grafia mais usada; empate fica com a alfabética.
  for (const grupo of mapa.values()) {
    grupo.chave = [...grupo.grafias.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? grupo.chave;
  }

  // `(sem informação)` sempre por último: é ausência de dado, não uma categoria
  // que compete com as outras pelo topo da lista.
  const lista = [...mapa.values()]
    // `grafias` é andaime do agrupamento; não faz parte do resultado.
    .map((g): GrupoSituacao => ({ chave: g.chave, total: g.total, contagem: g.contagem }))
    .sort((a, b) => {
      if (a.chave === SEM_VALOR) return 1;
      if (b.chave === SEM_VALOR) return -1;
      return b.total - a.total || a.chave.localeCompare(b.chave);
    });
  return opcoes.limite ? lista.slice(0, opcoes.limite) : lista;
}

export type PontoSemana = {
  /** `2026-W14`, usado para ordenar. */
  chave: string;
  /** `S14`, curto para caber no eixo sem virar borrão. */
  rotulo: string;
  /** Mês da quinta-feira da semana (mesma regra ISO do ano), para o eixo. */
  mes: string;
  /** Concluídas com data de conclusão nessa semana. */
  concluidas: number;
  /** Previstas: prazo cai nessa semana. */
  previstas: number;
  /** Concluídas acumuladas até o fim da semana. */
  acumuladoConcluidas: number;
  /** Previstas acumuladas até o fim da semana. */
  acumuladoPrevistas: number;
};

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/** `2026-09-03` → `{ chave: '2026-W36', rotulo: 'Sem 36', mes: 'set' }`. */
export function semanaDe(
  iso: string,
): { chave: string; rotulo: string; mes: string } | null {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return null;
  const data = new Date(Date.UTC(a, m - 1, d));
  if (Number.isNaN(data.getTime())) return null;
  // Semana ISO: joga a data para a quinta-feira da mesma semana e conta.
  const dia = data.getUTCDay() || 7;
  const quinta = new Date(data);
  quinta.setUTCDate(quinta.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(quinta.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(
    ((quinta.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7,
  );
  return {
    chave: `${quinta.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`,
    rotulo: `S${String(semana).padStart(2, "0")}`,
    // A quinta-feira é o dia que define o ano ISO da semana; usar o mês dela
    // evita rotular como "ago" uma semana que é quase toda de setembro.
    mes: MESES[quinta.getUTCMonth()] ?? "",
  };
}

/**
 * Série semanal do índice de remoção: barras de concluídas contra a linha de
 * previstas. Só entram semanas em que houve alguma coisa; o intervalo é
 * contínuo entre a primeira e a última, para o eixo não mentir sobre o tempo.
 */
export function porSemana(linhas: LinhaIndicador[]): PontoSemana[] {
  const mapa = new Map<string, PontoSemana>();

  const garante = (iso: string): PontoSemana | null => {
    const s = semanaDe(iso);
    if (!s) return null;
    let ponto = mapa.get(s.chave);
    if (!ponto) {
      ponto = {
        chave: s.chave,
        rotulo: s.rotulo,
        mes: s.mes,
        concluidas: 0,
        previstas: 0,
        acumuladoConcluidas: 0,
        acumuladoPrevistas: 0,
      };
      mapa.set(s.chave, ponto);
    }
    return ponto;
  };

  for (const r of linhas) {
    if (r.data_conclusao) {
      const p = garante(r.data_conclusao);
      if (p) p.concluidas += 1;
    }
    if (r.data_limite) {
      const p = garante(r.data_limite);
      if (p) p.previstas += 1;
    }
  }

  const lista = [...mapa.values()].sort((a, b) =>
    a.chave.localeCompare(b.chave),
  );
  let acumC = 0;
  let acumP = 0;
  for (const p of lista) {
    acumC += p.concluidas;
    acumP += p.previstas;
    p.acumuladoConcluidas = acumC;
    p.acumuladoPrevistas = acumP;
  }
  return lista;
}

export type MediaResolucao = {
  chave: string;
  dias: number;
  concluidas: number;
};

/**
 * Média de dias entre criação e conclusão por dimensão (normalmente o
 * responsável). Só conta quem tem restrição concluída — média de zero
 * conclusões não significa nada.
 */
export function mediaResolucaoPor(
  linhas: Array<LinhaIndicador & Record<string, unknown>>,
  campo: string,
  opcoes: { limite?: number } = {},
): MediaResolucao[] {
  const soma = new Map<string, { dias: number; n: number }>();
  for (const r of linhas) {
    const dias = tempoResolucao(r);
    if (dias === null || r.status !== "concluida") continue;
    const bruto = r[campo];
    const chave =
      typeof bruto === "string" && bruto.trim().length > 0
        ? bruto.trim()
        : SEM_VALOR;
    const atual = soma.get(chave) ?? { dias: 0, n: 0 };
    atual.dias += dias;
    atual.n += 1;
    soma.set(chave, atual);
  }
  const lista = [...soma.entries()]
    .map(([chave, v]) => ({ chave, dias: v.dias / v.n, concluidas: v.n }))
    .sort((a, b) => b.dias - a.dias || a.chave.localeCompare(b.chave));
  return opcoes.limite ? lista.slice(0, opcoes.limite) : lista;
}

/** `0.9019` → `90,2%`. */
export function formataPercentual(v: number, casas = 1): string {
  return `${(v * 100).toFixed(casas).replace(".", ",")}%`;
}

/** `12.4567` → `12,5`. */
export function formataDecimal(v: number | null, casas = 1): string {
  if (v === null) return "—";
  return v.toFixed(casas).replace(".", ",");
}

/**
 * Teto "redondo" do eixo, o mais justo possível: `proximoTeto(272)` dá 300, não
 * 500 — meia altura vazia num gráfico é meia altura desperdiçada. Os passos
 * cobrem a década com granularidade suficiente para o topo ficar perto do
 * maior valor sem deixar a barra encostar na borda.
 */
export function tetoDoEixo(maximo: number): number {
  const v = Math.max(1, maximo);
  const ordem = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const candidato = ordem * m;
    if (candidato >= v) return candidato;
  }
  return ordem * 10;
}

export type ItemRanking = {
  /** 1 é quem mais concluiu. Empate de concluídas recebe posições distintas. */
  posicao: number;
  chave: string;
  total: number;
  concluidas: number;
  concluidasNoPrazo: number;
  concluidasComAtraso: number;
  abertas: number;
  atrasadas: number;
  /** Concluídas sobre o que coube a ele (fora canceladas). */
  irr: number;
  /** Das concluídas dele, quantas fecharam dentro do prazo. */
  aderencia: number;
};

/**
 * Ranking de quem mais CONCLUIU restrições. Reaproveita o agrupamento de
 * `porDimensao` (mesma normalização de grafia) e só reordena: aqui o critério
 * é conclusão, não volume — quem recebeu 80 e fechou 10 fica atrás de quem
 * recebeu 12 e fechou 12.
 *
 * `(sem informação)` fica de fora: ranking é de gente, e restrição sem
 * responsável não é uma pessoa que merece pódio.
 */
export function rankingConclusao(
  linhas: Array<LinhaIndicador & Record<string, unknown>>,
  campo: string,
  opcoes: { hoje?: string; limite?: number } = {},
): ItemRanking[] {
  const grupos = porDimensao(linhas, campo, { hoje: opcoes.hoje }).filter(
    (g) => g.chave !== SEM_VALOR,
  );

  const lista = grupos
    .map((g) => {
      const concluidas =
        g.contagem.concluida_no_prazo + g.contagem.concluida_com_atraso;
      const consideradas = g.total - g.contagem.cancelada;
      return {
        posicao: 0,
        chave: g.chave,
        total: g.total,
        concluidas,
        concluidasNoPrazo: g.contagem.concluida_no_prazo,
        concluidasComAtraso: g.contagem.concluida_com_atraso,
        abertas: g.contagem.no_prazo + g.contagem.atrasada,
        atrasadas: g.contagem.atrasada,
        irr: consideradas > 0 ? concluidas / consideradas : 0,
        aderencia:
          concluidas > 0 ? g.contagem.concluida_no_prazo / concluidas : 0,
      };
    })
    // Desempate: quem fechou a mesma quantidade sobe se fechou mais no prazo,
    // depois se deixou menos coisa aberta. Alfabético fecha a conta para a
    // ordem não depender da ordem de chegada das linhas.
    .sort(
      (a, b) =>
        b.concluidas - a.concluidas ||
        b.concluidasNoPrazo - a.concluidasNoPrazo ||
        a.abertas - b.abertas ||
        a.chave.localeCompare(b.chave),
    )
    .map((item, i) => ({ ...item, posicao: i + 1 }));

  return opcoes.limite ? lista.slice(0, opcoes.limite) : lista;
}
