"use client";

import type { ReactNode } from "react";
import { Alerta, Botao } from "./basicos";
import { Modal } from "./modal";

/**
 * Pergunta antes de uma ação que muda o que alguém enxerga ou que não se
 * desfaz. Substitui `window.confirm`: diz o efeito concreto ("Fulano deixa de
 * ver esta obra"), mostra espera e erro no próprio diálogo e não trava a aba.
 *
 * Quem chama controla `aberto` e fecha no sucesso; no erro o diálogo fica
 * aberto com a mensagem.
 */
export function Confirmacao({
  aberto,
  aoFechar,
  aoConfirmar,
  titulo,
  descricao,
  children,
  rotuloConfirmar,
  rotuloPendente = "Aguarde…",
  tom = "primario",
  pendente = false,
  erro = null,
  confirmarDesabilitado = false,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: () => void;
  titulo: string;
  descricao?: string;
  /** Campos extras (ex.: escolher workspace, digitar senha). */
  children?: ReactNode;
  rotuloConfirmar: string;
  rotuloPendente?: string;
  tom?: "primario" | "perigo";
  pendente?: boolean;
  erro?: string | null;
  confirmarDesabilitado?: boolean;
}) {
  const fecha = () => {
    if (!pendente) aoFechar();
  };
  return (
    <Modal
      aberto={aberto}
      aoFechar={fecha}
      titulo={titulo}
      {...(descricao !== undefined ? { descricao } : {})}
      largura={480}
      rodape={
        <>
          <Botao variante="secundario" onClick={fecha} disabled={pendente}>
            Cancelar
          </Botao>
          <Botao
            variante={tom === "perigo" ? "perigo" : "primario"}
            onClick={aoConfirmar}
            disabled={pendente || confirmarDesabilitado}
            // Sem campo no corpo, o foco inicial vai para a ação principal.
            {...(children === undefined ? { "data-autofocus": "" } : {})}
          >
            {pendente ? rotuloPendente : rotuloConfirmar}
          </Botao>
        </>
      }
    >
      {children !== undefined || erro ? (
        <div className="space-y-4 pb-1">
          {children}
          {erro ? <Alerta>{erro}</Alerta> : null}
        </div>
      ) : null}
    </Modal>
  );
}
