import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ehGestor, exigeMembro } from "@/server/auth";
import { listaMembros } from "@/server/obras/queries";
import { listaRestricoes } from "@/server/restricoes/queries";
import { GradeRestricoes } from "@/components/restricoes/grade";
import { Alerta, CabecalhoPagina } from "@/components/ui/basicos";
import { formataNumero } from "@/lib/restricoes/dominio";
import { lerFiltros } from "@/lib/restricoes/filtros";

// Aviso de exclusão vindo do detalhe: só um número, nada de texto livre.
const excluidaSchema = z.coerce.number().int().positive().max(1_000_000);

export const dynamic = "force-dynamic";

export default async function PaginaTabela({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { obraId } = await params;
  if (!z.guid().safeParse(obraId).success) notFound();
  const busca = await searchParams;
  const texto = (k: string) => {
    const v = busca[k];
    return typeof v === "string" ? v : undefined;
  };
  const importadas = texto("importadas");
  const atualizadas = texto("atualizadas");
  const ignoradas = texto("ignoradas");
  const excluida = excluidaSchema.safeParse(texto("excluida")).data;
  const filtros = lerFiltros(busca);

  const { supabase, obra, papel: papelWs } = await exigeMembro(obraId);
  const [restricoes, membros] = await Promise.all([
    listaRestricoes(supabase, obraId),
    listaMembros(supabase, obraId),
  ]);
  const papel = ehGestor(papelWs) ? "gestor" : "membro";

  return (
    <div className="space-y-3">
      <CabecalhoPagina
        titulo="Tabela"
        apoio={
          <>
            <span className="hidden md:inline">
              Clique numa célula para editar. Enter salva, Esc cancela.
            </span>
            <span className="md:hidden">
              Toque numa restrição para ver e editar os detalhes.
            </span>
          </>
        }
        acoes={
          papel === "gestor" ? (
            <Link
              href={`/obras/${obraId}/importar`}
              className="rounded-lg border border-[var(--borda)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--tinta-media)] transition hover:border-[var(--marca-terracotta)] hover:text-[var(--marca-terracotta)]"
            >
              Importar planilha
            </Link>
          ) : null
        }
      />

      {importadas || atualizadas ? (
        <Alerta tipo="ok">
          {[
            `${importadas ?? 0} restrição(ões) adicionada(s)`,
            Number(atualizadas) > 0 ? `${atualizadas} atualizada(s)` : null,
            Number(ignoradas) > 0
              ? `${ignoradas} já existia(m) e foi(ram) mantida(s)`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          .
        </Alerta>
      ) : null}

      {excluida ? (
        <Alerta tipo="ok">{formataNumero(excluida)} excluída.</Alerta>
      ) : null}

      <GradeRestricoes
        obraId={obraId}
        obraNome={obra.nome}
        restricoes={restricoes}
        membros={membros}
        papel={papel}
        filtrosIniciais={filtros}
      />
    </div>
  );
}
