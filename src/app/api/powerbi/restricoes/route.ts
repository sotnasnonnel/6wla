import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extratoRestricoes, tokenValido } from "@/server/admin/powerbi";

export const dynamic = "force-dynamic";

const consultaSchema = z.object({
  obra: z.string().trim().max(30).optional(),
  workspace: z.string().trim().max(30).optional(),
});

/**
 * GET /api/powerbi/restricoes?workspace=PHD&obra=HRMS (os dois filtros são opcionais)
 * Header: Authorization: Bearer <POWERBI_API_TOKEN>
 *
 * No Power BI: Obter dados → Web → Avançado → adicionar o header Authorization.
 */
export async function GET(request: NextRequest) {
  if (!tokenValido(request.headers.get("authorization"))) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const parsed = consultaSchema.safeParse({
    obra: request.nextUrl.searchParams.get("obra") ?? undefined,
    workspace: request.nextUrl.searchParams.get("workspace") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json({ erro: "parâmetros inválidos" }, { status: 400 });

  try {
    const dados = await extratoRestricoes(parsed.data.obra, parsed.data.workspace);
    return NextResponse.json(dados, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[powerbi] falha ao gerar extrato", e);
    return NextResponse.json({ erro: "falha interna" }, { status: 500 });
  }
}
