"use client";

import { useRef } from "react";
import { selecionaWorkspace } from "@/server/workspaces/actions";

type Item = { id: string; codigo: string; nome: string };

/**
 * Seletor de workspace no topo da barra lateral. Quem está em um só vê o nome fixo; quem está
 * em vários troca aqui (a escolha vai para cookie via Server Action).
 */
export function SeletorWorkspace({
  atualId,
  lista,
}: {
  atualId: string;
  lista: Item[];
}) {
  const ref = useRef<HTMLFormElement>(null);
  const atual = lista.find((w) => w.id === atualId);

  if (lista.length <= 1) {
    return (
      <div className="px-1" title={atual?.nome}>
        <span className="block text-[0.625rem] font-semibold tracking-[0.05em] text-[var(--tinta-apagada)] uppercase">
          Workspace
        </span>
        <span className="block truncate text-sm font-semibold text-[var(--tinta-forte)]">
          {atual?.nome ?? "—"}
        </span>
      </div>
    );
  }

  return (
    <form ref={ref} action={selecionaWorkspace}>
      <select
        name="workspaceId"
        value={atualId}
        onChange={() => ref.current?.requestSubmit()}
        aria-label="Workspace"
        className="w-full min-h-9 truncate rounded-lg border-[1.5px] border-[var(--borda)] bg-white px-2.5 py-1.5 text-sm font-semibold text-[var(--tinta-forte)] transition focus:border-[var(--marca-terracotta)] focus:shadow-[0_0_0_3px_var(--marca-anel)] focus:outline-none"
      >
        {lista.map((w) => (
          <option key={w.id} value={w.id}>
            {w.codigo} · {w.nome}
          </option>
        ))}
      </select>
    </form>
  );
}
