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
import type { Comentario, Evento } from "@/server/restricoes/queries";
import type { Membro } from "@/server/obras/queries";
import { formataDataHora } from "@/lib/restricoes/dominio";
import { Alerta, Botao } from "@/components/ui/basicos";
import { DescricaoEvento } from "./historico";

type Props = {
  restricaoId: string;
  comentarios: Comentario[];
  eventos: Evento[];
  membros: Membro[];
  meuId: string;
};

type Item =
  | { tipo: "comentario"; em: string; comentario: Comentario }
  | { tipo: "evento"; em: string; evento: Evento };

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Linha do tempo da restrição: comentários e alterações em ordem
 * cronológica. Comentário é balão de conversa (os meus à direita);
 * alteração é uma linha discreta centralizada, como aviso de sistema. O filtro
 * "Só comentários" esconde as alterações para ler a conversa.
 *
 * Digite `@` para mencionar um membro da obra; cada mencionado recebe
 * notificação. Mensagens e alterações de outras pessoas chegam via Realtime
 * (o servidor re-renderiza a lista).
 */
export function ChatRestricao({
  restricaoId,
  comentarios,
  eventos,
  membros,
  meuId,
}: Props) {
  const [soComentarios, setSoComentarios] = useState(false);
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
  const listaRef = useRef<HTMLOListElement>(null);

  const itens: Item[] = [
    ...comentarios.map((c): Item => ({
      tipo: "comentario",
      em: c.criado_em,
      comentario: c,
    })),
    ...(soComentarios
      ? []
      : eventos.map((e): Item => ({
          tipo: "evento",
          em: e.criado_em,
          evento: e,
        }))),
  ].sort((a, b) => a.em.localeCompare(b.em));

  // Quem está lendo mensagens antigas não é arrastado para o fim quando chega
  // uma nova: aparece o botão "Novas mensagens". Ao abrir, ou quando a
  // mensagem nova é minha, desce direto.
  const noFim = useRef(true);
  const [novas, setNovas] = useState(false);
  const ultimo = itens[itens.length - 1];
  const ultimoEhMeu =
    ultimo?.tipo === "comentario" && ultimo.comentario.autor?.id === meuId;

  const desce = () => {
    const lista = listaRef.current;
    // Rola só o painel, não a página: `scrollIntoView` arrastaria a janela
    // inteira até o fim da linha do tempo ao abrir a restrição.
    if (lista) lista.scrollTop = lista.scrollHeight;
    noFim.current = true;
    setNovas(false);
  };

  // Conta o que chegou, não o que está visível: trocar o filtro "Só
  // comentários" não é mensagem nova.
  const total = comentarios.length + eventos.length;
  useEffect(() => {
    if (noFim.current || ultimoEhMeu) desce();
    else setNovas(true);
  }, [total, ultimoEhMeu]);

  const aoRolar = () => {
    const lista = listaRef.current;
    if (!lista) return;
    noFim.current =
      lista.scrollHeight - lista.scrollTop - lista.clientHeight < 48;
    if (noFim.current) setNovas(false);
  };

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`chat:${restricaoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "6wla_restricao_comentarios",
          filter: `restricao_id=eq.${restricaoId}`,
        },
        () => router.refresh(),
      )
      // Alteração na restrição gera evento no histórico: atualiza a linha do
      // tempo também (a tabela de eventos não está na publication).
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "6wla_restricoes",
          filter: `id=eq.${restricaoId}`,
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
      // O campo nunca perdeu o foco (só leitura), mas garante para quem
      // enviou pelo botão: a próxima mensagem já pode ser digitada.
      areaRef.current?.focus();
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
      <div className="flex items-center justify-between gap-2 border-b border-[var(--grade)] px-5 py-3">
        <h2 className="text-[0.78rem] font-bold tracking-[0.05em] text-[var(--marca-azul)] uppercase">
          Atividades
        </h2>
        <div
          role="group"
          aria-label="Filtro da linha do tempo"
          className="flex rounded-lg bg-[#edf2f7] p-1 text-xs font-semibold"
        >
          {[
            { valor: false, rotulo: "Tudo" },
            { valor: true, rotulo: "Só comentários" },
          ].map((f) => (
            <button
              key={f.rotulo}
              type="button"
              aria-pressed={soComentarios === f.valor}
              onClick={() => setSoComentarios(f.valor)}
              className={`rounded-md px-2.5 py-1 transition ${
                soComentarios === f.valor
                  ? "bg-white text-[var(--tinta-forte)] shadow-[var(--sombra-sm)]"
                  : "text-[var(--tinta-fraca)] hover:text-[var(--tinta-forte)]"
              }`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <ol
          ref={listaRef}
          onScroll={aoRolar}
          aria-label="Linha do tempo"
          className="rolagem-fina flex-1 overflow-auto bg-[#fafbfc] px-4 pt-1 pb-4"
        >
          {itens.length === 0 ? (
            <li className="mt-3 rounded-xl border border-dashed border-[var(--borda-forte)] px-4 py-6 text-center text-sm text-[var(--tinta-fraca)]">
              Nenhuma atividade ainda. Escreva abaixo para começar a conversa.
            </li>
          ) : null}
          {itens.map((item, i) => {
            if (item.tipo === "evento") {
              const e = item.evento;
              return (
                <li key={`e-${e.id}`} className="flex justify-center py-1">
                  <p className="max-w-[92%] rounded-lg bg-[var(--marca-gelo)] px-3 py-1 text-center text-xs leading-5 text-[var(--tinta-fraca)]">
                    <span className="font-semibold text-[var(--tinta-media)]">
                      {e.autor?.nome ?? "Sistema"}
                    </span>{" "}
                    <DescricaoEvento evento={e} nomes={nomePorId} />
                    <span className="ml-1.5 whitespace-nowrap text-[var(--tinta-fraca)]">
                      {formataDataHora(e.criado_em)}
                    </span>
                  </p>
                </li>
              );
            }
            const c = item.comentario;
            const meu = c.autor?.id === meuId;
            const nome = c.autor?.nome ?? "Usuário removido";
            // Mensagens seguidas da mesma pessoa não repetem avatar e nome.
            const anterior = itens[i - 1];
            const emSequencia =
              anterior?.tipo === "comentario" &&
              anterior.comentario.autor?.id === c.autor?.id;
            return (
              <li
                key={`c-${c.id}`}
                className={`flex items-end gap-2 ${meu ? "flex-row-reverse" : ""} ${emSequencia ? "pt-1" : "pt-3"}`}
              >
                {meu ? null : (
                  <span
                    aria-hidden
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--marca-azul)] text-[10px] font-bold text-white ${emSequencia ? "invisible" : ""}`}
                  >
                    {iniciais(nome)}
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${
                    meu
                      ? "rounded-br-md bg-[#eff6ff]"
                      : "rounded-bl-md border border-[var(--borda)] bg-white shadow-[var(--sombra-sm)]"
                  }`}
                >
                  <div
                    className={`mb-0.5 flex flex-wrap items-baseline gap-x-2 text-xs ${meu ? "justify-end" : ""}`}
                  >
                    {meu || emSequencia ? null : (
                      <span className="font-semibold text-[var(--tinta-forte)]">
                        {nome}
                      </span>
                    )}
                    <span className="text-[var(--tinta-fraca)]">
                      {formataDataHora(c.criado_em)}
                    </span>
                  </div>
                  <p className="text-sm break-words whitespace-pre-wrap text-[var(--tinta-forte)]">
                    {destacaMencoes(c.texto, c.mencoes, nomePorId)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        {novas ? (
          <button
            type="button"
            onClick={desce}
            className="absolute bottom-3 left-1/2 min-h-10 -translate-x-1/2 rounded-full bg-[var(--marca-azul)] px-4 text-xs font-semibold text-white shadow-[var(--sombra-sm)] transition hover:opacity-90"
          >
            Novas mensagens ↓
          </button>
        ) : null}
      </div>

      <div className="relative border-t border-[var(--grade)] bg-white px-5 py-3">
        {sugestoes && candidatas.length > 0 ? (
          <ul className="absolute bottom-full left-3 z-20 mb-1 w-64 rounded-lg border border-[var(--borda)] bg-white py-1 shadow-lg">
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
                  <span className="text-sm text-[var(--tinta-forte)]">
                    {m.nome}
                  </span>
                  <span className="text-xs text-[var(--tinta-fraca)]">
                    {m.email}
                  </span>
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
          // durante a espera seria apagado junto com o que foi enviado. Só
          // leitura, e não desabilitado, para o foco continuar no campo.
          readOnly={pendente}
          aria-busy={pendente}
          aria-label="Mensagem"
          placeholder="Escreva uma mensagem… use @ para mencionar alguém"
          onChange={(ev) =>
            aoDigitar(ev.target.value, ev.target.selectionStart)
          }
          onKeyDown={teclas}
          className="w-full resize-none rounded-lg border-[1.5px] border-[var(--borda)] px-3 py-2 text-sm transition focus:border-[var(--marca-terracotta)] focus:shadow-[0_0_0_3px_var(--marca-anel)] focus:outline-none"
        />
        {erro ? (
          <div className="mt-2">
            <Alerta>{erro}</Alerta>
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between">
          {/* Tela de toque não tem Ctrl: a dica só confundiria. */}
          <span className="text-xs text-[var(--tinta-fraca)] [@media(pointer:coarse)]:invisible">
            Ctrl+Enter envia
          </span>
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
        className="rounded bg-[var(--marca-brand-50)] px-1 font-semibold text-[var(--marca-terracotta-escuro)]"
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
