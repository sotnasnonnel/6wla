"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/database.types";
import {
  CAMPOS_PPC,
  ROTULOS_PPC,
  OBRIGATORIOS_PPC,
  type CampoPpc,
} from "@/lib/ppc/dominio";
import { quantidadePpc } from "@/lib/ppc/importacao";
import { normalizaChave } from "@/lib/importacao/mapa";
import {
  Alerta,
  AreaTexto,
  Botao,
  Campo,
  Cartao,
  Selecao,
} from "@/components/ui/basicos";
import { Modal } from "@/components/ui/modal";
import { salvaAtividadePpc } from "@/server/ppc/actions";

type Registro = Tables<"atividades_ppc">;
export const numeroPpc = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
function exibe(campo: CampoPpc, valor: string | number | null): string {
  if (valor === null || valor === "") return "—";
  if (typeof valor === "number") return numeroPpc.format(valor);
  if (campo === "inicio_semana" || campo === "termino_semana")
    return valor.split("-").reverse().join("/");
  return valor;
}

export function TabelaPpc({
  registros,
  obraId,
  podeEditar,
}: {
  registros: Registro[];
  obraId: string;
  podeEditar: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [semana, setSemana] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [pagina, setPagina] = useState(0);
  const [editando, setEditando] = useState<Registro | null>(null);
  const [aviso, setAviso] = useState("");
  const semanas = [
    ...new Set(registros.map((r) => `${r.inicio_semana}|${r.semana}`)),
  ]
    .sort()
    .reverse();
  const disciplinas = [
    ...new Set(registros.map((r) => r.disciplina).filter(Boolean)),
  ].sort();
  const filtrados = registros.filter(
    (r) =>
      (!semana || `${r.inicio_semana}|${r.semana}` === semana) &&
      (!disciplina || r.disciplina === disciplina) &&
      (!busca ||
        normalizaChave(
          [
            r.id_atividade,
            r.nome_atividade,
            r.responsavel,
            r.encarregado,
            r.lider_imediato,
          ].join(" "),
        ).includes(normalizaChave(busca))),
  );
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 50));
  const atual = Math.min(pagina, totalPaginas - 1);
  const visiveis = filtrados.slice(atual * 50, (atual + 1) * 50);
  const informadas = filtrados.filter(
    (r) => r.quantidade_realizada !== null,
  ).length;
  return (
    <div className="space-y-4">
      {aviso ? <Alerta tipo="ok">{aviso}</Alerta> : null}
      <Cartao>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            Buscar atividade ou pessoa
            <Campo
              value={busca}
              placeholder="ID, atividade, responsável…"
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(0);
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            Semana
            <Selecao
              value={semana}
              onChange={(e) => {
                setSemana(e.target.value);
                setPagina(0);
              }}
            >
              <option value="">Todas as semanas</option>
              {semanas.map((s) => {
                const [inicio, nome] = s.split("|");
                return (
                  <option key={s} value={s}>
                    {nome} · {inicio?.split("-").reverse().join("/")}
                  </option>
                );
              })}
            </Selecao>
          </label>
          <label className="space-y-1 text-sm">
            Disciplina
            <Selecao
              value={disciplina}
              onChange={(e) => {
                setDisciplina(e.target.value);
                setPagina(0);
              }}
            >
              <option value="">Todas as disciplinas</option>
              {disciplinas.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Selecao>
          </label>
        </div>
        <p className="mt-3 text-sm text-[var(--tinta-fraca)]">
          {filtrados.length} atividade(s) · Quantidade realizada informada em{" "}
          {informadas} · {filtrados.length - informadas} sem apontamento
        </p>
      </Cartao>
      {registros.length === 0 ? (
        <Cartao>
          <h2 className="font-semibold">Nenhuma programação importada</h2>
          <p className="mt-1 text-sm text-[var(--tinta-fraca)]">
            {podeEditar
              ? "Use Importar programação para carregar a aba PPC ou Programação e conferir os campos."
              : "Um gestor da obra pode importar a programação semanal."}
          </p>
        </Cartao>
      ) : filtrados.length === 0 ? (
        <Cartao>Nenhuma atividade encontrada com estes filtros.</Cartao>
      ) : (
        <>
          <div className="max-w-full overflow-x-auto rounded-md border border-[var(--borda)] bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Atividades da programação semanal
              </caption>
              <thead className="bg-[var(--marca-gelo)]">
                <tr>
                  {CAMPOS_PPC.map((c) => (
                    <th
                      key={c}
                      className="whitespace-nowrap px-3 py-2 font-medium"
                    >
                      {ROTULOS_PPC[c]}
                    </th>
                  ))}
                  {podeEditar ? <th className="px-3 py-2">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[var(--borda)] hover:bg-[var(--marca-gelo)]/50"
                  >
                    {CAMPOS_PPC.map((c) => (
                      <td
                        key={c}
                        className={`px-3 py-2 align-top ${c.includes("quantidade") ? "text-right tabular-nums" : ""}`}
                      >
                        <div
                          className={
                            c === "nome_atividade" ||
                            c === "observacoes" ||
                            c === "desvio"
                              ? "min-w-56 max-w-96 whitespace-pre-line"
                              : "max-w-64 whitespace-nowrap"
                          }
                        >
                          {exibe(c, r[c])}
                        </div>
                      </td>
                    ))}
                    {podeEditar ? (
                      <td className="px-3 py-2">
                        <Botao
                          variante="secundario"
                          aria-label={`Editar atividade ${r.id_atividade}`}
                          onClick={() => setEditando(r)}
                        >
                          Editar
                        </Botao>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              Página {atual + 1} de {totalPaginas} · {filtrados.length}{" "}
              atividades
            </span>
            <div className="flex gap-2">
              <Botao
                variante="secundario"
                disabled={atual === 0}
                onClick={() => setPagina(atual - 1)}
              >
                Anterior
              </Botao>
              <Botao
                variante="secundario"
                disabled={atual + 1 >= totalPaginas}
                onClick={() => setPagina(atual + 1)}
              >
                Próxima
              </Botao>
            </div>
          </div>
        </>
      )}
      {editando ? (
        <EditarPpc
          key={editando.id}
          registro={editando}
          obraId={obraId}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            setAviso("Atividade atualizada.");
          }}
        />
      ) : null}
    </div>
  );
}

export function EditarPpc({
  registro,
  obraId,
  aoFechar,
  aoSalvar,
  compacto = false,
}: {
  registro: Registro;
  obraId: string;
  aoFechar: () => void;
  aoSalvar: () => void;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const campos = compacto
    ? CAMPOS_PPC.filter((c) =>
        [
          "quantidade_prevista",
          "quantidade_realizada",
          "responsavel",
          "lider_imediato",
          "encarregado",
          "status_planejamento",
          "desvio",
        ].includes(c),
      )
    : CAMPOS_PPC;
  return (
    <Modal
      aberto
      aoFechar={() => {
        if (!pendente) aoFechar();
      }}
      titulo={`Atividade ${registro.id_atividade}`}
      descricao="Atualize a programação e o apontamento realizado."
      largura={850}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          iniciar(async () => {
            setErro("");
            try {
              const dados = Object.fromEntries(form);
              const resultado = await salvaAtividadePpc({
                obraId,
                id: registro.id,
                atividade: {
                  ...dados,
                  quantidade_prevista: quantidadePpc(
                    String(form.get("quantidade_prevista") ?? ""),
                  ),
                  quantidade_realizada: quantidadePpc(
                    String(form.get("quantidade_realizada") ?? ""),
                  ),
                },
              });
              if (!resultado.ok) {
                setErro(resultado.erro);
                return;
              }
              aoSalvar();
              router.refresh();
            } catch {
              setErro(
                "Não foi possível salvar. Confira a conexão e tente novamente.",
              );
            }
          });
        }}
        className="space-y-4"
      >
        {erro ? <Alerta>{erro}</Alerta> : null}
        {compacto && (
          <p className="text-sm font-medium">{registro.nome_atividade}</p>
        )}
        {CAMPOS_PPC.filter((c) => !campos.includes(c)).map((c) => (
          <input key={c} type="hidden" name={c} value={registro[c] ?? ""} />
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          {campos.map((c) => (
            <label
              key={c}
              className={`space-y-1 text-sm ${c === "observacoes" || c === "nome_atividade" ? "sm:col-span-2" : ""}`}
            >
              {ROTULOS_PPC[c]}
              {OBRIGATORIOS_PPC.includes(c) ? " *" : ""}
              {c === "observacoes" || c === "desvio" ? (
                <AreaTexto
                  name={c}
                  defaultValue={registro[c]}
                  maxLength={5000}
                  disabled={pendente}
                  rows={3}
                />
              ) : (
                <Campo
                  name={c}
                  defaultValue={registro[c] ?? ""}
                  required={OBRIGATORIOS_PPC.includes(c)}
                  disabled={pendente}
                  type={c.endsWith("_semana") ? "date" : "text"}
                  inputMode={c.includes("quantidade") ? "decimal" : undefined}
                  maxLength={c === "nome_atividade" ? 2000 : 500}
                />
              )}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" disabled={pendente} onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar atividade"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
