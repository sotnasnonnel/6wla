"use client";

import { useMemo, useState } from "react";
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
import { BarrasEmpilhadas, CartaoKpi, Legenda, Painel } from "./pecas";
import { SerieSemanal } from "./semanal";
import { ParetoCausas } from "./pareto";
import { RankingConclusao } from "./ranking";
import { Detalhamento } from "./detalhamento";

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

type Dimensao = "area" | "setor" | "responsavel" | "causa_6m" | "classificacao";

type Filtros = {
  semana: string;
  situacao: Situacao | "";
  dimensoes: Partial<Record<Dimensao, string>>;
  busca: string;
};

const VAZIO: Filtros = {
  semana: "",
  situacao: "",
  dimensoes: {},
  busca: "",
};

const DIMENSOES: Array<{ campo: Dimensao; titulo: string; limite: number }> = [
  { campo: "area", titulo: "Área", limite: 14 },
  { campo: "responsavel", titulo: "Responsável", limite: 14 },
  { campo: "setor", titulo: "Setor", limite: 14 },
  { campo: "classificacao", titulo: "Classificação", limite: 10 },
];

const DIM_ROTULO: Record<Dimensao, string> = {
  area: "Área",
  setor: "Setor",
  responsavel: "Responsável",
  causa_6m: "Causa 6M",
  classificacao: "Classificação",
};

/**
 * Painel de indicadores. Os filtros são cruzados: clicar numa barra de "Área"
 * refaz todos os outros gráficos com aquele recorte, como no relatório do
 * Power BI. Tudo roda no cliente — são centenas de linhas, não milhões, e
 * assim o clique responde na hora.
 */
