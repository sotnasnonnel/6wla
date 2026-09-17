"use client";

import Link from "next/link";
import { Alerta, Botao } from "@/components/ui/basicos";

/**
 * Erro genérico das telas do app (obras, administração, notificações, conta).
 * A obra tem o próprio, mais específico. O shell (menu) continua de pé.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg space-y-3">
      <Alerta>
        Algo deu errado ao carregar esta tela. Confira a conexão e tente de
        novo.{error.digest ? ` (ref. ${error.digest})` : ""}
      </Alerta>
      <div className="flex flex-wrap gap-2">
        <Botao onClick={reset}>Tentar de novo</Botao>
        <Link
          href="/obras"
          className="inline-flex min-h-10 items-center rounded-lg border border-[var(--borda)] bg-white px-4 text-sm font-semibold text-[var(--marca-azul)] transition hover:bg-[var(--plano)]"
        >
          Ir para as obras
        </Link>
      </div>
    </div>
  );
}
