"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizaRestricao } from "@/server/restricoes/actions";
import type { Restricao } from "@/server/restricoes/queries";
import type { Membro } from "@/server/obras/queries";
import type { RestricaoEditavel } from "@/lib/restricoes/schemas";
import {
  formataData,
  PRIORIDADES,
  PRIORIDADE_ROTULO,
} from "@/lib/restricoes/dominio";
import {
  Alerta,
  AreaTexto,
  Botao,
  Campo,
  Rotulo,
  Selecao,
  TituloSecao,
} from "@/components/ui/basicos";

type Props = {
  restricao: Restricao;
  membros: Membro[];
  papel: "gestor" | "membro";
};

type CampoEditavel = keyof RestricaoEditavel;

type DefCampo = {
  campo: CampoEditavel;
  rotulo: string;
  tipo: "texto" | "area" | "data" | "prioridade" | "membro";
  obrigatorio?: boolean;
  lista?: readonly string[];
  placeholder?: string;
  /** Linha inteira no modo leitura (texto longo). */
  largo?: boolean;
};

const CAUSAS_6M = [
  "Método",
  "Material",
  "Máquina",
  "Mão de obra",
  "Medida",
  "Meio ambiente",
  "Segurança",
] as const;

type DefCartao = {
  titulo: string;
  campos: DefCampo[];
  /** Ocupa as duas colunas da grade de cards. */
  inteiro?: boolean;
};

const CARTOES: DefCartao[] = [
  {
    titulo: "Restrição",
    inteiro: true,
    campos: [
      {
        campo: "descricao",
        rotulo: "Descrição",
        tipo: "area",
        obrigatorio: true,
        largo: true,
      },
      { campo: "acao", rotulo: "Ação", tipo: "area", largo: true },
      { campo: "prioridade", rotulo: "Prioridade", tipo: "prioridade" },
      { campo: "codigo", rotulo: "Código na planilha", tipo: "texto" },
    ],
  },
  {
    titulo: "Responsável e prazos",
    campos: [
      { campo: "responsavel_id", rotulo: "Responsável", tipo: "membro" },
      {
        campo: "responsavel_nome",
        rotulo: "Responsável (texto)",
        tipo: "texto",
      },
      { campo: "responsavel_email", rotulo: "E-mail", tipo: "texto" },
      { campo: "responsavel_telefone", rotulo: "Telefone", tipo: "texto" },
      {
        campo: "data_criacao",
        rotulo: "Criada em",
        tipo: "data",
        obrigatorio: true,
      },
      { campo: "data_limite", rotulo: "Prazo", tipo: "data" },
      { campo: "previsao_conclusao", rotulo: "Previsão", tipo: "data" },
      { campo: "data_conclusao", rotulo: "Concluída em", tipo: "data" },
      {
        campo: "semana_programada",
        rotulo: "Semana programada",
        tipo: "texto",
        placeholder: "S-20",
      },
    ],
  },
  {
    titulo: "Classificação",
    campos: [
      {
        campo: "causa_6m",
        rotulo: "Causa 6M",
        tipo: "texto",
        lista: CAUSAS_6M,
      },
      { campo: "classificacao", rotulo: "Classificação", tipo: "texto" },
      { campo: "area", rotulo: "Área", tipo: "texto" },
      { campo: "setor", rotulo: "Setor", tipo: "texto" },
      { campo: "localizacao", rotulo: "Local", tipo: "texto" },
    ],
  },
  {
    titulo: "Atividade",
    campos: [
      { campo: "id_atividade", rotulo: "ID da atividade", tipo: "texto" },
      {
        campo: "atividade_impactada",
        rotulo: "Atividade impactada",
        tipo: "texto",
        largo: true,
      },
      { campo: "inicio_atividade", rotulo: "Início", tipo: "data" },
    ],
  },
  {
    titulo: "Situação e observações",
    campos: [
      {
        campo: "descricao_status",
        rotulo: "Situação",
        tipo: "area",
        largo: true,
      },
      {
        campo: "observacoes",
        rotulo: "Observações",
        tipo: "area",
        largo: true,
      },
    ],
  },
];

