import PaginaPpc from "@/components/ppc/pagina";
export const dynamic = "force-dynamic";
export const metadata = { title: "Check-in / Check-out · PPC" };
export default function Pagina({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  return <PaginaPpc params={params} />;
}
