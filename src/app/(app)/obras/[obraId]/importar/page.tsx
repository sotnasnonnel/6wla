import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigeGestor } from "@/server/auth";
import { buscaObra } from "@/server/obras/queries";
import { listaImportacoes } from "@/server/importacao/queries";
import { iaDisponivel } from "@/server/importacao/gemini";
import { FormUpload } from "@/components/importacao/upload";
import { Cartao, Etiqueta, CabecalhoPagina } from "@/components/ui/basicos";
import { formataDataHora } from "@/lib/restricoes/dominio";

export const dynamic = "force-dynamic";

export default async function PaginaImportar({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  if (!z.guid().safeParse(obraId).success) notFound();
  const { supabase } = await exigeGestor(obraId);
  const [obra, historico] = await Promise.all([
    buscaObra(supabase, obraId),
    listaImportacoes(supabase, obraId),
  ]);
  if (!obra) notFound();

  return (
    <div className="max-w-3xl space-y-4">
      <Link
        href={`/obras/${obraId}/tabela`}
        className="text-sm text-[var(--tinta-fraca)] hover:text-[var(--tinta-forte)]"
      >
        ← {obra.codigo}
      </Link>
      <CabecalhoPagina
        titulo="Importar planilha"
        apoio="Envie o arquivo .xlsx. Na próxima tela você confere qual coluna vira qual campo antes de gravar."
      />

      <Cartao>
        <FormUpload obraId={obraId} comIA={iaDisponivel()} />
      </Cartao>

      {historico.length > 0 ? (
        <Cartao>
          <h2 className="mb-2 text-sm font-semibold text-[var(--tinta-forte)]">
            Importações anteriores
          </h2>
          <ul className="divide-y divide-[#eceae7] text-sm">
            {historico.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
              >
                <span className="text-xs text-[var(--tinta-fraca)] sm:w-28 sm:shrink-0">
                  {formataDataHora(h.criado_em)}
                </span>
                <span className="min-w-0 flex-1 basis-full truncate text-[var(--tinta-forte)] sm:basis-auto">
                  {h.arquivo_nome}{" "}
                  <span className="text-[var(--tinta-fraca)]">· aba {h.aba}</span>
                </span>
                <Etiqueta
                  tom={
                    h.status === "concluida"
                      ? "verde"
                      : h.status === "rascunho"
                        ? "amarelo"
                        : "neutro"
                  }
                >
                  {h.status === "concluida"
                    ? `${h.importadas} de ${h.total_linhas}`
                    : h.status}
                </Etiqueta>
                {h.status === "rascunho" ? (
                  <Link
                    href={`/obras/${obraId}/importar/${h.id}`}
                    className="text-[var(--marca-terracotta)] hover:underline"
                  >
                    continuar
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}
    </div>
  );
}
