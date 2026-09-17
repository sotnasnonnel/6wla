import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ehGestor, exigeMembro } from "@/server/auth";
import { listaMembros } from "@/server/obras/queries";
import {
  buscaRestricao,
  listaAnexos,
  listaComentarios,
  listaEventos,
  listaRestricoesParaNavegar,
  listaTarefas,
} from "@/server/restricoes/queries";
import { DetalhesRestricao } from "@/components/restricoes/detalhes";
import { ChatRestricao } from "@/components/restricoes/chat";
import { AnexosRestricao } from "@/components/restricoes/anexos";
import { ChecklistRestricao } from "@/components/restricoes/checklist";
import { BarraStatus } from "@/components/restricoes/barra-status";
import { ExcluirRestricao } from "@/components/restricoes/excluir-restricao";
import { AtalhoAtividades } from "@/components/restricoes/atalho-atividades";
import { Etiqueta, TituloSecao } from "@/components/ui/basicos";
import {
  diasParaPrazo,
  estaAtrasada,
  formataData,
  formataNumero,
  hojeIso,
  PRIORIDADE_ROTULO,
} from "@/lib/restricoes/dominio";
import {
  caminhoDetalhe,
  caminhoVolta,
  comParametro,
  filtraRestricoes,
  lerFiltros,
  nomeResponsavel,
  ordenaRestricoes,
  serializaFiltros,
  vizinhos,
} from "@/lib/restricoes/filtros";

export const dynamic = "force-dynamic";

const CARD =
  "rounded-xl border border-[var(--borda)] bg-white shadow-[var(--sombra-sm)]";

/**
 * Detalhe da restrição: cabeçalho com ações e barra de status clicável (do
 * app-phd), e as duas colunas da versão anterior — à esquerda os cards de
 * detalhe, checklist e anexos; à direita as Atividades (conversa +
 * histórico), fixas na rolagem. No celular, tudo empilha.
 *
 * `?volta=` traz o recorte da tabela de onde a pessoa veio: vale para o link
 * de volta e para o anterior/próxima, que andam pela mesma lista filtrada.
 */
