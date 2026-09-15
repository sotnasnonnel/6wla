import PaginaPpc from "@/components/ppc/pagina";
export const dynamic = "force-dynamic";
export const metadata = { title: "Tabela de importação · PPC" };
export default function Pagina({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  return <PaginaPpc params={params} importacao />;
}
