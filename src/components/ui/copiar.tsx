"use client";

import { useEffect, useState } from "react";
import { Botao } from "./basicos";

/**
 * Copia texto para a área de transferência. `navigator.clipboard` só existe
 * em contexto seguro (HTTPS/localhost); fora dele, cai no `execCommand` com
 * um campo temporário. Devolve `false` se nenhum dos dois funcionou.
 */
export async function copiaTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Permissão negada: tenta o caminho antigo abaixo.
  }
  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  campo.remove();
  return ok;
}

/** Botão "Copiar" com retorno visível ("Copiado" / "Não deu, copie à mão"). */
export function BotaoCopiar({
  texto,
  rotulo = "Copiar",
  variante = "secundario",
  className = "",
}: {
  texto: string;
  rotulo?: string;
  variante?: "primario" | "secundario" | "fantasma";
  className?: string;
}) {
  const [estado, setEstado] = useState<"ocioso" | "copiado" | "falhou">(
    "ocioso",
  );

  useEffect(() => {
    if (estado !== "copiado") return;
    const t = window.setTimeout(() => setEstado("ocioso"), 2500);
    return () => window.clearTimeout(t);
  }, [estado]);

  return (
    <>
      <Botao
        variante={variante}
        className={className}
        onClick={async () => {
          setEstado((await copiaTexto(texto)) ? "copiado" : "falhou");
        }}
      >
        {estado === "copiado" ? "Copiado ✓" : rotulo}
      </Botao>
      <span role="status" className="sr-only">
        {estado === "copiado" ? "Copiado" : ""}
      </span>
      {estado === "falhou" ? (
        <span className="text-xs text-[var(--perigo-tinta)]">
          Não foi possível copiar. Selecione o texto e copie à mão.
        </span>
      ) : null}
    </>
  );
}
