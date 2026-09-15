"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alerta, Botao, Campo, Selecao } from "@/components/ui/basicos";
import { Modal } from "@/components/ui/modal";
import {
  CAMPOS_PPC,
  ROTULOS_PPC,
  OBRIGATORIOS_PPC,
  type MapaPpc,
} from "@/lib/ppc/dominio";
import { inspecionaPpc, importaPpc } from "@/server/ppc/actions";
import { mapaPpcReutilizaColuna, valorMapeadoPpc } from "@/lib/ppc/importacao";

type Inspecao = Extract<
  Awaited<ReturnType<typeof inspecionaPpc>>,
  { ok: true }
>["dados"];

export function ImportarPpc({ obraId }: { obraId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [aba, setAba] = useState("PPC");
  const [inspecao, setInspecao] = useState<Inspecao | null>(null);
  const [mapa, setMapa] = useState<MapaPpc>({});
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [pendente, iniciar] = useTransition();
  const formulario = () => {
    const form = new FormData();
    form.set("obraId", obraId);
    form.set("aba", aba);
    if (arquivo) form.set("arquivo", arquivo);
    return form;
  };
  const conferir = () =>
    iniciar(async () => {
      setErro("");
      try {
        const resultado = await inspecionaPpc(formulario());
        if (!resultado.ok) {
          setErro(resultado.erro);
          return;
        }
        setInspecao(resultado.dados);
        setMapa(resultado.dados.mapa);
      } catch {
        setErro(
          "Não foi possível enviar o arquivo. Confira a conexão e tente novamente.",
        );
      }
    });
  const confirmar = () =>
    iniciar(async () => {
      setErro("");
      try {
        const form = formulario();
        form.set("mapa", JSON.stringify(mapa));
        const resultado = await importaPpc(form);
        if (!resultado.ok) {
          setErro(resultado.erro);
          return;
        }
        setAviso(
          `${resultado.dados.importadas} atividade(s) importada(s). ${resultado.dados.existentes} já existente(s), preservada(s).`,
        );
        setAberto(false);
        setInspecao(null);
        setArquivo(null);
        router.refresh();
      } catch {
        setErro(
          "Não foi possível confirmar a importação. Tente novamente; atividades existentes serão preservadas.",
        );
      }
    });
  const faltam = OBRIGATORIOS_PPC.filter((c) => !mapa[c]);
  const duplicadas = mapaPpcReutilizaColuna(mapa, inspecao?.emPares ?? false);

  return (
    <div className="flex max-w-[min(24rem,80vw)] flex-col items-start gap-2">
      {aviso ? <Alerta tipo="ok">{aviso}</Alerta> : null}
      <Botao
        onClick={() => {
          setErro("");
          setAberto(true);
        }}
      >
        Importar programação
      </Botao>
      <Modal
        aberto={aberto}
        aoFechar={() => {
          if (!pendente) setAberto(false);
        }}
        titulo="Importar PPC / Programação"
        largura={960}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--tinta-fraca)]">
            Selecione a aba PPC ou Programação de um arquivo .xlsx, com até 15
            MB e 5.000 atividades. Fórmulas devem estar calculadas e salvas no
            Excel.
          </p>
          {erro ? <Alerta>{erro}</Alerta> : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className="space-y-1 text-sm">
              Arquivo Excel
              <Campo
                type="file"
                accept=".xlsx"
                disabled={pendente}
                onChange={(e) => {
                  setArquivo(e.target.files?.[0] ?? null);
                  setInspecao(null);
                  setErro("");
                }}
              />
            </label>
            <label className="space-y-1 text-sm">
              Aba da planilha
              <Selecao
                value={aba}
                disabled={pendente}
                onChange={(e) => {
                  setAba(e.target.value);
                  setInspecao(null);
                  setErro("");
                }}
              >
                <option>PPC</option>
                <option>Programação</option>
              </Selecao>
            </label>
          </div>
          {!inspecao ? (
            <Botao disabled={!arquivo || pendente} onClick={conferir}>
              {pendente ? "Lendo planilha…" : "Conferir colunas"}
            </Botao>
          ) : (
            <>
              <h3 className="font-semibold">
                {inspecao.total}{" "}
                {inspecao.emPares
                  ? "atividade(s) em pares Previsto / Real"
                  : "linha(s)"}{" "}
                na aba {inspecao.aba}
              </h3>
              <p className="text-sm text-[var(--tinta-fraca)]">
                Confira as colunas e a amostra. Campos com * são obrigatórios;
                quantidade realizada vazia significa que ainda não foi
                informada.
              </p>
              {inspecao.emPares ? (
                <div className="space-y-3 rounded-md border border-[var(--borda)] p-3">
                  <label className="block space-y-1 text-sm font-medium">
                    Coluna da quantidade (Previsto e Real)
                    <Selecao
                      value={mapa.quantidade_prevista ?? ""}
                      disabled={pendente}
                      onChange={(e) =>
                        setMapa((anterior) => {
                          const novo = { ...anterior };
                          if (e.target.value) {
                            novo.quantidade_prevista = e.target.value;
                            novo.quantidade_realizada = e.target.value;
                          } else {
                            delete novo.quantidade_prevista;
                            delete novo.quantidade_realizada;
                          }
                          return novo;
                        })
                      }
                    >
                      <option value="">Selecione a coluna</option>
                      {inspecao.cabecalhos.map((c) => (
                        <option key={c} value={c}>
                          {c === "PPC" ? "PPC — total semanal" : c}
                        </option>
                      ))}
                    </Selecao>
                  </label>
                  <p className="text-sm text-[var(--tinta-fraca)]">
                    Uma seleção para os dois valores: o previsto vem da linha
                    Previsto e o realizado da linha Real logo abaixo. Os dados
                    compartilhados permanecem vinculados ao mesmo par.
                  </p>
                  {["QTD.", "QTD", "QUANTIDADE"].includes(
                    (mapa.quantidade_prevista ?? "").toUpperCase(),
                  ) && inspecao.cabecalhos.includes("PPC") ? (
                    <Alerta tipo="info">
                      Confira os valores da amostra. QTD. pode conter fórmulas
                      diferentes do total semanal PPC.
                    </Alerta>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CAMPOS_PPC.filter(
                  (c) =>
                    !inspecao.emPares ||
                    (c !== "quantidade_prevista" &&
                      c !== "quantidade_realizada"),
                ).map((campo) => (
                  <label key={campo} className="space-y-1 text-sm">
                    {ROTULOS_PPC[campo]}
                    {OBRIGATORIOS_PPC.includes(campo) ? " *" : ""}
                    <Selecao
                      value={mapa[campo] ?? ""}
                      disabled={pendente}
                      onChange={(e) =>
                        setMapa((anterior) => {
                          const novo = { ...anterior };
                          if (e.target.value) novo[campo] = e.target.value;
                          else delete novo[campo];
                          return novo;
                        })
                      }
                    >
                      <option value="">Não importar</option>
                      {inspecao.cabecalhos.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Selecao>
                  </label>
                ))}
              </div>
              <div className="max-w-full overflow-x-auto rounded border border-[var(--borda)]">
                <table className="w-full text-left text-xs">
                  <caption className="p-2 text-left font-medium">
                    Amostra{" "}
                    {inspecao.emPares
                      ? "das primeiras 5 atividades"
                      : "das primeiras 5 linhas"}
                  </caption>
                  <thead className="bg-[var(--marca-gelo)]">
                    <tr>
                      <th className="whitespace-nowrap p-2">
                        {inspecao.emPares ? "Linhas Previsto / Real" : "Linha"}
                      </th>
                      {CAMPOS_PPC.map((c) => (
                        <th key={c} className="whitespace-nowrap p-2">
                          {ROTULOS_PPC[c]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inspecao.amostra.map((l) => (
                      <tr
                        key={l.numero}
                        className="border-t border-[var(--borda)]"
                      >
                        <td className="whitespace-nowrap p-2">
                          {l.numero}
                          {l.real ? ` / ${l.real.numero}` : ""}
                        </td>
                        {CAMPOS_PPC.map((c) => (
                          <td
                            key={c}
                            className="max-w-64 truncate p-2"
                            title={valorMapeadoPpc(l, c, mapa)}
                          >
                            {valorMapeadoPpc(l, c, mapa) || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Alerta tipo="info">
                A importação cria atividades novas. Se já existir o mesmo ID,
                semana e início nesta obra, os dados salvos serão preservados.
                Linhas inválidas bloqueiam a importação inteira.
              </Alerta>
              {faltam.length ? (
                <p className="text-sm">
                  Identifique: {faltam.map((c) => ROTULOS_PPC[c]).join(", ")}.
                </p>
              ) : null}
              {duplicadas ? (
                <Alerta>
                  Uma coluna foi selecionada para mais de um campo.
                </Alerta>
              ) : null}
              <Botao
                disabled={pendente || !!faltam.length || duplicadas}
                onClick={confirmar}
              >
                {pendente ? "Importando…" : "Confirmar importação"}
              </Botao>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
