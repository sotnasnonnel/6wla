"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Confirmacao } from "@/components/ui/confirmacao";
import {
  criaTarefa,
  marcaTarefa,
  removeTarefa,
  renomeiaTarefa,
} from "@/server/restricoes/tarefas";
import type { Tarefa } from "@/server/restricoes/queries";
import type { Resultado } from "@/server/auth";
import {
  Alerta,
  Botao,
  Campo,
  Etiqueta,
  TituloSecao,
} from "@/components/ui/basicos";

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
 *
 * Texto digitado (tarefa nova ou renomeada) só some depois que o servidor
 * confirma; se falhar, volta para o campo. O cabeçalho com a contagem mora
 * aqui para acompanhar a lista otimista, não a do último render do servidor.
 */
export function ChecklistRestricao({ restricaoId, tarefas }: Props) {
  const router = useRouter();
  const [lista, muda] = useOptimistic(tarefas, aplica);
  const [, inicia] = useTransition();
  const [criando, iniciaCriacao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [nova, setNova] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  const executa = (
    mudanca: Mudanca,
    acao: () => Promise<Resultado>,
    aoFalhar?: () => void,
  ) => {
    setErro(null);
    inicia(async () => {
      muda(mudanca);
      const res = await acao();
      if (!res.ok) {
        setErro(res.erro);
        aoFalhar?.();
      }
      router.refresh();
    });
  };

  const adicionar = () => {
    const texto = nova.trim();
    if (!texto || criando) return;
    setErro(null);
    iniciaCriacao(async () => {
      muda({ tipo: "cria", texto });
      const res = await criaTarefa({ restricaoId, texto });
      if (res.ok) setNova("");
      else setErro(res.erro);
      router.refresh();
    });
  };

  const salvarEdicao = (tarefa: Tarefa) => {
    setEditando(null);
    const texto = rascunho.trim();
    if (!texto || texto === tarefa.texto) return;
    executa(
      { tipo: "renomeia", id: tarefa.id, texto },
      () => renomeiaTarefa(tarefa.id, texto),
      // Reabre o campo com o que foi digitado: ninguém redigita por rede ruim.
      () => {
        setRascunho(texto);
        setEditando(tarefa.id);
      },
    );
  };

  const [aApagar, setAApagar] = useState<Tarefa | null>(null);
  const apagar = (tarefa: Tarefa) => setAApagar(tarefa);
  const confirmaApagar = () => {
    if (!aApagar) return;
    const tarefa = aApagar;
    setAApagar(null);
    executa({ tipo: "remove", id: tarefa.id }, () => removeTarefa(tarefa.id));
  };

  const feitas = lista.filter((t) => t.concluida).length;
  const pendentes = lista.length - feitas;
  const pendenteNoServidor = (t: Tarefa) => t.id.startsWith("nova-");

  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center justify-between gap-2">
        <TituloSecao>
          Checklist
          {lista.length > 0 ? (
            <span className="font-semibold tracking-normal text-[var(--tinta-fraca)] normal-case">
              ({pendentes} {pendentes === 1 ? "pendente" : "pendentes"})
            </span>
          ) : null}
        </TituloSecao>
        {lista.length > 0 ? (
          <Etiqueta tom={pendentes === 0 ? "verde" : "neutro"}>
            {feitas}/{lista.length}
          </Etiqueta>
        ) : null}
      </div>

      {erro ? <Alerta>{erro}</Alerta> : null}

      {lista.length > 0 ? (
        <div
          role="progressbar"
          aria-label="Tarefas concluídas"
          aria-valuemin={0}
          aria-valuemax={lista.length}
          aria-valuenow={feitas}
          className="h-2 overflow-hidden rounded-full bg-[var(--grade)]"
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
          <li key={t.id} className="group flex items-start gap-1 py-1">
            {/* Alvo de 40px para o dedo; o círculo continua com 20px. */}
            <label className="relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center">
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
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-full border-2 border-[var(--borda-forte)] bg-white transition checked:border-[var(--marca-verde)] checked:bg-[var(--marca-verde)] hover:border-[var(--marca-verde)] disabled:cursor-wait"
              />
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="pointer-events-none absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </label>
            <div className="min-w-0 flex-1 py-2">
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
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--tinta-apagada)] opacity-100 transition group-hover:opacity-100 hover:bg-[var(--perigo-fundo)] hover:text-[var(--perigo)] focus-visible:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0"
            >
              <svg
                aria-hidden
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
              </svg>
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
          // Só leitura (e não desabilitado) durante o envio: o foco fica no
          // campo e o texto não some antes de o servidor confirmar.
          readOnly={criando}
          aria-busy={criando}
          onChange={(e) => setNova(e.target.value)}
          placeholder="Adicionar tarefa…"
          aria-label="Nova tarefa"
        />
        <Botao
          type="submit"
          variante="secundario"
          disabled={!nova.trim() || criando}
          className="shrink-0"
        >
          {criando ? "Adicionando…" : "Adicionar"}
        </Botao>
      </form>
      <Confirmacao
        aberto={aApagar !== null}
        aoFechar={() => setAApagar(null)}
        titulo="Apagar tarefa?"
        descricao={aApagar ? `"${aApagar.texto}" sai do checklist.` : undefined}
        rotuloConfirmar="Apagar"
        tom="perigo"
        aoConfirmar={confirmaApagar}
      />
    </div>
  );
}
