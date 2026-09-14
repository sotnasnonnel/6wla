"use client";

import { Alerta, Botao } from "@/components/ui/basicos";

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
        Algo deu errado ao carregar a obra.{" "}
        {error.digest ? `(ref. ${error.digest})` : ""}
      </Alerta>
      <Botao variante="secundario" onClick={reset}>
        Tentar de novo
      </Botao>
    </div>
  );
}
