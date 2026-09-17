import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";

/**
 * Renova a sessão a cada requisição e manda quem não está logado para /login.
 * Roda no proxy (antes do App Router), único lugar que pode escrever cookie
 * em toda requisição.
 */
export async function atualizaSessao(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() renova a sessão se preciso e confere a assinatura do JWT
  // localmente (chave ES256 do projeto), sem ida ao Auth a cada requisição.
  // getSession() não serviria: só lê o cookie, sem validar.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname } = request.nextUrl;
  // Allowlist explícita: rota nova nasce protegida por padrão.
  // /definir-senha recebe o link do convite e o de redefinição; quem chega
  // logado NÃO é redirecionado (o link de recuperação abre a sessão antes de
  // a pessoa trocar a senha).
  const publica =
    pathname === "/login" ||
    pathname === "/definir-senha" ||
    pathname === "/api/powerbi/restricoes" ||
    // Chamadas pelo n8n; a proteção é o token (AUTOMACOES_TOKEN).
    pathname === "/api/automacoes/pendentes" ||
    pathname === "/api/automacoes/confirmar";

  if (!user && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("proximo", pathname);
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/obras";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
