import Link from "next/link";
import type { Restricao } from "@/server/restricoes/queries";
import {
  PRIORIDADE_ROTULO,
  STATUS_ROTULO,
  diasParaPrazo,
  estaAtrasada,
  formataData,
  formataNumero,
} from "@/lib/restricoes/dominio";
import { caminhoDetalhe, nomeResponsavel } from "@/lib/restricoes/filtros";
import { Etiqueta } from "@/components/ui/basicos";
import { TOM_PRIORIDADE, TOM_STATUS } from "./tons";

/**
 * A mesma lista de restrições, em cartões, para o celular.
 *
 * A tabela de 26 colunas é a ferramenta de escritório; em obra, no telefone,
 * o que se precisa saber de relance é outro conjunto pequeno: qual restrição,
 * em que estado, com quem e para quando. Editar não acontece aqui — o toque
 * abre a tela de detalhes, onde os campos têm tamanho de dedo e nenhum
 * encostão salva coisa errada.
 */
export function CartoesRestricoes({
  obraId,
  qs = "",
  restricoes,
  nomePorId,
  hoje,
}: {
  obraId: string;
  /** Recorte atual da grade, levado ao detalhe para o "voltar". */
  qs?: string;
  restricoes: Restricao[];
  nomePorId: Map<string, string>;
  hoje: string;
}) {
  if (restricoes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--borda-forte)] bg-white px-4 py-10 text-center text-sm text-[var(--tinta-fraca)]">
        Nenhuma restrição com esses filtros.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {restricoes.map((r) => {
        const atrasada = estaAtrasada(r, hoje);
        const dias = diasParaPrazo(r.data_limite, hoje);
        const responsavel = nomeResponsavel(r, nomePorId);
        return (
          <li key={r.id}>
            <Link
              href={caminhoDetalhe(obraId, r.id, qs)}
              className={`block rounded-lg border p-3 transition active:bg-[var(--marca-brand-50)] ${
                atrasada
                  ? "border-[var(--marca-brand-200)] bg-[var(--marca-brand-50)]"
                  : "border-[var(--borda)] bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-[var(--marca-terracotta)]">
                  {formataNumero(r.numero)}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <Etiqueta tom={TOM_STATUS[r.status]}>
                    {STATUS_ROTULO[r.status]}
                  </Etiqueta>
                  <Etiqueta tom={TOM_PRIORIDADE[r.prioridade]}>
                    {PRIORIDADE_ROTULO[r.prioridade]}
                  </Etiqueta>
                </span>
              </div>

              <p className="mt-1.5 line-clamp-2 text-sm font-medium text-[var(--tinta-forte)]">
                {r.descricao}
              </p>
              {r.acao ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-[var(--tinta-fraca)]">
                  {r.acao}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--tinta-media)]">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Icone caminho="M16 20v-2a4 4 0 0 0-8 0v2M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
                  <span className="truncate">
                    {responsavel ?? (
                      <span className="text-[var(--tinta-fraca)] italic">
                        sem responsável
                      </span>
                    )}
                  </span>
                </span>
                {r.data_limite ? (
                  <span
                    className={`inline-flex items-center gap-1 tabular-nums ${
                      atrasada
                        ? "font-semibold text-[var(--marca-terracotta-vermelho)]"
                        : ""
                    }`}
                  >
                    <Icone caminho="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18" />
                    {formataData(r.data_limite)}
                    {atrasada ? ` · ${Math.abs(dias ?? 0)}d atrasada` : ""}
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Icone({ caminho }: { caminho: string }) {
  return (
    <svg
      aria-hidden
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-[var(--tinta-fraca)]"
    >
      <path d={caminho} />
    </svg>
  );
}
