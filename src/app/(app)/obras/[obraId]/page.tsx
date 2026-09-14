import { notFound, redirect } from "next/navigation";
import { z } from "zod";

/** Entrar numa obra abre os indicadores dela. */
export default async function PaginaObra({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  if (!z.guid().safeParse(obraId).success) notFound();
  redirect(`/obras/${obraId}/indicadores`);
}
