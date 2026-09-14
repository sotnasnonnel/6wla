"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { comenta } from "@/server/comentarios/actions";
import type { Comentario } from "@/server/restricoes/queries";
import type { Membro } from "@/server/obras/queries";
import { formataDataHora } from "@/lib/restricoes/dominio";
import { Alerta, Botao } from "@/components/ui/basicos";

type Props = {
  restricaoId: string;
  comentarios: Comentario[];
  membros: Membro[];
  meuId: string;
};

/**
 * Chat da restrição. Digite `@` para mencionar um membro da obra; cada
 * mencionado recebe notificação. Novas mensagens de outros usuários chegam
 * via Realtime (o servidor re-renderiza a lista).
 */
export function ChatRestricao({
  restricaoId,
  comentarios,
  membros,
  meuId,
}: Props) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [mencoes, setMencoes] = useState<Map<string, string>>(new Map());
  const [sugestoes, setSugestoes] = useState<{
    termo: string;
    inicio: number;
  } | null>(null);
  const [destacada, setDestacada] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [comentarios.length]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`chat:${restricaoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "restricao_comentarios",
          filter: `restricao_id=eq.${restricaoId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [restricaoId, router]);

  const nomePorId = new Map(membros.map((m) => [m.id, m.nome]));

  const aoDigitar = (valor: string, cursor: number) => {
    setTexto(valor);
    const antes = valor.slice(0, cursor);
    const m = /(?:^|\s)@([^\s@]*)$/.exec(antes);
    setSugestoes(
      m
        ? {
            termo: (m[1] ?? "").toLowerCase(),
            inicio: cursor - (m[1]?.length ?? 0) - 1,
          }
        : null,
    );
    setDestacada(0);
  };

  const escolhe = (membro: Membro) => {
    if (!sugestoes) return;
    const cursor = areaRef.current?.selectionStart ?? texto.length;
    const novo = `${texto.slice(0, sugestoes.inicio)}@${membro.nome} ${texto.slice(cursor)}`;
    setTexto(novo);
    setMencoes((m) => new Map(m).set(membro.id, membro.nome));
    setSugestoes(null);
    requestAnimationFrame(() => areaRef.current?.focus());
  };

  const candidatas = sugestoes
    ? membros
        .filter((m) => m.nome.toLowerCase().includes(sugestoes.termo))
        .slice(0, 6)
    : [];

  const enviar = () => {
    // Duas submissões concorrentes (botão + Ctrl+Enter) mandariam a mesma
    // mensagem duas vezes.
    if (pendente) return;
    const limpo = texto.trim();
    if (!limpo) return;
    // Só conta como menção quem continua citado no texto final.
    const ids = [...mencoes.entries()]
      .filter(([, nome]) => limpo.includes(`@${nome}`))
      .map(([id]) => id);
    inicia(async () => {
      const r = await comenta({ restricaoId, texto: limpo, mencoes: ids });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      setTexto("");
      setMencoes(new Map());
      router.refresh();
    });
  };

  const teclas = (ev: KeyboardEvent<HTMLTextAreaElement>) => {
    if (sugestoes && candidatas.length > 0) {
      // Setas escolhem a pessoa; Enter/Tab confirmam a que está destacada.
      // Sem isso, só a primeira da lista era alcançável sem mouse.
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        setDestacada((i) => {
          const passo = ev.key === "ArrowDown" ? 1 : -1;
          return (i + passo + candidatas.length) % candidatas.length;
        });
        return;
      }
      if (ev.key === "Enter" || ev.key === "Tab") {
        ev.preventDefault();
        const alvo = candidatas[destacada] ?? candidatas[0];
        if (alvo) escolhe(alvo);
        return;
      }
    }
    if (ev.key === "Escape") setSugestoes(null);
    if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      enviar();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-auto p-3">
        {comentarios.length === 0 ? (
          <p className="text-sm text-[var(--tinta-fraca)]">
            Nenhuma mensagem ainda. Comece a conversa abaixo.
          </p>
        ) : null}
        {comentarios.map((c) => {
          const meu = c.autor?.id === meuId;
          return (
            <div
              key={c.id}
              className={`flex ${meu ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${meu ? "bg-[#eaf0f6]" : "bg-white border border-[var(--borda)]"}`}
              >
                <div className="mb-0.5 flex items-baseline gap-2 text-xs text-[var(--tinta-fraca)]">
                  <span className="font-semibold text-[var(--tinta-media)]">
                    {c.autor?.nome ?? "Usuário removido"}
                  </span>
                  <span>{formataDataHora(c.criado_em)}</span>
                </div>
                <p className="whitespace-pre-wrap text-[var(--tinta-forte)]">
                  {destacaMencoes(c.texto, c.mencoes, nomePorId)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={fimRef} />
      </div>

      <div className="relative border-t border-[var(--borda)] bg-white p-3">
        {sugestoes && candidatas.length > 0 ? (
          <ul className="absolute bottom-full left-3 z-20 mb-1 w-64 rounded-md border border-[var(--borda)] bg-white py-1 shadow-lg">
            {candidatas.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-current={i === destacada ? true : undefined}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    escolhe(m);
                  }}
                  className={`flex w-full flex-col px-3 py-1.5 text-left hover:bg-[var(--marca-gelo)] ${i === destacada ? "bg-[var(--marca-gelo)]" : ""}`}
                >
                  <span className="text-sm text-[var(--tinta-forte)]">{m.nome}</span>
                  <span className="text-xs text-[var(--tinta-fraca)]">{m.email}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <textarea
          ref={areaRef}
          value={texto}
          rows={3}
          // Enquanto envia, o editor fica travado: sem isso, o texto digitado
          // durante a espera seria apagado junto com o que foi enviado.
          disabled={pendente}
          aria-busy={pendente}
          placeholder="Escreva uma mensagem… use @ para mencionar alguém"
          onChange={(ev) =>
            aoDigitar(ev.target.value, ev.target.selectionStart)
          }
          onKeyDown={teclas}
          className="w-full resize-none rounded-md border border-[var(--borda)] px-2.5 py-2 text-sm focus:border-[var(--marca-terracotta)] focus:outline-none"
        />
        {erro ? (
          <div className="mt-2">
            <Alerta>{erro}</Alerta>
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-[var(--tinta-fraca)]">Ctrl+Enter envia</span>
          <Botao
            onClick={enviar}
            disabled={pendente || texto.trim().length === 0}
          >
            {pendente ? "Enviando…" : "Enviar"}
          </Botao>
        </div>
      </div>
    </div>
  );
}

/** Realça `@Nome` de cada mencionado. */
function destacaMencoes(
  texto: string,
  mencoes: string[],
  nomePorId: Map<string, string>,
) {
  const nomes = mencoes
    .map((id) => nomePorId.get(id))
    .filter((n): n is string => !!n);
  if (nomes.length === 0) return texto;
  const re = new RegExp(`@(${nomes.map(escapaRegex).join("|")})`, "g");
  const partes: React.ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    const i = m.index ?? 0;
    partes.push(texto.slice(ultimo, i));
    partes.push(
      <span
        key={i}
        className="rounded bg-violet-100 px-1 font-medium text-violet-800"
      >
        {m[0]}
      </span>,
    );
    ultimo = i + m[0].length;
  }
  partes.push(texto.slice(ultimo));
  return partes;
}

function escapaRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
