import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from '@/env';
import { serverEnv } from '@/env';
import type { Database } from '@/lib/database.types';

/**
 * Cliente com `service_role`: IGNORA RLS por completo.
 *
 * Só existe para o que a sincronização precisa fazer e um usuário não pode:
 * gravar o cadastro vindo da planilha e marcar o que já foi escrito de volta.
 *
 * Regras, sem exceção:
 *   - nunca importado por arquivo com `"use client"` (o `server-only` acima
 *     transforma essa tentativa em erro de build, não em vazamento em produção);
 *   - nunca usado para atender requisição de usuário — ali vale a RLS;
 *   - todo chamador precisa checar autorização por conta própria, porque o
 *     banco não vai checar por ele.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