export default async function PaginaRestricao({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; restricaoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { obraId, restricaoId } = await params;
  const { volta: voltaBruto } = await searchParams;
  const volta =
    typeof voltaBruto === "string" && voltaBruto.length <= 1000
      ? voltaBruto
      : undefined;
  if (
    !z.guid().safeParse(obraId).success ||
    !z.guid().safeParse(restricaoId).success
  )
    notFound();

  const { supabase, perfil, papel: papelWs } = await exigeMembro(obraId);
  const papel = ehGestor(papelWs) ? "gestor" : "membro";
  const restricao = await buscaRestricao(supabase, restricaoId);
  if (!restricao || restricao.obra_id !== obraId) notFound();

  const [membros, comentarios, eventos, anexos, tarefas, todas] =
    await Promise.all([
      listaMembros(supabase, obraId),
      listaComentarios(supabase, restricaoId),
      listaEventos(supabase, restricaoId),
      listaAnexos(supabase, restricaoId),
      listaTarefas(supabase, restricaoId),
      listaRestricoesParaNavegar(supabase, obraId),
    ]);
  const atrasada = estaAtrasada(restricao);
  const dias = diasParaPrazo(restricao.data_limite);
  const nomePorId = new Map(membros.map((m) => [m.id, m.nome]));
  const responsavel = nomeResponsavel(restricao, nomePorId);

  // Anterior/próxima na lista que a pessoa estava vendo. Se esta restrição
  // saiu do recorte (mudou de status, por exemplo), anda pela obra inteira na
  // mesma ordem.
  const filtros = lerFiltros(new URLSearchParams(volta ?? ""));
  const qs = serializaFiltros(filtros);
  const ctx = { nomePorId, hoje: hojeIso() };
  const recorte = ordenaRestricoes(
    filtraRestricoes(todas, filtros, ctx),
    filtros.ordem,
    nomePorId,
  );
  const naLista = vizinhos(recorte, restricaoId);
  const { anterior, proxima, posicao } =
    naLista.posicao >= 0
      ? naLista
      : vizinhos(
          ordenaRestricoes(todas, filtros.ordem, nomePorId),
          restricaoId,
        );
  const totalNavegavel = naLista.posicao >= 0 ? recorte.length : todas.length;
  const hrefVolta = caminhoVolta(obraId, qs);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href={hrefVolta}
              className="-ml-2 inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-medium text-[var(--tinta-fraca)] transition hover:bg-[var(--marca-gelo)] hover:text-[var(--marca-terracotta)]"
            >
              ← Tabela
            </Link>
            <span className="text-[var(--borda-forte)]">/</span>
            <span className="font-mono font-semibold text-[var(--marca-terracotta)]">
              {formataNumero(restricao.numero)}
            </span>
            {restricao.codigo ? (
              <span className="text-[var(--tinta-fraca)]">
                código {restricao.codigo}
              </span>
            ) : null}
          </div>
          <h1 className="mt-1 line-clamp-2 text-xl font-bold tracking-[-0.02em] text-[var(--tinta-forte)] sm:text-2xl">
            {restricao.descricao}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--tinta-fraca)]">
            <span>{responsavel ?? "Sem responsável"}</span>
            {restricao.data_limite ? (
              <span>
                Prazo {formataData(restricao.data_limite)}
                {dias !== null &&
                (restricao.status === "pendente" ||
                  restricao.status === "em_andamento")
                  ? dias < 0
                    ? ` · ${-dias} ${dias === -1 ? "dia" : "dias"} de atraso`
                    : dias === 0
                      ? " · vence hoje"
                      : ` · faltam ${dias} ${dias === 1 ? "dia" : "dias"}`
                  : ""}
              </span>
            ) : null}
            <Etiqueta
              tom={
                restricao.prioridade === "urgente" ||
                restricao.prioridade === "alta"
                  ? "amarelo"
                  : "neutro"
              }
            >
              Prioridade {PRIORIDADE_ROTULO[restricao.prioridade].toLowerCase()}
            </Etiqueta>
            {atrasada ? <Etiqueta tom="vermelho">Atrasada</Etiqueta> : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <nav
            aria-label="Navegar entre restrições"
            className="flex items-center gap-1"
          >
            <NavVizinha
              href={anterior ? caminhoDetalhe(obraId, anterior.id, qs) : null}
              rotulo={
                anterior
                  ? `Anterior: ${formataNumero(anterior.numero)}`
                  : "Sem anterior"
              }
            >
              ‹ Anterior
            </NavVizinha>
            {posicao >= 0 ? (
              <span className="px-1 text-xs text-[var(--tinta-fraca)] tabular-nums">
                {posicao + 1} de {totalNavegavel}
              </span>
            ) : null}
            <NavVizinha
              href={proxima ? caminhoDetalhe(obraId, proxima.id, qs) : null}
              rotulo={
                proxima
                  ? `Próxima: ${formataNumero(proxima.numero)}`
                  : "Sem próxima"
              }
            >
              Próxima ›
            </NavVizinha>
          </nav>
          {papel === "gestor" ? (
            <ExcluirRestricao
              restricaoId={restricaoId}
              destino={comParametro(
                hrefVolta,
                "excluida",
                String(restricao.numero),
              )}
            />
          ) : null}
        </div>
      </header>

      <BarraStatus restricaoId={restricaoId} status={restricao.status} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <div className="space-y-4">
          <DetalhesRestricao
            restricao={restricao}
            membros={membros}
            papel={papel}
          />

          <section className={`${CARD} px-5 py-4`}>
            <ChecklistRestricao restricaoId={restricaoId} tarefas={tarefas} />
          </section>

          <section className={`${CARD} px-5 py-4`}>
            <div className="mb-2">
              <TituloSecao>
                Anexos
                {anexos.length > 0 ? (
                  <Etiqueta tom="neutro">{anexos.length}</Etiqueta>
                ) : null}
              </TituloSecao>
            </div>
            <AnexosRestricao
              restricaoId={restricaoId}
              anexos={anexos}
              papel={papel}
            />
          </section>
        </div>

        <section
          id="atividades"
          tabIndex={-1}
          aria-label="Atividades"
          className={`${CARD} flex h-[620px] scroll-mt-16 focus:outline-none flex-col overflow-hidden lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:min-h-[520px]`}
        >
          <ChatRestricao
            restricaoId={restricaoId}
            comentarios={comentarios}
            eventos={eventos}
            membros={membros}
            meuId={perfil.id}
          />
        </section>
      </div>

      <AtalhoAtividades alvoId="atividades" total={comentarios.length} />
    </div>
  );
}

/** Botão de anterior/próxima; sem vizinho, fica visível e inerte. */
function NavVizinha({
  href,
  rotulo,
  children,
}: {
  href: string | null;
  rotulo: string;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex min-h-10 items-center rounded-lg border border-[var(--borda)] bg-white px-3 text-sm font-medium";
  if (!href)
    return (
      <span
        aria-disabled="true"
        title={rotulo}
        className={`${base} cursor-not-allowed text-[var(--tinta-apagada)] opacity-60`}
      >
        {children}
      </span>
    );
  return (
    <Link
      href={href}
      title={rotulo}
      aria-label={rotulo}
      className={`${base} text-[var(--tinta-media)] transition hover:border-[var(--marca-terracotta)] hover:text-[var(--marca-terracotta)]`}
    >
      {children}
    </Link>
  );
}
