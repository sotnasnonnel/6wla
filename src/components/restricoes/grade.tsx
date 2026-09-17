"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { geraXlsx, nomeArquivo } from "@/lib/exportacao/xlsx";
import { planilhaDeRestricoes } from "@/lib/restricoes/planilha";
import { atualizaCampo } from "@/server/restricoes/actions";
import type { Restricao } from "@/server/restricoes/queries";
import type { Membro } from "@/server/obras/queries";
import type { RestricaoEditavel } from "@/lib/restricoes/schemas";
import {
  PRIORIDADES,
  PRIORIDADE_ROTULO,
  STATUS,
  STATUS_ROTULO,
  diasParaPrazo,
  estaAtrasada,
  formataData,
  formataNumero,
  hojeIso,
} from "@/lib/restricoes/dominio";
import {
  FILTROS_PADRAO,
  RESP_SEM,
  caminhoDetalhe,
  contaFiltros,
  filtraRestricoes,
  ordenaRestricoes,
  serializaFiltros,
  type FiltroStatus,
  type FiltrosGrade,
} from "@/lib/restricoes/filtros";
import { CelulaEditavel } from "./celula";
import { CartoesRestricoes } from "./cartoes";
import { TOM_PRIORIDADE, TOM_STATUS } from "./tons";
import { ModalNovaRestricao } from "./modal-nova";
import { Botao, Etiqueta } from "@/components/ui/basicos";

const COLUNAS_OCULTAS_PADRAO: VisibilityState = {
  codigo: false,
  responsavel_email: false,
  responsavel_telefone: false,
  descricao_status: false,
  id_atividade: false,
  inicio_atividade: false,
  localizacao: false,
  previsao_conclusao: false,
  semana_programada: false,
  observacoes: false,
  data_criacao: false,
  reprogramacoes: false,
};

type Props = {
  obraId: string;
  obraNome: string;
  restricoes: Restricao[];
  membros: Membro[];
  papel: "gestor" | "membro";
  /** Recorte lido da URL pela página: voltar do detalhe mantém a lista. */
  filtrosIniciais?: FiltrosGrade;
};

/** Nº e Restrição ficam presos à esquerda ao rolar para os lados. */
const FIXAS = ["numero", "descricao"];

// Tempo do destaque de linha alterada por outra pessoa. Conta desde o aviso
// do Realtime, e o dado novo ainda precisa vir do servidor: por isso um pouco
// mais que o piscar de olhos de 1,5 s.
const DESTAQUE_MS = 2500;

/** Id da linha num aviso do Realtime (`new` vem vazio num DELETE). */
function idDoAviso(registro: unknown): string | null {
  if (typeof registro !== "object" || registro === null) return null;
  if (!("id" in registro)) return null;
  return typeof registro.id === "string" ? registro.id : null;
}

const ajuda = createColumnHelper<Restricao>();

