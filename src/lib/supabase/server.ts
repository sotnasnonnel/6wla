import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/env';
import type { Database } from '@/lib/database.types';

/**
 * Cliente de servidor (Server Components, Server Actions, Route Handlers).
 * Usa a anon key com a sessão do cookie e continua sujeito a RLS.
 *
 * Para autenticar SEMPRE use `getUser()`, nunca `getSession()`: a sessão vem do
 * cookie e pode ter sido forjada; `getUser()` valida o token no servidor de auth.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component não pode escrever cookie. O middleware renova a
            // sessão, então ignorar aqui é seguro.
          }
        },
      },
    }
  );
}

/** Usuário autenticado, validado no servidor de auth. `null` se não houver. */
export async function usuarioAtual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
