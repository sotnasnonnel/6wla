"use client";

import Link from "next/link";
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
  papel,
  naoLidas,
  userId,
}: {
  nome: string;
  /** Rótulo do papel ("Administrador geral", "Gestor"...). */
  papel: string;
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

  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div>
      <div className="px-2 pt-2">
        <ItemRodape
          href="/notificacoes"
          titulo={`Notificações: ${total} não lidas`}
        >
          <span className="relative shrink-0">
            <Icone nome="sino" />
            {total > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] rounded-full bg-[var(--marca-terracotta)] px-1 text-center text-[10px] leading-4 font-bold text-white">
                {total > 99 ? "99+" : total}
              </span>
            ) : null}
          </span>
          <span className={`truncate ${colapsada ? "md:hidden" : ""}`}>
            Notificações
          </span>
        </ItemRodape>
      </div>

      {/* Rodapé do app-phd: avatar com iniciais, nome, papel e sair. */}
      <div
        className={`flex items-center gap-3 p-3 ${colapsada ? "md:flex-col md:gap-2 md:px-2" : ""}`}
      >
        <Link
          href="/conta"
          title={`${nome} · Sua conta`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--marca-terracotta)] text-[0.8rem] font-bold text-white transition hover:bg-[var(--marca-terracotta-escuro)]"
        >
          {iniciais || "?"}
        </Link>
        <Link
          href="/conta"
          className={`min-w-0 flex-1 ${colapsada ? "md:hidden" : ""}`}
        >
          <strong className="block truncate text-[0.78rem] font-semibold text-[#1e293b]">
            {nome}
          </strong>
          <span className="block truncate text-[0.7rem] text-[var(--tinta-fraca)]">
            {papel}
          </span>
        </Link>
        <form action={sair}>
          <button
            type="submit"
            title="Sair"
            aria-label="Sair"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--tinta-fraca)] transition hover:bg-[var(--perigo-fundo)] hover:text-[var(--perigo)]"
          >
            <Icone nome="sair" tamanho={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
