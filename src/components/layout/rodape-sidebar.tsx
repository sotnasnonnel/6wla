"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sair } from "@/app/login/actions";
import { Icone, ItemRodape, useMenuColapsado } from "./sidebar";

/**
 * Rodapé da barra lateral: notificações (com contador ao vivo), atalho para a
 * conta e sair. O recolhido vem do contexto da própria barra, não de uma prop
 * do servidor: senão o rodapé só encolheria na navegação seguinte.
 */
export function RodapeSidebar({
  nome,
  naoLidas,
  userId,
}: {
  nome: string;
  naoLidas: number;
  userId: string;
}) {
  const colapsada = useMenuColapsado();
  const [total, setTotal] = useState(naoLidas);
  const [ultimo, setUltimo] = useState(naoLidas);
  // O servidor manda um valor novo a cada navegação; ele vence o estado local.
  if (naoLidas !== ultimo) {
    setUltimo(naoLidas);
    setTotal(naoLidas);
  }

  useEffect(() => {
    const supabase = createClient();
    const recontar = async () => {
      const { count } = await supabase
        .from("6wla_notificacoes")
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

  return (
    <div className="space-y-0.5">
      <ItemRodape
        href="/notificacoes"
        titulo={`Notificações: ${total} não lidas`}
      >
        <span className="relative shrink-0">
          <Icone nome="sino" />
          {total > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 min-w-[15px] rounded-full bg-[var(--marca-terracotta)] px-1 text-center text-[10px] font-bold leading-[15px] text-white">
              {total > 99 ? "99+" : total}
            </span>
          ) : null}
        </span>
        <span className={`truncate ${colapsada ? "md:hidden" : ""}`}>
          Notificações
        </span>
      </ItemRodape>

      <ItemRodape href="/conta" titulo={nome} destaque>
        <Icone nome="conta" />
        <span className={`truncate ${colapsada ? "md:hidden" : ""}`}>
          {nome}
        </span>
      </ItemRodape>

      <form action={sair}>
        <button
          type="submit"
          title="Sair"
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <Icone nome="sair" />
          <span className={`truncate ${colapsada ? "md:hidden" : ""}`}>
            Sair
          </span>
        </button>
      </form>
    </div>
  );
}
