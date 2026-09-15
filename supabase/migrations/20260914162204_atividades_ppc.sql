-- Rollback: exportar os dados, depois DROP TABLE public.atividades_ppc;
-- DROP FUNCTION app.antes_de_atualizar_ppc(); em nova migration.
create table public.atividades_ppc (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  id_atividade text not null check (length(btrim(id_atividade)) between 1 and 500),
  nome_atividade text not null check (length(btrim(nome_atividade)) between 1 and 2000),
  semana text not null check (length(btrim(semana)) between 1 and 500),
  quantidade_prevista numeric not null check (quantidade_prevista between 0 and 999999999999),
  quantidade_realizada numeric check (quantidade_realizada between 0 and 999999999999),
  status_planejamento text not null default '' check (length(status_planejamento) <= 500),
  observacoes text not null default '' check (length(observacoes) <= 5000),
  causa_6ms text not null default '' check (length(causa_6ms) <= 500),
  lider_imediato text not null default '' check (length(lider_imediato) <= 500),
  encarregado text not null default '' check (length(encarregado) <= 500),
  responsavel text not null default '' check (length(responsavel) <= 500),
  disciplina text not null default '' check (length(disciplina) <= 500),
  inicio_semana date not null,
  termino_semana date not null check (termino_semana >= inicio_semana),
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (obra_id, id_atividade, semana, inicio_semana)
);
create index on public.atividades_ppc (obra_id, inicio_semana);
alter table public.atividades_ppc enable row level security;
revoke all on public.atividades_ppc from anon, authenticated;
grant select, insert, update, delete on public.atividades_ppc to authenticated;
grant all on public.atividades_ppc to service_role;
create policy ppc_select on public.atividades_ppc for select to authenticated
  using (app.eh_membro_obra(obra_id));
create policy ppc_insert on public.atividades_ppc for insert to authenticated
  with check (app.eh_gestor_obra(obra_id) and criado_por = auth.uid());
create policy ppc_update on public.atividades_ppc for update to authenticated
  using (app.eh_gestor_obra(obra_id)) with check (app.eh_gestor_obra(obra_id));
create policy ppc_delete on public.atividades_ppc for delete to authenticated
  using (app.eh_gestor_obra(obra_id));

create function app.antes_de_atualizar_ppc() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.obra_id := old.obra_id;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.atualizado_em := now();
  return new;
end;
$$;
revoke all on function app.antes_de_atualizar_ppc() from public;
create trigger antes_de_atualizar_ppc before update on public.atividades_ppc
  for each row execute function app.antes_de_atualizar_ppc();
