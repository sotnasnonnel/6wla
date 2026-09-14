import type { Evento } from "@/server/restricoes/queries";
import {
  formataDataHora,
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

/** Linha do tempo de alterações (gerada por gatilho no banco). Server Component. */
export function HistoricoRestricao({
  eventos,
  nomes,
}: {
  eventos: Evento[];
  nomes: Map<string, string>;
}) {
  if (eventos.length === 0)
    return <p className="text-sm text-[var(--tinta-fraca)]">Sem histórico.</p>;
  return (
    <ol className="space-y-2 text-sm">
      {[...eventos].reverse().map((e) => (
        <li key={e.id} className="flex gap-2">
          <span className="w-24 shrink-0 text-xs text-[var(--tinta-fraca)]">
            {formataDataHora(e.criado_em)}
          </span>
          <div className="min-w-0">
            <span className="font-medium text-[var(--tinta-media)]">
              {e.autor?.nome ?? "Sistema"}
            </span>{" "}
            {e.tipo === "criada" ? (
              <span className="text-[var(--tinta-media)]">criou a restrição</span>
            ) : e.tipo === "importada" ? (
              <span className="text-[var(--tinta-media)]">importou da planilha</span>
            ) : (
              <span className="text-[var(--tinta-media)]">
                alterou <span className="font-medium">{rotulo(e.campo)}</span>:{" "}
                <span className="text-[var(--tinta-fraca)] line-through">
                  {valor(e.campo, e.valor_anterior, nomes)}
                </span>{" "}
                →{" "}
                <span className="text-[var(--tinta-forte)]">
                  {valor(e.campo, e.valor_novo, nomes)}
                </span>
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
