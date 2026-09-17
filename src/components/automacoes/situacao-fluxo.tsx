"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sincronizaFluxoDaObra } from "@/server/automacoes/actions";
import { Alerta, Botao } from "@/components/ui/basicos";

export type FluxoVista = {
  /** false quando o servidor não tem a integração com o n8n configurada. */
  ligada: boolean;
  nome: string;
  ativo: boolean;
  erro: string | null;
  /** Nenhum fluxo registrado ainda para a obra. */
  existe: boolean;
};

/** Situação do fluxo n8n "<código> - Restrições" da obra. */
export function SituacaoFluxo({
  obraId,
  fluxo,
}: {
  obraId: string;
  fluxo: FluxoVista;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();

  const sincroniza = () => {
    setErro(null);
    inicia(async () => {
      const r = await sincronizaFluxoDaObra(obraId);
      if (!r.ok) setErro(r.erro);
      router.refresh();
    });
  };

  if (!fluxo.ligada) {
    return (
      <div className="mb-4">
        <Alerta tipo="info">
          A criação automática do fluxo no n8n não está configurada neste
          servidor. As automações ficam salvas, mas nenhum e-mail sai até um
          administrador configurar a integração.
        </Alerta>
      </div>
    );
  }

  const texto = fluxo.erro
    ? fluxo.erro
    : !fluxo.existe
      ? "O fluxo no n8n é criado ao salvar a primeira automação."
      : fluxo.ativo
        ? `Fluxo “${fluxo.nome}” ativo no n8n.`
        : `Fluxo “${fluxo.nome}” desativado no n8n (todas as automações estão pausadas).`;

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Alerta tipo={fluxo.erro ? "erro" : fluxo.ativo ? "ok" : "info"}>
          {texto}
        </Alerta>
        {fluxo.existe || fluxo.erro ? (
          <Botao variante="secundario" onClick={sincroniza} disabled={pendente}>
            {pendente ? "Sincronizando…" : "Sincronizar"}
          </Botao>
        ) : null}
      </div>
      {erro ? <Alerta>{erro}</Alerta> : null}
    </div>
  );
}
