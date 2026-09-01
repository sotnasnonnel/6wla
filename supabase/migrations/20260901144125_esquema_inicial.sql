-- Esquema inicial do controle de restrições 6WLA.
--
-- Propriedade dividida por campo (decisão de projeto):
--   - A PLANILHA (SharePoint, aba 6WLA) é dona do CADASTRO: descrição, ação,
--     responsável, prazos, classificação. Esses campos só são escritos pela
--     sincronização do n8n; o app nunca os altera.
--   - O BANCO é dono do ESTADO: status, comentários, histórico. O n8n escreve
--     apenas o status de volta na planilha.
-- Nenhum campo tem dois donos, então não existe conflito a resolver.
--
-- Rollback:
--   drop schema app cascade;
--   drop table public.disparo_itens, public.disparos, public.restricao_eventos,
--     public.restricoes, public.membros_obra, public.perfis, public.obra_fontes,
--     public.obras cascade;
--   drop type public.restricao_status, public.papel_obra, public.evento_tipo,
--     public.disparo_canal cascade;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

-- "No prazo" e "Atrasado" NÃO são status: são função da data limite. Misturar
-- as duas coisas numa coluna só é o defeito das planilhas atuais, e é por isso
-- que cada obra filtra um conjunto diferente.
create type public.restricao_status as enum (
  'pendente',
  'em_tratativa',
  'resolvida',
  'cancelada'
);

create type public.papel_obra as enum ('responsavel', 'gestor');

create type public.evento_tipo as enum (
  'criada',
  'status',
  'comentario',
  'sincronizacao'
);

create type public.disparo_canal as enum ('email', 'whatsapp');

-- ---------------------------------------------------------------------------
-- Obras (contratos)
-- ---------------------------------------------------------------------------

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,           -- ex.: IMCS-CT09-PLAN
  nome text not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table public.obras is 'Contratos/obras. Um por workflow de Restrições que existia no n8n.';

-- Configuração de sincronização por obra. Substitui os 21 workflows duplicados:
-- obra nova passa a ser um INSERT aqui, não uma cópia de workflow.
create table public.obra_fontes (
  obra_id uuid primary key references public.obras(id) on delete cascade,
  arquivo_url text not null,             -- URL do .xlsx no SharePoint
  aba text not null default '6WLA',
  linhas_descartadas smallint not null default 0,  -- IMCS descarta 2 e usa a 3ª como cabeçalho
  -- de-para de colunas: {"descricao": ["Restrição"], "acao": ["Ação"], ...}
  -- As planilhas divergem entre obras e NÃO são renomeadas; o mapa absorve isso.
  mapa_colunas jsonb not null default '{}'::jsonb,
  -- de-para de status da planilha para o enum: {"pendente": "pendente", "no prazo": "pendente"}
  mapa_status jsonb not null default '{}'::jsonb,
  copias_fixas text[] not null default '{}',  -- e-mails em cópia, antes hardcoded no n8n
  hora_disparo time not null default '07:30',
  dias_disparo smallint[] not null default '{1,2,3,4,5}',  -- 1=segunda ... 7=domingo
  sincronia_ativa boolean not null default true,
  ultima_leitura_em timestamptz,
  ultima_escrita_em timestamptz,
  criado_em timestamptz not null default now()
);

comment on column public.obra_fontes.mapa_colunas is
  'De-para dos nomes de coluna da aba 6WLA daquela obra para os campos canônicos.';

-- ---------------------------------------------------------------------------
-- Pessoas e papéis
-- ---------------------------------------------------------------------------

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nome text,
  -- PMO enxerga todas as obras; é o único papel global.
  pmo boolean not null default false,
  criado_em timestamptz not null default now()
);

create table public.membros_obra (
  obra_id uuid not null references public.obras(id) on delete cascade,
  user_id uuid not null references public.perfis(id) on delete cascade,
  papel public.papel_obra not null,
  criado_em timestamptz not null default now(),
  primary key (obra_id, user_id)
);

create index on public.membros_obra (user_id);

-- ---------------------------------------------------------------------------
-- Restrições
-- ---------------------------------------------------------------------------

