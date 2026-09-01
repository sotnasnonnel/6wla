'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/env';
import type { Database } from '@/lib/database.types';

/**
 * Cliente do browser. Usa a anon key e está sujeito a RLS — é a policy no banco
 * que decide o que este usuário enxerga, não o filtro que o componente escrever.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
