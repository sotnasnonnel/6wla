"use client";

import { useState } from "react";
import {
  montaEmails,
  type ContextoEmail,
  type RestricaoComPerfil,
} from "@/lib/automacoes/email";
import { Alerta, Selecao } from "@/components/ui/basicos";

/**
 * Prévia do e-mail real, montada pela mesma função que a API usa, com os
 * dados atuais da obra. O HTML roda num iframe `sandbox` sem permissões:
 * nada ali executa script nem enxerga a página.
 */
export function PreviaEmail({
  restricoes,
  ctx,
}: {
  restricoes: readonly RestricaoComPerfil[];
  ctx: ContextoEmail;
}) {
  const [escolhido, setEscolhido] = useState("");
  const { emails, semEmail } = montaEmails(restricoes, ctx);
  const atual =
    emails.find((e) => e.destinatario === escolhido) ?? emails[0] ?? null;

  return (
    <div className="space-y-3">
      {ctx.config.destino === "responsaveis" ? (
        <div>
          <label
            htmlFor="previa-ver-como"
            className="mb-1.5 block text-[13px] font-medium text-[var(--tinta-media)]"
          >
            Ver como
            <span className="ml-1.5 font-normal text-[var(--tinta-fraca)]">
              {emails.length} e-mail(s) neste disparo
            </span>
          </label>
          <Selecao
            id="previa-ver-como"
            value={atual?.destinatario ?? ""}
            onChange={(e) => setEscolhido(e.target.value)}
            disabled={emails.length === 0}
          >
            {emails.map((e) => (
              <option key={e.destinatario} value={e.destinatario}>
                {e.nome} ({e.total}) — {e.destinatario}
              </option>
            ))}
          </Selecao>
        </div>
      ) : null}

      {semEmail.length > 0 ? (
        <Alerta tipo="info">
          Sem e-mail cadastrado, não recebem:{" "}
          {semEmail.map((s) => `${s.nome} (${s.total})`).join(", ")}.
        </Alerta>
      ) : null}

      {atual ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-[var(--plano)] px-3 py-2 text-sm">
            <dt className="text-[var(--tinta-fraca)]">Para</dt>
            <dd className="break-all text-[var(--tinta-forte)]">
              {atual.destinatario}
            </dd>
            {atual.copias.length > 0 ? (
              <>
                <dt className="text-[var(--tinta-fraca)]">Cópia</dt>
                <dd className="break-all text-[var(--tinta-forte)]">
                  {atual.copias.join(", ")}
                </dd>
              </>
            ) : null}
            <dt className="text-[var(--tinta-fraca)]">Assunto</dt>
            <dd className="font-medium text-[var(--tinta-forte)]">
              {atual.assunto}
            </dd>
          </dl>
          <iframe
            title={`Prévia do e-mail para ${atual.nome}`}
            sandbox=""
            srcDoc={atual.html}
            className="h-[560px] w-full rounded-lg border border-[var(--borda)] bg-white"
          />
        </>
      ) : (
        <Alerta tipo="info">
          Hoje nenhum e-mail sairia: não há restrição aberta nas situações
          escolhidas
          {ctx.config.destino === "lista"
            ? ""
            : " com responsável que tenha e-mail"}
          . Nesse caso o disparo é registrado como “sem conteúdo” e nada é
          enviado.
        </Alerta>
      )}
    </div>
  );
}
