"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluiRestricao } from "@/server/restricoes/actions";
import { Confirmacao } from "@/components/ui/confirmacao";

/**
 * Botão "Excluir" do cabeçalho da restrição. Só aparece para gestor.
 *
 * `destino` é a tabela já com o recorte de onde a pessoa veio e o aviso
 * `excluida`, montado no servidor a partir de parâmetros validados.
 */
export function ExcluirRestricao({
  restricaoId,
  destino,
}: {
  restricaoId: string;
  destino: string;
}) {
  const router = useRouter();
  const [pendente, inicia] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pendente}
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
        className="min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--perigo)] transition hover:bg-[var(--perigo-fundo)] disabled:opacity-60"
      >
        Excluir
      </button>
      <Confirmacao
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Excluir esta restrição?"
        descricao="Checklist, anexos, comentários e histórico vão junto. Não dá para desfazer."
        rotuloConfirmar="Excluir"
        rotuloPendente="Excluindo…"
        tom="perigo"
        pendente={pendente}
        erro={erro}
        aoConfirmar={() =>
          inicia(async () => {
            const res = await excluiRestricao(restricaoId);
            if (!res.ok) setErro(res.erro);
            else router.push(destino);
          })
        }
      />
    </>
  );
}
