import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { confereToken, processaPendentes } from "@/server/admin/automacoes";

export const dynamic = "force-dynamic";

/** E-mails devolvidos por chamada; o resto sai no próximo ciclo. */
const LIMITE_POR_CHAMADA = 50;

const SEM_CACHE = { "Cache-Control": "no-store" };

/**
 * GET /api/automacoes/pendentes?obra=<uuid>
 * Header: Authorization: Bearer <AUTOMACOES_TOKEN>
 *
 * Chamado pelo fluxo n8n da obra a cada 15 min. Agenda o que venceu, reserva e devolve
 * [{ envioId, to, cc, subject, html }]. Cada item devolvido deve ser
 * confirmado em POST /api/automacoes/confirmar.
 */
export async function GET(request: NextRequest) {
  const token = confereToken(request.headers.get("authorization"));
  if (token === "desligado")
    return NextResponse.json({ erro: "automações desligadas" }, { status: 503 });
  if (token !== "ok")
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const obra = z.guid().safeParse(request.nextUrl.searchParams.get("obra"));
  if (!obra.success)
    return NextResponse.json({ erro: "obra inválida" }, { status: 400 });

  try {
    const emails = await processaPendentes(
      new Date(),
      LIMITE_POR_CHAMADA,
      obra.data,
    );
    return NextResponse.json(emails, { headers: SEM_CACHE });
  } catch (e) {
    console.error("[automacoes] falha em pendentes", e);
    return NextResponse.json({ erro: "falha interna" }, { status: 500 });
  }
}
