import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { exigeGestor } from "@/server/auth";
import {
  buscaImportacao,
  codigosDaObra,
  gravadasDaImportacao,
  relatorioDaImportacao,
  resumoDoPlano,
} from "@/server/importacao/queries";
import { contaCasamentos } from "@/lib/importacao/mapa";
import { travaVigente } from "@/lib/importacao/plano";
import { iaDisponivel } from "@/server/importacao/gemini";
import { Mapeamento } from "@/components/importacao/mapeamento";
import { EtapasImportacao } from "@/components/importacao/etapas";
import { ResultadoImportacao } from "@/components/importacao/resultado";
import { Alerta, CabecalhoPagina } from "@/components/ui/basicos";

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
  const { supabase, obra } = await exigeGestor(obraId);
  const imp = await buscaImportacao(supabase, importacaoId);
  if (!imp || imp.obra_id !== obraId) notFound();
  if (imp.status === "cancelada") redirect(`/obras/${obraId}/importar`);

  const destino = `${obra.codigo} · ${obra.nome}`;
  const voltar = (
    <Link
      href={`/obras/${obraId}/importar`}
      className="text-sm text-[var(--tinta-fraca)] hover:text-[var(--tinta-forte)]"
    >
      ← Importar
    </Link>
  );

  if (imp.status === "concluida") {
    return (
      <div className="max-w-3xl space-y-4">
        {voltar}
        <CabecalhoPagina
          titulo="Importação concluída"
          apoio={`${imp.total_linhas} linhas lidas da aba ${imp.aba}.`}
        />
        <EtapasImportacao
          atual="resultado"
          obra={destino}
          arquivo={imp.arquivo_nome}
        />
        <ResultadoImportacao
          obraId={obraId}
          totalLinhas={imp.total_linhas}
          importadas={imp.importadas}
          atualizadas={imp.atualizadas}
          ignoradas={imp.ignoradas}
          relatorio={relatorioDaImportacao(imp)}
        />
      </div>
    );
  }

  // A coluna de código é escolhida na tela, então a conta de "quantas já
  // existem" é feita para todas as colunas de uma vez: uma consulta só, e a
  // tela acompanha a escolha sem voltar ao servidor.
  const [codigos, gravadas] = await Promise.all([
    codigosDaObra(supabase, obraId, imp.id),
    gravadasDaImportacao(supabase, obraId, imp.id),
  ]);
  const casamentos = contaCasamentos(
    imp.linhas,
    imp.cabecalhos,
    codigos.keys(),
  );
  // Com linhas já gravadas, mapa e modo ficam os da primeira tentativa.
  const retomada = gravadas.length > 0;
  const modoInicial = retomada ? imp.modo : "adicionar";
  const resumo = await resumoDoPlano(
    supabase,
    imp,
    imp.mapa_colunas,
    modoInicial,
  );
  const gravando = travaVigente(imp.mapa_origem);
  const origemSugestao =
    imp.mapa_origem === "ia"
      ? "Sugestão feita pela IA — revise antes de gravar."
      : imp.mapa_origem === "apelidos"
        ? "Sugestão feita por nomes conhecidos de coluna — revise antes de gravar."
        : null;

  return (
    <div className="space-y-4">
      {voltar}
      <CabecalhoPagina
        titulo="Conferir colunas"
        apoio={`${imp.total_linhas} linhas na aba ${imp.aba}.${origemSugestao ? ` ${origemSugestao}` : ""}`}
      />
      <EtapasImportacao
        atual="conferencia"
        obra={destino}
        arquivo={imp.arquivo_nome}
      />
      {gravando ? (
        <Alerta tipo="info">
          Esta importação está sendo gravada agora (por você em outra aba ou por
          outra pessoa). Aguarde e recarregue a página antes de tentar de novo.
        </Alerta>
      ) : null}
      <Mapeamento
        importacaoId={imp.id}
        destino={destino}
        cabecalhos={imp.cabecalhos}
        linhas={imp.linhas.slice(0, 5)}
        mapaInicial={imp.mapa_colunas}
        modoInicial={modoInicial}
        comIA={iaDisponivel() && !retomada}
        casamentos={casamentos}
        totalLinhas={imp.linhas.length}
        resumoInicial={resumo}
        retomada={retomada}
      />
    </div>
  );
}
