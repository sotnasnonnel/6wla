"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Status } from "@/lib/restricoes/dominio";
import {
  formataDecimal,
  formataPercentual,
  porDimensao,
  porSemana,
  rankingConclusao,
  resumo,
  semanaDe,
  situacaoDe,
  SITUACAO_COR,
  SITUACAO_ROTULO,
  SITUACOES_EMPILHADAS,
  type Situacao,
} from "@/lib/restricoes/indicadores";
import {
  AvisoCorte,
  BarrasEmpilhadas,
  CartaoKpi,
  Legenda,
  Painel,
} from "./pecas";
import { SerieSemanal } from "./semanal";
import { ParetoCausas } from "./pareto";
import { RankingConclusao } from "./ranking";
import { Detalhamento } from "./detalhamento";
import {
  alternaDimensao,
  escreveFiltros,
  FILTROS_VAZIOS,
  leFiltros,
  semDimensao,
  temRecorte,
  type Dimensao,
  type Filtros,
} from "./filtros";

export type LinhaPainel = {
  id: string;
  obra_id: string;
  numero: number;
  descricao: string;
  acao: string | null;
  status: Status;
  data_criacao: string;
  data_limite: string | null;
  previsao_conclusao: string | null;
  data_conclusao: string | null;
  responsavel: string | null;
  area: string | null;
  setor: string | null;
  causa_6m: string | null;
  classificacao: string | null;
  atividade_impactada: string | null;
};

const DIMENSOES: Array<{ campo: Dimensao; titulo: string; limite: number }> = [
  { campo: "area", titulo: "Área", limite: 14 },
  { campo: "responsavel", titulo: "Responsável", limite: 14 },
  { campo: "setor", titulo: "Setor", limite: 14 },
  { campo: "classificacao", titulo: "Classificação", limite: 10 },
];

const LIMITE_RANKING = 14;

const DIM_ROTULO: Record<Dimensao, string> = {
  area: "Área",
  setor: "Setor",
  responsavel: "Responsável",
  causa_6m: "Causa 6M",
  classificacao: "Classificação",
};

const ID_DETALHAMENTO = "detalhamento";

const NOTA_CRUZADA =
  "Os demais gráficos usam este recorte; esta dimensão mantém as alternativas para comparação.";

/** Data que põe a restrição numa semana — a mesma regra do filtro. */
const dataDaSemana = (r: LinhaPainel) => r.data_conclusao ?? r.data_limite;

/**
 * Painel de indicadores. Os filtros são cruzados: clicar numa barra de "Área"
 * refaz todos os outros gráficos com aquele recorte, como no relatório do
 * Power BI. Tudo roda no cliente — são centenas de linhas, não milhões, e
 * assim o clique responde na hora.
 *
 * Os filtros moram na URL: o link compartilhado abre o mesmo recorte e o
 * "voltar" do navegador desfaz o último clique.
 */
