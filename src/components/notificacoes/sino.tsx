"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Contador de notificações não lidas. Começa com o valor do servidor e
 * acompanha inserções/atualizações via Realtime (a RLS garante que só chegam
 * as do próprio usuário).
 */
export function Sino({ userId, inicial }: { userId: string; inicial: number }) {
  const [total, setTotal] = useState(inicial);
  const [ultimoInicial, setUltimoInicial] = useState(inicial);
  // O layout persiste entre navegações; quando o servidor manda um valor novo,
  // ele vence o estado local.
  if (inicial !== ultimoInicial) {
    setUltimoInicial(inicial);
    setTotal(inicial);
  }

  useEffect(() => {
    const supabase = createClient();
    const recontar = async () => {
      const { count } = await supabase
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("lida_em", null);
      if (typeof count === "number") setTotal(count);
    };
    const canal = supabase
      .channel(`notificacoes:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        () => void recontar(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userId]);

  return (
    <Link
      href="/notificacoes"
      className="relative rounded-md p-1.5 text-[var(--tinta-media)] hover:bg-[var(--marca-gelo)]"
      aria-label={`Notificações: ${total} não lidas`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {total > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[var(--marca-terracotta-vermelho)] px-1 text-center text-[11px] font-semibold leading-[18px] text-white">
          {total > 99 ? "99+" : total}
        </span>
      ) : null}
    </Link>
  );
}
