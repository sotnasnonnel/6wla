"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { SELECT_CONTAGEM_NAO_LIDAS } from "@/components/notificacoes/contagem";

/**
 * Contador de notificações não lidas, único para o shell: o sino da barra do
 * celular e o do rodapé da barra lateral mostram o mesmo número e dividem uma
 * assinatura Realtime só. Começa com o valor do servidor e recontam com a
 * mesma consulta dele (ver `SELECT_CONTAGEM_NAO_LIDAS`).
 */
const Contexto = createContext(0);

export function useNaoLidas(): number {
  return useContext(Contexto);
}

export function ProvedorNaoLidas({
  inicial,
  userId,
  children,
}: {
  inicial: number;
  userId: string;
  children: ReactNode;
}) {
  const [total, setTotal] = useState(inicial);
  const [ultimo, setUltimo] = useState(inicial);
  // O layout persiste entre navegações; o valor novo do servidor vence.
  if (inicial !== ultimo) {
    setUltimo(inicial);
    setTotal(inicial);
  }

  useEffect(() => {
    const supabase = createClient();
    const recontar = async () => {
      const { count, error } = await supabase
        .from("6wla_notificacoes")
        .select(SELECT_CONTAGEM_NAO_LIDAS, { count: "exact", head: true })
        .eq("user_id", userId)
        .is("lida_em", null);
      // Falha de rede mantém o último número conhecido.
      if (!error && typeof count === "number") setTotal(count);
    };
    const canal = supabase
      .channel(`notificacoes:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "6wla_notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        () => void recontar(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userId]);

  return <Contexto.Provider value={total}>{children}</Contexto.Provider>;
}

/** Bolinha com o número; some quando é zero. */
export function ContadorBolha({ total }: { total: number }) {
  if (total <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute -top-1.5 -right-1.5 min-w-[16px] rounded-full bg-[var(--marca-terracotta)] px-1 text-center text-[10px] leading-4 font-bold text-white"
    >
      {total > 99 ? "99+" : total}
    </span>
  );
}

export function rotuloNaoLidas(total: number): string {
  if (total === 0) return "Notificações, nenhuma não lida";
  return `Notificações, ${total} ${total === 1 ? "não lida" : "não lidas"}`;
}

/** Sino da barra superior do celular. */
export function SinoTopo({ icone }: { icone: ReactNode }) {
  const total = useNaoLidas();
  return (
    <Link
      href="/notificacoes"
      aria-label={rotuloNaoLidas(total)}
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--tinta-media)] transition hover:bg-[var(--marca-gelo)]"
    >
      <span className="relative">
        {icone}
        <ContadorBolha total={total} />
      </span>
    </Link>
  );
}
