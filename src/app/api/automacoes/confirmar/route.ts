import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { confereToken, confirmaEnvio } from "@/server/admin/automacoes";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  envioId: z.guid(),
  ok: z.boolean(),
  erro: z.string().trim().max(2000).optional(),
});

/**
 * POST /api/automacoes/confirmar
 * Header: Authorization: Bearer <AUTOMACOES_TOKEN>
 * Corpo: { "envioId": "<uuid>", "ok": true } ou { "envioId", "ok": false, "erro": "..." }
 */
export async function POST(request: NextRequest) {
  const token = confereToken(request.headers.get("authorization"));
  if (token === "desligado")
    return NextResponse.json({ erro: "automações desligadas" }, { status: 503 });
  if (token !== "ok")
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  const parsed = corpoSchema.safeParse(bruto);
  if (!parsed.success)
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });

  try {
    const achou = await confirmaEnvio(parsed.data);
    if (!achou)
      return NextResponse.json(
        { erro: "envio não encontrado ou já confirmado" },
        { status: 404 },
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[automacoes] falha em confirmar", e);
    return NextResponse.json({ erro: "falha interna" }, { status: 500 });
  }
}
