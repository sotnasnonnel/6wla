---
name: supabase-migration
description: Cria uma migration Supabase com RLS, índices e tipos regenerados, seguindo o checklist do projeto. Use ao adicionar ou alterar tabela, coluna, policy, função ou enum.
disable-model-invocation: true
---

# Nova migration

Alvo: `$ARGUMENTS`

## Passos

1. **Antes de escrever SQL**, confira o schema atual:
   - local: `npx supabase db diff --schema public` ou leia as migrations existentes;
   - remoto (só leitura): `mcp__claude_ai_Supabase__list_tables`.

2. Gere o arquivo — nunca crie o `.sql` à mão:
   ```
   npx supabase migration new <nome_snake_case>
   ```

3. Escreva o SQL. Template para tabela nova:
   ```sql
   -- Rollback: drop table public.<nome>;

   create table public.<nome> (
     id uuid primary key default gen_random_uuid(),
     owner_id uuid not null references auth.users(id) on delete cascade,
     created_at timestamptz not null default now()
   );

   alter table public.<nome> enable row level security;

   create policy "<nome>_select_own" on public.<nome>
     for select using (auth.uid() = owner_id);
   create policy "<nome>_insert_own" on public.<nome>
     for insert with check (auth.uid() = owner_id);
   create policy "<nome>_update_own" on public.<nome>
     for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
   create policy "<nome>_delete_own" on public.<nome>
     for delete using (auth.uid() = owner_id);

   create index on public.<nome> (owner_id);
   ```

4. **Checklist antes de validar** — cada item, explicitamente:
   - [ ] `enable row level security` presente
   - [ ] policy para cada operação que o app realmente usa
   - [ ] índice em toda FK e em coluna usada em `where`/`order by`
   - [ ] `timestamptz` (nunca `timestamp`), `numeric` para dinheiro (nunca `float`)
   - [ ] `on delete` explícito em toda FK
   - [ ] comentário de rollback no topo
   - [ ] se a tabela já tem dados: `add column not null` só com default; `create index concurrently`

5. Valide localmente: `npx supabase db reset` (recria do zero e aplica tudo).

6. Regenere os tipos:
   ```
   npx supabase gen types typescript --local > src/lib/database.types.ts
   ```

7. Rode o subagente `db-reviewer` no arquivo criado. Corrija o que ele apontar antes de considerar pronto.

## Nunca

- Editar migration já criada — correção é **nova** migration.
- `apply_migration` / `execute_sql` no projeto remoto sem pedido explícito do usuário.
- `using (true)` sem um comentário explicando por que aquela tabela é pública.