create table public.restricoes (
  -- Mesmo UUID gravado na coluna ID da planilha. É o que liga as duas pontas:
  -- inserir linha, ordenar ou corrigir um typo não quebra o vínculo.
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,

  -- --- Campos do CADASTRO: donos da planilha, só o n8n escreve ---
  descricao text not null,
  acao text,
  responsavel_nome text,
  responsavel_email text,
  data_criacao date,
  data_limite date,
  atividade_impactada text,
  classificacao text,
  localizacao text,
  setor text,
  -- Colunas que existem só naquela obra (ÁREA, GERÊNCIA...) e não têm campo canônico.
  extras jsonb not null default '{}'::jsonb,
  linha_planilha integer,
  removida_da_planilha boolean not null default false,
  sincronizado_em timestamptz not null default now(),

  -- --- Campos do ESTADO: donos do banco, o app escreve ---
  status public.restricao_status not null default 'pendente',
  status_alterado_em timestamptz not null default now(),
  status_alterado_por uuid references public.perfis(id),
  -- Marca até onde o n8n já escreveu de volta. A escrita de volta seleciona
  -- exatamente as linhas em que status_alterado_em > status_escrito_em.
  status_escrito_em timestamptz,

  criado_em timestamptz not null default now()
);

create index on public.restricoes (obra_id);
create index on public.restricoes (responsavel_email);
create index on public.restricoes (obra_id, status);
create index on public.restricoes (data_limite);
create index on public.restricoes (status_alterado_por);
-- Fila da escrita de volta: só o que mudou depois da última gravação.
create index on public.restricoes (obra_id, status_alterado_em)
  where status_escrito_em is null or status_alterado_em > status_escrito_em;

-- Está atrasada? Derivado, nunca digitado.
create or replace function public.restricao_atrasada(r public.restricoes)
returns boolean
language sql
stable
set search_path = ''
as $$
  select r.data_limite is not null
     and r.status in ('pendente', 'em_tratativa')
     and r.data_limite < current_date;
$$;

-- ---------------------------------------------------------------------------
-- Histórico — a pergunta "quem respondeu isso e quando?" que hoje não tem resposta
-- ---------------------------------------------------------------------------

create table public.restricao_eventos (
  id uuid primary key default gen_random_uuid(),
  restricao_id uuid not null references public.restricoes(id) on delete cascade,
  tipo public.evento_tipo not null,
  autor_id uuid references public.perfis(id),
  autor_email text,                      -- preservado mesmo se o perfil sumir
  status_anterior public.restricao_status,
  status_novo public.restricao_status,
  comentario text,
  criado_em timestamptz not null default now(),
  constraint comentario_nao_vazio check (
    comentario is null or length(btrim(comentario)) > 0
  )
);

create index on public.restricao_eventos (restricao_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Auditoria de disparos — "será que ele recebeu?"
-- ---------------------------------------------------------------------------

create table public.disparos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  canal public.disparo_canal not null default 'email',
  destinatario_email text not null,
  qtd_restricoes integer not null default 0,
  sucesso boolean not null,
  erro text,
  enviado_em timestamptz not null default now()
);

create index on public.disparos (obra_id, enviado_em desc);
create index on public.disparos (enviado_em desc) where not sucesso;

create table public.disparo_itens (
  disparo_id uuid not null references public.disparos(id) on delete cascade,
  restricao_id uuid not null references public.restricoes(id) on delete cascade,
  primary key (disparo_id, restricao_id)
);

create index on public.disparo_itens (restricao_id);

-- ---------------------------------------------------------------------------
-- Helpers de autorização
-- ---------------------------------------------------------------------------

create schema if not exists app;

-- As policies abaixo chamam funcoes deste schema; sem USAGE, toda consulta
-- de um usuario autenticado falha com "permission denied for schema app".
grant usage on schema app to authenticated, anon, service_role;

create or replace function app.email_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.email from public.perfis p where p.id = (select auth.uid());
$$;

create or replace function app.e_pmo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.pmo from public.perfis p where p.id = (select auth.uid())), false);
$$;

create or replace function app.e_gestor(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros_obra m
    where m.obra_id = p_obra
      and m.user_id = (select auth.uid())
      and m.papel = 'gestor'
  );
$$;

create or replace function app.membro_da_obra(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros_obra m
    where m.obra_id = p_obra and m.user_id = (select auth.uid())
  );
$$;

