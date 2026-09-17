"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ObraEmail, RestricaoComPerfil } from "@/lib/automacoes/email";
import { modeloPlanilha, type AutomacaoConfig } from "@/lib/automacoes/schema";
import {
  alternaAutomacao,
  enviaTeste,
  excluiAutomacao,
} from "@/server/automacoes/actions";
import {
  Alerta,
  Botao,
  CabecalhoPagina,
  Cartao,
  Etiqueta,
  TituloSecao,
  Vazio,
} from "@/components/ui/basicos";
import { Confirmacao } from "@/components/ui/confirmacao";
import { EditorAutomacao } from "./editor";
import { SituacaoFluxo, type FluxoVista } from "./situacao-fluxo";

export type AutomacaoVista = {
  id: string;
  config: AutomacaoConfig;
  /** "Seg a sex · 07:30 · por responsável". */
  resumo: string;
  proxima: string | null;
  ultimoEnvio: string | null;
};

export type EnvioVista = {
  id: string;
  automacao: string;
  destinatario: string;
  status: string;
  total: number;
  horario: string;
  erro: string | null;
  teste: boolean;
};

type Aviso = { tipo: "ok" | "erro"; texto: string; id: string };

const STATUS_ENVIO: Record<
  string,
  { rotulo: string; tom: "neutro" | "azul" | "verde" | "vermelho" }
> = {
  reservado: { rotulo: "Na fila", tom: "azul" },
  enviado: { rotulo: "Enviado", tom: "verde" },
  erro: { rotulo: "Erro", tom: "vermelho" },
  sem_conteudo: { rotulo: "Sem conteúdo", tom: "neutro" },
};

function novaEmBranco(): AutomacaoConfig {
  return { ...modeloPlanilha(), nome: "" };
}

