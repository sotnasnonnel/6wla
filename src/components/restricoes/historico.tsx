import type { Evento } from "@/server/restricoes/queries";
import {
  PRIORIDADE_ROTULO,
  STATUS_ROTULO,
} from "@/lib/restricoes/dominio";
import { CAMPO_ROTULO, type CampoImportavel } from "@/lib/importacao/mapa";

const ROTULOS: Record<string, string> = {
  ...CAMPO_ROTULO,
  responsavel_id: "Responsável (usuário)",
};

function rotulo(campo: string | null): string {
  if (!campo) return "";
  return ROTULOS[campo as CampoImportavel] ?? campo;
}

function valor(
  campo: string | null,
  v: string | null,
  nomes: Map<string, string>,
): string {
  if (v === null || v === "") return "—";
  if (campo === "status")
    return STATUS_ROTULO[v as keyof typeof STATUS_ROTULO] ?? v;
  if (campo === "prioridade")
    return PRIORIDADE_ROTULO[v as keyof typeof PRIORIDADE_ROTULO] ?? v;
  if (campo === "responsavel_id") return nomes.get(v) ?? v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
  return v.length > 80 ? `${v.slice(0, 80)}…` : v;
}

/**
 * Frase de um evento do histórico ("alterou Prazo: 10/09 → 20/09"). Os
 * eventos são gerados por gatilho no banco; a linha do tempo da restrição
 * intercala essas frases com os comentários.
 */
export function DescricaoEvento({
  evento: e,
  nomes,
}: {
  evento: Evento;
  nomes: Map<string, string>;
}) {
  if (e.tipo === "criada") return <>criou a restrição</>;
  if (e.tipo === "importada") return <>importou da planilha</>;
  return (
    <>
      alterou <span className="font-medium">{rotulo(e.campo)}</span>:{" "}
      <span className="text-[var(--tinta-fraca)] line-through">
        {valor(e.campo, e.valor_anterior, nomes)}
      </span>{" "}
      →{" "}
      <span className="text-[var(--tinta-forte)]">
        {valor(e.campo, e.valor_novo, nomes)}
      </span>
    </>
  );
}
