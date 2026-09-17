-- Um fluxo n8n por obra, criado pelo próprio 6wla.
--
-- Decisão do usuário (2026-09-17): em vez de UM fluxo fixo para todas as
-- obras, a aba Automações cria no n8n (pela API dele) o fluxo
-- "<código da obra> - Restrições". O fluxo continua só entregando e-mails:
-- a cada 15 min chama /api/automacoes/pendentes?obra=<id>, e a agenda
-- (dias, hora, pausa) segue no 6wla.
--
--   - `6wla_automacao_fluxos`: qual fluxo n8n atende cada obra e como ficou a
--     última sincronização. Gestor só LÊ (a aba mostra a situação); quem
--     escreve é o service_role, depois da checagem de gestor na aplicação.
--   - `6wla_reivindica_envios` ganha o filtro por obra: o fluxo de uma obra
--     não pode levar os e-mails de outra. A versão sem obra é removida para
--     que nenhum fluxo antigo esvazie a fila de todas as obras.
--
-- Nada aqui toca tabelas view_* do PHD View.
--
-- Rollback:
--   set lock_timeout = '3s';
--   drop function public."6wla_reivindica_envios"(integer, uuid);
--   drop table public."6wla_automacao_fluxos";
--   -- e recriar "6wla_reivindica_envios"(integer) como em
--   -- 20260916162550_automacoes.sql.
--   Os fluxos já criados no n8n precisam ser apagados à mão.

set lock_timeout = '3s';

create table public."6wla_automacao_fluxos" (
  obra_id uuid primary key references public."6wla_obras"(id) on delete cascade,
  -- Id do fluxo no n8n; null enquanto a criação não deu certo.
  n8n_id text check (n8n_id is null or char_length(n8n_id) between 1 and 64),
  nome text not null check (char_length(nome) between 1 and 120),
  ativo boolean not null default false,
  -- Última falha de sincronização (texto para o gestor, sem detalhe interno).
  erro text check (erro is null or char_length(erro) <= 500),
  sincronizado_em timestamptz not null default now()
);

alter table public."6wla_automacao_fluxos" enable row level security;

revoke all on public."6wla_automacao_fluxos" from anon;
-- Sem policy de escrita já nega; o revoke deixa a intenção explícita.
revoke insert, update, delete on public."6wla_automacao_fluxos" from authenticated;

create policy "fluxos: gestor da obra lê"
  on public."6wla_automacao_fluxos"
  for select to authenticated
  using ("6wla_app".eh_gestor_obra(obra_id));

-- ---------------------------------------------------------------------------
-- Reserva da fila, agora por obra
-- ---------------------------------------------------------------------------

drop function public."6wla_reivindica_envios"(integer);

-- Marca como entregues (e devolve) até `p_limite` reservas da obra. Reserva
-- com mais de 6 h sem entrega vira erro: e-mail de ontem não sai hoje.
create function public."6wla_reivindica_envios"(p_limite integer, p_obra_id uuid)
returns setof public."6wla_automacao_envios"
language sql
set search_path = ''
as $$
  with expirados as (
    update public."6wla_automacao_envios"
    set status = 'erro',
        erro = 'Expirou antes de ser entregue ao n8n.',
        confirmado_em = now()
    where status = 'reservado'
      and entregue_em is null
      and criado_em < now() - interval '6 hours'
  ),
  escolhidos as (
    select e.id
    from public."6wla_automacao_envios" e
    join public."6wla_automacoes" a on a.id = e.automacao_id
    where e.status = 'reservado'
      and e.entregue_em is null
      and e.criado_em >= now() - interval '6 hours'
      and a.obra_id = p_obra_id
    order by e.criado_em, e.id
    limit least(greatest(p_limite, 1), 200)
    for update of e skip locked
  )
  update public."6wla_automacao_envios" e
  set entregue_em = now()
  from escolhidos
  where e.id = escolhidos.id
  returning e.*;
$$;

revoke all on function public."6wla_reivindica_envios"(integer, uuid) from public, anon, authenticated;
grant execute on function public."6wla_reivindica_envios"(integer, uuid) to service_role;
