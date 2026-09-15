"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  criaTarefa,
  marcaTarefa,
  removeTarefa,
  renomeiaTarefa,
} from "@/server/restricoes/tarefas";
import type { Tarefa } from "@/server/restricoes/queries";
import type { Resultado } from "@/server/auth";
import { Alerta, Botao, Campo } from "@/components/ui/basicos";

type Props = {
  restricaoId: string;
  tarefas: Tarefa[];
};

type Mudanca =
  | { tipo: "marca"; id: string; concluida: boolean }
  | { tipo: "renomeia"; id: string; texto: string }
  | { tipo: "remove"; id: string }
  | { tipo: "cria"; texto: string };

function aplica(tarefas: Tarefa[], m: Mudanca): Tarefa[] {
  switch (m.tipo) {
    case "marca":
      return tarefas.map((t) =>
        t.id === m.id ? { ...t, concluida: m.concluida } : t,
      );
    case "renomeia":
      return tarefas.map((t) => (t.id === m.id ? { ...t, texto: m.texto } : t));
    case "remove":
      return tarefas.filter((t) => t.id !== m.id);
    case "cria":
      return [
        ...tarefas,
        {
          id: `nova-${tarefas.length}`,
          texto: m.texto,
          concluida: false,
          concluida_em: null,
          concluidor: null,
        },
      ];
  }
}

function quando(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Checklist de tarefas da restrição. Marcar é a ação mais frequente, então a
 * tela muda na hora (otimista) e o servidor confirma depois; se recusar, o
 * `router.refresh` devolve a lista ao que está no banco.
 *
 * Não mexe no status da restrição — é só o progresso de quem está resolvendo.
 */
export function ChecklistRestricao({ restricaoId, tarefas }: Props) {
  const router = useRouter();
  const [lista, muda] = useOptimistic(tarefas, aplica);
  const [, inicia] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [nova, setNova] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  const executa = (mudanca: Mudanca, acao: () => Promise<Resultado>) => {
    setErro(null);
    inicia(async () => {
      muda(mudanca);
      const res = await acao();
      if (!res.ok) setErro(res.erro);
      router.refresh();
    });
  };

  const adicionar = () => {
    const texto = nova.trim();
    if (!texto) return;
    setNova("");
    executa({ tipo: "cria", texto }, () => criaTarefa({ restricaoId, texto }));
  };

  const salvarEdicao = (tarefa: Tarefa) => {
    setEditando(null);
    const texto = rascunho.trim();
    if (!texto || texto === tarefa.texto) return;
    executa({ tipo: "renomeia", id: tarefa.id, texto }, () =>
      renomeiaTarefa(tarefa.id, texto),
    );
  };

  const apagar = (tarefa: Tarefa) => {
    if (!window.confirm(`Apagar a tarefa "${tarefa.texto}"?`)) return;
    executa({ tipo: "remove", id: tarefa.id }, () => removeTarefa(tarefa.id));
  };

  const feitas = lista.filter((t) => t.concluida).length;
  const pendenteNoServidor = (t: Tarefa) => t.id.startsWith("nova-");

  return (
    <div className="space-y-2">
      {erro ? <Alerta>{erro}</Alerta> : null}

      {lista.length > 0 ? (
        <div
          role="progressbar"
          aria-label="Tarefas concluídas"
          aria-valuemin={0}
          aria-valuemax={lista.length}
          aria-valuenow={feitas}
          className="h-1.5 overflow-hidden rounded-full bg-[var(--grade)]"
        >
          <div
            className="h-full rounded-full bg-[var(--marca-verde)] transition-[width]"
            style={{ width: `${(feitas / lista.length) * 100}%` }}
          />
        </div>
      ) : (
        <p className="py-1 text-sm text-[var(--tinta-fraca)]">
          Nenhuma tarefa. Liste o que precisa acontecer para resolver a
          restrição.
        </p>
      )}

      <ul className="divide-y divide-[var(--grade)]">
        {lista.map((t) => (
          <li key={t.id} className="group flex items-start gap-2.5 py-1.5">
            <input
              type="checkbox"
              checked={t.concluida}
              disabled={pendenteNoServidor(t)}
              onChange={(e) =>
                executa(
                  { tipo: "marca", id: t.id, concluida: e.target.checked },
                  () => marcaTarefa(t.id, e.target.checked),
                )
              }
              aria-label={`Concluída: ${t.texto}`}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--marca-verde)] disabled:cursor-wait"
            />
            <div className="min-w-0 flex-1">
              {editando === t.id ? (
                <Campo
                  ref={(el) => el?.focus()}
                  value={rascunho}
                  maxLength={500}
                  onChange={(e) => setRascunho(e.target.value)}
                  onBlur={() => salvarEdicao(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setEditando(null);
                  }}
                  aria-label="Texto da tarefa"
                  className="py-1 sm:py-0.5"
                />
              ) : (
                <button
                  type="button"
                  disabled={pendenteNoServidor(t)}
                  onClick={() => {
                    setRascunho(t.texto);
                    setEditando(t.id);
                  }}
                  title="Clique para editar"
                  className={`block w-full rounded px-1 text-left text-sm break-words transition hover:bg-[var(--marca-gelo)] ${
                    t.concluida
                      ? "text-[var(--tinta-fraca)] line-through"
                      : "text-[var(--tinta-forte)]"
                  }`}
                >
                  {t.texto}
                </button>
              )}
              {t.concluida && t.concluida_em ? (
                <span className="block px-1 text-[11px] text-[var(--tinta-fraca)]">
                  {t.concluidor?.nome ?? "usuário removido"} ·{" "}
                  {quando(t.concluida_em)}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => apagar(t)}
              disabled={pendenteNoServidor(t)}
              aria-label={`Apagar tarefa: ${t.texto}`}
              title="Apagar tarefa"
              className="shrink-0 rounded px-2 py-0.5 text-xs text-[var(--tinta-fraca)] opacity-100 transition group-hover:opacity-100 hover:bg-[var(--perigo-fundo)] hover:text-[var(--marca-terracotta-vermelho)] focus-visible:opacity-100 sm:opacity-0"
            >
              Apagar
            </button>
          </li>
        ))}
      </ul>

      <form
        className="flex gap-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          adicionar();
        }}
      >
        <Campo
          value={nova}
          maxLength={500}
          onChange={(e) => setNova(e.target.value)}
          placeholder="Adicionar tarefa…"
          aria-label="Nova tarefa"
        />
        <Botao
          type="submit"
          variante="secundario"
          disabled={!nova.trim()}
          className="shrink-0"
        >
          Adicionar
        </Botao>
      </form>
    </div>
  );
}
