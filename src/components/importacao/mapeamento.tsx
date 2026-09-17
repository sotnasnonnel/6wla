"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  confirmaImportacao,
  resugereComIA,
  simulaImportacao,
  type EstadoImportacao,
} from "@/server/importacao/actions";
import type { ResumoImportacao } from "@/server/importacao/queries";
import {
  CAMPOS_IMPORTAVEIS,
  CAMPO_DESCRICAO,
  CAMPO_ROTULO,
  LINHA_ORIGEM,
  type Casamento,
  type CampoImportavel,
  type LinhaPlanilha,
  type MapaColunas,
} from "@/lib/importacao/mapa";
import {
  previaDaLinha,
  rotuloPosicao,
  type ModoImportacao,
} from "@/lib/importacao/plano";
import { Alerta, Botao, Cartao, Selecao } from "@/components/ui/basicos";
import { ListaProblemas } from "./resultado";

type Props = {
  importacaoId: string;
  /** Obra de destino, já formatada. */
  destino: string;
  cabecalhos: string[];
  /** Amostra: as primeiras linhas da planilha. */
  linhas: LinhaPlanilha[];
  mapaInicial: MapaColunas;
  modoInicial: ModoImportacao;
  comIA: boolean;
  /** Quantas linhas casariam com restrições existentes, por coluna candidata. */
  casamentos: Record<string, Casamento>;
  totalLinhas: number;
  /** Resumo exato do servidor para o mapa/modo iniciais. */
  resumoInicial: ResumoImportacao;
  /**
   * Parte da planilha já foi gravada numa tentativa que parou no meio: mapa
   * e modo ficam travados nos da primeira tentativa, e só o que falta entra.
   */
  retomada: boolean;
};

/** O que decide cada restrição; o resto é complemento. */
const ESSENCIAIS: readonly CampoImportavel[] = [
  "descricao",
  "responsavel_nome",
  "data_limite",
  "status",
  "codigo",
];
const COMPLEMENTARES = CAMPOS_IMPORTAVEIS.filter(
  (c) => !ESSENCIAIS.includes(c),
);

/** Só estes campos mudam as contagens do resumo. */
const MUDAM_RESUMO: readonly CampoImportavel[] = ["descricao", "codigo"];

type Transferencia = {
  coluna: string;
  de: CampoImportavel;
  para: CampoImportavel;
  anterior: MapaColunas;
};

/**
 * Tela de conferência: para cada campo do sistema, o gestor escolhe a coluna
 * da planilha (ou nenhuma). Colunas não mapeadas ficam salvas nas informações
 * extras de cada restrição.
 */
