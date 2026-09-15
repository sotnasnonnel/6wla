"use client";

import { useActionState } from "react";
import {
  iniciaImportacao,
  type EstadoImportacao,
} from "@/server/importacao/actions";
import { Alerta, Botao, Campo, Rotulo } from "@/components/ui/basicos";

export function FormUpload({
  obraId,
  comIA,
}: {
  obraId: string;
  comIA: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoImportacao, FormData>(
    iniciaImportacao,
    {},
  );
  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="obraId" value={obraId} />
      <div>
        <Rotulo htmlFor="arquivo">Arquivo .xlsx</Rotulo>
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full text-sm text-[var(--tinta-media)] file:mr-3 file:rounded-lg file:border file:border-[var(--borda)] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-[var(--marca-gelo)]"
        />
      </div>
      <div className="max-w-xs">
        <Rotulo htmlFor="aba">Aba (opcional)</Rotulo>
        <Campo id="aba" name="aba" placeholder="6WLA" />
        <p className="mt-1 text-xs text-[var(--tinta-fraca)]">
          Se vazio, usa a primeira aba com dados.
        </p>
      </div>
      <p className="text-xs text-[var(--tinta-fraca)]">
        {comIA
          ? "A IA (Gemini) vai sugerir o de-para das colunas; você confere antes de gravar."
          : "Sem chave da IA configurada: o de-para é sugerido por nomes conhecidos e você ajusta na próxima tela."}
      </p>
      {estado.erro ? <Alerta>{estado.erro}</Alerta> : null}
      <Botao type="submit" disabled={pendente}>
        {pendente ? "Lendo planilha…" : "Enviar e conferir"}
      </Botao>
    </form>
  );
}
