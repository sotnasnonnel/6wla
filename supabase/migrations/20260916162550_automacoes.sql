-- Automações por obra: relatório de restrições por e-mail.
--
-- Motivo: substituir o fluxo n8n que baixava a planilha do SharePoint e
-- mandava, seg–sex às 7h30, um e-mail por responsável com as restrições
-- atrasadas e no prazo. Agora o gestor da obra configura o relatório no 6wla
-- e UM fluxo n8n fixo chama a API do 6wla a cada 15 min
-- (/api/automacoes/pendentes e /api/automacoes/confirmar, protegidas por
-- token) e só entrega os e-mails. O 6wla não tem SMTP.
--
--   - `6wla_automacoes`: a configuração (dias, hora, fuso, situações,
--     colunas, destino, cópias, assunto). Só gestor da obra (ou admin) vê e
--     mexe.
--   - `6wla_automacao_envios`: fila e histórico. Cada linha é um e-mail
--     reservado para um horário; o `unique (automacao_id, agendado_para,
--     destinatario)` garante que duas chamadas simultâneas do n8n não
--     dupliquem o envio. Gestor só LÊ; quem escreve é o service_role (API do
--     n8n e o "enviar teste", que roda no servidor depois de checar o gestor).
--   - `6wla_reivindica_envios`: entrega ao n8n as reservas ainda não
--     entregues, com `for update skip locked` (duas chamadas nunca levam a
--     mesma linha). Só service_role executa.
--
-- `ultimo_disparo` é o marco do agendador: horários até ele já foram
-- tratados. O app o põe em now() ao criar/reagendar/reativar, para não
-- disparar um horário que já passou.
--
-- Nada aqui toca tabelas view_* do PHD View.
--
-- Rollback (nenhum dado de outra tabela depende destas):
--   set lock_timeout = '3s';
--   drop function public."6wla_reivindica_envios"(integer);
--   drop table public."6wla_automacao_envios";
--   drop table public."6wla_automacoes";
--   drop function "6wla_app".antes_de_gravar_automacao();

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- Configuração
-- ---------------------------------------------------------------------------

