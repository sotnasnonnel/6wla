/**
 * Agendamento das automações: dado o instante atual (UTC), o fuso, os dias da
 * semana e a hora local, qual horário deve disparar agora. Sem dependência:
 * o fuso é resolvido com Intl.DateTimeFormat (inclui horário de verão).
 */

export const FUSO_PADRAO = "America/Sao_Paulo";

/** O n8n chama a cada 15 min; 60 min cobre atrasos e uma chamada perdida. */
export const JANELA_PADRAO_MIN = 60;

export const DIAS_ROTULO_CURTO = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const;
const DIAS_ROTULO_MINUSCULO = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sáb",
] as const;

export type Agenda = {
  /** 0 = domingo … 6 = sábado. */
  dias: readonly number[];
  /** `HH:MM` ou `HH:MM:SS` (o Postgres devolve com segundos). */
  hora: string;
  fuso: string;
};

export function fusoValido(fuso: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatadores.set(fuso, f);
  }
  return f;
}

type Partes = {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
};

/** Relógio de parede do instante no fuso. */
export function partesNoFuso(instante: Date, fuso: string): Partes {
  const p: Record<string, number> = {};
  for (const { type, value } of formatador(fuso).formatToParts(instante)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return {
    ano: p.year ?? 1970,
    mes: p.month ?? 1,
    dia: p.day ?? 1,
    hora: (p.hour ?? 0) % 24,
    minuto: p.minute ?? 0,
    segundo: p.second ?? 0,
  };
}

/** Diferença (ms) entre o relógio do fuso e o UTC naquele instante. */
function deslocamento(instante: Date, fuso: string): number {
  const p = partesNoFuso(instante, fuso);
  const comoUtc = Date.UTC(
    p.ano,
    p.mes - 1,
    p.dia,
    p.hora,
    p.minuto,
    p.segundo,
  );
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/** Instante UTC de um relógio de parede no fuso. */
export function instanteDoRelogio(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  fuso: string,
): Date {
  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto);
  // Duas passadas acertam a virada de horário de verão.
  let t = alvo - deslocamento(new Date(alvo), fuso);
  t = alvo - deslocamento(new Date(t), fuso);
  return new Date(t);
}

export function lerHora(hora: string): { h: number; m: number } | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(hora);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

/** Data local (ano, mês, dia) deslocada em `delta` dias, com o dia da semana. */
function diaLocal(base: Partes, delta: number) {
  const d = new Date(Date.UTC(base.ano, base.mes - 1, base.dia + delta));
  return {
    ano: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    semana: d.getUTCDay(),
  };
}

function horarioDoDia(agora: Date, agenda: Agenda, delta: number): Date | null {
  const hm = lerHora(agenda.hora);
  if (!hm) return null;
  const d = diaLocal(partesNoFuso(agora, agenda.fuso), delta);
  if (!agenda.dias.includes(d.semana)) return null;
  return instanteDoRelogio(d.ano, d.mes, d.dia, hm.h, hm.m, agenda.fuso);
}

/**
 * Horário agendado a disparar agora: o mais recente que já chegou (≤ agora),
 * há menos de `janelaMin` minutos, e posterior ao `ultimoDisparo`. `null`
 * quando não há nada a fazer.
 */
export function horarioDevido({
  agora,
  agenda,
  ultimoDisparo,
  janelaMin = JANELA_PADRAO_MIN,
}: {
  agora: Date;
  agenda: Agenda;
  ultimoDisparo: Date | null;
  janelaMin?: number;
}): Date | null {
  if (!fusoValido(agenda.fuso)) return null;
  const candidatos = [0, -1]
    .map((delta) => horarioDoDia(agora, agenda, delta))
    .filter((h): h is Date => h !== null)
    .filter((h) => h.getTime() <= agora.getTime())
    .filter((h) => agora.getTime() - h.getTime() < janelaMin * 60_000)
    .filter((h) => !ultimoDisparo || h.getTime() > ultimoDisparo.getTime())
    .sort((a, b) => b.getTime() - a.getTime());
  return candidatos[0] ?? null;
}

/** Próximo horário estritamente depois de `agora` (para a tela). */
export function proximaExecucao(agora: Date, agenda: Agenda): Date | null {
  if (!fusoValido(agenda.fuso)) return null;
  for (let delta = 0; delta <= 7; delta++) {
    const h = horarioDoDia(agora, agenda, delta);
    if (h && h.getTime() > agora.getTime()) return h;
  }
  return null;
}

/** `[1,2,3,4,5]` → "Seg a sex"; `[1,3,5]` → "Seg, qua, sex". */
export function resumoDias(dias: readonly number[]): string {
  const unicos = [...new Set(dias)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (unicos.length === 0) return "Nenhum dia";
  if (unicos.length === 7) return "Todos os dias";
  if (unicos.join() === "0,6") return "Fins de semana";
  const consecutivo = unicos.every(
    (d, i) => i === 0 || d === (unicos[i - 1] ?? -9) + 1,
  );
  const primeiro = unicos[0] ?? 0;
  const ultimo = unicos[unicos.length - 1] ?? 0;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (consecutivo && unicos.length >= 3) {
    return `${cap(DIAS_ROTULO_MINUSCULO[primeiro] ?? "")} a ${DIAS_ROTULO_MINUSCULO[ultimo] ?? ""}`;
  }
  return cap(unicos.map((d) => DIAS_ROTULO_MINUSCULO[d] ?? "").join(", "));
}

/** `07:30:00` → `07:30`. */
export function horaCurta(hora: string): string {
  return hora.slice(0, 5);
}

/** "Sex, 18/09 às 07:30" no fuso da automação. */
export function formataInstante(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso);
  const semana = new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay();
  const dd = String(p.dia).padStart(2, "0");
  const mm = String(p.mes).padStart(2, "0");
  const hh = String(p.hora).padStart(2, "0");
  const mi = String(p.minuto).padStart(2, "0");
  return `${DIAS_ROTULO_CURTO[semana] ?? ""}, ${dd}/${mm} às ${hh}:${mi}`;
}

/** Data de hoje (aaaa-mm-dd) no fuso — "atrasada" depende do dia local. */
export function hojeNoFuso(agora: Date, fuso: string): string {
  const p = partesNoFuso(agora, fusoValido(fuso) ? fuso : FUSO_PADRAO);
  return `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}
