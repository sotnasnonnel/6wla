import type { Prioridade, Status } from "@/lib/restricoes/dominio";

type Tom = "neutro" | "azul" | "verde" | "amarelo" | "vermelho" | "roxo";

/** Cor de cada estado, compartilhada pela tabela e pelos cartões do celular. */
export const TOM_STATUS: Record<Status, Tom> = {
  pendente: "amarelo",
  em_andamento: "azul",
  concluida: "verde",
  cancelada: "neutro",
};

export const TOM_PRIORIDADE: Record<Prioridade, Tom> = {
  urgente: "vermelho",
  alta: "amarelo",
  media: "neutro",
  baixa: "neutro",
};