create table public."6wla_automacoes" (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public."6wla_obras"(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  ativa boolean not null default true,
  -- 0 = domingo … 6 = sábado (Date.getDay / extract(dow)).
  dias_semana smallint[] not null
    check (
      cardinality(dias_semana) between 1 and 7
      and dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    ),
  hora time not null,
  fuso text not null default 'America/Sao_Paulo'
    check (char_length(fuso) between 1 and 64),
  situacoes text[] not null
    check (
      cardinality(situacoes) between 1 and 3
      and situacoes <@ array['atrasada', 'no_prazo', 'sem_prazo']::text[]
    ),
  -- Chaves do catálogo de colunas (src/lib/automacoes/colunas.ts), validadas
  -- na aplicação; a API ignora chave desconhecida.
  colunas text[] not null check (cardinality(colunas) between 1 and 30),
  destino text not null check (destino in ('responsaveis', 'lista')),
  -- E-mails (validados na aplicação e de novo na entrega).
  destinatarios text[] not null default '{}'
    check (cardinality(destinatarios) <= 50),
  copias text[] not null default '{}'
    check (cardinality(copias) <= 20),
  assunto text not null check (char_length(assunto) between 1 and 150),
  agrupar_por_responsavel boolean not null default true,
  criado_por uuid references public."6wla_perfis"(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  ultimo_disparo timestamptz,
  constraint automacoes_lista_tem_destinatario
    check (destino <> 'lista' or cardinality(destinatarios) > 0)
);

create index on public."6wla_automacoes" (obra_id);
create index on public."6wla_automacoes" (criado_por);
create index on public."6wla_automacoes" (ativa);

comment on table public."6wla_automacoes" is
  'Relatórios de restrições por e-mail de uma obra. Entregues pelo n8n via /api/automacoes/*.';
comment on column public."6wla_automacoes".ultimo_disparo is
  'Marco do agendador: horários até aqui já foram tratados (enviados ou pulados).';

-- Não muda de obra nem de autor; carimba a atualização.
create or replace function "6wla_app".antes_de_gravar_automacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.obra_id <> old.obra_id then
      raise exception 'Automação não muda de obra.'
        using errcode = 'check_violation';
    end if;
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger antes_de_gravar_automacao
  before insert or update on public."6wla_automacoes"
  for each row execute function "6wla_app".antes_de_gravar_automacao();

-- Função de gatilho: sem grant.
revoke execute on function "6wla_app".antes_de_gravar_automacao() from public;

-- ---------------------------------------------------------------------------
-- Fila e histórico de envios
-- ---------------------------------------------------------------------------

create table public."6wla_automacao_envios" (
  id uuid primary key default gen_random_uuid(),
  automacao_id uuid not null references public."6wla_automacoes"(id) on delete cascade,
  agendado_para timestamptz not null,
  status text not null default 'reservado'
    check (status in ('reservado', 'enviado', 'erro', 'sem_conteudo')),
  -- Um e-mail, ou a lista separada por vírgula (destino 'lista'). Vazio só
  -- no registro de "sem conteúdo".
  destinatario text not null
    check (
      char_length(destinatario) <= 20000
      and (destinatario <> '' or status = 'sem_conteudo')
    ),
  copias text[] not null default '{}' check (cardinality(copias) <= 20),
  assunto text not null default '' check (char_length(assunto) <= 200),
  total_itens integer not null default 0 check (total_itens >= 0),
  erro text check (char_length(erro) <= 2000),
  -- Envio pedido pelo botão "Enviar teste para mim".
  teste boolean not null default false,
  -- Quando a reserva foi entregue ao n8n (null = ainda na fila).
  entregue_em timestamptz,
  criado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  constraint automacao_envios_idempotente unique (automacao_id, agendado_para, destinatario)
);

-- O unique acima começa por automacao_id e já cobre a FK; este serve o
-- histórico (mais recentes primeiro).
create index on public."6wla_automacao_envios" (automacao_id, criado_em desc);
create index automacao_envios_fila on public."6wla_automacao_envios" (criado_em)
  where status = 'reservado' and entregue_em is null;

comment on table public."6wla_automacao_envios" is
  'Fila/histórico dos e-mails das automações. Escrita só pelo service_role.';

alter table public."6wla_automacoes" enable row level security;
alter table public."6wla_automacao_envios" enable row level security;
revoke all on public."6wla_automacoes" from anon;
revoke all on public."6wla_automacao_envios" from anon;
-- Sem policy de escrita já nega; o revoke deixa a intenção explícita.
revoke insert, update, delete on public."6wla_automacao_envios" from authenticated;

-- automações: só gestor da obra (ou admin), em todas as operações.
create policy automacoes_select on public."6wla_automacoes"
  for select to authenticated using ("6wla_app".eh_gestor_obra(obra_id));
create policy automacoes_insert on public."6wla_automacoes"
  for insert to authenticated with check (
    "6wla_app".eh_gestor_obra(obra_id)
    and criado_por = auth.uid()
  );
create policy automacoes_update on public."6wla_automacoes"
  for update to authenticated
  using ("6wla_app".eh_gestor_obra(obra_id))
  with check ("6wla_app".eh_gestor_obra(obra_id));
create policy automacoes_delete on public."6wla_automacoes"
  for delete to authenticated using ("6wla_app".eh_gestor_obra(obra_id));

-- envios: gestor da obra da automação lê o histórico.
create policy automacao_envios_select on public."6wla_automacao_envios"
  for select to authenticated using (
    exists (
      select 1 from public."6wla_automacoes" a
      where a.id = automacao_id and "6wla_app".eh_gestor_obra(a.obra_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Entrega ao n8n
-- ---------------------------------------------------------------------------

-- Marca como entregues (e devolve) até `p_limite` reservas na fila. Reserva
-- com mais de 6 h sem entrega vira erro: e-mail de ontem não sai hoje.
create or replace function public."6wla_reivindica_envios"(p_limite integer)
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
    select id
    from public."6wla_automacao_envios"
    where status = 'reservado'
      and entregue_em is null
      and criado_em >= now() - interval '6 hours'
    order by criado_em, id
    limit least(greatest(p_limite, 1), 200)
    for update skip locked
  )
  update public."6wla_automacao_envios" e
  set entregue_em = now()
  from escolhidos
  where e.id = escolhidos.id
  returning e.*;
$$;

revoke all on function public."6wla_reivindica_envios"(integer) from public, anon, authenticated;
grant execute on function public."6wla_reivindica_envios"(integer) to service_role;
