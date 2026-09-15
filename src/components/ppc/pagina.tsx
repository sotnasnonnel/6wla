import { notFound } from "next/navigation";
import { z } from "zod";
import { exigeMembro, ehGestor } from "@/server/auth";
import type { Tables } from "@/lib/database.types";
import { CabecalhoPagina } from "@/components/ui/basicos";
import { ImportarPpc } from "@/components/ppc/importar";
import { TabelaPpc } from "@/components/ppc/tabela";
import Link from "next/link";
import { SemanaPpc } from "@/components/ppc/semana";
import { TelaoPpc } from "@/components/ppc/telao";

export default async function PaginaPpc({
  params,
  importacao = false,
  telao = false,
}: {
  params: Promise<{ obraId: string }>;
  importacao?: boolean;
  telao?: boolean;
}) {
  const { obraId } = await params;
  if (!z.guid().safeParse(obraId).success) notFound();
  const { supabase, obra, papel } = await exigeMembro(obraId);
  const registros: Tables<"atividades_ppc">[] = [];
  // PostgREST limita cada resposta a 1.000 linhas; não ocultar o restante.
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await supabase
      .from("atividades_ppc")
      .select("*")
      .eq("obra_id", obraId)
      .order("inicio_semana", { ascending: false })
      .order("id")
      .range(inicio, inicio + 999);
    if (error)
      throw new Error("Não foi possível carregar a programação da obra.");
    registros.push(...data);
    if (data.length < 1000) break;
  }
  if (telao)
    return (
      <TelaoPpc
        registros={registros}
        obraId={obraId}
        obraNome={obra.nome}
        atualizadoEm={new Date().toISOString()}
      />
    );
  return (
    <div className="min-w-0 space-y-4">
      <CabecalhoPagina
        titulo={importacao ? "Tabela de importação" : "Check-in / Check-out"}
        apoio={
          importacao
            ? `${obra.codigo} · Todas as atividades e os dados importados da programação.`
            : `${obra.codigo} · A programação da semana, a equipe e o avanço de cada atividade.`
        }
        acoes={
          importacao && ehGestor(papel) ? (
            <ImportarPpc obraId={obraId} />
          ) : !importacao ? (
            <Link
              href={`/obras/${obraId}/telao`}
              className="rounded-md bg-[var(--marca-azul)] px-3 py-2 text-sm font-medium text-white"
            >
              Modo telão
            </Link>
          ) : undefined
        }
      />
      <nav
        aria-label="Visões da programação"
        className="flex gap-1 border-b border-[var(--borda)]"
      >
        {[
          {
            slug: "check-in-check-out",
            nome: "Atividades da semana",
            ativo: !importacao,
          },
          {
            slug: "tabela-importacao",
            nome: "Tabela de importação",
            ativo: importacao,
          },
        ].map((item) => (
          <Link
            key={item.slug}
            href={`/obras/${obraId}/${item.slug}`}
            aria-current={item.ativo ? "page" : undefined}
            className={`border-b-2 px-3 py-3 text-sm font-medium ${item.ativo ? "border-[var(--marca-terracotta)] text-[var(--marca-terracotta)]" : "border-transparent text-[var(--tinta-fraca)] hover:text-[var(--tinta-forte)]"}`}
          >
            {item.nome}
          </Link>
        ))}
      </nav>
      {importacao ? (
        <TabelaPpc
          registros={registros}
          obraId={obraId}
          podeEditar={ehGestor(papel)}
        />
      ) : (
        <SemanaPpc
          registros={registros}
          obraId={obraId}
          podeEditar={ehGestor(papel)}
          hoje={new Intl.DateTimeFormat("sv-SE", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date())}
        />
      )}
    </div>
  );
}
