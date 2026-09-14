/**
 * Vocabulário do domínio de restrições: status, prioridade e a regra de atraso.
 * Puro, sem dependência de framework, para ser usado em server e client.
 */

export const STATUS = ['pendente', 'em_andamento', 'concluida', 'cancelada'] as const;
export type Status = (typeof STATUS)[number];

export const PRIORIDADES = ['urgente', 'alta', 'media', 'baixa'] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const STATUS_ROTULO: Record<Status, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const PRIORIDADE_ROTULO: Record<Prioridade, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export const STATUS_ABERTOS: readonly Status[] = ['pendente', 'em_andamento'];

/**
 * "Atrasada" não é status, é cálculo: aberta e com prazo vencido. Assim ninguém
 * precisa lembrar de trocar o status quando a data passa — o defeito das
 * planilhas atuais.
 */
export function estaAtrasada(
  r: { status: Status; data_limite: string | null },
  hoje: string = hojeIso()
): boolean {
  if (!STATUS_ABERTOS.includes(r.status)) return false;
  if (!r.data_limite) return false;
  return r.data_limite < hoje;
}

/** Dias até o prazo (negativo = vencido). `null` sem prazo. */
export function diasParaPrazo(dataLimite: string | null, hoje: string = hojeIso()): number | null {
  if (!dataLimite) return null;
  const a = Date.UTC(...partesData(dataLimite));
  const b = Date.UTC(...partesData(hoje));
  return Math.round((a - b) / 86_400_000);
}

function partesData(iso: string): [number, number, number] {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return [ano ?? 1970, (mes ?? 1) - 1, dia ?? 1];
}

/** Data de hoje em `aaaa-mm-dd` no fuso local. */
export function hojeIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** `2026-09-03` → `03/09/2026`. Devolve string vazia para `null`. */
export function formataData(iso: string | null | undefined): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function formataDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formataNumero(numero: number): string {
  return `R-${String(numero).padStart(3, '0')}`;
}