/**
 * Detalhes da restrição em cards de leitura, cada um com seu "Editar" (padrão
 * do app-phd), numa grade de duas colunas. Editar troca a leitura por campos
 * só daquele card; salvar manda só os campos que mudaram de fato — um card
 * aberto por muito tempo não desfaz o que outra pessoa gravou nos vizinhos.
 *
 * O status não mora aqui: é a barra clicável do cabeçalho.
 */
export function DetalhesRestricao({ restricao, membros, papel }: Props) {
  const extras = restricao.extras as Record<string, unknown>;
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      {CARTOES.map((c) => (
        <CartaoDetalhe
          key={c.titulo}
          def={c}
          restricao={restricao}
          membros={membros}
          papel={papel}
        />
      ))}
      {Object.keys(extras).length > 0 ? (
        <section className="rounded-xl border border-[var(--borda)] bg-white px-5 py-4 shadow-[var(--sombra-sm)] md:col-span-2">
          <details>
            <summary className="cursor-pointer">
              <TituloSecao como="span">Outras colunas da planilha</TituloSecao>
            </summary>
            <dl className="mt-3 grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(extras).map(([k, val]) => (
                <div key={k}>
                  <dt className="text-xs text-[var(--tinta-fraca)]">{k}</dt>
                  <dd className="break-words text-[var(--tinta-forte)]">
                    {String(val)}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
      ) : null}
    </div>
  );
}

