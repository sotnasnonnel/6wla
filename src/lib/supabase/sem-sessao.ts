import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { Database } from "@/lib/database.types";

/**
 * Cliente anon SEM sessão e com fluxo implícito, só para pedir e-mail de
 * redefinição de senha pelo servidor. Não serve para ler dados (sem usuário,
 * a RLS não libera nada).
 *
 * Por que não o `createServerClient`: ele usa PKCE e guarda o verificador no
 * cookie de quem pediu. O link do e-mail costuma ser aberto em outro
 * aparelho (ou, no caso do admin, por outra pessoa), onde esse verificador
 * não existe e a troca do `?code=` falharia. No fluxo implícito o link volta
 * com a sessão no fragmento e funciona em qualquer navegador.
 */
export function createClienteSemSessao() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
