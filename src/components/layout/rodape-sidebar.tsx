"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { sair } from "@/app/login/actions";
import { Icone, ItemRodape, useMenuColapsado } from "./sidebar";
import { ContadorBolha, rotuloNaoLidas, useNaoLidas } from "./nao-lidas";

/**
 * Rodapé da barra lateral: notificações (com contador ao vivo), atalho para a
 * conta e sair. O recolhido vem do contexto da própria barra, não de uma prop
 * do servidor: senão o rodapé só encolheria na navegação seguinte.
 */
export function RodapeSidebar({
  nome,
  papel,
}: {
  nome: string;
  /** Rótulo do papel ("Administrador geral", "Gestor"...). */
  papel: string;
}) {
  const colapsada = useMenuColapsado();
  const total = useNaoLidas();

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
          titulo={rotuloNaoLidas(total)}
          rotuloAcessivel={rotuloNaoLidas(total)}
        >
          <span className="relative shrink-0">
            <Icone nome="sino" />
            <ContadorBolha total={total} />
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
          aria-label={`${nome} · Sua conta`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--marca-terracotta)] text-[0.8rem] font-bold text-white transition hover:bg-[var(--marca-terracotta-escuro)]"
        >
          {iniciais || "?"}
        </Link>
        <Link
          href="/conta"
          tabIndex={-1}
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
          <BotaoSair />
        </form>
      </div>
    </div>
  );
}

function BotaoSair() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title="Sair"
      aria-label={pending ? "Saindo…" : "Sair"}
      disabled={pending}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--tinta-fraca)] transition hover:bg-[var(--perigo-fundo)] hover:text-[var(--perigo-tinta)] disabled:opacity-60"
    >
      <Icone nome="sair" tamanho={18} />
    </button>
  );
}