export function PainelAutomacoes({
  obra,
  automacoes,
  envios,
  restricoes,
  site,
  hoje,
  meuEmail,
  copiasFixas,
  fluxo,
}: {
  obra: ObraEmail;
  automacoes: AutomacaoVista[];
  envios: EnvioVista[];
  restricoes: RestricaoComPerfil[];
  site: string | null;
  hoje: string;
  meuEmail: string;
  /** Sempre em cópia (gestor dono da obra). */
  copiasFixas: string[];
  fluxo: FluxoVista;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<{
    id: string | null;
    config: AutomacaoConfig;
    chave: number;
  } | null>(null);
  const [excluir, setExcluir] = useState<AutomacaoVista | null>(null);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();

  const abre = (id: string | null, config: AutomacaoConfig) =>
    setEditor({ id, config, chave: Date.now() });

  const alterna = (a: AutomacaoVista) => {
    setOcupado(`alterna:${a.id}`);
    inicia(async () => {
      const r = await alternaAutomacao(a.id, !a.config.ativa);
      setOcupado(null);
      if (!r.ok) setAviso({ tipo: "erro", texto: r.erro, id: a.id });
      else router.refresh();
    });
  };

  const testa = (a: AutomacaoVista) => {
    setOcupado(`teste:${a.id}`);
    inicia(async () => {
      const r = await enviaTeste(a.id);
      setOcupado(null);
      setAviso(
        r.ok
          ? {
              tipo: "ok",
              id: a.id,
              texto: `Teste na fila para ${meuEmail} (${r.dados.total} restrição(ões)). Chega em até 15 minutos.`,
            }
          : { tipo: "erro", texto: r.erro, id: a.id },
      );
      if (r.ok) router.refresh();
    });
  };

  const confirmaExclusao = () => {
    if (!excluir) return;
    const alvo = excluir;
    inicia(async () => {
      const r = await excluiAutomacao(alvo.id);
      if (!r.ok) {
        setErroExcluir(r.erro);
        return;
      }
      setExcluir(null);
      setErroExcluir(null);
      router.refresh();
    });
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Automações"
        apoio={`Relatórios de restrições de ${obra.nome} enviados por e-mail nos dias e horários escolhidos.`}
        acoes={
          <>
            <Botao
              variante="secundario"
              onClick={() => abre(null, modeloPlanilha())}
            >
              Usar modelo da planilha
            </Botao>
            <Botao onClick={() => abre(null, novaEmBranco())}>
              Nova automação
            </Botao>
          </>
        }
      />

      <SituacaoFluxo obraId={obra.id} fluxo={fluxo} />

      {automacoes.length === 0 ? (
        <Vazio
          titulo="Nenhuma automação nesta obra"
          descricao="Comece pelo modelo “Lista de restrições (como a planilha)”: de segunda a sexta às 7h30, cada responsável recebe as restrições pendentes e no prazo."
          acao={
            <Botao onClick={() => abre(null, modeloPlanilha())}>
              Usar modelo da planilha
            </Botao>
          }
        />
      ) : (
        <ul className="space-y-3">
          {automacoes.map((a) => {
            const ativa = a.config.ativa;
            return (
              <li key={a.id}>
                <Cartao>
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-[var(--tinta-forte)]">
                        {a.config.nome}
                      </h2>
                      <p className="mt-0.5 text-sm text-[var(--tinta-media)]">
                        {a.resumo}
                      </p>
                      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--tinta-fraca)]">
                        <div className="flex gap-1">
                          <dt>Próxima execução:</dt>
                          <dd className="font-medium text-[var(--tinta-media)]">
                            {ativa ? (a.proxima ?? "—") : "pausada"}
                          </dd>
                        </div>
                        <div className="flex gap-1">
                          <dt>Último envio:</dt>
                          <dd className="font-medium text-[var(--tinta-media)]">
                            {a.ultimoEnvio ?? "nenhum ainda"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-[var(--tinta-media)]">
                      <span>{ativa ? "Ativa" : "Pausada"}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={ativa}
                        aria-label={`${a.config.nome}: ${ativa ? "ativa" : "pausada"}`}
                        disabled={pendente}
                        onClick={() => alterna(a)}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                          ativa
                            ? "bg-[var(--marca-terracotta)]"
                            : "bg-[var(--borda-forte)]"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            ativa ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--grade)] pt-3">
                    <Botao
                      variante="secundario"
                      onClick={() => abre(a.id, a.config)}
                    >
                      Editar e ver prévia
                    </Botao>
                    <Botao
                      variante="secundario"
                      onClick={() => testa(a)}
                      disabled={pendente}
                      title="Usa a configuração salva. O n8n entrega em até 15 minutos."
                    >
                      {ocupado === `teste:${a.id}`
                        ? "Enfileirando…"
                        : "Enviar teste para mim"}
                    </Botao>
                    <Botao
                      variante="fantasma"
                      onClick={() => {
                        setErroExcluir(null);
                        setExcluir(a);
                      }}
                      disabled={pendente}
                    >
                      Excluir
                    </Botao>
                  </div>
                  {aviso?.id === a.id ? (
                    <div className="mt-3">
                      <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>
                    </div>
                  ) : null}
                </Cartao>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-xs text-[var(--tinta-fraca)]">
        Os e-mails saem de sistema@phdengenharia.eng.br pelo n8n, que consulta o
        6wla a cada 15 minutos — um envio pode chegar até 15 minutos depois do
        horário. O teste vai só para você ({meuEmail}), com tudo num e-mail.
      </p>

      <section className="mt-8" aria-labelledby="historico-envios">
        <div id="historico-envios" className="mb-3">
          <TituloSecao>Últimos envios</TituloSecao>
        </div>
        {envios.length === 0 ? (
          <p className="text-sm text-[var(--tinta-fraca)]">
            Nenhum envio registrado ainda.
          </p>
        ) : (
          <div className="rolagem-fina overflow-x-auto rounded-xl border border-[var(--borda)] bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[var(--plano)] text-xs text-[var(--tinta-fraca)]">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Quando
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Automação
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Para
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Itens
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--grade)]">
                {envios.map((e) => {
                  const st = STATUS_ENVIO[e.status] ?? {
                    rotulo: e.status,
                    tom: "neutro" as const,
                  };
                  return (
                    <tr key={e.id} className="align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-[var(--tinta-media)]">
                        {e.horario}
                      </td>
                      <td className="px-3 py-2 text-[var(--tinta-forte)]">
                        {e.automacao}
                        {e.teste ? (
                          <span className="ml-1.5">
                            <Etiqueta tom="amarelo">teste</Etiqueta>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 break-all text-[var(--tinta-media)]">
                        {e.destinatario || "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{e.total}</td>
                      <td className="px-3 py-2">
                        <Etiqueta tom={st.tom}>{st.rotulo}</Etiqueta>
                        {e.erro ? (
                          <p className="mt-1 max-w-xs text-xs text-[var(--tinta-fraca)]">
                            {e.erro}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editor ? (
        <EditorAutomacao
          key={editor.chave}
          automacaoId={editor.id}
          inicial={editor.config}
          obra={obra}
          restricoes={restricoes}
          site={site}
          hoje={hoje}
          copiasFixas={copiasFixas}
          aoFechar={() => setEditor(null)}
        />
      ) : null}

      <Confirmacao
        aberto={excluir !== null}
        aoFechar={() => setExcluir(null)}
        aoConfirmar={confirmaExclusao}
        titulo="Excluir automação?"
        descricao={
          excluir
            ? `“${excluir.config.nome}” para de enviar e o histórico dela é apagado.`
            : ""
        }
        rotuloConfirmar="Excluir"
        rotuloPendente="Excluindo…"
        tom="perigo"
        pendente={pendente}
        erro={erroExcluir}
      />
    </>
  );
}
