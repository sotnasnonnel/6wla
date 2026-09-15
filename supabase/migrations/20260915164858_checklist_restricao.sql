-- Checklist da restrição.
--
-- Tarefas que precisam acontecer para a restrição ser resolvida ("pedir
-- orçamento", "liberar frente com a segurança"). Decisões do usuário:
--   - Qualquer membro da obra cria, marca, renomeia e apaga tarefa — quem
--     executa é quem está na frente de serviço, igual à edição da restrição.
--   - Cada tarefa guarda só texto e check, mais quem marcou e quando.
--   - O checklist NÃO mexe no status da restrição; é só progresso.
--
-- `concluida_por`/`concluida_em` são preenchidos pelo gatilho, nunca pelo
-- cliente: "quem marcou" não pode ser forjado.
--
-- Rollback (antes dos rollbacks das migrations anteriores):
--   drop table public."6wla_restricao_tarefas";
--   drop function "6wla_app".antes_de_gravar_tarefa();

create table public."6wla_restricao_tarefas" (
  id uuid primary key default gen_random_uuid(),
  restricao_id uuid not null references public."6wla_restricoes"(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  concluida boolean not null default false,
  -- `set null`: apagar a pessoa não apaga o checklist.
  concluida_por uuid references public."6wla_perfis"(id) on delete set null,
  concluida_em timestamptz,
  criado_por uuid references public."6wla_perfis"(id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint restricao_tarefas_conclusao_coerente
    check (concluida = (concluida_em is not null))
);

create index on public."6wla_restricao_tarefas" (restricao_id, criado_em);
create index on public."6wla_restricao_tarefas" (criado_por);
create index on public."6wla_restricao_tarefas" (concluida_por);

create or replace function "6wla_app".antes_de_gravar_tarefa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.restricao_id <> old.restricao_id then
    raise exception 'Tarefa não muda de restrição.'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' then
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
  end if;

  if new.concluida and (tg_op = 'INSERT' or not old.concluida) then
    new.concluida_por := auth.uid();
    new.concluida_em := now();
  elsif not new.concluida then
    new.concluida_por := null;
    new.concluida_em := null;
  else
    -- Continua marcada: preserva quem marcou originalmente.
    new.concluida_por := old.concluida_por;
    new.concluida_em := old.concluida_em;
  end if;
  return new;
end;
$$;

create trigger antes_de_gravar_tarefa
  before insert or update on public."6wla_restricao_tarefas"
  for each row execute function "6wla_app".antes_de_gravar_tarefa();

alter table public."6wla_restricao_tarefas" enable row level security;
revoke all on public."6wla_restricao_tarefas" from anon;

-- Membro da obra da restrição faz tudo; ninguém de fora vê nem escreve.
create policy tarefas_select on public."6wla_restricao_tarefas"
  for select to authenticated using (
    exists (
      select 1 from public."6wla_restricoes" r
      where r.id = restricao_id and "6wla_app".eh_membro_obra(r.obra_id)
    )
  );
create policy tarefas_insert on public."6wla_restricao_tarefas"
  for insert to authenticated with check (
    criado_por = auth.uid()
    and exists (
      select 1 from public."6wla_restricoes" r
      where r.id = restricao_id and "6wla_app".eh_membro_obra(r.obra_id)
    )
  );
create policy tarefas_update on public."6wla_restricao_tarefas"
  for update to authenticated
  using (
    exists (
      select 1 from public."6wla_restricoes" r
      where r.id = restricao_id and "6wla_app".eh_membro_obra(r.obra_id)
    )
  )
  with check (
    exists (
      select 1 from public."6wla_restricoes" r
      where r.id = restricao_id and "6wla_app".eh_membro_obra(r.obra_id)
    )
  );
create policy tarefas_delete on public."6wla_restricao_tarefas"
  for delete to authenticated using (
    exists (
      select 1 from public."6wla_restricoes" r
      where r.id = restricao_id and "6wla_app".eh_membro_obra(r.obra_id)
    )
  );
