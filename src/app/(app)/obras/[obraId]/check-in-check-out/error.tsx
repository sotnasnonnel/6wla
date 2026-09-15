"use client";
import { Alerta, Botao } from "@/components/ui/basicos";

export default function ErroPpc({ retry }: { retry: () => void }) {
  return (
    <div className="space-y-3">
      <Alerta>Não foi possível carregar a programação. Tente novamente.</Alerta>
      <Botao onClick={retry}>Tentar novamente</Botao>
    </div>
  );
}
