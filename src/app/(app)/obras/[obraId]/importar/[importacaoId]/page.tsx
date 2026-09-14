import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { exigeGestor } from "@/server/auth";
import {
  buscaImportacao,
  codigosDaObra,
} from "@/server/importacao/queries";
import { contaCasamentos } from "@/lib/importacao/mapa";
import { iaDisponivel } from "@/server/importacao/gemini";
import { Mapeamento } from "@/components/importacao/mapeamento";
import { CabecalhoPagina } from "@/components/ui/basicos";

export const dynamic = "force-dynamic";

export default async function PaginaConferencia({
  params,
}: {
  params: Promise<{ obraId: string; importacaoId: string }>;
}) {
  const { obraId, importacaoId } = await params;
  if (
    !z.guid().safeParse(obraId).success ||
    !z.guid().safeParse(importacaoId).success
  )
    notFound();
  const { supabase } = await exigeGestor(obraId);
  const imp = await buscaImportacao(supabase, importacaoId);
  if (!imp || imp.obra_id !== obraId) notFound();
  if (imp.status !== "rascunho") redirect(`/obras/${obraId}/importar`);

  // A coluna de código é escolhida na tela, então a conta de "quantas já
  // existem" é feita para todas as colunas de uma vez: uma consulta só, e a
  // tela acompanha a escolha sem voltar ao servidor.
  const codigos = await codigosDaObra(supabase, obraId);
  const casamentos = contaCasamentos(imp.linhas, imp.cabecalhos, codigos.keys());

  return (
    <div className="space-y-4">
      <Link
        href={`/obras/${obraId}/importar`}
        className="text-sm text-[var(--tinta-fraca)] hover:text-[var(--tinta-forte)]"
      >
        ← Importar
      </Link>
      <CabecalhoPagina
        titulo="Conferir colunas"
        apoio={`${imp.total_linhas} linhas na aba ${imp.aba} de ${imp.arquivo_nome}. Sugestão feita ${imp.mapa_origem === "ia" ? "pela IA" : "por nomes conhecidos"}.`}
      />
      <Mapeamento
        importacaoId={imp.id}
        cabecalhos={imp.cabecalhos}
        linhas={imp.linhas.slice(0, 5)}
        mapaInicial={imp.mapa_colunas}
        comIA={iaDisponivel()}
        casamentos={casamentos}
        totalLinhas={imp.linhas.length}
      />
    </div>
  );
}