export function GradeRestricoes({
  obraId,
  obraNome,
  restricoes,
  membros,
  papel,
  filtrosIniciais = FILTROS_PADRAO,
}: Props) {
  const router = useRouter();
  // Lista atual para quem guarda edições: as colunas são memorizadas e o
  // `salvar` delas enxergaria a lista de quando foram criadas.
  const restricoesAtuais = useRef(restricoes);
  useEffect(() => {
    restricoesAtuais.current = restricoes;
  }, [restricoes]);
  /**
   * Resultado das edições locais, guardado junto da lista que o servidor
   * mandou quando elas aconteceram. Chegou lista nova (Realtime, refresh,
   * outra pessoa editando), a cópia local é descartada: o servidor é a fonte
   * da verdade e uma sobrescrita antiga esconderia o que mudou nos outros
   * campos.
   */
  const [edicoes, setEdicoes] = useState<{
    fonte: Restricao[];
    mapa: Record<string, Restricao>;
  }>({ fonte: restricoes, mapa: {} });
  const sobrescritas = useMemo(
    () => (edicoes.fonte === restricoes ? edicoes.mapa : {}),
    [edicoes, restricoes],
  );
  const [busca, setBusca] = useState(filtrosIniciais.busca);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>(
    filtrosIniciais.status,
  );
  const [filtroResp, setFiltroResp] = useState(filtrosIniciais.resp);
  const [soAtrasadas, setSoAtrasadas] = useState(filtrosIniciais.atrasadas);
  const [ordenacao, setOrdenacao] = useState<SortingState>(() =>
    filtrosIniciais.ordem ? [filtrosIniciais.ordem] : [],
  );
  const [visiveis, setVisiveis] = useState<VisibilityState>(
    COLUNAS_OCULTAS_PADRAO,
  );
  const [menuColunas, setMenuColunas] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const botaoColunas = useRef<HTMLButtonElement>(null);
  const [anuncio, setAnuncio] = useState("");
  const [destacadas, setDestacadas] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Linhas que eu mesmo acabei de salvar: o Realtime avisa delas também, e
  // não faz sentido destacar a minha própria edição.
  const meusSalvos = useRef(new Map<string, number>());
  const [modalAberto, setModalAberto] = useState(false);
  // No celular os filtros ficam recolhidos: a busca resolve a maioria dos
  // casos e a lista começa mais perto do topo da tela.
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const hoje = hojeIso();

  // Outros usuários editando a mesma obra: recarrega os dados do servidor.
  useEffect(() => {
    const supabase = createClient();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const canal = supabase
      .channel(`restricoes:${obraId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "6wla_restricoes",
          filter: `obra_id=eq.${obraId}`,
        },
        (aviso) => {
          const id = idDoAviso(aviso.new);
          const meu = id ? meusSalvos.current.get(id) : undefined;
          if (id && !(meu && Date.now() - meu < 5000)) {
            setDestacadas((atual) => new Set(atual).add(id));
            const t = setTimeout(() => {
              timers.delete(t);
              setDestacadas((atual) => {
                const novo = new Set(atual);
                novo.delete(id);
                return novo;
              });
            }, DESTAQUE_MS);
            timers.add(t);
          }
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      for (const t of timers) clearTimeout(t);
      void supabase.removeChannel(canal);
    };
  }, [obraId, router]);

  // Recorte na URL: recarregar ou voltar do detalhe devolve a mesma lista.
  // `history.replaceState` (integrado ao roteador do Next) não refaz a busca
  // no servidor a cada tecla, como faria `router.replace`.
  const ordem = ordenacao[0] ?? null;
  const qs = serializaFiltros({
    busca,
    status: filtroStatus,
    resp: filtroResp,
    atrasadas: soAtrasadas,
    ordem: ordem ? { id: ordem.id, desc: ordem.desc } : null,
  });
  useEffect(() => {
    const t = setTimeout(() => {
      const alvo = qs ? `?${qs}` : "";
      if (window.location.search === alvo) return;
      window.history.replaceState(null, "", alvo || window.location.pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [qs]);

  // Menu de colunas: Esc e clique fora fecham.
  useEffect(() => {
    if (!menuColunas) return;
    const fora = (ev: PointerEvent) => {
      if (ev.target instanceof Node && menuRef.current?.contains(ev.target))
        return;
      setMenuColunas(false);
    };
    const tecla = (ev: globalThis.KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      setMenuColunas(false);
      botaoColunas.current?.focus();
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [menuColunas]);

  const nomePorId = useMemo(
    () => new Map(membros.map((m) => [m.id, m.nome])),
    [membros],
  );

  // Filtro e ordenação são as mesmas funções que o detalhe usa para o
  // anterior/próxima: as duas telas concordam sobre a ordem da lista.
  const ordemId = ordem?.id;
  const ordemDesc = ordem?.desc;
  const dados = useMemo(() => {
    const linhas = restricoes.map((r) => sobrescritas[r.id] ?? r);
    const filtradas = filtraRestricoes(
      linhas,
      {
        busca,
        status: filtroStatus,
        resp: filtroResp,
        atrasadas: soAtrasadas,
        ordem: null,
      },
      { nomePorId, hoje },
    );
    return ordenaRestricoes(
      filtradas,
      ordemId === undefined ? null : { id: ordemId, desc: ordemDesc === true },
      nomePorId,
    );
  }, [
    restricoes,
    sobrescritas,
    busca,
    filtroStatus,
    filtroResp,
    soAtrasadas,
    hoje,
    nomePorId,
    ordemId,
    ordemDesc,
  ]);

  const responsaveis = useMemo(() => {
    const s = new Set<string>();
    for (const r of restricoes) {
      const nome = r.responsavel_id
        ? nomePorId.get(r.responsavel_id)
        : r.responsavel_nome;
      if (nome) s.add(nome);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [restricoes, nomePorId]);

  const salvar =
    (r: Restricao, campo: keyof RestricaoEditavel) => async (valor: string) => {
      meusSalvos.current.set(r.id, Date.now());
      const res = await atualizaCampo({ restricaoId: r.id, campo, valor });
      if (!res.ok) return res.erro;
      meusSalvos.current.set(r.id, Date.now());
      const fonte = restricoesAtuais.current;
      setEdicoes((atual) => ({
        fonte,
        mapa: {
          ...(atual.fonte === fonte ? atual.mapa : {}),
          [res.dados.id]: res.dados,
        },
      }));
      setAnuncio(`${formataNumero(r.numero)}: salvo.`);
      return null;
    };

  const textoCol = (
    campo: keyof RestricaoEditavel & keyof Restricao,
    cabecalho: string,
    largura: number,
  ) =>
    ajuda.accessor((r) => (r[campo] as string | null) ?? "", {
      id: campo,
      header: cabecalho,
      size: largura,
      cell: ({ row, getValue }) => (
        <CelulaEditavel
          valor={getValue()}
          tipo="texto"
          rotulo={`${cabecalho} de ${formataNumero(row.original.numero)}`}
          aoSalvar={salvar(row.original, campo)}
        />
      ),
    });

  const dataCol = (
    campo: keyof RestricaoEditavel & keyof Restricao,
    cabecalho: string,
  ) =>
    ajuda.accessor((r) => (r[campo] as string | null) ?? "", {
      id: campo,
      header: cabecalho,
      size: 110,
      cell: ({ row, getValue }) => (
        <CelulaEditavel
          valor={getValue()}
          tipo="data"
          rotulo={`${cabecalho} de ${formataNumero(row.original.numero)}`}
          exibicao={getValue() ? formataData(getValue()) : undefined}
          aoSalvar={salvar(row.original, campo)}
        />
      ),
    });

  const colunas = useMemo(
    () => [
      ajuda.accessor("numero", {
        header: "Nº",
        size: 70,
        enableHiding: false,
        cell: ({ row }) => (
          <Link
            href={caminhoDetalhe(obraId, row.original.id, qs)}
            className="block px-2 py-1 font-mono text-xs font-semibold text-[var(--marca-terracotta)] hover:underline"
            title="Abrir detalhes e chat"
          >
            {formataNumero(row.original.numero)}
          </Link>
        ),
      }),
      ajuda.accessor("status", {
        header: "Status",
        size: 130,
        cell: ({ row, getValue }) => (
          <CelulaEditavel
            valor={getValue()}
            tipo="selecao"
            rotulo={`Status de ${formataNumero(row.original.numero)}`}
            opcoes={STATUS.map((s) => ({ valor: s, rotulo: STATUS_ROTULO[s] }))}
            exibicao={
              <Etiqueta tom={TOM_STATUS[getValue()]}>
                {STATUS_ROTULO[getValue()]}
              </Etiqueta>
            }
            aoSalvar={salvar(row.original, "status")}
          />
        ),
      }),
      ajuda.accessor("prioridade", {
        header: "Prior.",
        size: 100,
        cell: ({ row, getValue }) => (
          <CelulaEditavel
            valor={getValue()}
            tipo="selecao"
            rotulo={`Prioridade de ${formataNumero(row.original.numero)}`}
            opcoes={PRIORIDADES.map((p) => ({
              valor: p,
              rotulo: PRIORIDADE_ROTULO[p],
            }))}
            exibicao={
              <Etiqueta tom={TOM_PRIORIDADE[getValue()]}>
                {PRIORIDADE_ROTULO[getValue()]}
              </Etiqueta>
            }
            aoSalvar={salvar(row.original, "prioridade")}
          />
        ),
      }),
      { ...textoCol("descricao", "Restrição", 340), enableHiding: false },
      textoCol("acao", "Ação", 260),
      ajuda.accessor((r) => r.responsavel_id ?? "", {
        id: "responsavel",
        header: "Responsável",
        size: 170,
        cell: ({ row }) => {
          const r = row.original;
          const nome = r.responsavel_id
            ? (nomePorId.get(r.responsavel_id) ?? "Usuário indisponível")
            : r.responsavel_nome;
          return (
            <CelulaEditavel
              valor={r.responsavel_id ?? ""}
              tipo="selecao"
              rotulo={`Responsável de ${formataNumero(r.numero)}`}
              opcoes={[
                {
                  valor: "",
                  rotulo: r.responsavel_nome
                    ? `(texto) ${r.responsavel_nome}`
                    : "— sem usuário —",
                },
                ...membros.map((m) => ({ valor: m.id, rotulo: m.nome })),
              ]}
              exibicao={
                nome ? (
                  <span
                    className={
                      r.responsavel_id ? "" : "italic text-[var(--tinta-fraca)]"
                    }
                    title={
                      r.responsavel_id
                        ? "Usuário do sistema"
                        : "Só texto (sem usuário)"
                    }
                  >
                    {nome}
                  </span>
                ) : undefined
              }
              aoSalvar={salvar(r, "responsavel_id")}
            />
          );
        },
      }),
      ajuda.accessor((r) => r.data_limite ?? "", {
        id: "data_limite",
        header: "Prazo",
        size: 120,
        cell: ({ row, getValue }) => {
          const r = row.original;
          const atrasada = estaAtrasada(r, hoje);
          const dias = diasParaPrazo(r.data_limite, hoje);
          return (
            <CelulaEditavel
              valor={getValue()}
              tipo="data"
              rotulo={`Prazo de ${formataNumero(r.numero)}`}
              exibicao={
                getValue() ? (
                  <span
                    className={
                      atrasada
                        ? "font-semibold text-[var(--marca-terracotta-vermelho)]"
                        : ""
                    }
                    title={dias !== null ? `${dias} dia(s)` : undefined}
                  >
                    {formataData(getValue())}
                    {atrasada ? ` (${Math.abs(dias ?? 0)}d)` : ""}
                    {r.reprogramacoes > 0 ? (
                      <span
                        className="ml-1 text-xs text-[var(--aviso-tinta)]"
                        title={`${r.reprogramacoes} reprogramação(ões); prazo original ${formataData(r.prazo_original)}`}
                      >
                        ↻{r.reprogramacoes}
                      </span>
                    ) : null}
                  </span>
                ) : undefined
              }
              aoSalvar={salvar(r, "data_limite")}
            />
          );
        },
      }),
      dataCol("previsao_conclusao", "Previsão"),
      dataCol("data_conclusao", "Concluída em"),
      textoCol("causa_6m", "Causa 6M", 120),
      textoCol("classificacao", "Classificação", 170),
      textoCol("area", "Área", 130),
      textoCol("setor", "Setor", 120),
      textoCol("localizacao", "Local", 130),
      textoCol("atividade_impactada", "Atividade impactada", 200),
      textoCol("id_atividade", "ID ativ.", 90),
      dataCol("inicio_atividade", "Início ativ."),
      ajuda.accessor((r) => r.semana_programada ?? "", {
        id: "semana_programada",
        header: "Semana",
        size: 100,
        cell: ({ row, getValue }) => (
          <CelulaEditavel
            valor={getValue()}
            tipo="texto"
            rotulo={`Semana de ${formataNumero(row.original.numero)}`}
            desabilitada={papel !== "gestor" && !!getValue()}
            titulo={
              papel !== "gestor" && getValue()
                ? "Linha de base: só gestor altera"
                : undefined
            }
            aoSalvar={salvar(row.original, "semana_programada")}
          />
        ),
      }),
      textoCol("descricao_status", "Situação (texto)", 220),
      textoCol("observacoes", "Observações", 220),
      textoCol("codigo", "Cód. planilha", 90),
      textoCol("responsavel_email", "E-mail resp.", 180),
      textoCol("responsavel_telefone", "Telefone", 120),
      dataCol("data_criacao", "Criada em"),
      ajuda.accessor("reprogramacoes", {
        header: "Reprog.",
        size: 70,
        cell: ({ getValue }) => (
          <div className="px-2 py-1 text-center text-sm">{getValue()}</div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [obraId, membros, nomePorId, hoje, papel, qs],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 não é compatível com o React Compiler; o hook decide sozinho.
  const tabela = useReactTable({
    data: dados,
    columns: colunas,
    state: {
      sorting: ordenacao,
      columnVisibility: visiveis,
      columnPinning: { left: FIXAS, right: [] },
    },
    onSortingChange: setOrdenacao,
    onColumnVisibilityChange: setVisiveis,
    getCoreRowModel: getCoreRowModel(),
    // A ordem já vem aplicada em `dados` (ver `ordenaRestricoes`); a tabela
    // só guarda qual coluna está marcada. Uma coluna por vez, como na URL.
    manualSorting: true,
    enableMultiSort: false,
    columnResizeMode: "onChange",
  });

  /**
   * Exporta o que está na tela: as linhas que sobraram dos filtros, na ordem
   * escolhida, com as colunas visíveis. O arquivo é montado no navegador — a
   * grade já tem os dados na mão, não faz sentido pedir de novo ao servidor.
   */
  const exportar = () => {
    const linhas = tabela.getRowModel().rows.map((l) => l.original);
    const { colunas: cols, linhas: celulas } = planilhaDeRestricoes(
      linhas,
      tabela.getVisibleLeafColumns().map((c) => c.id),
      { nomePorId, hoje },
    );
    const arquivo = geraXlsx({
      colunas: cols,
      linhas: celulas,
      aba: "Restrições",
    });
    const url = URL.createObjectURL(
      new Blob([arquivo as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo(`restricoes ${obraNome}`, hoje);
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalAtrasadas = restricoes.filter((r) =>
    estaAtrasada(sobrescritas[r.id] ?? r, hoje),
  ).length;

  const filtrosAtivos = contaFiltros({
    ...FILTROS_PADRAO,
    status: filtroStatus,
    resp: filtroResp,
    atrasadas: soAtrasadas,
  });

  const chips: Array<{ chave: string; rotulo: string; limpa: () => void }> = [];
  if (busca.trim())
    chips.push({
      chave: "q",
      rotulo: `Busca: “${busca.trim()}”`,
      limpa: () => setBusca(""),
    });
  if (filtroStatus !== "abertas")
    chips.push({
      chave: "status",
      rotulo: `Status: ${filtroStatus === "todas" ? "todas" : STATUS_ROTULO[filtroStatus]}`,
      limpa: () => setFiltroStatus(FILTROS_PADRAO.status),
    });
  if (filtroResp)
    chips.push({
      chave: "resp",
      rotulo:
        filtroResp === RESP_SEM
          ? "Sem responsável"
          : `Responsável: ${filtroResp}`,
      limpa: () => setFiltroResp(""),
    });
  if (soAtrasadas)
    chips.push({
      chave: "atrasadas",
      rotulo: "Só atrasadas",
      limpa: () => setSoAtrasadas(false),
    });

  const limparFiltros = () => {
    setBusca(FILTROS_PADRAO.busca);
    setFiltroStatus(FILTROS_PADRAO.status);
    setFiltroResp(FILTROS_PADRAO.resp);
    setSoAtrasadas(FILTROS_PADRAO.atrasadas);
  };

  return (
    <div className="space-y-2">
      <p role="status" className="sr-only">
        {anuncio}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar restrições"
          maxLength={200}
          className="min-w-0 flex-1 rounded-lg border border-[var(--borda)] px-2.5 py-2 text-sm focus:border-[var(--marca-terracotta)] focus:outline-none sm:w-56 sm:flex-none sm:py-1.5"
        />

        {/* No celular, um botão só abre o resto dos filtros. */}
        <button
          type="button"
          onClick={() => setFiltrosAbertos((v) => !v)}
          aria-expanded={filtrosAbertos}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--borda)] bg-white px-2.5 py-2 text-sm text-[var(--tinta-media)] sm:hidden"
        >
          Filtros
          {filtrosAtivos > 0 ? (
            <Etiqueta tom="vermelho">{filtrosAtivos}</Etiqueta>
          ) : null}
        </button>

        <Botao
          variante="secundario"
          className="shrink-0 py-2 sm:py-1.5"
          onClick={exportar}
          disabled={dados.length === 0}
          title={`Exportar ${dados.length} restrição(ões) para .xlsx, com as colunas visíveis`}
        >
          <svg
            aria-hidden
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <span className="hidden sm:inline">Exportar Excel</span>
          <span className="sm:hidden">Excel</span>
        </Botao>

        <Botao
          className="shrink-0 py-2 sm:order-last sm:ml-auto sm:py-1.5"
          onClick={() => setModalAberto(true)}
        >
          <svg
            aria-hidden
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="hidden sm:inline">Adicionar restrição</span>
          <span className="sm:hidden">Nova</span>
        </Botao>

        <div
          className={`${filtrosAbertos ? "flex" : "hidden"} w-full flex-col items-stretch gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center`}
        >
          <select
            value={filtroStatus}
            aria-label="Filtrar por status"
            onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            className="w-full rounded-lg border border-[var(--borda)] bg-white px-2 py-2 text-base sm:w-auto sm:py-1.5 sm:text-sm"
          >
            <option value="abertas">Abertas</option>
            <option value="todas">Todas</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS_ROTULO[s]}
              </option>
            ))}
          </select>
          <select
            value={filtroResp}
            aria-label="Filtrar por responsável"
            onChange={(e) => setFiltroResp(e.target.value)}
            className="w-full rounded-lg border border-[var(--borda)] bg-white px-2 py-2 text-base sm:w-auto sm:max-w-56 sm:py-1.5 sm:text-sm"
          >
            <option value="">Todos os responsáveis</option>
            <option value={RESP_SEM}>Sem responsável</option>
            {/* Filtro vindo de link antigo, de alguém que saiu da lista. */}
            {filtroResp &&
            filtroResp !== RESP_SEM &&
            !responsaveis.includes(filtroResp) ? (
              <option value={filtroResp}>{filtroResp}</option>
            ) : null}
            {responsaveis.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 py-1 text-sm text-[var(--tinta-media)]">
            <input
              type="checkbox"
              checked={soAtrasadas}
              onChange={(e) => setSoAtrasadas(e.target.checked)}
              className="h-4 w-4"
            />
            Só atrasadas
            {totalAtrasadas > 0 ? (
              <Etiqueta tom="vermelho">{totalAtrasadas}</Etiqueta>
            ) : null}
          </label>

          {/* Escolher colunas só faz sentido onde existe tabela. */}
          <div ref={menuRef} className="relative hidden md:block">
            <button
              ref={botaoColunas}
              type="button"
              onClick={() => setMenuColunas((v) => !v)}
              aria-expanded={menuColunas}
              aria-controls="menu-colunas"
              className="rounded-lg border border-[var(--borda)] bg-white px-2.5 py-1.5 text-sm hover:bg-[var(--marca-gelo)]"
            >
              Colunas
            </button>
            {menuColunas ? (
              <div
                id="menu-colunas"
                role="group"
                aria-label="Colunas visíveis"
                className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-[var(--borda)] bg-white p-2 shadow-lg"
              >
                <div className="rolagem-fina max-h-72 overflow-auto">
                  {tabela.getAllLeafColumns().map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-1 py-0.5 text-sm ${c.getCanHide() ? "" : "text-[var(--tinta-fraca)]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={c.getIsVisible()}
                        disabled={!c.getCanHide()}
                        onChange={c.getToggleVisibilityHandler()}
                      />
                      {typeof c.columnDef.header === "string"
                        ? c.columnDef.header
                        : c.id}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setVisiveis(COLUNAS_OCULTAS_PADRAO)}
                  className="mt-2 w-full border-t border-[var(--grade)] px-1 pt-2 text-left text-xs font-semibold text-[var(--marca-terracotta)] hover:underline"
                >
                  Restaurar padrão
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Recorte ativo e contagem ficam sempre à vista, inclusive no celular
          com os filtros recolhidos. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <span
            key={c.chave}
            className="inline-flex max-w-full items-center rounded-full bg-[var(--marca-gelo)] pl-2.5 text-xs font-medium text-[var(--tinta-media)]"
          >
            <span className="truncate">{c.rotulo}</span>
            <button
              type="button"
              onClick={c.limpa}
              aria-label={`Remover filtro ${c.rotulo}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm hover:text-[var(--tinta-forte)]"
            >
              ×
            </button>
          </span>
        ))}
        {chips.length > 0 ? (
          <button
            type="button"
            onClick={limparFiltros}
            className="min-h-8 rounded-lg px-2 text-xs font-semibold text-[var(--marca-terracotta)] hover:underline"
          >
            Limpar filtros
          </button>
        ) : null}
        <span className="ml-auto text-xs text-[var(--tinta-fraca)] tabular-nums">
          {dados.length} de {restricoes.length}
        </span>
      </div>

      <ModalNovaRestricao
        obraId={obraId}
        membros={membros}
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
      />

      {/* Celular: cartões. A ordenação escolhida na tabela vale aqui também. */}
      <div className="md:hidden">
        <CartoesRestricoes
          obraId={obraId}
          qs={qs}
          restricoes={tabela.getRowModel().rows.map((l) => l.original)}
          nomePorId={nomePorId}
          hoje={hoje}
        />
      </div>

      <div
        className="hidden overflow-auto rounded-xl border border-[var(--borda)] bg-white shadow-[var(--sombra-sm)] md:block"
        style={{ maxHeight: "calc(100vh - 230px)" }}
      >
        <table
          className="border-separate border-spacing-0 text-sm"
          style={{ width: tabela.getTotalSize() }}
        >
          <thead>
            {tabela.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const fixa = h.column.getIsPinned() === "left";
                  return (
                    <th
                      key={h.id}
                      style={{
                        width: h.getSize(),
                        left: fixa ? h.column.getStart("left") : undefined,
                      }}
                      aria-sort={
                        h.column.getIsSorted() === "asc"
                          ? "ascending"
                          : h.column.getIsSorted() === "desc"
                            ? "descending"
                            : "none"
                      }
                      className={`sticky top-0 border-b border-r border-[var(--borda)] bg-[var(--plano)] px-2.5 py-2.5 text-left text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[var(--tinta-media)] select-none ${fixa ? "z-20" : "z-10"} ${fixa && h.column.getIsLastColumn("left") ? "shadow-[4px_0_6px_-4px_rgba(15,23,42,0.18)]" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="flex w-full items-center gap-1"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc"
                          ? "▲"
                          : h.column.getIsSorted() === "desc"
                            ? "▼"
                            : ""}
                      </button>
                      <div
                        onMouseDown={h.getResizeHandler()}
                        onTouchStart={h.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--marca-terracotta)]"
                      />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {tabela.getRowModel().rows.map((row) => {
              const atrasada = estaAtrasada(row.original, hoje);
              const destacada = destacadas.has(row.original.id);
              return (
                <tr
                  key={row.id}
                  data-destacada={destacada || undefined}
                  className={`transition-colors duration-700 ${
                    destacada
                      ? "bg-[var(--aviso-fundo)]"
                      : atrasada
                        ? "bg-[var(--marca-brand-50)]"
                        : "odd:bg-white even:bg-[#fcfcfd]"
                  } hover:bg-[var(--plano)]`}
                >
                  {row.getVisibleCells().map((cell) => {
                    const fixa = cell.column.getIsPinned() === "left";
                    return (
                      <td
                        key={cell.id}
                        style={{
                          width: cell.column.getSize(),
                          left: fixa ? cell.column.getStart("left") : undefined,
                        }}
                        // Coluna fixa herda o fundo da linha para cobrir o
                        // que passa por baixo ao rolar.
                        className={`border-b border-r border-[var(--grade)] p-0 align-top ${
                          fixa ? "sticky z-[5] bg-inherit" : ""
                        } ${
                          fixa && cell.column.getIsLastColumn("left")
                            ? "shadow-[4px_0_6px_-4px_rgba(15,23,42,0.18)]"
                            : ""
                        }`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {dados.length === 0 ? (
              <tr>
                <td
                  colSpan={colunas.length}
                  className="px-3 py-8 text-center text-sm text-[var(--tinta-fraca)]"
                >
                  Nenhuma restrição com esses filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