export function Mapeamento({
  importacaoId,
  destino,
  cabecalhos,
  linhas,
  mapaInicial,
  modoInicial,
  comIA,
  casamentos,
  totalLinhas,
  resumoInicial,
  retomada,
}: Props) {
  const [mapaEditado, setMapa] = useState<MapaColunas>(mapaInicial);
  const [modoEditado, setModo] = useState<ModoImportacao>(modoInicial);
  const [estado, acao, pendente] = useActionState<EstadoImportacao, FormData>(
    confirmaImportacao,
    {},
  );
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [pensando, iniciaIA] = useTransition();
  const [transferencia, setTransferencia] = useState<Transferencia | null>(
    null,
  );
  const [resumoCliente, setResumoCliente] = useState<ResumoImportacao | null>(
    null,
  );
  const [erroResumo, setErroResumo] = useState<string | null>(null);
  const [calculando, iniciaCalculo] = useTransition();
  const pedido = useRef(0);

  // Numa retomada, o servidor manda: o que está na tela é o que foi usado.
  const mapa = retomada ? mapaInicial : mapaEditado;
  const modo = retomada ? modoInicial : modoEditado;
  const resumo = retomada ? resumoInicial : (resumoCliente ?? resumoInicial);

  const usadas = new Map<string, CampoImportavel>();
  for (const campo of CAMPOS_IMPORTAVEIS) {
    const c = mapa[campo];
    if (c) usadas.set(c, campo);
  }
  const naoMapeadas = cabecalhos.filter((c) => !usadas.has(c));
  const mapeados = CAMPOS_IMPORTAVEIS.filter((c) => mapa[c]);
  const complementaresMapeados = COMPLEMENTARES.filter((c) => mapa[c]).length;

  // Quantas linhas desta planilha já existem na obra, pela coluna escolhida
  // como código. Sem coluna de código, nada casa.
  const conta = mapa.codigo ? casamentos[mapa.codigo] : undefined;

  /** Recalcula as contagens no servidor, com o mesmo plano da gravação. */
  const recalcula = (novoMapa: MapaColunas, novoModo: ModoImportacao) => {
    const este = ++pedido.current;
    iniciaCalculo(async () => {
      const r = await simulaImportacao({
        importacaoId,
        mapa: Object.fromEntries(
          Object.entries(novoMapa).filter(
            (par): par is [string, string] => typeof par[1] === "string",
          ),
        ),
        modo: novoModo,
      });
      // Resposta atrasada de uma escolha anterior não sobrescreve a atual.
      if (este !== pedido.current) return;
      if (r.ok) {
        setResumoCliente(r.dados);
        setErroResumo(null);
      } else setErroResumo(r.erro);
    });
  };

  const define = (campo: CampoImportavel, coluna: string) => {
    const novo: MapaColunas = { ...mapaEditado };
    // Uma coluna só pode alimentar um campo: se já estava em outro, sai de lá
    // — e o gestor fica sabendo, com como desfazer.
    const dono = coluna ? usadas.get(coluna) : undefined;
    for (const k of CAMPOS_IMPORTAVEIS) if (novo[k] === coluna) delete novo[k];
    if (coluna) novo[campo] = coluna;
    else delete novo[campo];
    setMapa(novo);
    // Sem código não há como atualizar: volta ao modo que só adiciona.
    const novoModo = novo.codigo ? modoEditado : "adicionar";
    if (novoModo !== modoEditado) setModo(novoModo);
    setTransferencia(
      dono && dono !== campo
        ? { coluna, de: dono, para: campo, anterior: mapaEditado }
        : null,
    );
    if (
      MUDAM_RESUMO.includes(campo) ||
      (dono !== undefined && MUDAM_RESUMO.includes(dono))
    )
      recalcula(novo, novoModo);
  };

  const desfaz = () => {
    if (!transferencia) return;
    const anterior = transferencia.anterior;
    setMapa(anterior);
    setTransferencia(null);
    if (
      MUDAM_RESUMO.includes(transferencia.de) ||
      MUDAM_RESUMO.includes(transferencia.para)
    )
      recalcula(anterior, modo);
  };

  const escolheModo = (m: ModoImportacao) => {
    setModo(m);
    recalcula(mapa, m);
  };

  const seletor = (campo: CampoImportavel) => {
    const id = `mapa-${campo}`;
    const faltaDescricao = campo === "descricao" && !mapa.descricao;
    return (
      <div
        key={campo}
        className="grid grid-cols-1 gap-1.5 py-2 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-3 sm:py-1.5"
      >
        <div>
          <label
            htmlFor={id}
            className={`text-sm text-[var(--tinta-forte)] ${campo === "descricao" ? "font-semibold" : ""}`}
          >
            {CAMPO_ROTULO[campo]}
            {campo === "descricao" ? (
              <span className="text-[var(--perigo-tinta)]"> (obrigatório)</span>
            ) : null}
          </label>
          <div
            id={`${id}-ajuda`}
            className="text-[11px] leading-tight text-[var(--tinta-fraca)]"
          >
            {CAMPO_DESCRICAO[campo]}
          </div>
        </div>
        <div>
          <Selecao
            id={id}
            value={mapa[campo] ?? ""}
            disabled={retomada || pendente}
            aria-describedby={
              faltaDescricao ? `${id}-ajuda ${id}-erro` : `${id}-ajuda`
            }
            aria-invalid={faltaDescricao ? true : undefined}
            onChange={(e) => define(campo, e.target.value)}
          >
            <option value="">— não importar —</option>
            {cabecalhos.map((c) => {
              const dono = usadas.get(c);
              return (
                <option key={c} value={c}>
                  {c}
                  {dono && dono !== campo
                    ? ` (hoje em ${CAMPO_ROTULO[dono]})`
                    : ""}
                </option>
              );
            })}
          </Selecao>
          {faltaDescricao ? (
            <p id={`${id}-erro`} className="mt-1 text-xs text-[var(--perigo)]">
              Escolha a coluna com o texto da restrição: sem ela nenhuma linha
              pode ser gravada.
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  const previa = linhas.map((l, i) => previaDaLinha(l, i, mapa));
  const aGravar = resumo.novas + (modo === "atualizar" ? resumo.atualizar : 0);
  const rotuloBotao = pendente
    ? "Gravando…"
    : retomada
      ? `Gravar as ${aGravar} que faltam`
      : modo === "atualizar"
        ? `Atualizar ${resumo.atualizar} e adicionar ${resumo.novas}`
        : `Adicionar ${resumo.novas} restrição(ões)`;

  return (
    <form
      action={acao}
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <input type="hidden" name="importacaoId" value={importacaoId} />
      <input type="hidden" name="modo" value={modo} />
      {CAMPOS_IMPORTAVEIS.map((campo) => (
        <input
          key={campo}
          type="hidden"
          name={`mapa.${campo}`}
          value={mapa[campo] ?? ""}
        />
      ))}

      {retomada ? (
        <div className="lg:col-span-2">
          <Alerta tipo="info">
            <b>
              {resumo.jaGravadas} gravadas · {aGravar} faltam
            </b>
            . Uma tentativa anterior parou no meio. As já gravadas continuam no
            sistema e são reconhecidas: gravar de novo só envia o que falta. O
            mapeamento e o modo ficam os daquela tentativa.
          </Alerta>
        </div>
      ) : null}

      <Cartao className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--tinta-forte)]">
            Campo do sistema ← coluna da planilha
          </h2>
          {comIA ? (
            <Botao
              variante="secundario"
              disabled={pensando || pendente}
              onClick={() =>
                iniciaIA(async () => {
                  const r = await resugereComIA(importacaoId);
                  if (!r.ok) setErroIA(r.erro);
                  else {
                    setErroIA(null);
                    setTransferencia(null);
                    setMapa(r.dados);
                    recalcula(r.dados, modo);
                  }
                })
              }
            >
              {pensando ? "Perguntando à IA…" : "Sugerir de novo com IA"}
            </Botao>
          ) : null}
        </div>
        {erroIA ? (
          <Alerta>
            {erroIA} O mapeamento manual continua disponível abaixo.
          </Alerta>
        ) : null}
        {transferencia ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-2 text-sm text-[#1e40af]">
            <span role="status" className="min-w-0 flex-1">
              Coluna “{transferencia.coluna}” saiu de{" "}
              <b>{CAMPO_ROTULO[transferencia.de]}</b> e agora alimenta{" "}
              <b>{CAMPO_ROTULO[transferencia.para]}</b>.
            </span>
            <Botao variante="secundario" onClick={desfaz}>
              Desfazer
            </Botao>
          </div>
        ) : null}

        <h3 className="pt-1 text-xs font-bold tracking-[0.05em] text-[var(--marca-azul)] uppercase">
          Essenciais
        </h3>
        <div className="divide-y divide-[var(--grade)]">
          {ESSENCIAIS.map(seletor)}
        </div>
        <details className="group rounded-lg border border-[var(--borda)] px-3 py-1">
          <summary className="cursor-pointer py-1.5 text-sm font-medium text-[var(--tinta-media)]">
            Campos complementares{" "}
            <span className="text-[var(--tinta-fraca)]">
              ({complementaresMapeados} de {COMPLEMENTARES.length} mapeados)
            </span>
          </summary>
          <div className="divide-y divide-[var(--grade)]">
            {COMPLEMENTARES.map(seletor)}
          </div>
        </details>
      </Cartao>

      <div className="min-w-0 space-y-4">
        <Cartao>
          <h2 className="mb-1 text-sm font-semibold text-[var(--tinta-forte)]">
            Prévia: como as primeiras linhas serão gravadas
          </h2>
          <p className="mb-2 text-xs text-[var(--tinta-fraca)]">
            Valores já convertidos pela mesma regra da gravação.
          </p>
          <ul className="divide-y divide-[var(--grade)] text-sm">
            {previa.map((p) => (
              <li key={`${p.posicao.numero}`} className="py-2">
                <div className="text-[11px] font-medium text-[var(--tinta-fraca)] uppercase">
                  {rotuloPosicao(p.posicao)}
                </div>
                {p.ok ? (
                  <>
                    <div className="font-medium break-words text-[var(--tinta-forte)]">
                      {p.descricao}
                    </div>
                    <dl className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--tinta-media)]">
                      <div>
                        <dt className="inline text-[var(--tinta-fraca)]">
                          Responsável:{" "}
                        </dt>
                        <dd className="inline">{p.responsavel}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--tinta-fraca)]">
                          Status:{" "}
                        </dt>
                        <dd className="inline">{p.status}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--tinta-fraca)]">
                          Prazo:{" "}
                        </dt>
                        <dd className="inline">{p.prazo}</dd>
                      </div>
                    </dl>
                    {p.avisos.length > 0 ? (
                      <ul className="mt-1 text-xs text-[var(--aviso-tinta)]">
                        {p.avisos.map((a) => (
                          <li key={a}>⚠ {a}</li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <div className="text-[var(--perigo-tinta)]">
                    Não será gravada: {p.motivo}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium text-[var(--tinta-media)]">
              Ver a planilha original
            </summary>
            <div className="-mx-3 mt-2 overflow-auto sm:mx-0">
              <table className="text-xs">
                <thead>
                  <tr>
                    {cabecalhos.map((c) => {
                      const dono = usadas.get(c);
                      return (
                        <th
                          key={c}
                          scope="col"
                          className={`border-b border-[var(--borda)] px-2 py-1 text-left font-semibold whitespace-nowrap ${dono ? "text-[var(--tinta-forte)]" : "text-[var(--tinta-fraca)]"}`}
                        >
                          {c}
                          <div
                            className={`text-[10px] font-normal ${dono ? "text-[var(--sucesso-tinta)]" : ""}`}
                          >
                            → {dono ? CAMPO_ROTULO[dono] : "informações extras"}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr
                      key={String(l[LINHA_ORIGEM] ?? i)}
                      className="odd:bg-[var(--marca-gelo)]"
                    >
                      {cabecalhos.map((c) => (
                        <td
                          key={c}
                          className="max-w-[220px] truncate border-b border-[var(--grade)] px-2 py-1 text-[var(--tinta-media)]"
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
          </details>
        </Cartao>

        <Cartao>
          <h2 className="mb-1 text-sm font-semibold text-[var(--tinta-forte)]">
            O que fazer com o que já está no sistema
          </h2>
          <p className="mb-2 text-xs text-[var(--tinta-fraca)]">
            {mapa.codigo ? (
              <>
                Casando pela coluna <b>{mapa.codigo}</b>:{" "}
                <b>{conta?.existentes ?? 0}</b> das {totalLinhas} linhas já
                existem nesta obra
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
          <fieldset className="space-y-1.5" disabled={retomada || pendente}>
            <legend className="sr-only">Modo de importação</legend>
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
            ).map((opcao) => {
              const bloqueada = !mapa.codigo && opcao.valor === "atualizar";
              return (
                <label
                  key={opcao.valor}
                  className={`flex cursor-pointer gap-2 rounded-lg border p-2 transition ${
                    modo === opcao.valor
                      ? "border-[var(--marca-terracotta)] bg-[var(--marca-brand-50)]"
                      : "border-[var(--borda)] hover:bg-[var(--marca-gelo)]"
                  } ${bloqueada ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <input
                    type="radio"
                    name="modo-escolha"
                    value={opcao.valor}
                    checked={modo === opcao.valor}
                    disabled={bloqueada}
                    onChange={() => escolheModo(opcao.valor)}
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
              );
            })}
          </fieldset>
        </Cartao>

        <Cartao>
          <h2 className="mb-2 text-sm font-semibold text-[var(--tinta-forte)]">
            Resumo antes de gravar
          </h2>
          <dl className="space-y-1 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--tinta-fraca)]">Destino:</dt>
              <dd className="font-medium text-[var(--tinta-forte)]">
                {destino}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--tinta-fraca)]">Linhas lidas:</dt>
              <dd className="font-medium tabular-nums text-[var(--tinta-forte)]">
                {totalLinhas}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--tinta-fraca)]">
                Campos mapeados ({mapeados.length}):
              </dt>
              <dd className="text-[var(--tinta-media)]">
                {mapeados.length > 0
                  ? mapeados.map((c) => CAMPO_ROTULO[c]).join(", ")
                  : "nenhum"}
              </dd>
            </div>
          </dl>

          <div aria-live="polite" aria-busy={calculando}>
            <dl
              className={`mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 ${calculando ? "opacity-60" : ""}`}
            >
              {[
                { rotulo: "Novas", valor: resumo.novas },
                {
                  rotulo: "Atualizadas",
                  valor: modo === "atualizar" ? resumo.atualizar : 0,
                },
                { rotulo: "Ignoradas", valor: resumo.ignoradas },
                { rotulo: "Descartadas", valor: resumo.descartadas },
              ].map((n) => (
                <div
                  key={n.rotulo}
                  className="rounded-lg bg-[var(--plano)] p-2"
                >
                  <dt className="text-[11px] text-[var(--tinta-fraca)]">
                    {n.rotulo}
                  </dt>
                  <dd className="text-lg font-bold tabular-nums text-[var(--tinta-forte)]">
                    {n.valor}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-1 text-xs text-[var(--tinta-fraca)]">
              {calculando
                ? "Recalculando…"
                : "Contagem de todas as linhas da planilha. Ignoradas: código já existente ou repetido. Descartadas: linhas inválidas, como sem descrição."}
              {resumo.jaGravadas > 0
                ? ` ${resumo.jaGravadas} já gravadas numa tentativa anterior não entram de novo.`
                : ""}
            </p>
            {erroResumo ? <Alerta>{erroResumo}</Alerta> : null}
          </div>

          {resumo.problemas.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium text-[var(--tinta-media)]">
                Ver linhas que não serão gravadas (
                {resumo.ignoradas + resumo.descartadas})
              </summary>
              <div className="mt-1">
                <ListaProblemas
                  itens={resumo.problemas}
                  total={resumo.ignoradas + resumo.descartadas}
                />
              </div>
            </details>
          ) : null}

          <p className="mt-3 text-sm text-[var(--tinta-media)]">
            {naoMapeadas.length > 0 ? (
              <>
                <span className="font-medium">
                  {naoMapeadas.length} coluna(s) não mapeada(s)
                </span>{" "}
                não são descartadas: ficam salvas em “informações extras” de
                cada restrição:{" "}
                <span className="text-[var(--tinta-fraca)]">
                  {naoMapeadas.join(", ")}
                </span>
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
            <Botao
              type="submit"
              disabled={
                pendente || calculando || !mapa.descricao || aGravar === 0
              }
            >
              {rotuloBotao}
            </Botao>
            {aGravar === 0 && mapa.descricao && !calculando ? (
              <p className="mt-1 text-xs text-[var(--tinta-fraca)]">
                Nada a gravar com este mapeamento e modo.
              </p>
            ) : null}
          </div>
        </Cartao>
      </div>
    </form>
  );
}
