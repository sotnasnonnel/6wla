"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
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
  type Status,
} from "@/lib/restricoes/dominio";
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
};

const ajuda = createColumnHelper<Restricao>();

export function GradeRestricoes({
  obraId,
  obraNome,
  restricoes,
  membros,
  papel,
}: Props) {
  const router = useRouter();
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
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<
    "abertas" | "todas" | Status
  >("abertas");
  const [filtroResp, setFiltroResp] = useState("");
  const [soAtrasadas, setSoAtrasadas] = useState(false);
  const [ordenacao, setOrdenacao] = useState<SortingState>([
    { id: "numero", desc: true },
  ]);
  const [visiveis, setVisiveis] = useState<VisibilityState>(
    COLUNAS_OCULTAS_PADRAO,
  );
  const [menuColunas, setMenuColunas] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  // No celular os filtros ficam recolhidos: a busca resolve a maioria dos
  // casos e a lista começa mais perto do topo da tela.
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const hoje = hojeIso();

  // Outros usuários editando a mesma obra: recarrega os dados do servidor.
  useEffect(() => {
    const supabase = createClient();
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
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [obraId, router]);

  const nomePorId = useMemo(
    () => new Map(membros.map((m) => [m.id, m.nome])),
    [membros],
  );

  const dados = useMemo(() => {
    const linhas = restricoes.map((r) => sobrescritas[r.id] ?? r);
    const termo = busca.trim().toLowerCase();
    return linhas.filter((r) => {
      if (
        filtroStatus === "abertas" &&
        !(r.status === "pendente" || r.status === "em_andamento")
      )
        return false;
      if (
        filtroStatus !== "abertas" &&
        filtroStatus !== "todas" &&
        r.status !== filtroStatus
      )
        return false;
      if (soAtrasadas && !estaAtrasada(r, hoje)) return false;
      if (filtroResp) {
        const nome = r.responsavel_id
          ? nomePorId.get(r.responsavel_id)
          : r.responsavel_nome;
        if (filtroResp === "__sem__" ? !!nome : nome !== filtroResp)
          return false;
      }
      if (termo) {
        const alvo = [
          r.descricao,
          r.acao,
          r.codigo,
          r.responsavel_nome,
          r.setor,
          r.area,
          r.atividade_impactada,
          r.classificacao,
          r.causa_6m,
          formataNumero(r.numero),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [
    restricoes,
    sobrescritas,
    busca,
    filtroStatus,
    filtroResp,
    soAtrasadas,
    hoje,
    nomePorId,
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
      const res = await atualizaCampo({ restricaoId: r.id, campo, valor });
      if (!res.ok) return res.erro;
      setEdicoes((atual) => ({
        fonte: restricoes,
        mapa: {
          ...(atual.fonte === restricoes ? atual.mapa : {}),
          [res.dados.id]: res.dados,
        },
      }));
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
        cell: ({ row }) => (
          <Link
            href={`/obras/${obraId}/restricoes/${row.original.id}`}
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
      textoCol("descricao", "Restrição", 340),
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
    [obraId, membros, nomePorId, hoje, papel],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 não é compatível com o React Compiler; o hook decide sozinho.
  const tabela = useReactTable({
    data: dados,
    columns: colunas,
    state: { sorting: ordenacao, columnVisibility: visiveis },
    onSortingChange: setOrdenacao,
    onColumnVisibilityChange: setVisiveis,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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

  const filtrosAtivos =
    (filtroStatus !== "abertas" ? 1 : 0) +
    (filtroResp ? 1 : 0) +
    (soAtrasadas ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar…"
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
            onChange={(e) =>
              setFiltroStatus(e.target.value as typeof filtroStatus)
            }
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
            onChange={(e) => setFiltroResp(e.target.value)}
            className="w-full rounded-lg border border-[var(--borda)] bg-white px-2 py-2 text-base sm:w-auto sm:max-w-56 sm:py-1.5 sm:text-sm"
          >
            <option value="">Todos os responsáveis</option>
            <option value="__sem__">Sem responsável</option>
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
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setMenuColunas((v) => !v)}
              className="rounded-lg border border-[var(--borda)] bg-white px-2.5 py-1.5 text-sm hover:bg-[var(--marca-gelo)]"
            >
              Colunas
            </button>
            {menuColunas ? (
              <div className="absolute right-0 z-30 mt-1 max-h-80 w-56 overflow-auto rounded-lg border border-[var(--borda)] bg-white p-2 shadow-lg">
                {tabela.getAllLeafColumns().map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-1 py-0.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={c.getIsVisible()}
                      onChange={c.getToggleVisibilityHandler()}
                    />
                    {typeof c.columnDef.header === "string"
                      ? c.columnDef.header
                      : c.id}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <span className="text-xs text-[var(--tinta-fraca)]">
            {dados.length} de {restricoes.length}
          </span>
        </div>
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
          <thead className="sticky top-0 z-10 bg-[var(--plano)]">
            {tabela.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    style={{ width: h.getSize() }}
                    aria-sort={
                      h.column.getIsSorted() === "asc"
                        ? "ascending"
                        : h.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                    }
                    className="relative border-b border-r border-[var(--borda)] px-2.5 py-2.5 text-left text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[var(--tinta-media)] select-none"
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
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {tabela.getRowModel().rows.map((row) => {
              const atrasada = estaAtrasada(row.original, hoje);
              return (
                <tr
                  key={row.id}
                  className={`${atrasada ? "bg-[var(--marca-brand-50)]" : "odd:bg-white even:bg-[#fcfcfd]"} hover:bg-[var(--plano)]`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="border-b border-r border-[var(--grade)] p-0 align-top"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
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
