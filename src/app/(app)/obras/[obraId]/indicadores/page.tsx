import { notFound } from "next/navigation";
import { z } from "zod";
import { exigeMembro } from "@/server/auth";
import { linhasDaObra } from "@/server/restricoes/indicadores";
import { PainelIndicadores } from "@/components/indicadores/painel";
import { hojeIso } from "@/lib/restricoes/dominio";
import { CabecalhoPagina, Vazio } from "@/components/ui/basicos";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PaginaIndicadoresObra({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  if (!z.guid().safeParse(obraId).success) notFound();
  const { supabase, papel } = await exigeMembro(obraId);
  const linhas = await linhasDaObra(supabase, obraId);

  return (
    <div className="space-y-3">
      <CabecalhoPagina
        titulo="Indicadores"
        apoio={
          linhas.length > 0 ? (
            <>
              <span className="hidden md:inline">Clique</span>
              <span className="md:hidden">Toque</span> numa barra para recortar
              todo o painel por ela. O recorte fica no endereço da página, para
              compartilhar.
            </>
          ) : undefined
        }
      />
      {linhas.length === 0 ? (
        <Vazio
          titulo="Nenhuma restrição nesta obra ainda"
          descricao="Os indicadores aparecem assim que houver restrições lançadas."
          acao={
            <Link
              href={
                papel === "membro"
                  ? `/obras/${obraId}/tabela`
                  : `/obras/${obraId}/importar`
              }
              className="rounded-lg bg-[var(--marca-terracotta)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--marca-terracotta-escuro)]"
            >
              {papel === "membro" ? "Ir para a tabela" : "Importar planilha"}
            </Link>
          }
        />
      ) : (
        <PainelIndicadores linhas={linhas} hoje={hojeIso()} />
      )}
    </div>
  );
}