export function PainelIndicadores({
  linhas,
  hoje,
}: {
  linhas: LinhaPainel[];
  hoje: string;
}) {
  const [f, setF] = useState<Filtros>(VAZIO);

  /** Filtra tudo menos a dimensão pedida (para a barra clicada não sumir). */
  const filtra = (exceto?: Dimensao) => {
    const termo = f.busca.trim().toLowerCase();
    return linhas.filter((r) => {
      if (f.situacao && situacaoDe(r, hoje) !== f.situacao) return false;
      if (f.semana) {
        const base = r.data_conclusao ?? r.data_limite;
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
      const base = l.data_conclusao ?? l.data_limite;
      const s = base ? semanaDe(base) : null;
      if (s) mapa.set(s.chave, `Semana ${s.rotulo.slice(1)} de ${s.mes}`);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [linhas]);

  const alternaDimensao = (campo: Dimensao, chave: string) =>
    setF((atual) => ({
      ...atual,
      dimensoes: {
        ...atual.dimensoes,
        [campo]: atual.dimensoes[campo] === chave ? undefined : chave,
      },
    }));

  const chips = [
    ...(f.situacao
      ? [{ k: "situacao", txt: SITUACAO_ROTULO[f.situacao] }]
      : []),
    ...(f.semana
      ? [
          {
            k: "semana",
            txt:
              semanasDisponiveis.find(([c]) => c === f.semana)?.[1] ?? f.semana,
          },
        ]
      : []),
    ...Object.entries(f.dimensoes)
      .filter(([, v]) => !!v)
      .map(([campo, v]) => ({
        k: `dim:${campo}`,
        txt: `${DIM_ROTULO[campo as Dimensao]}: ${v}`,
      })),
    ...(f.busca.trim() ? [{ k: "busca", txt: `"${f.busca.trim()}"` }] : []),
  ];

  const limpaChip = (k: string) =>
    setF((atual) => {
      if (k.startsWith("dim:")) {
        const campo = k.slice(4) as Dimensao;
        return {
          ...atual,
          dimensoes: { ...atual.dimensoes, [campo]: undefined },
        };
      }
      if (k === "situacao") return { ...atual, situacao: "" };
      if (k === "semana") return { ...atual, semana: "" };
      return { ...atual, busca: "" };
    });

  return (
    <div className="space-y-3">
      {/* Filtros numa linha só, acima de tudo. */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={f.situacao}
          onChange={(e) =>
            setF({ ...f, situacao: e.target.value as Situacao | "" })
          }
          aria-label="Situação"
          className="min-w-0 flex-1 rounded-md border border-[var(--borda)] bg-white px-2 py-2 text-sm sm:flex-none sm:py-1.5"
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
          onChange={(e) => setF({ ...f, semana: e.target.value })}
          aria-label="Semana"
          className="min-w-0 flex-1 rounded-md border border-[var(--borda)] bg-white px-2 py-2 text-sm sm:flex-none sm:py-1.5"
        >
          <option value="">Todas as semanas</option>
          {semanasDisponiveis.map(([chave, rotulo]) => (
            <option key={chave} value={chave}>
              {rotulo}
            </option>
          ))}
        </select>
        <input
          value={f.busca}
          onChange={(e) => setF({ ...f, busca: e.target.value })}
          placeholder="Buscar…"
          aria-label="Buscar"
          className="w-full rounded-md border border-[var(--borda)] px-2.5 py-2 text-base focus:border-[var(--marca-terracotta)] focus:outline-none sm:w-48 sm:py-1.5 sm:text-sm"
        />
        {chips.length > 0 ? (
          <>
            <span className="ml-1 flex flex-wrap gap-1">
              {chips.map((c) => (
                <button
                  key={c.k}
                  type="button"
                  onClick={() => limpaChip(c.k)}
                  className="flex items-center gap-1 rounded-full bg-[#e6e4e1] px-2.5 py-1 text-xs text-[var(--tinta-media)] hover:bg-[#d9d6d2]"
                  title="Remover filtro"
                >
                  {c.txt} <span aria-hidden>×</span>
                </button>
              ))}
            </span>
            <button
              type="button"
              onClick={() => setF(VAZIO)}
              className="text-xs text-[var(--marca-terracotta)] hover:underline"
            >
              limpar tudo
            </button>
          </>
        ) : null}
        <span className="text-xs text-[var(--tinta-fraca)] tabular-nums sm:ml-auto">
          {filtradas.length} de {linhas.length}
        </span>
      </div>

      {/* Faixa de indicadores. */}
      <div className="flex flex-wrap gap-2">
        <CartaoKpi rotulo="Total de restrições" valor={String(r.total)} />
        <CartaoKpi
          rotulo="Concluídas"
          valor={String(r.concluidas)}
          detalhe={`${r.concluidasNoPrazo} no prazo · ${r.concluidasComAtraso} com atraso`}
          cor={SITUACAO_COR.concluida_no_prazo}
        />
        <CartaoKpi
          rotulo="No prazo"
          valor={String(r.noPrazo)}
          cor={SITUACAO_COR.no_prazo}
        />
        <CartaoKpi
          rotulo="Atrasadas"
          valor={String(r.atrasadas)}
          detalhe={
            r.mediaAtrasoAbertas
              ? `${formataDecimal(r.mediaAtrasoAbertas, 0)} dias em média`
              : undefined
          }
          cor={SITUACAO_COR.atrasada}
        />
        <CartaoKpi
          rotulo="IRR"
          valor={formataPercentual(r.irr, 2)}
          detalhe="Índice de remoção de restrições"
          destaque
        />
        <CartaoKpi
          rotulo="Aderência ao prazo"
          valor={formataPercentual(r.aderenciaPrazo, 1)}
          detalhe="das concluídas fecharam no prazo"
        />
        <CartaoKpi
          rotulo="Resolução média"
          valor={formataDecimal(r.mediaResolucao)}
          detalhe="dias da criação até a conclusão"
        />
      </div>

      <Painel
        titulo="Índice de remoção por semana"
        acessorio={
          <span className="text-xs text-[var(--tinta-fraca)]">
            barras: concluídas · linha: previstas
          </span>
        }
      >
        <SerieSemanal pontos={semanas} />
      </Painel>

      <Painel
        titulo="Causa 6M · Pareto"
        acessorio={
          f.dimensoes.causa_6m ? (
            <button
              type="button"
              onClick={() => alternaDimensao("causa_6m", f.dimensoes.causa_6m ?? "")}
              className="text-xs text-[var(--marca-terracotta)] hover:underline"
            >
              limpar
            </button>
          ) : (
            <span className="text-xs text-[var(--tinta-fraca)]">barras: restrições · linha: % acumulado</span>
          )
        }
      >
        <ParetoCausas
          grupos={porDimensao(filtra("causa_6m"), "causa_6m", { hoje })}
          selecionada={f.dimensoes.causa_6m ?? null}
          aoClicar={(chave) => alternaDimensao("causa_6m", chave)}
        />
      </Painel>

      <Painel
        titulo="Ranking de conclusão · responsável"
        acessorio={
          f.dimensoes.responsavel ? (
            <button
              type="button"
              onClick={() =>
                alternaDimensao("responsavel", f.dimensoes.responsavel ?? "")
              }
              className="text-xs text-[var(--marca-terracotta)] hover:underline"
            >
              limpar
            </button>
          ) : (
            <span className="text-xs text-[var(--tinta-fraca)]">
              barra: concluídas · % : do que coube a ele
            </span>
          )
        }
      >
        <RankingConclusao
          itens={rankingConclusao(filtra("responsavel"), "responsavel", {
            hoje,
            limite: 14,
          })}
          selecionada={f.dimensoes.responsavel ?? null}
          aoClicar={(chave) => alternaDimensao("responsavel", chave)}
        />
      </Painel>

      <div className="grid gap-3 lg:grid-cols-2">
        {DIMENSOES.map(({ campo, titulo, limite }) => {
          const grupos = porDimensao(filtra(campo), campo, { hoje, limite });
          return (
            <Painel
              key={campo}
              titulo={titulo}
              acessorio={
                f.dimensoes[campo] ? (
                  <button
                    type="button"
                    onClick={() =>
                      alternaDimensao(campo, f.dimensoes[campo] ?? "")
                    }
                    className="text-xs text-[var(--marca-terracotta)] hover:underline"
                  >
                    limpar
                  </button>
                ) : null
              }
            >
              <BarrasEmpilhadas
                grupos={grupos}
                selecionada={f.dimensoes[campo] ?? null}
                aoClicar={(chave) => alternaDimensao(campo, chave)}
              />
            </Painel>
          );
        })}

      </div>

      <div className="flex items-center justify-between">
        <Legenda
          ativa={f.situacao || null}
          aoClicar={(s) => setF({ ...f, situacao: f.situacao === s ? "" : s })}
        />
      </div>

      <Painel titulo="Detalhamento">
        <Detalhamento linhas={filtradas} hoje={hoje} />
      </Painel>
    </div>
  );
}