function CartaoDetalhe({
  def,
  restricao: r,
  membros,
  papel,
}: {
  def: DefCartao;
  restricao: Restricao;
  membros: Membro[];
  papel: "gestor" | "membro";
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, inicia] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const botaoEditar = useRef<HTMLButtonElement>(null);
  // Ao sair da edição pelo teclado ou pelos botões, o foco volta ao "Editar";
  // sem isso ele cairia no corpo da página.
  const devolverFoco = useRef(false);

  useEffect(() => {
    if (editando) {
      formRef.current
        ?.querySelector<HTMLElement>(
          "input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
        )
        ?.focus();
    } else if (devolverFoco.current) {
      devolverFoco.current = false;
      botaoEditar.current?.focus();
    }
  }, [editando]);

  // "Salvo" é um respiro visual, some sozinho.
  useEffect(() => {
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(false), 2000);
    return () => clearTimeout(t);
  }, [salvo]);
  // Linha de base definida: só gestor mexe (o gatilho do banco também barra).
  const baseTravada = papel !== "gestor" && !!r.semana_programada;
  const nomes = new Map(membros.map((m) => [m.id, m.nome]));

  const leitura = (d: DefCampo): string => {
    const valor = r[d.campo];
    if (valor === null || valor === "") return "—";
    if (d.tipo === "data") return formataData(String(valor));
    if (d.tipo === "prioridade")
      return PRIORIDADE_ROTULO[valor as RestricaoEditavel["prioridade"]];
    if (d.tipo === "membro")
      return nomes.get(String(valor)) ?? "Usuário indisponível";
    return String(valor);
  };

  const fecha = () => {
    devolverFoco.current = true;
    setErro(null);
    setEditando(false);
  };

  const salvar = (form: FormData) => {
    const patch: Record<string, string | null> = {};
    for (const d of def.campos) {
      if (d.campo === "semana_programada" && baseTravada) continue;
      const bruto = String(form.get(d.campo) ?? "").trim();
      const novo = bruto === "" && !d.obrigatorio ? null : bruto;
      const original = r[d.campo];
      const antes =
        original === null || original === "" ? null : String(original);
      if ((novo === "" ? null : novo) !== antes) patch[d.campo] = novo;
    }
    if (Object.keys(patch).length === 0) {
      fecha();
      return;
    }
    inicia(async () => {
      const res = await atualizaRestricao(
        r.id,
        patch as Partial<RestricaoEditavel>,
      );
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      fecha();
      setSalvo(true);
      router.refresh();
    });
  };

  const id = (campo: string) => `${r.id}-${campo}`;

  return (
    <section
      className={`rounded-xl border border-[var(--borda)] bg-white px-5 py-4 shadow-[var(--sombra-sm)] ${def.inteiro ? "md:col-span-2" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <TituloSecao>{def.titulo}</TituloSecao>
        <div className="flex items-center gap-1">
          <span
            role="status"
            className="text-xs font-semibold text-[var(--sucesso-tinta)]"
          >
            {salvo ? "Salvo" : ""}
          </span>
          {!editando ? (
            <button
              ref={botaoEditar}
              type="button"
              onClick={() => {
                setErro(null);
                setSalvo(false);
                setEditando(true);
              }}
              aria-label={`Editar ${def.titulo}`}
              className="-my-2 -mr-2 inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-[var(--marca-terracotta)] transition hover:bg-[var(--marca-brand-50)]"
            >
              <span aria-hidden>✎</span>&nbsp;Editar
            </button>
          ) : null}
        </div>
      </div>

      {!editando ? (
        <dl
          className={`grid grid-cols-2 gap-x-4 gap-y-3 text-sm ${def.inteiro ? "sm:grid-cols-4" : ""}`}
        >
          {def.campos.map((d) => (
            <div key={d.campo} className={d.largo ? "col-span-full" : ""}>
              <dt className="text-xs text-[var(--tinta-fraca)]">{d.rotulo}</dt>
              <dd className="break-words whitespace-pre-line text-[var(--tinta-forte)]">
                {leitura(d)}
              </dd>
              {d.campo === "data_limite" &&
              r.prazo_original &&
              r.prazo_original !== r.data_limite ? (
                <dd className="mt-0.5 text-[11px] text-[var(--aviso-tinta)]">
                  Original {formataData(r.prazo_original)} · {r.reprogramacoes}{" "}
                  {r.reprogramacoes === 1 ? "reprogramação" : "reprogramações"}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      ) : (
        <form
          ref={formRef}
          aria-label={`Editar ${def.titulo}`}
          onSubmit={(ev) => {
            ev.preventDefault();
            salvar(new FormData(ev.currentTarget));
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Escape" && !pendente) {
              ev.preventDefault();
              fecha();
            }
          }}
          className={`grid gap-3 ${def.inteiro ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}
        >
          {def.campos.map((d) => {
            const atual = r[d.campo];
            const valor = atual === null ? "" : String(atual);
            const travado = d.campo === "semana_programada" && baseTravada;
            return (
              <div
                key={d.campo}
                className={d.tipo === "area" || d.largo ? "col-span-full" : ""}
              >
                <Rotulo htmlFor={id(d.campo)}>{d.rotulo}</Rotulo>
                {d.tipo === "area" ? (
                  <AreaTexto
                    id={id(d.campo)}
                    name={d.campo}
                    defaultValue={valor}
                    rows={3}
                    required={d.obrigatorio}
                  />
                ) : d.tipo === "prioridade" ? (
                  <Selecao id={id(d.campo)} name={d.campo} defaultValue={valor}>
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORIDADE_ROTULO[p]}
                      </option>
                    ))}
                  </Selecao>
                ) : d.tipo === "membro" ? (
                  <Selecao id={id(d.campo)} name={d.campo} defaultValue={valor}>
                    <option value="">— nenhum —</option>
                    {/* Sem esta opção o select cairia em "nenhum" e salvar
                        apagaria o responsável sem ninguém pedir. */}
                    {valor && !nomes.has(valor) ? (
                      <option value={valor}>Usuário indisponível</option>
                    ) : null}
                    {membros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </Selecao>
                ) : (
                  <>
                    <Campo
                      id={id(d.campo)}
                      name={d.campo}
                      type={d.tipo === "data" ? "date" : "text"}
                      defaultValue={valor}
                      required={d.obrigatorio}
                      disabled={travado}
                      title={travado ? "Só gestor da obra altera" : undefined}
                      placeholder={d.placeholder}
                      list={d.lista ? `${id(d.campo)}-lista` : undefined}
                    />
                    {d.lista ? (
                      <datalist id={`${id(d.campo)}-lista`}>
                        {d.lista.map((x) => (
                          <option key={x} value={x} />
                        ))}
                      </datalist>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
          {erro ? (
            <div className="col-span-full">
              <Alerta>{erro}</Alerta>
            </div>
          ) : null}
          <div className="col-span-full flex justify-end gap-2 pt-1">
            <Botao variante="fantasma" onClick={fecha} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={pendente}>
              {pendente ? "Salvando…" : "Salvar"}
            </Botao>
          </div>
        </form>
      )}
    </section>
  );
}
