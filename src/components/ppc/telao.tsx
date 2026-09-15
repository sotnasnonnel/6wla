"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/database.types";
import { paginasTelao } from "@/lib/ppc/telao";
import { resumoQuantidades } from "@/lib/ppc/resumo";
import { numeroPpc } from "./tabela";
import css from "./telao.module.css";
type Registro = Tables<"atividades_ppc">;
const chave = (r: Registro) =>
  `${r.inicio_semana}|${r.termino_semana}|${r.semana}`;
const data = (v: string) => v.split("-").reverse().join("/");
const numero = (v: number | null) => (v === null ? "—" : numeroPpc.format(v));
function observaTela(avisa: () => void) {
  const mq = window.matchMedia("(min-height: 850px) and (min-width: 1000px)");
  mq.addEventListener("change", avisa);
  return () => mq.removeEventListener("change", avisa);
}

export function TelaoPpc({
  registros,
  obraId,
  obraNome,
  atualizadoEm,
}: {
  registros: Registro[];
  obraId: string;
  obraNome: string;
  atualizadoEm: string;
}) {
  const router = useRouter();
  const tela = useRef<HTMLDivElement>(null);
  const [semana, setSemana] = useState("ultima");
  const [segundos, setSegundos] = useState(20);
  const [pausado, setPausado] = useState(false);
  const [cheia, setCheia] = useState(false);
  const [offline, setOffline] = useState(false);
  const [erro, setErro] = useState("");
  const [agora, setAgora] = useState(() => Date.parse(atualizadoEm));
  const grande = useSyncExternalStore(
    observaTela,
    () =>
      window.matchMedia("(min-height: 850px) and (min-width: 1000px)").matches,
    () => false,
  );
  const semanas = [
    ...new Map(registros.map((r) => [chave(r), r])).values(),
  ].sort((a, b) => b.inicio_semana.localeCompare(a.inicio_semana));
  const selecionada =
    semana === "ultima" ? semanas[0] : semanas.find((r) => chave(r) === semana);
  const atividades = selecionada
    ? registros.filter((r) => chave(r) === chave(selecionada))
    : [];
  const totais = resumoQuantidades(atividades).filter(
    (t) => t.unidade !== "Sem unidade",
  );
  useEffect(() => {
    const atualiza = () => router.refresh();
    const timer = setInterval(atualiza, 60000);
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const conexao = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) atualiza();
    };
    const fullscreen = () => setCheia(!!document.fullscreenElement);
    window.addEventListener("online", conexao);
    window.addEventListener("offline", conexao);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      clearInterval(timer);
      clearInterval(relogio);
      window.removeEventListener("online", conexao);
      window.removeEventListener("offline", conexao);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [router]);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await tela.current?.requestFullscreen();
    } catch {
      setErro("Use F11 para colocar o navegador em tela cheia.");
    }
  }
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(atualizadoEm));
  return (
    <div ref={tela} className={css.tela}>
      <header className={css.topo}>
        <div>
          <h1>{obraNome}</h1>
          <p>
            Programação semanal ·{" "}
            {selecionada
              ? `${selecionada.semana} · ${data(selecionada.inicio_semana)} a ${data(selecionada.termino_semana)}`
              : "Nenhuma semana importada"}
          </p>
        </div>
        <div className={css.controles}>
          <label>
            Semana
            <select
              aria-label="Semana do telão"
              value={semana}
              onChange={(e) => setSemana(e.target.value)}
            >
              <option value="ultima">Última semana</option>
              {semanas.map((r) => (
                <option key={chave(r)} value={chave(r)}>
                  {r.semana} · {data(r.inicio_semana)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trocar a cada
            <select
              aria-label="Tempo de exibição"
              value={segundos}
              onChange={(e) => setSegundos(Number(e.target.value))}
            >
              {[10, 20, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {n}s
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => setPausado(!pausado)}>
            {pausado ? "Continuar" : "Pausar"}
          </button>
          <button onClick={fullscreen}>
            {cheia ? "Sair da tela cheia" : "Tela cheia"}
          </button>
          <Link href={`/obras/${obraId}/check-in-check-out`}>
            Sair do telão
          </Link>
        </div>
      </header>
      <section aria-label="Resumo da semana no telão" className={css.faixa}>
        <span>
          Atividades<strong>{atividades.length}</strong>
        </span>
        <span>
          Com desvio
          <strong>{atividades.filter((r) => r.desvio.trim()).length}</strong>
        </span>
        <span>
          Conferidas
          <strong>{atividades.filter((r) => r.conferido).length}</strong>
        </span>
        <span>
          A conferir
          <strong>{atividades.filter((r) => !r.conferido).length}</strong>
        </span>
      </section>
      <div className={css.unidades}>
        {totais.map((t) => (
          <span key={t.unidade}>
            <b>
              {t.unidade}
              {t.media ? " (média)" : ""}
            </b>{" "}
            · Prev. {numero(t.prevista)} / Real. {numero(t.realizada)}
            {t.semReal ? ` · ${t.semReal} sem real` : ""}
          </span>
        ))}
      </div>
      {(offline || agora - Date.parse(atualizadoEm) > 150000 || erro) && (
        <p role="status" className={css.aviso}>
          {erro || "Atualização pendente. Exibindo os últimos dados recebidos."}
        </p>
      )}
      <Apresentacao
        key={`${selecionada ? chave(selecionada) : "vazia"}|${grande}`}
        registros={atividades}
        tamanho={grande ? 2 : 1}
        segundos={segundos}
        pausado={pausado}
      />
      <footer className={css.rodape}>
        <span>
          Dados recebidos às {hora} · Atualização automática a cada minuto
        </span>
        <span>
          {selecionada &&
          selecionada.termino_semana <
            new Intl.DateTimeFormat("sv-SE", {
              timeZone: "America/Sao_Paulo",
            }).format(new Date(agora))
            ? "Programação anterior · "
            : ""}
          Somente visualização
        </span>
      </footer>
    </div>
  );
}

function Apresentacao({
  registros,
  tamanho,
  segundos,
  pausado,
}: {
  registros: Registro[];
  tamanho: number;
  segundos: number;
  pausado: boolean;
}) {
  const paginas = paginasTelao(registros, tamanho);
  const [indice, setIndice] = useState(0);
  const [progresso, setProgresso] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  const atual = paginas.length ? indice % paginas.length : 0;
  const pagina = paginas[atual];
  useEffect(() => {
    if (pausado || !paginas.length) return;
    const inicio = Date.now();
    const timer = setInterval(() => {
      const valor = Math.min((Date.now() - inicio) / (segundos * 1000), 1);
      setProgresso(valor);
      const elemento = area.current;
      if (elemento)
        elemento.scrollTop =
          Math.max(0, elemento.scrollHeight - elemento.clientHeight) *
          Math.min(1, Math.max(0, (valor - 0.15) / 0.7));
      if (valor >= 1) {
        setIndice((n) => n + 1);
        setProgresso(0);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [indice, segundos, pausado, paginas.length]);
  function avanca(direcao: number) {
    setIndice(
      (n) => (n + direcao + paginas.length) % Math.max(1, paginas.length),
    );
    setProgresso(0);
    if (area.current) area.current.scrollTop = 0;
  }
  if (!pagina)
    return (
      <div className={css.conteudo}>
        <h2>Nenhuma atividade para exibir nesta semana.</h2>
      </div>
    );
  return (
    <>
      <div className={css.grupo}>
        <div>
          <p>Encarregado · {pagina.total} atividade(s)</p>
          <h2>{pagina.encarregado || "Não informado"}</h2>
        </div>
        <div className={css.controles}>
          <button aria-label="Página anterior" onClick={() => avanca(-1)}>
            ←
          </button>
          <span role="status">
            Página {atual + 1} de {paginas.length}
          </span>
          <button aria-label="Próxima página" onClick={() => avanca(1)}>
            →
          </button>
          <span>
            {pausado
              ? "Pausado"
              : `${Math.max(0, Math.ceil(segundos * (1 - progresso)))}s`}
          </span>
        </div>
      </div>
      <div ref={area} className={css.conteudo} aria-label="Atividades no telão">
        <div className={css.atividades}>
          {pagina.atividades.map((r) => (
            <article
              key={r.id}
              aria-label={`Atividade ${r.id_atividade}`}
              className={css.atividade}
            >
              <div>
                <p className={css.identificacao}>
                  {r.id_atividade} ·{" "}
                  {r.disciplina || "Disciplina não informada"}
                </p>
                <h3>{r.nome_atividade}</h3>
              </div>
              <dl className={css.quantidades}>
                <div>
                  <dt>Previsto {r.unidade && `(${r.unidade})`}</dt>
                  <dd>{numero(r.quantidade_prevista)}</dd>
                </div>
                <div>
                  <dt>Realizado</dt>
                  <dd>{numero(r.quantidade_realizada)}</dd>
                </div>
              </dl>
              <dl className={css.equipe}>
                <div>
                  <dt>Responsável</dt>
                  <dd>{r.responsavel || "Não informado"}</dd>
                </div>
                <div>
                  <dt>Líder imediato</dt>
                  <dd>{r.lider_imediato || "Não informado"}</dd>
                </div>
                <div>
                  <dt>Planejamento</dt>
                  <dd>{r.status_planejamento || "Não informado"}</dd>
                </div>
                <div>
                  <dt>Conferência</dt>
                  <dd>{r.conferido ? "Conferida" : "A conferir"}</dd>
                </div>
              </dl>
              <div className={`${css.desvio} ${r.desvio ? css.desvioCom : ""}`}>
                <b>Desvio</b> · {r.desvio || "Não informado"}
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className={css.progresso} aria-hidden>
        <div style={{ width: `${progresso * 100}%` }} />
      </div>
    </>
  );
}
