"use client";

import { useActionState, useState, useTransition } from "react";
import {
  confirmaImportacao,
  resugereComIA,
  type EstadoImportacao,
} from "@/server/importacao/actions";
import {
  CAMPOS_IMPORTAVEIS,
  CAMPO_DESCRICAO,
  CAMPO_ROTULO,
  type Casamento,
  type CampoImportavel,
  type LinhaPlanilha,
  type MapaColunas,
} from "@/lib/importacao/mapa";
import { Alerta, Botao, Cartao, Selecao } from "@/components/ui/basicos";

type Props = {
  importacaoId: string;
  cabecalhos: string[];
  linhas: LinhaPlanilha[];
  mapaInicial: MapaColunas;
  comIA: boolean;
  /** Quantas linhas casariam com restrições existentes, por coluna candidata. */
  casamentos: Record<string, Casamento>;
  totalLinhas: number;
};

type Modo = "adicionar" | "atualizar";

/**
 * Tela de conferência: para cada campo do sistema, o gestor escolhe a coluna
 * da planilha (ou nenhuma). Colunas não mapeadas vão para "extras".
 */
export function Mapeamento({
  importacaoId,
  cabecalhos,
  linhas,
  mapaInicial,
  comIA,
  casamentos,
  totalLinhas,
}: Props) {
  const [mapa, setMapa] = useState<MapaColunas>(mapaInicial);
  const [modo, setModo] = useState<Modo>("adicionar");
  const [estado, acao, pendente] = useActionState<EstadoImportacao, FormData>(
    confirmaImportacao,
    {},
  );
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [pensando, inicia] = useTransition();

  const usadas = new Map<string, CampoImportavel>();
  for (const campo of CAMPOS_IMPORTAVEIS) {
    const c = mapa[campo];
    if (c) usadas.set(c, campo);
  }
  const naoMapeadas = cabecalhos.filter((c) => !usadas.has(c));

  // Quantas linhas desta planilha já existem na obra, pela coluna escolhida
  // como código. Sem coluna de código, nada casa.
  const conta = mapa.codigo ? casamentos[mapa.codigo] : undefined;
  const repetidas = conta?.existentes ?? 0;
  const novas = totalLinhas - repetidas;

  const define = (campo: CampoImportavel, coluna: string) => {
    setMapa((m) => {
      const novo: MapaColunas = { ...m };
      // Uma coluna só pode alimentar um campo.
      for (const k of CAMPOS_IMPORTAVEIS)
        if (novo[k] === coluna) delete novo[k];
      if (coluna) novo[campo] = coluna;
      else delete novo[campo];
      return novo;
    });
  };

  return (
    <form
      action={acao}
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <input type="hidden" name="importacaoId" value={importacaoId} />
      {CAMPOS_IMPORTAVEIS.map((campo) => (
        <input
          key={campo}
          type="hidden"
          name={`mapa.${campo}`}
          value={mapa[campo] ?? ""}
        />
      ))}

      <Cartao className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--tinta-forte)]">
            Campo do sistema ← coluna da planilha
          </h2>
          {comIA ? (
            <Botao
              variante="secundario"
              disabled={pensando}
              onClick={() =>
                inicia(async () => {
                  const r = await resugereComIA(importacaoId);
                  if (!r.ok) setErroIA(r.erro);
                  else {
                    setErroIA(null);
                    setMapa(r.dados);
                  }
                })
              }
            >
              {pensando ? "Perguntando à IA…" : "Sugerir com IA"}
            </Botao>
          ) : null}
        </div>
        {erroIA ? <Alerta>{erroIA}</Alerta> : null}
        <div className="divide-y divide-[#eceae7]">
          {CAMPOS_IMPORTAVEIS.map((campo) => (
            <div
              key={campo}
              className="grid grid-cols-1 gap-1.5 py-2 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-3 sm:py-1.5"
            >
              <div>
                <div
                  className={`text-sm ${campo === "descricao" ? "font-semibold text-[var(--tinta-forte)]" : "text-[var(--tinta-forte)]"}`}
                >
                  {CAMPO_ROTULO[campo]}
                  {campo === "descricao" ? (
                    <span className="text-red-600"> *</span>
                  ) : null}
                </div>
                <div className="text-[11px] leading-tight text-[var(--tinta-fraca)]">
                  {CAMPO_DESCRICAO[campo]}
                </div>
              </div>
              <Selecao
                value={mapa[campo] ?? ""}
                onChange={(e) => define(campo, e.target.value)}
              >
                <option value="">— não importar —</option>
                {cabecalhos.map((c) => {
                  const dono = usadas.get(c);
                  return (
                    <option key={c} value={c}>
                      {c}
                      {dono && dono !== campo
                        ? ` (já usada em ${CAMPO_ROTULO[dono]})`
                        : ""}
                    </option>
                  );
                })}
              </Selecao>
            </div>
          ))}
        </div>
      </Cartao>

      <div className="min-w-0 space-y-4">
        <Cartao>
          <h2 className="mb-2 text-sm font-semibold text-[var(--tinta-forte)]">
            Amostra (5 primeiras linhas)
          </h2>
          <div className="-mx-3 overflow-auto sm:mx-0">
            <table className="text-xs">
              <thead>
                <tr>
                  {cabecalhos.map((c) => (
                    <th
                      key={c}
                      className={`whitespace-nowrap border-b border-[var(--borda)] px-2 py-1 text-left font-semibold ${usadas.has(c) ? "text-[var(--tinta-forte)]" : "text-[var(--tinta-fraca)]"}`}
                    >
                      {c}
                      {usadas.has(c) ? (
                        <div className="text-[10px] font-normal text-emerald-700">
                          → {CAMPO_ROTULO[usadas.get(c)!]}
                        </div>
                      ) : (
                        <div className="text-[10px] font-normal">→ extras</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className="odd:bg-[var(--marca-gelo)]">
                    {cabecalhos.map((c) => (
                      <td
                        key={c}
                        className="max-w-[220px] truncate border-b border-[#eceae7] px-2 py-1 text-[var(--tinta-media)]"
                        title={String(l[c] ?? "")}
                      >
                        {l[c] === null || l[c] === undefined
                          ? ""
                          : String(l[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>

        <Cartao>
          <h2 className="mb-1 text-sm font-semibold text-[var(--tinta-forte)]">
            O que fazer com o que já está no sistema
          </h2>
          <p className="mb-2 text-xs text-[var(--tinta-fraca)]">
            {mapa.codigo ? (
              <>
                Casando pela coluna <b>{mapa.codigo}</b>:{" "}
                <b>{repetidas}</b> das {totalLinhas} linhas já existem nesta
                obra
                {conta && conta.semCodigo > 0
                  ? `, ${conta.semCodigo} estão sem código (entram sempre como novas)`
                  : ""}
                .
              </>
            ) : (
              <>
                Nenhuma coluna está mapeada como <b>Código</b>. Sem ela não dá
                para saber o que já existe, e toda linha entra como restrição
                nova.
              </>
            )}
          </p>
          <div className="space-y-1.5">
            {(
              [
                {
                  valor: "adicionar",
                  titulo: "Só adicionar as novas",
                  detalhe:
                    "Quem já está no sistema fica como está — o que foi editado aqui não é sobrescrito pela planilha.",
                },
                {
                  valor: "atualizar",
                  titulo: "Atualizar as que já existem e adicionar as novas",
                  detalhe:
                    "A planilha manda: cada linha que casa pelo código atualiza a restrição. Coluna vazia na planilha não apaga o que está preenchido aqui, e toda alteração fica no histórico.",
                },
              ] as const
            ).map((opcao) => (
              <label
                key={opcao.valor}
                className={`flex cursor-pointer gap-2 rounded-md border p-2 transition ${
                  modo === opcao.valor
                    ? "border-[var(--marca-terracotta)] bg-[#fdf6f0]"
                    : "border-[var(--borda)] hover:bg-[var(--marca-gelo)]"
                } ${!mapa.codigo && opcao.valor === "atualizar" ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="modo"
                  value={opcao.valor}
                  checked={modo === opcao.valor}
                  disabled={!mapa.codigo && opcao.valor === "atualizar"}
                  onChange={() => setModo(opcao.valor)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--tinta-forte)]">
                    {opcao.titulo}
                  </span>
                  <span className="block text-[11px] leading-tight text-[var(--tinta-fraca)]">
                    {opcao.detalhe}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Cartao>

        <Cartao>
          <p className="text-sm text-[var(--tinta-media)]">
            {naoMapeadas.length > 0 ? (
              <>
                <span className="font-medium">
                  {naoMapeadas.length} coluna(s)
                </span>{" "}
                ficam guardadas como extras, sem virar campo:{" "}
                <span className="text-[var(--tinta-fraca)]">{naoMapeadas.join(", ")}</span>
              </>
            ) : (
              "Todas as colunas foram mapeadas."
            )}
          </p>
          <p className="mt-2 text-xs text-[var(--tinta-fraca)]">
            Status como &quot;Concluído com atraso&quot; vira <b>Concluída</b>;
            o atraso é recalculado pelas datas. &quot;No prazo&quot; vira{" "}
            <b>Pendente</b>. Responsável com e-mail igual ao de um usuário
            cadastrado é vinculado automaticamente.
          </p>
          {estado.erro ? (
            <div className="mt-3">
              <Alerta>{estado.erro}</Alerta>
            </div>
          ) : null}
          <div className="mt-3">
            <Botao type="submit" disabled={pendente || !mapa.descricao}>
              {pendente
                ? "Importando…"
                : modo === "atualizar"
                  ? `Atualizar ${repetidas} e adicionar ${novas}`
                  : `Adicionar ${novas} restrição(ões)`}
            </Botao>
          </div>
        </Cartao>
      </div>
    </form>
  );
}
