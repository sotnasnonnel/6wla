"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DIAS_ROTULO_CURTO } from "@/lib/automacoes/agenda";
import {
  montaAssunto,
  SITUACAO_EMAIL_INFO,
  type ObraEmail,
  type RestricaoComPerfil,
} from "@/lib/automacoes/email";
import {
  automacaoSchema,
  LIMITES,
  SITUACOES_EMAIL,
  type AutomacaoConfig,
} from "@/lib/automacoes/schema";
import { criaAutomacao, editaAutomacao } from "@/server/automacoes/actions";
import {
  Alerta,
  Botao,
  Campo,
  CampoRotulado,
  TituloSecao,
} from "@/components/ui/basicos";
import { Modal } from "@/components/ui/modal";
import { CampoEmails } from "./campo-emails";
import { PreviaEmail } from "./previa";
import { SeletorColunas } from "./seletor-colunas";

/** Segunda a domingo, na ordem de quem trabalha em obra. */
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0] as const;

type Erros = Partial<Record<keyof AutomacaoConfig, string>>;

export function EditorAutomacao({
  automacaoId,
  inicial,
  obra,
  restricoes,
  site,
  hoje,
  copiasFixas,
  aoFechar,
}: {
  /** `null` = nova. */
  automacaoId: string | null;
  inicial: AutomacaoConfig;
  obra: ObraEmail;
  restricoes: readonly RestricaoComPerfil[];
  site: string | null;
  hoje: string;
  copiasFixas: readonly string[];
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [c, setC] = useState<AutomacaoConfig>(inicial);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();

  const muda = <K extends keyof AutomacaoConfig>(
    campo: K,
    valor: AutomacaoConfig[K],
  ) => {
    setC((atual) => ({ ...atual, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: undefined }));
  };

  const alternaNaLista = <T,>(lista: readonly T[], item: T): T[] =>
    lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item];

  const salva = () => {
    const parsed = automacaoSchema.safeParse(c);
    if (!parsed.success) {
      const novos: Erros = {};
      for (const issue of parsed.error.issues) {
        const campo = issue.path[0];
        if (typeof campo === "string" && campo in c) {
          const chave = campo as keyof AutomacaoConfig;
          novos[chave] ??= issue.message;
        }
      }
      setErros(novos);
      setErroGeral("Revise os campos marcados.");
      return;
    }
    setErroGeral(null);
    inicia(async () => {
      const r = automacaoId
        ? await editaAutomacao(automacaoId, parsed.data)
        : await criaAutomacao(obra.id, parsed.data);
      if (!r.ok) {
        setErroGeral(r.erro);
        return;
      }
      router.refresh();
      aoFechar();
    });
  };

  const exemploNome =
    c.destino === "lista"
      ? "Todos"
      : (restricoes.find((r) => r.responsavel)?.responsavel?.nome ??
        restricoes.find((r) => r.responsavel_nome)?.responsavel_nome ??
        "Fulano");

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      bloqueado={pendente}
      largura={1240}
      titulo={automacaoId ? "Editar automação" : "Nova automação"}
      descricao="Relatório de restrições por e-mail. O envio é feito pelo n8n, que consulta o 6wla a cada 15 minutos."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={pendente}>
            Cancelar
          </Botao>
          <Botao onClick={salva} disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar"}
          </Botao>
        </>
      }
    >
      <div className="grid gap-6 pb-2 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="space-y-5">
          {erroGeral ? <Alerta>{erroGeral}</Alerta> : null}

          <CampoRotulado id="aut-nome" rotulo="Nome" erro={erros.nome}>
            <Campo
              id="aut-nome"
              value={c.nome}
              maxLength={LIMITES.nome}
              onChange={(e) => muda("nome", e.target.value)}
              data-autofocus=""
            />
          </CampoRotulado>

          <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--tinta-forte)]">
            <input
              type="checkbox"
              checked={c.ativa}
              onChange={(e) => muda("ativa", e.target.checked)}
              className="h-4 w-4 accent-[var(--marca-terracotta)]"
            />
            Ativa (dispara nos horários abaixo)
          </label>

          <section className="space-y-3">
            <TituloSecao como="h3">Quando</TituloSecao>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-[var(--tinta-media)]">
                Dias da semana
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {ORDEM_DIAS.map((d) => {
                  const marcado = c.dias_semana.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() =>
                        muda(
                          "dias_semana",
                          alternaNaLista(c.dias_semana, d).sort(
                            (a, b) => a - b,
                          ),
                        )
                      }
                      className={`min-h-10 min-w-12 rounded-full border px-3 text-sm font-semibold transition ${
                        marcado
                          ? "border-[var(--marca-terracotta)] bg-[var(--marca-brand-50)] text-[var(--marca-terracotta-escuro)]"
                          : "border-[var(--borda)] bg-white text-[var(--tinta-media)] hover:bg-[var(--plano)]"
                      }`}
                    >
                      {DIAS_ROTULO_CURTO[d]}
                    </button>
                  );
                })}
              </div>
              {erros.dias_semana ? (
                <p className="mt-1 text-xs text-[var(--perigo)]">
                  {erros.dias_semana}
                </p>
              ) : null}
            </fieldset>
            <CampoRotulado
              id="aut-hora"
              rotulo="Hora"
              dica="horário de Brasília"
              erro={erros.hora}
              className="max-w-[10rem]"
            >
              <Campo
                id="aut-hora"
                type="time"
                step={60}
                value={c.hora}
                onChange={(e) => muda("hora", e.target.value.slice(0, 5))}
              />
            </CampoRotulado>
          </section>

          <section className="space-y-3">
            <TituloSecao como="h3">O que entra</TituloSecao>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-[var(--tinta-media)]">
                Situações (só restrições abertas)
              </legend>
              <div className="space-y-1">
                {SITUACOES_EMAIL.map((s) => {
                  const info = SITUACAO_EMAIL_INFO[s];
                  return (
                    <label
                      key={s}
                      className="flex min-h-10 cursor-pointer items-start gap-2.5 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={c.situacoes.includes(s)}
                        onChange={() =>
                          muda(
                            "situacoes",
                            SITUACOES_EMAIL.filter((x) =>
                              alternaNaLista(c.situacoes, s).includes(x),
                            ),
                          )
                        }
                        className="mt-0.5 h-4 w-4 accent-[var(--marca-terracotta)]"
                      />
                      <span>
                        <span className="font-medium text-[var(--tinta-forte)]">
                          <span aria-hidden>{info.emoji} </span>
                          {info.titulo}
                        </span>
                        <span className="block text-xs text-[var(--tinta-fraca)]">
                          {info.explicacao}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {erros.situacoes ? (
                <p className="mt-1 text-xs text-[var(--perigo)]">
                  {erros.situacoes}
                </p>
              ) : null}
            </fieldset>
            <SeletorColunas
              valor={c.colunas}
              aoMudar={(v) => muda("colunas", v)}
              erro={erros.colunas}
            />
          </section>

          <section className="space-y-3">
            <TituloSecao como="h3">Para quem</TituloSecao>
            <fieldset className="space-y-1">
              <legend className="sr-only">Destino</legend>
              <label className="flex min-h-10 cursor-pointer items-start gap-2.5 py-1 text-sm">
                <input
                  type="radio"
                  name="aut-destino"
                  checked={c.destino === "responsaveis"}
                  onChange={() => muda("destino", "responsaveis")}
                  className="mt-0.5 h-4 w-4 accent-[var(--marca-terracotta)]"
                />
                <span>
                  <span className="font-medium text-[var(--tinta-forte)]">
                    Cada responsável recebe as suas
                  </span>
                  <span className="block text-xs text-[var(--tinta-fraca)]">
                    Um e-mail por pessoa, no e-mail do cadastro dela no 6wla
                    (responsável só com nome digitado não recebe).
                  </span>
                </span>
              </label>
              <label className="flex min-h-10 cursor-pointer items-start gap-2.5 py-1 text-sm">
                <input
                  type="radio"
                  name="aut-destino"
                  checked={c.destino === "lista"}
                  onChange={() => muda("destino", "lista")}
                  className="mt-0.5 h-4 w-4 accent-[var(--marca-terracotta)]"
                />
                <span>
                  <span className="font-medium text-[var(--tinta-forte)]">
                    Uma lista fixa de e-mails
                  </span>
                  <span className="block text-xs text-[var(--tinta-fraca)]">
                    Um e-mail só, com todas as restrições.
                  </span>
                </span>
              </label>
            </fieldset>

            {c.destino === "lista" ? (
              <>
                <CampoEmails
                  id="aut-destinatarios"
                  rotulo="Destinatários"
                  valor={c.destinatarios}
                  aoMudar={(v) => muda("destinatarios", v)}
                  maximo={LIMITES.destinatarios}
                  erro={erros.destinatarios}
                />
                <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={c.agrupar_por_responsavel}
                    onChange={(e) =>
                      muda("agrupar_por_responsavel", e.target.checked)
                    }
                    className="h-4 w-4 accent-[var(--marca-terracotta)]"
                  />
                  Separar por responsável dentro do e-mail
                </label>
              </>
            ) : null}

            <CampoEmails
              id="aut-copias"
              rotulo="Cópia para"
              dica={`opcional, até ${LIMITES.copias}; vai em todos os e-mails`}
              valor={c.copias}
              aoMudar={(v) => muda("copias", v)}
              maximo={LIMITES.copias}
              erro={erros.copias}
            />

            <CampoRotulado
              id="aut-assunto"
              rotulo="Assunto"
              dica="use {responsavel}, {obra} e {data}"
              erro={erros.assunto}
            >
              <Campo
                id="aut-assunto"
                value={c.assunto}
                maxLength={LIMITES.assunto}
                onChange={(e) => muda("assunto", e.target.value)}
              />
            </CampoRotulado>
            <p className="-mt-2 text-xs text-[var(--tinta-fraca)]">
              Fica assim:{" "}
              <span className="font-medium text-[var(--tinta-media)]">
                {montaAssunto(c.assunto, {
                  responsavel: exemploNome,
                  obra,
                  hoje,
                })}
              </span>
            </p>
          </section>
        </div>

        <section className="min-w-0 space-y-3" aria-label="Prévia do e-mail">
          <TituloSecao como="h3">Prévia com os dados de hoje</TituloSecao>
          <PreviaEmail
            restricoes={restricoes}
            ctx={{ obra, site, hoje, config: c, copiasFixas }}
          />
        </section>
      </div>
    </Modal>
  );
}