export function PainelIndicadores({
  linhas,
  hoje,
}: {
  linhas: LinhaPainel[];
  hoje: string;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const fUrl = useMemo(() => leFiltros(params), [params]);

  // A busca é digitada letra a letra: fica local para o campo não perder o
  // cursor, e vai para a URL sem empilhar histórico.
  const [busca, setBusca] = useState(fUrl.busca);
  const [buscaDaUrl, setBuscaDaUrl] = useState(fUrl.busca);
  if (fUrl.busca !== buscaDaUrl) {
    // A URL mudou por fora (voltar/avançar): o campo acompanha.
    setBuscaDaUrl(fUrl.busca);
    if (fUrl.busca !== busca.trim()) setBusca(fUrl.busca);
  }
  const f: Filtros = useMemo(() => ({ ...fUrl, busca }), [fUrl, busca]);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const aplica = (novo: Filtros, historico: "push" | "replace" = "push") => {
    const qs = escreveFiltros(novo);
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (historico === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  };

  /** Filtra tudo menos a dimensão pedida (para a barra clicada não sumir). */
  const filtra = (exceto?: Dimensao) => {
    const termo = f.busca.trim().toLowerCase();
    return linhas.filter((r) => {
      if (f.situacao && situacaoDe(r, hoje) !== f.situacao) return false;
      if (f.semana) {
        const base = dataDaSemana(r);
        if (!base || semanaDe(base)?.chave !== f.semana) return false;
      }
      for (const [campo, valor] of Object.entries(f.dimensoes)) {
        if (!valor || campo === exceto) continue;
        const atual = (r[campo as Dimensao] ?? "").trim();
        if (atual !== valor) return false;
      }
      if (termo) {
        const alvo = [
          r.descricao,
          r.acao,
          r.responsavel,
          r.area,
          r.setor,
          r.atividade_impactada,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  };

  const filtradas = useMemo(() => filtra(), [linhas, f, hoje]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = useMemo(() => resumo(filtradas, hoje), [filtradas, hoje]);
  const semanas = useMemo(() => porSemana(filtradas), [filtradas]);

  const semanasDisponiveis = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const l of linhas) {
      const base = dataDaSemana(l);
      const s = base ? semanaDe(base) : null;
      if (s)
        mapa.set(
          s.chave,
          `Sem ${s.rotulo.slice(1)} · ${s.mes}/${s.chave.slice(0, 4)}`,
        );
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [linhas]);

  const clicaDimensao = (campo: Dimensao, chave: string) =>
    aplica(alternaDimensao(f, campo, chave));
  const limpaDimensao = (campo: Dimensao) => aplica(semDimensao(f, campo));

  const chips: Array<{ k: string; txt: string; limpa: () => void }> = [
    ...(f.situacao
      ? [
          {
            k: "situacao",
            txt: SITUACAO_ROTULO[f.situacao],
            limpa: () => aplica({ ...f, situacao: "" }),
          },
        ]
      : []),
    ...(f.semana
      ? [
          {
            k: "semana",
            txt:
              semanasDisponiveis.find(([c]) => c === f.semana)?.[1] ?? f.semana,
            limpa: () => aplica({ ...f, semana: "" }),
          },
        ]
      : []),
    ...Object.entries(f.dimensoes)
      .filter(([, v]) => !!v)
      .map(([campo, v]) => ({
        k: `dim:${campo}`,
        txt: `${DIM_ROTULO[campo as Dimensao]}: ${v}`,
        limpa: () => limpaDimensao(campo as Dimensao),
      })),
    ...(f.busca.trim()
      ? [
          {
            k: "busca",
            txt: `“${f.busca.trim()}”`,
            limpa: () => {
              setBusca("");
              aplica({ ...f, busca: "" }, "replace");
            },
          },
        ]
      : []),
  ];

  const verLista = () => {
    const alvo = document.getElementById(ID_DETALHAMENTO);
    if (!alvo) return;
    const reduzido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    alvo.scrollIntoView({
      behavior: reduzido ? "auto" : "smooth",
      block: "start",
    });
    alvo.focus({ preventScroll: true });
  };

  const escopo = chips.length > 0 ? "no recorte atual" : "em toda a obra";
  const botaoLimpar = (campo: Dimensao) =>
    f.dimensoes[campo] ? (
      <button
        type="button"
        onClick={() => limpaDimensao(campo)}
        className="text-xs text-[var(--marca-terracotta)] hover:underline"
      >
        limpar
      </button>
    ) : null;

  const causas = porDimensao(filtra("causa_6m"), "causa_6m", { hoje });
  const ranking = rankingConclusao(filtra("responsavel"), "responsavel", {
    hoje,
  });
  const alternaSituacao = (s: Situacao) =>
    aplica({ ...f, situacao: f.situacao === s ? "" : s });

  return (
    <div className="space-y-3">
      {/* Barra de filtros fixa: o recorte fica à vista enquanto se rola. */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-[var(--borda)] bg-[var(--plano)]/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 md:top-0 md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltrosAbertos((a) => !a)}
            aria-expanded={filtrosAbertos}
            aria-controls="filtros-painel"
            className="min-h-9 rounded-lg border border-[var(--borda)] bg-white px-3 text-sm font-medium text-[var(--tinta-media)] md:hidden"
          >
            Filtros{chips.length > 0 ? ` (${chips.length})` : ""}
          </button>
          <div
            id="filtros-painel"
            className={`${filtrosAbertos ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 md:flex md:w-auto`}
          >
            <select
              value={f.situacao}
              onChange={(e) =>
                aplica({ ...f, situacao: e.target.value as Situacao | "" })
              }
              aria-label="Situação"
              className="min-h-9 min-w-0 flex-1 rounded-lg border border-[var(--borda)] bg-white px-2 py-1.5 text-sm md:flex-none"
            >
              <option value="">Todas as situações</option>
              {SITUACOES_EMPILHADAS.map((s) => (
                <option key={s} value={s}>
                  {SITUACAO_ROTULO[s]}
                </option>
              ))}
            </select>
            <select
              value={f.semana}
              onChange={(e) => aplica({ ...f, semana: e.target.value })}
              aria-label="Semana"
              aria-describedby="semana-regra"
              className="min-h-9 min-w-0 flex-1 rounded-lg border border-[var(--borda)] bg-white px-2 py-1.5 text-sm md:flex-none"
            >
              <option value="">Todas as semanas</option>
              {semanasDisponiveis.map(([chave, rotulo]) => (
                <option key={chave} value={chave}>
                  {rotulo}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                aplica({ ...f, busca: e.target.value }, "replace");
              }}
              placeholder="Buscar…"
              aria-label="Buscar"
              className="min-h-9 w-full rounded-lg border border-[var(--borda)] bg-white px-2.5 py-1.5 text-base focus:border-[var(--marca-terracotta)] focus:outline-none md:w-44 md:text-sm"
            />
            <p
              id="semana-regra"
              className="w-full text-[11px] text-[var(--tinta-fraca)] md:w-auto"
            >
              Semana: data de conclusão; se não houver, o prazo.
            </p>
          </div>
          {chips.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {chips.map((c) => (
                <button
                  key={c.k}
                  type="button"
                  onClick={c.limpa}
                  aria-label={`Remover filtro ${c.txt}`}
                  className="flex min-h-7 max-w-full items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs text-[var(--tinta-media)] ring-1 ring-[var(--borda)] hover:bg-[var(--marca-gelo)]"
                >
                  <span className="truncate">{c.txt}</span>
                  <span aria-hidden>×</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setBusca("");
                  aplica(FILTROS_VAZIOS);
                }}
                className="min-h-7 px-1 text-xs text-[var(--marca-terracotta)] hover:underline"
              >
                limpar tudo
              </button>
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span
              className="text-[var(--tinta-fraca)] tabular-nums"
              aria-live="polite"
            >
              {filtradas.length} de {linhas.length}
            </span>
            {temRecorte(f) || f.semana || f.busca.trim() ? (
              <button
                type="button"
                onClick={verLista}
                className="min-h-7 rounded-lg bg-[var(--marca-terracotta)] px-2.5 py-1 font-semibold text-white hover:bg-[var(--marca-terracotta-escuro)]"
              >
                {filtradas.length} restrições · Ver lista
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Primeira faixa: o que pede ação e o índice principal. */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <CartaoKpi
          rotulo="Atrasadas"
          valor={String(r.atrasadas)}
          detalhe={
            r.mediaAtrasoAbertas !== null
              ? `${formataDecimal(r.mediaAtrasoAbertas, 0)} dias de atraso em média`
              : "sem atraso a medir"
          }
          cor={SITUACAO_COR.atrasada}
          ajuda={
            <>
              Abertas (pendentes ou em andamento) cujo prazo já passou. A média
              é de dias entre o prazo e hoje.
            </>
          }
        />
        <CartaoKpi
          rotulo="No prazo"
          valor={String(r.noPrazo)}
          detalhe="abertas dentro do prazo"
          cor={SITUACAO_COR.no_prazo}
          ajuda={
            <>
              Abertas cujo prazo ainda não venceu. Restrição aberta sem prazo
              também conta aqui.
            </>
          }
        />
        <CartaoKpi
          rotulo="Concluídas"
          valor={String(r.concluidas)}
          detalhe={`${r.concluidasNoPrazo} no prazo · ${r.concluidasComAtraso} com atraso`}
          cor={SITUACAO_COR.concluida_no_prazo}
          ajuda={
            <>
              Com status Concluída. “Com atraso” quando a data de conclusão é
              posterior ao prazo.
            </>
          }
        />
        <CartaoKpi
          rotulo="IRR"
          valor={formataPercentual(r.irr, 2)}
          detalhe="índice de remoção de restrições"
          destaque
          ajuda={
            <>
              Concluídas ÷ (total − canceladas). Canceladas ficam fora do
              denominador: não foram removidas nem estão pendentes.
            </>
          }
        />
      </div>

      {/* Segunda faixa: contexto, em tamanho menor. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <CartaoKpi
          tamanho="compacto"
          rotulo="Aderência ao prazo"
          valor={formataPercentual(r.aderenciaPrazo, 1)}
          detalhe="das concluídas, fecharam no prazo"
          ajuda={<>Concluídas no prazo ÷ concluídas.</>}
        />
        <CartaoKpi
          tamanho="compacto"
          rotulo="Resolução média"
          valor={formataDecimal(r.mediaResolucao)}
          {...(r.mediaResolucao !== null ? { unidade: "dias" } : {})}
          detalhe={
            r.mediaResolucao !== null
              ? "da criação até a conclusão"
              : "nenhuma concluída com datas"
          }
          ajuda={
            <>
              Média de dias entre a data de criação e a de conclusão, só das
              concluídas.
            </>
          }
        />
        <CartaoKpi
          tamanho="compacto"
          rotulo="Total"
          valor={String(r.total)}
          detalhe={`${escopo}${r.canceladas > 0 ? ` · inclui ${r.canceladas} cancelada(s)` : ""}`}
          ajuda={
            <>
              Todas as restrições {escopo}, inclusive canceladas. Por isso a
              soma das faixas acima pode ser menor que o total.
            </>
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Painel
          titulo="Previstas e concluídas por semana"
          nota="Contagens por semana: barras = concluídas na semana; linha = previstas (prazo na semana)."
        >
          <SerieSemanal pontos={semanas} />
        </Painel>

        <Painel
          titulo="Causa 6M · Pareto"
          acessorio={botaoLimpar("causa_6m")}
          nota={
            f.dimensoes.causa_6m
              ? NOTA_CRUZADA
              : "Barras: restrições por causa, por situação · linha: % acumulado."
          }
        >
          <div className="mb-1.5">
            <Legenda ativa={f.situacao || null} aoClicar={alternaSituacao} />
          </div>
          <ParetoCausas
            grupos={causas}
            selecionada={f.dimensoes.causa_6m ?? null}
            aoClicar={(chave) => clicaDimensao("causa_6m", chave)}
          />
        </Painel>
      </div>

      <Painel
        titulo="Ranking de conclusão · responsável"
        acessorio={botaoLimpar("responsavel")}
        nota={
          f.dimensoes.responsavel
            ? NOTA_CRUZADA
            : "Barra: concluídas · %: concluídas sobre o que coube a ele (fora canceladas)."
        }
      >
        <div className="mb-1.5">
          <Legenda situacoes={["concluida_no_prazo", "concluida_com_atraso"]} />
        </div>
        <RankingConclusao
          itens={ranking.slice(0, LIMITE_RANKING)}
          selecionada={f.dimensoes.responsavel ?? null}
          aoClicar={(chave) => clicaDimensao("responsavel", chave)}
        />
        <AvisoCorte
          ocultos={ranking.length - LIMITE_RANKING}
          mostrados={LIMITE_RANKING}
          singular="responsável"
          plural="responsáveis"
        />
      </Painel>

      <section aria-label="Restrições por dimensão" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--borda)] bg-white px-2.5 py-1.5">
          <Legenda ativa={f.situacao || null} aoClicar={alternaSituacao} />
          <span className="text-[11px] text-[var(--tinta-fraca)]">
            Clique numa situação ou numa barra para recortar o painel.
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {DIMENSOES.map(({ campo, titulo, limite }) => {
            const todos = porDimensao(filtra(campo), campo, { hoje });
            return (
              <Painel
                key={campo}
                titulo={titulo}
                acessorio={botaoLimpar(campo)}
                {...(f.dimensoes[campo] ? { nota: NOTA_CRUZADA } : {})}
              >
                <BarrasEmpilhadas
                  grupos={todos.slice(0, limite)}
                  selecionada={f.dimensoes[campo] ?? null}
                  aoClicar={(chave) => clicaDimensao(campo, chave)}
                />
                <AvisoCorte
                  ocultos={todos.length - limite}
                  mostrados={limite}
                  singular="outra"
                  plural="outras"
                  feminino
                />
              </Painel>
            );
          })}
        </div>
      </section>

      <Painel
        id={ID_DETALHAMENTO}
        titulo="Detalhamento"
        nota={`${filtradas.length} restrições ${escopo}.`}
      >
        <Detalhamento linhas={filtradas} hoje={hoje} />
      </Painel>
    </div>
  );
}
