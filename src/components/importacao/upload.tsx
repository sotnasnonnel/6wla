"use client";

import { useActionState, useEffect, useState } from "react";
import {
  iniciaImportacao,
  type EstadoImportacao,
} from "@/server/importacao/actions";
import { Alerta, Botao, Campo, Rotulo } from "@/components/ui/basicos";

/** Mesmo limite de `iniciaImportacao`; aqui só para avisar antes de enviar. */
const TAMANHO_MAXIMO = 15 * 1024 * 1024;

/**
 * O servidor não informa o andamento: as etapas avançam pelo tempo típico de
 * cada uma, e a última fica até a resposta chegar. Serve para mostrar que o
 * envio não travou, não para medir progresso.
 */
function Progresso({ comIA }: { comIA: boolean }) {
  const etapas = [
    "Enviando arquivo…",
    "Lendo planilha…",
    comIA ? "Sugerindo colunas com IA…" : "Sugerindo colunas…",
  ];
  const [passo, setPasso] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setPasso((p) => Math.min(p + 1, etapas.length - 1)),
      2500,
    );
    return () => clearInterval(t);
  }, [etapas.length]);
  return (
    <p role="status" className="text-sm text-[var(--tinta-media)]">
      <span
        aria-hidden
        className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--marca-terracotta)] border-t-transparent align-[-1px] motion-reduce:animate-none"
      />
      {etapas[passo]}{" "}
      <span className="text-[var(--tinta-fraca)]">
        (etapa {passo + 1} de {etapas.length})
      </span>
    </p>
  );
}

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
  const [arquivo, setArquivo] = useState<{ nome: string; erro?: string }>();

  const aoEscolher = (f: File | undefined) => {
    if (!f) return setArquivo(undefined);
    const erro = !f.name.toLowerCase().endsWith(".xlsx")
      ? "Esse arquivo não é .xlsx. Salve a planilha como Pasta de Trabalho do Excel (.xlsx)."
      : f.size > TAMANHO_MAXIMO
        ? `O arquivo tem ${(f.size / 1024 / 1024).toFixed(1)} MB; o limite é 15 MB. Apague abas que não são de restrições e tente de novo.`
        : undefined;
    setArquivo(erro ? { nome: f.name, erro } : { nome: f.name });
  };

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="obraId" value={obraId} />
      <div>
        <Rotulo htmlFor="arquivo" dica="(.xlsx, até 15 MB)">
          Arquivo
        </Rotulo>
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          aria-describedby="arquivo-ajuda"
          aria-invalid={arquivo?.erro ? true : undefined}
          onChange={(e) => aoEscolher(e.target.files?.[0])}
          className="block w-full text-sm text-[var(--tinta-media)] file:mr-3 file:rounded-lg file:border file:border-[var(--borda)] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-[var(--marca-gelo)]"
        />
        <p
          id="arquivo-ajuda"
          className="mt-1 text-xs text-[var(--tinta-fraca)]"
        >
          {arquivo?.erro ? (
            <span className="text-[var(--perigo-tinta)]">{arquivo.erro}</span>
          ) : arquivo ? (
            <>
              Selecionado: <b className="break-all">{arquivo.nome}</b>
            </>
          ) : (
            "Só planilhas do Excel (.xlsx) de até 15 MB e 5.000 linhas."
          )}
        </p>
      </div>
      <div className="max-w-xs">
        <Rotulo htmlFor="aba" dica="(opcional)">
          Aba
        </Rotulo>
        <Campo
          id="aba"
          name="aba"
          placeholder="6WLA"
          aria-describedby="aba-ajuda"
        />
        <p id="aba-ajuda" className="mt-1 text-xs text-[var(--tinta-fraca)]">
          Se vazio, usa a primeira aba com dados.
        </p>
      </div>
      <p className="text-xs text-[var(--tinta-fraca)]">
        {comIA
          ? "A IA (Gemini) sugere qual coluna vira qual campo; é só uma sugestão, e você confere tudo antes de gravar."
          : "O de-para das colunas é sugerido por nomes conhecidos; você confere e ajusta na próxima etapa."}
      </p>
      {estado.erro ? <Alerta>{estado.erro}</Alerta> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" disabled={pendente || Boolean(arquivo?.erro)}>
          {pendente ? "Enviando…" : "Enviar e conferir"}
        </Botao>
        {pendente ? <Progresso comIA={comIA} /> : null}
      </div>
    </form>
  );
}
