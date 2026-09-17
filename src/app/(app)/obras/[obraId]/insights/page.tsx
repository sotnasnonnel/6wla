import { notFound } from "next/navigation";
import { z } from "zod";
import { exigeMembro } from "@/server/auth";
import { linhasInsights } from "@/server/insights/queries";
import { resumoIADisponivel } from "@/server/insights/gemini";
import { formataData, hojeIso } from "@/lib/restricoes/dominio";
import { geraInsights } from "@/lib/restricoes/insights";
import { CabecalhoPagina, Vazio } from "@/components/ui/basicos";
import { ListaInsights } from "@/components/insights/lista";
import { ResumoIA } from "@/components/insights/resumo-ia";

export const dynamic = "force-dynamic";

export default async function PaginaInsightsObra({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  if (!z.guid().safeParse(obraId).success) notFound();
  const { supabase } = await exigeMembro(obraId);
  const hoje = hojeIso();
  const linhas = await linhasInsights(supabase, obraId);
  const insights = geraInsights(linhas, hoje, obraId);

  return (
    <div>
      <CabecalhoPagina
        titulo="Insights"
        apoio={
          <>
            Alertas calculados a partir das restrições da obra, com referência
            em <time dateTime={hoje}>{formataData(hoje)}</time>.
          </>
        }
      />
      {linhas.length > 0 ? (
        <ResumoIA obraId={obraId} disponivel={resumoIADisponivel()} />
      ) : null}
      {linhas.length === 0 ? (
        <Vazio
          titulo="Nenhuma restrição nesta obra ainda"
          descricao="Os insights aparecem assim que houver restrições lançadas."
        />
      ) : insights.length === 0 ? (
        <Vazio
          titulo="Nenhum alerta nesta obra agora"
          descricao="Nada atrasado, parado ou sem dono. Bom sinal — vale manter o ritmo."
        />
      ) : (
        <ListaInsights insights={insights} obraId={obraId} />
      )}
    </div>
  );
}
