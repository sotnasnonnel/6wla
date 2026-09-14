"use client";

import { useRef } from "react";
import { selecionaWorkspace } from "@/server/workspaces/actions";

type Item = { id: string; codigo: string; nome: string };

/**
 * Seletor de workspace no topo. Quem está em um só vê o nome fixo; quem está
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
      <span className="rounded-md bg-[var(--marca-gelo)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--tinta-media)]">
        {atual?.codigo ?? "—"}
      </span>
    );
  }

  return (
    <form ref={ref} action={selecionaWorkspace}>
      <select
        name="workspaceId"
        value={atualId}
        onChange={() => ref.current?.requestSubmit()}
        aria-label="Workspace"
        className="rounded-md border border-[var(--borda)] bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--tinta-media)]"
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
