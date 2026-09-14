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
} from "@/server/restricoes/queries";
import { DetalhesRestricao } from "@/components/restricoes/detalhes";
import { ChatRestricao } from "@/components/restricoes/chat";
import { AnexosRestricao } from "@/components/restricoes/anexos";
import { HistoricoRestricao } from "@/components/restricoes/historico";
import { Etiqueta } from "@/components/ui/basicos";
import {
  estaAtrasada,
  formataNumero,
  STATUS_ROTULO,
} from "@/lib/restricoes/dominio";

export const dynamic = "force-dynamic";

export default async function PaginaRestricao({
  params,
}: {
  params: Promise<{ obraId: string; restricaoId: string }>;
}) {
  const { obraId, restricaoId } = await params;
  if (
    !z.guid().safeParse(obraId).success ||
    !z.guid().safeParse(restricaoId).success
  )
    notFound();

  const { supabase, perfil, papel: papelWs } = await exigeMembro(obraId);
  const papel = ehGestor(papelWs) ? "gestor" : "membro";
  const restricao = await buscaRestricao(supabase, restricaoId);
  if (!restricao || restricao.obra_id !== obraId) notFound();

  const [membros, comentarios, eventos, anexos] = await Promise.all([
    listaMembros(supabase, obraId),
    listaComentarios(supabase, restricaoId),
    listaEventos(supabase, restricaoId),
    listaAnexos(supabase, restricaoId),
  ]);
  const nomes = new Map(membros.map((m) => [m.id, m.nome]));
  const atrasada = estaAtrasada(restricao);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/obras/${obraId}/tabela`}
          className="text-sm text-[var(--tinta-fraca)] hover:text-[var(--tinta-forte)]"
        >
          ← Voltar à lista
        </Link>
        <h1 className="flex min-w-0 items-center gap-2 text-base font-semibold text-[var(--tinta-forte)] sm:text-lg">
          <span className="font-mono text-[var(--marca-terracotta)]">
            {formataNumero(restricao.numero)}
          </span>
          <span className="line-clamp-1">{restricao.descricao}</span>
        </h1>
        <div className="flex items-center gap-1.5">
          <Etiqueta
            tom={
              restricao.status === "concluida"
                ? "verde"
                : restricao.status === "cancelada"
                  ? "neutro"
                  : "azul"
            }
          >
            {STATUS_ROTULO[restricao.status]}
          </Etiqueta>
          {atrasada ? <Etiqueta tom="vermelho">Atrasada</Etiqueta> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-[var(--borda)] bg-white p-3 shadow-sm sm:p-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--tinta-forte)]">
              Detalhes
            </h2>
            <DetalhesRestricao
              restricao={restricao}
              membros={membros}
              papel={papel}
            />
          </section>
          <section className="rounded-lg border border-[var(--borda)] bg-white p-3 shadow-sm sm:p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--tinta-forte)]">
              Anexos
              {anexos.length > 0 ? (
                <Etiqueta tom="neutro">{anexos.length}</Etiqueta>
              ) : null}
            </h2>
            <AnexosRestricao
              restricaoId={restricaoId}
              anexos={anexos}
              papel={papel}
            />
          </section>
          <section className="rounded-lg border border-[var(--borda)] bg-white p-3 shadow-sm sm:p-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--tinta-forte)]">
              Histórico de alterações
            </h2>
            <HistoricoRestricao eventos={eventos} nomes={nomes} />
          </section>
        </div>
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-[var(--borda)] bg-[var(--marca-gelo)] shadow-sm lg:sticky lg:top-16 lg:h-[calc(100vh-5rem)]">
          <h2 className="border-b border-[var(--borda)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--tinta-forte)]">
            Chat da restrição
          </h2>
          <ChatRestricao
            restricaoId={restricaoId}
            comentarios={comentarios}
            membros={membros}
            meuId={perfil.id}
          />
        </section>
      </div>
    </div>
  );
}
