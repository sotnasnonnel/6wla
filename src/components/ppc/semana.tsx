"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/database.types";
import { normalizaChave } from "@/lib/importacao/mapa";
import { resumoQuantidades } from "@/lib/ppc/resumo";
import { confereAtividadePpc } from "@/server/ppc/actions";
import { Alerta, Botao, Campo, Selecao } from "@/components/ui/basicos";
import { EditarPpc, numeroPpc } from "./tabela";
import estilos from "./semana.module.css";
type Registro = Tables<"atividades_ppc">;
const chave = (r: Registro) =>
  `${r.inicio_semana}|${r.termino_semana}|${r.semana}`;
const data = (v: string) => v.split("-").reverse().join("/");
const quantidade = (v: number | null) =>
  v === null ? "—" : numeroPpc.format(v);

export function SemanaPpc({
  registros,
  obraId,
  podeEditar,
  hoje,
}: {
  registros: Registro[];
  obraId: string;
  podeEditar: boolean;
  hoje: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const semanas = [
    ...new Map(registros.map((r) => [chave(r), r])).values(),
  ].sort((a, b) => b.inicio_semana.localeCompare(a.inicio_semana));
  const [semana, setSemana] = useState(
    semanas[0] ? chave(semanas[0]) : "atual",
  );
  const [busca, setBusca] = useState("");
  const [encarregado, setEncarregado] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [situacao, setSituacao] = useState("");
  const [editando, setEditando] = useState<Registro | null>(null);
  const daSemana = registros.filter((r) =>
    semana === "atual"
      ? r.inicio_semana <= hoje && r.termino_semana >= hoje
      : chave(r) === semana,
  );
  const selecionada = semanas.find((r) => chave(r) === semana);
  const totais = resumoQuantidades(daSemana).filter(
    (t) => t.unidade !== "Sem unidade",
  );
  const encarregados = [
    ...new Set(daSemana.map((r) => r.encarregado).filter(Boolean)),
  ].sort();
  const pessoas = [
    ...new Set(daSemana.map((r) => r.responsavel).filter(Boolean)),
  ].sort();
  const filtradas = daSemana.filter(
    (r) =>
      (!encarregado ||
        (encarregado === "sem"
          ? !r.encarregado
          : r.encarregado === encarregado)) &&
      (!responsavel ||
        (responsavel === "sem"
          ? !r.responsavel
          : r.responsavel === responsavel)) &&
      (!situacao ||
        (situacao === "desvio"
          ? !!r.desvio
          : situacao === "pendente"
            ? !r.conferido
            : r.conferido)) &&
      normalizaChave(
        [
          r.id_atividade,
          r.nome_atividade,
          r.responsavel,
          r.encarregado,
          r.lider_imediato,
          r.disciplina,
          r.desvio,
        ].join(" "),
      ).includes(normalizaChave(busca)),
  );
  const agrupadas = new Map<string, { nome: string; atividades: Registro[] }>();
  for (const r of filtradas) {
    const nome = r.encarregado.trim();
    const id = normalizaChave(nome);
    const grupo = agrupadas.get(id) ?? { nome, atividades: [] };
    grupo.atividades.push(r);
    agrupadas.set(id, grupo);
  }
  const grupos = [...agrupadas.entries()].sort(([, a], [, b]) =>
    !a.nome ? 1 : !b.nome ? -1 : a.nome.localeCompare(b.nome, "pt-BR"),
  );
  function trocaSemana(v: string) {
    setSemana(v);
    setBusca("");
    setEncarregado("");
    setResponsavel("");
    setSituacao("");
  }
  function conferir(r: Registro) {
    iniciar(async () => {
      setErro("");
      try {
        const res = await confereAtividadePpc({
          obraId,
          id: r.id,
          conferido: !r.conferido,
          versao: r.atualizado_em,
        });
        if (!res.ok) {
          setErro(res.erro);
          return;
        }
        router.refresh();
      } catch {
        setErro("Não foi possível salvar a conferência. Tente novamente.");
      }
    });
  }
  return (
    <div className="space-y-4">
      {erro && <Alerta>{erro}</Alerta>}
      {aviso && <Alerta tipo="ok">{aviso}</Alerta>}
      <section
        aria-label="Resumo geral da semana"
        className="rounded-xl border border-[var(--borda)] bg-white p-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--tinta-fraca)]">
              Resumo geral ·{" "}
              {selecionada && selecionada.termino_semana < hoje
                ? "Programação anterior"
                : "Programação semanal"}
            </p>
            <div className={estilos.periodo}>
              <h2 className="text-2xl font-semibold text-[var(--marca-azul)]">
                {selecionada?.semana ?? "Semana atual"}
              </h2>
              <div className="text-sm">
                <span className="text-[var(--tinta-fraca)]">Início </span>
                <strong>
                  {selecionada ? data(selecionada.inicio_semana) : "—"}
                </strong>
              </div>
              <div className="text-sm">
                <span className="text-[var(--tinta-fraca)]">Término </span>
                <strong>
                  {selecionada ? data(selecionada.termino_semana) : "—"}
                </strong>
              </div>
            </div>
          </div>
          <label className="w-full space-y-1 text-xs sm:w-72">
            Semana
            <Selecao
              value={semana}
              onChange={(e) => trocaSemana(e.target.value)}
            >
              <option value="atual">Semana atual</option>
              {semanas.map((r) => (
                <option key={chave(r)} value={chave(r)}>
                  {r.semana} · {data(r.inicio_semana)} a{" "}
                  {data(r.termino_semana)}
                </option>
              ))}
            </Selecao>
          </label>
        </div>
        <div className={estilos.resumo}>
          {[
            { nome: "Atividades", valor: daSemana.length },
            {
              nome: "Com desvio",
              valor: daSemana.filter((r) => r.desvio.trim()).length,
            },
            {
              nome: "Conferidas",
              valor: daSemana.filter((r) => r.conferido).length,
            },
            {
              nome: "A conferir",
              valor: daSemana.filter((r) => !r.conferido).length,
            },
          ].map((i) => (
            <div key={i.nome} className={estilos.indicador}>
              <span>{i.nome}</span>
              <strong>{i.valor}</strong>
            </div>
          ))}
        </div>
        {totais.length > 0 && (
          <div className="mt-2">
            <h3 className="mb-2 text-xs font-semibold text-[var(--tinta-media)]">
              Quantidade prevista e realizada por unidade
            </h3>
            <div className={estilos.totais}>
              {totais.map((t) => (
                <div
                  key={t.unidade}
                  className={estilos.total}
                  title={`${t.total} atividade(s)`}
                >
                  <strong className="text-[var(--marca-azul)]">
                    {t.unidade}
                    {t.media ? " · média" : ""}
                  </strong>
                  <span>
                    Prevista <strong>{quantidade(t.prevista)}</strong>
                  </span>
                  <span>
                    Realizada <strong>{quantidade(t.realizada)}</strong>
                  </span>
                  {t.semReal > 0 && (
                    <p className="mt-1 text-[var(--tinta-fraca)]">
                      {t.semReal} sem quantidade realizada
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <div className={estilos.filtros}>
        <label className="space-y-1 text-xs">
          Buscar atividade ou pessoa
          <Campo
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="ID, atividade ou pessoa…"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-[var(--marca-azul)]">
          Encarregado
          <Selecao
            value={encarregado}
            onChange={(e) => setEncarregado(e.target.value)}
          >
            <option value="">Todos os encarregados</option>
            <option value="sem">Não informado</option>
            {encarregados.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Selecao>
        </label>
        <label className="space-y-1 text-xs">
          Responsável
          <Selecao
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
          >
            <option value="">Todos os responsáveis</option>
            <option value="sem">Não informado</option>
            {pessoas.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Selecao>
        </label>
        <label className="space-y-1 text-xs">
          Conferência e desvio
          <Selecao
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
          >
            <option value="">Todas as atividades</option>
            <option value="pendente">A conferir</option>
            <option value="conferida">Conferidas</option>
            <option value="desvio">Com desvio</option>
          </Selecao>
        </label>
      </div>
      <p role="status" className="text-xs text-[var(--tinta-fraca)]">
        {filtradas.length} de {daSemana.length} atividade(s) · {grupos.length}{" "}
        grupo(s) por encarregado · Resumo referente à semana inteira
      </p>
      {grupos.map(([id, g]) => (
        <section
          key={id}
          aria-label={`Encarregado ${g.nome || "Não informado"}`}
          className="overflow-hidden rounded-lg border border-[var(--borda)] bg-white"
        >
          <header className="flex flex-wrap items-center justify-between gap-2 bg-[var(--marca-azul)] px-3 py-2 text-white">
            <h3
              aria-label={g.nome || "Não informado"}
              className={`${estilos.nomeEncarregado} text-sm font-semibold`}
            >
              <span className="mr-2 text-xs font-normal text-white/70">
                Encarregado
              </span>
              {g.nome || "Não informado"}
            </h3>
            <span className="text-xs text-white/80">
              {g.atividades.length} atividade(s) ·{" "}
              {g.atividades.filter((r) => r.conferido).length} conferida(s)
            </span>
          </header>
          <div
            aria-hidden
            className={`${estilos.cabecalho} border-b border-[var(--borda)] bg-[var(--marca-gelo)] px-3 py-2 text-xs font-medium text-[var(--tinta-media)]`}
          >
            {[
              "Atividade",
              "Equipe",
              "Unidade",
              "Prevista",
              "Realizada",
              "Desvio",
              "Conferir",
            ].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <div className="divide-y divide-[var(--borda)]">
            {g.atividades.map((r) => (
              <article
                key={r.id}
                aria-label={`Atividade ${r.id_atividade}`}
                className={`${estilos.linha} px-3 py-3 text-xs hover:bg-[var(--marca-gelo)]/40`}
              >
                <div className={`${estilos.atividade} min-w-0`}>
                  <div className="mb-1 flex flex-wrap gap-2 text-[var(--tinta-fraca)]">
                    <strong className="text-[var(--marca-azul)]">
                      {r.id_atividade}
                    </strong>
                    <span>{r.disciplina || "Disciplina não informada"}</span>
                  </div>
                  <h4 className="font-medium leading-snug break-words">
                    {r.nome_atividade}
                  </h4>
                  {r.status_planejamento && (
                    <p className="mt-1 text-[11px] text-[var(--tinta-fraca)]">
                      {r.status_planejamento}
                    </p>
                  )}
                </div>
                <dl className="min-w-0 space-y-1 break-words">
                  <div>
                    <dt className="text-[10px] text-[var(--tinta-fraca)]">
                      Responsável
                    </dt>
                    <dd>{r.responsavel || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[var(--tinta-fraca)]">
                      Líder imediato
                    </dt>
                    <dd>{r.lider_imediato || "Não informado"}</dd>
                  </div>
                </dl>
                <div>
                  <span className={estilos.rotulo}>Unidade</span>
                  {r.unidade || "—"}
                </div>
                <div className="font-semibold tabular-nums text-[var(--marca-azul)]">
                  <span className={estilos.rotulo}>Quantidade prevista</span>
                  {quantidade(r.quantidade_prevista)}
                </div>
                <div className="font-semibold tabular-nums text-[var(--marca-azul)]">
                  <span className={estilos.rotulo}>Quantidade realizada</span>
                  {quantidade(r.quantidade_realizada)}
                </div>
                <div
                  className={`${estilos.desvio} min-w-0 whitespace-pre-line break-words ${r.desvio ? "text-amber-800" : "text-[var(--tinta-fraca)]"}`}
                >
                  <span className={estilos.rotulo}>Desvio</span>
                  {r.desvio || "Não informado"}
                </div>
                <div className="flex flex-col items-start gap-2">
                  {podeEditar ? (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={`Conferir atividade ${r.id_atividade}`}
                        checked={r.conferido}
                        disabled={pendente}
                        onChange={() => conferir(r)}
                        className="h-4 w-4 accent-[var(--marca-terracotta)]"
                      />
                      <span>{r.conferido ? "Conferida" : "Conferir"}</span>
                    </label>
                  ) : (
                    <span>{r.conferido ? "Conferida" : "A conferir"}</span>
                  )}
                  {podeEditar && (
                    <Botao
                      variante="fantasma"
                      className="px-0 text-xs"
                      aria-label={`Atualizar atividade ${r.id_atividade}`}
                      onClick={() => setEditando(r)}
                    >
                      Editar
                    </Botao>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {!grupos.length && (
        <div className="rounded-lg border border-dashed border-[var(--borda)] bg-white p-8 text-center">
          <h3 className="font-semibold">Nenhuma atividade encontrada</h3>
          <p className="mt-2 text-sm text-[var(--tinta-fraca)]">
            {registros.length
              ? "Confira a semana e os filtros selecionados."
              : "Carregue a programação na aba Tabela de importação."}
          </p>
        </div>
      )}
      {editando && (
        <EditarPpc
          compacto
          key={editando.id}
          registro={editando}
          obraId={obraId}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            setAviso("Atividade atualizada. Confira os dados novamente.");
          }}
        />
      )}
    </div>
  );
}