-- Regra central de visibilidade de uma restrição:
--   PMO           -> todas
--   gestor da obra -> todas daquela obra
--   responsável    -> apenas as endereçadas ao e-mail dele
create or replace function app.pode_ver_restricao(p_obra uuid, p_responsavel_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.e_pmo()
      or app.e_gestor(p_obra)
      or (
        app.membro_da_obra(p_obra)
        and p_responsavel_email is not null
        and lower(p_responsavel_email) = lower(coalesce(app.email_atual(), ''))
      );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.obras            enable row level security;
alter table public.obra_fontes      enable row level security;
alter table public.perfis           enable row level security;
alter table public.membros_obra     enable row level security;
alter table public.restricoes       enable row level security;
alter table public.restricao_eventos enable row level security;
alter table public.disparos         enable row level security;
alter table public.disparo_itens    enable row level security;

-- obras: quem é membro vê a obra; PMO vê todas. Escrita só por service_role (n8n/admin).
create policy obras_select on public.obras
  for select to authenticated
  using (app.e_pmo() or app.membro_da_obra(id));

-- obra_fontes guarda URL de SharePoint e lista de cópias: só PMO enxerga.
create policy obra_fontes_select on public.obra_fontes
  for select to authenticated
  using (app.e_pmo());

-- perfis: cada um vê o próprio; PMO vê todos.
create policy perfis_select on public.perfis
  for select to authenticated
  using (id = (select auth.uid()) or app.e_pmo());

create policy perfis_update_proprio on public.perfis
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Consultar public.perfis dentro de uma policy de public.perfis causa recursao
-- infinita de RLS. A regra "ninguem se promove a PMO" vira gatilho.
create or replace function public.perfis_bloqueia_escalada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and new.pmo is distinct from old.pmo then
    raise exception 'O papel PMO so pode ser concedido pela administracao.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger perfis_bloqueia_escalada
  before update on public.perfis
  for each row execute function public.perfis_bloqueia_escalada();

-- membros_obra: você vê seus vínculos; gestor vê os da obra dele; PMO vê tudo.
create policy membros_select on public.membros_obra
  for select to authenticated
  using (user_id = (select auth.uid()) or app.e_gestor(obra_id) or app.e_pmo());

-- restricoes: leitura pela regra central.
create policy restricoes_select on public.restricoes
  for select to authenticated
  using (app.pode_ver_restricao(obra_id, responsavel_email));

-- restricoes: o app só altera ESTADO. O cadastro é da planilha, e a checagem
-- coluna a coluna abaixo impede que um UPDATE do app encoste nele.
create policy restricoes_update_estado on public.restricoes
  for update to authenticated
  using (app.pode_ver_restricao(obra_id, responsavel_email))
  with check (app.pode_ver_restricao(obra_id, responsavel_email));

-- eventos: visíveis para quem vê a restrição; qualquer um que vê pode comentar.
create policy eventos_select on public.restricao_eventos
  for select to authenticated
  using (exists (
    select 1 from public.restricoes r
    where r.id = restricao_id and app.pode_ver_restricao(r.obra_id, r.responsavel_email)
  ));

create policy eventos_insert on public.restricao_eventos
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.restricoes r
      where r.id = restricao_id and app.pode_ver_restricao(r.obra_id, r.responsavel_email)
    )
  );

-- Histórico é imutável: sem update, sem delete. Nenhuma policy concede isso.

-- disparos: auditoria é de gestor da obra e PMO.
create policy disparos_select on public.disparos
  for select to authenticated
  using (app.e_pmo() or app.e_gestor(obra_id));

create policy disparo_itens_select on public.disparo_itens
  for select to authenticated
  using (exists (
    select 1 from public.disparos d
    where d.id = disparo_id and (app.e_pmo() or app.e_gestor(d.obra_id))
  ));

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------

-- Impede que o app escreva em campo do cadastro, mesmo que a policy passe.
-- A sincronização do n8n usa service_role, que ignora RLS e este gatilho não a bloqueia
-- porque ela roda com auth.uid() nulo.
create or replace function public.restricoes_protege_cadastro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;  -- sincronização (service_role)
  end if;

  if new.descricao is distinct from old.descricao
     or new.acao is distinct from old.acao
     or new.responsavel_email is distinct from old.responsavel_email
     or new.responsavel_nome is distinct from old.responsavel_nome
     or new.data_limite is distinct from old.data_limite
     or new.data_criacao is distinct from old.data_criacao
     or new.obra_id is distinct from old.obra_id
     or new.extras is distinct from old.extras then
    raise exception 'Campo de cadastro só pode ser alterado na planilha (aba 6WLA).'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    new.status_alterado_em := now();
    new.status_alterado_por := (select auth.uid());
  end if;

  return new;
end;
$$;

create trigger restricoes_protege_cadastro
  before update on public.restricoes
  for each row execute function public.restricoes_protege_cadastro();

-- Toda mudança de status vira evento. O histórico não depende de o app lembrar de gravar.
create or replace function public.restricoes_registra_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.restricao_eventos
      (restricao_id, tipo, autor_id, autor_email, status_anterior, status_novo)
    values
      (new.id, 'status', (select auth.uid()), app.email_atual(), old.status, new.status);
  end if;
  return null;
end;
$$;

create trigger restricoes_registra_status
  after update on public.restricoes
  for each row execute function public.restricoes_registra_status();

-- Perfil criado automaticamente no primeiro login por magic link.
create or replace function public.cria_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, email, nome)
  values (new.id, lower(new.email), new.raw_user_meta_data ->> 'nome')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger cria_perfil_ao_cadastrar
  after insert on auth.users
  for each row execute function public.cria_perfil();
