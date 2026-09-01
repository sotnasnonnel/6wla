# Supabase

## Clients (três, não misture)
- `createBrowserClient` — anon key, roda no browser, sujeito a RLS.
- `createServerClient` — anon key + cookies, em Server Components/Actions, sujeito a RLS.
- `service_role` — **apenas** em jobs/Route Handlers de admin, isolado em `src/server/admin/`. Nunca importado por arquivo com `"use client"`.

## RLS
- Toda tabela: `alter table X enable row level security;` na mesma migration que a cria.
- Policies explícitas por operação (`select`/`insert`/`update`/`delete`). Sem `using (true)` salvo tabela pública deliberada, comentada.
- Nunca confie no client para filtrar por `user_id` — a policy é quem garante.
- `auth.uid()` nas policies; funções `security definer` só com `set search_path = ''`.

## Migrations
- `npx supabase migration new <nome>` → editar SQL → `npx supabase db reset` local para validar → commit.
- Migration é imutável depois de mergeada. Correção = nova migration.
- Toda migration deve ser reversível ou ter plano de rollback documentado no topo do arquivo.
- Após mudança de schema: regenerar tipos → `npx supabase gen types typescript --local > src/lib/database.types.ts`.

## MCP
Os tools `mcp__claude_ai_Supabase__*` estão disponíveis. Use `list_tables`/`get_advisors` para **inspecionar**. `apply_migration` e `execute_sql` atingem o projeto remoto — não use sem pedido explícito do usuário.
