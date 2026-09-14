-- Esquema inicial do controle de restrições 6WLA (Last Planner System).
--
-- Multi-tenant por WORKSPACE: um workspace (empresa/contrato) tem várias
-- obras e várias pessoas. Quem está num workspace vê todas as obras dele e
-- nada de outro workspace. Uma pessoa pode estar em vários workspaces.
-- Papéis no workspace: admin (pessoas, obras), gestor (importa, trava linha
-- de base) e membro (edita restrições, comenta). `perfis.admin` é o
-- super-admin global (cria workspaces, enxerga tudo).
--
-- O sistema é a fonte da verdade. Planilhas existentes entram por importação
-- (uma vez, com conferência de mapeamento) e a partir daí vivem aqui.
--
-- Decisões que vêm das limitações do MS Planner (Planner.pdf):
--   - histórico de alteração de campo é automático (restricao_eventos);
--   - prazo original é preservado e reprogramações são contadas;
--   - "semana programada" (linha de base) só pode ser alterada por gestor;
--   - menções em comentários geram notificação persistente e auditável.
--
-- "Atrasada" NÃO é status: é função de data_limite < hoje (ou de
-- data_conclusao > data_limite, para "concluída com atraso").
--
-- Rollback:
--   drop schema app cascade;
--   drop table public.notificacoes, public.restricao_eventos,
--     public.restricao_comentarios, public.restricoes, public.importacoes,
--     public.obras, public.membros_workspace, public.workspaces,
--     public.perfis cascade;
--   drop type public.restricao_status, public.restricao_prioridade,
--     public.restricao_origem, public.workspace_papel, public.evento_tipo,
--     public.notificacao_tipo, public.importacao_status cascade;

create extension if not exists "pgcrypto";

-- Funções auxiliares ficam fora de `public` para não serem expostas pela API.
create schema if not exists app;
grant usage on schema app to authenticated;

-- `anon` não tem nada a fazer neste esquema: toda policy é `to authenticated`.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.restricao_status as enum ('pendente', 'em_andamento', 'concluida', 'cancelada');
create type public.restricao_prioridade as enum ('urgente', 'alta', 'media', 'baixa');
create type public.restricao_origem as enum ('manual', 'importada');
create type public.workspace_papel as enum ('admin', 'gestor', 'membro');
create type public.evento_tipo as enum ('criada', 'alteracao', 'importada');
create type public.notificacao_tipo as enum ('mencao', 'atribuicao', 'comentario');
create type public.importacao_status as enum ('rascunho', 'concluida', 'cancelada');

-- ---------------------------------------------------------------------------
-- Pessoas
-- ---------------------------------------------------------------------------

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Sempre em minúsculas (gatilho); unicidade case-insensitive por índice.
  email text not null,
  nome text not null,
  -- Super-admin global: cria workspaces e enxerga todos.
  admin boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create unique index perfis_email_unico on public.perfis (lower(email));

-- Perfil nasce junto com o usuário do auth. `nome` vem do user_metadata.
create or replace function app.cria_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_final text := lower(coalesce(new.email, new.phone, new.id::text || '@sem-email.local'));
begin
  insert into public.perfis (id, email, nome)
  values (
    new.id,
    email_final,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(email_final, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger cria_perfil_apos_signup
  after insert on auth.users
  for each row execute function app.cria_perfil();

-- ---------------------------------------------------------------------------
-- Workspaces e obras
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table public.workspaces is 'Empresa/contrato. Fronteira de visibilidade: quem está aqui vê só o que é daqui.';

create table public.membros_workspace (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.perfis(id) on delete cascade,
  papel public.workspace_papel not null default 'membro',
  criado_em timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index on public.membros_workspace (user_id);

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  codigo text not null,
  nome text not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (workspace_id, codigo)
);

create index on public.obras (workspace_id);

comment on table public.obras is 'Obras de um workspace. Todo membro do workspace enxerga todas.';

-- ---------------------------------------------------------------------------
-- Funções de autorização (usadas pelas policies e pelos gatilhos)
-- ---------------------------------------------------------------------------

create or replace function app.eh_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.admin and p.ativo from public.perfis p where p.id = auth.uid()),
    false
  );
$$;

-- Papel do usuário logado no workspace (null se não participa ou inativo).
create or replace function app.papel_ws(ws uuid)
returns public.workspace_papel
language sql stable security definer set search_path = ''
as $$
  select m.papel
  from public.membros_workspace m
  join public.perfis p on p.id = m.user_id
  where m.workspace_id = ws and m.user_id = auth.uid() and p.ativo;
$$;

create or replace function app.eh_membro_ws(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.eh_admin() or app.papel_ws(ws) is not null;
$$;

create or replace function app.eh_gestor_ws(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.eh_admin() or app.papel_ws(ws) in ('admin', 'gestor');
$$;

create or replace function app.eh_admin_ws(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.eh_admin() or app.papel_ws(ws) = 'admin';
$$;

-- Workspace de uma obra (para policies das tabelas filhas).
create or replace function app.obra_ws(obra uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select o.workspace_id from public.obras o where o.id = obra;
$$;

create or replace function app.eh_membro_obra(obra uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.eh_membro_ws(app.obra_ws(obra));
$$;

create or replace function app.eh_gestor_obra(obra uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.eh_gestor_ws(app.obra_ws(obra));
$$;

-- Duas pessoas que dividem pelo menos um workspace podem ver uma à outra.
create or replace function app.divide_workspace(alvo uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.membros_workspace meu
    join public.membros_workspace dele on dele.workspace_id = meu.workspace_id
    where meu.user_id = auth.uid() and dele.user_id = alvo
  );
$$;

-- Usuário X é membro ativo do workspace Y (validar responsável/menção).
create or replace function app.usuario_no_ws(usuario uuid, ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.membros_workspace m
    join public.perfis p on p.id = m.user_id
    where m.workspace_id = ws and m.user_id = usuario and p.ativo
  );
$$;

revoke execute on all functions in schema app from public;
grant execute on function
  app.eh_admin(),
  app.papel_ws(uuid),
  app.eh_membro_ws(uuid),
  app.eh_gestor_ws(uuid),
  app.eh_admin_ws(uuid),
  app.obra_ws(uuid),
  app.eh_membro_obra(uuid),
  app.eh_gestor_obra(uuid),
  app.divide_workspace(uuid),
  app.usuario_no_ws(uuid, uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Importações (Excel)
-- ---------------------------------------------------------------------------

create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  criado_por uuid references public.perfis(id) on delete set null,
  arquivo_nome text not null,
  aba text not null,
  status public.importacao_status not null default 'rascunho',
  cabecalhos text[] not null default '{}',
  linhas jsonb not null default '[]'::jsonb,
  mapa_colunas jsonb not null default '{}'::jsonb,
  -- Quem sugeriu o mapa: 'apelidos' | 'ia' | 'manual'
  mapa_origem text not null default 'apelidos',
  total_linhas integer not null default 0,
  importadas integer not null default 0,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create index on public.importacoes (obra_id, criado_em desc);
create index on public.importacoes (criado_por);

-- ---------------------------------------------------------------------------
-- Restrições
-- ---------------------------------------------------------------------------

create table public.restricoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  -- Sequencial por obra, atribuído por gatilho ("R-012"). O default 0 existe
  -- só para o tipo gerado não exigir a coluna; a constraint garante o gatilho.
  numero integer not null default 0,
  codigo text,

  descricao text not null,
  acao text,
  -- Responsável: usuário do sistema (membro do workspace) e/ou só texto.
  responsavel_id uuid references public.perfis(id) on delete set null,
  responsavel_nome text,
  responsavel_email text,
  responsavel_telefone text,

  status public.restricao_status not null default 'pendente',
  prioridade public.restricao_prioridade not null default 'media',
  descricao_status text,

  causa_6m text,
  classificacao text,
  area text,
  setor text,
  localizacao text,
  id_atividade text,
  atividade_impactada text,
  inicio_atividade date,

  data_criacao date not null default current_date,
  data_limite date,
  prazo_original date,
  reprogramacoes integer not null default 0,
  previsao_conclusao date,
  data_conclusao date,
  -- Linha de base ("S-20"). Só gestor altera depois de definida.
  semana_programada text,

  observacoes text,
  extras jsonb not null default '{}'::jsonb,

  origem public.restricao_origem not null default 'manual',
  importacao_id uuid references public.importacoes(id) on delete set null,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  unique (obra_id, numero),
  constraint numero_positivo check (numero > 0),
  constraint concluida_tem_data check (status <> 'concluida' or data_conclusao is not null)
);

create index on public.restricoes (obra_id, status);
create index on public.restricoes (obra_id, data_limite);
create index on public.restricoes (responsavel_id);
create index on public.restricoes (importacao_id);
create index on public.restricoes (criado_por);

create or replace function app.numera_restricao()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.obra_id::text));
  select coalesce(max(numero), 0) + 1 into new.numero
  from public.restricoes where obra_id = new.obra_id;
  if new.prazo_original is null then
    new.prazo_original := new.data_limite;
  end if;
  if new.status = 'concluida' and new.data_conclusao is null then
    new.data_conclusao := current_date;
  end if;
  -- Responsável precisa ser membro do workspace; senão fica só o texto.
  if new.responsavel_id is not null
     and not app.usuario_no_ws(new.responsavel_id, app.obra_ws(new.obra_id)) then
    new.responsavel_id := null;
  end if;
  return new;
end;
$$;

create trigger numera_restricao
  before insert on public.restricoes
  for each row execute function app.numera_restricao();

create or replace function app.antes_de_atualizar_restricao()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.atualizado_em := now();
  new.numero := old.numero;
  new.obra_id := old.obra_id;
  new.origem := old.origem;
  new.importacao_id := old.importacao_id;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.reprogramacoes := old.reprogramacoes;

  if old.prazo_original is null and new.data_limite is not null then
    new.prazo_original := new.data_limite;
  else
    new.prazo_original := old.prazo_original;
    if new.data_limite is distinct from old.data_limite and old.data_limite is not null then
      new.reprogramacoes := old.reprogramacoes + 1;
    end if;
  end if;

  if new.status = 'concluida' and old.status <> 'concluida' and new.data_conclusao is null then
    new.data_conclusao := current_date;
  end if;
  if new.status <> 'concluida' and old.status = 'concluida' then
    new.data_conclusao := null;
  end if;

  if new.semana_programada is distinct from old.semana_programada
     and old.semana_programada is not null
     and not app.eh_gestor_obra(old.obra_id) then
    raise exception 'Só gestor altera a semana programada (linha de base).'
      using errcode = 'insufficient_privilege';
  end if;

  if new.responsavel_id is distinct from old.responsavel_id
     and new.responsavel_id is not null
     and not app.usuario_no_ws(new.responsavel_id, app.obra_ws(old.obra_id)) then
    raise exception 'O responsável precisa ser membro do workspace.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger antes_de_atualizar_restricao
  before update on public.restricoes
  for each row execute function app.antes_de_atualizar_restricao();

-- ---------------------------------------------------------------------------
-- Histórico
-- ---------------------------------------------------------------------------

create table public.restricao_eventos (
  id uuid primary key default gen_random_uuid(),
  restricao_id uuid not null references public.restricoes(id) on delete cascade,
  autor_id uuid references public.perfis(id) on delete set null,
  tipo public.evento_tipo not null,
  campo text,
  valor_anterior text,
  valor_novo text,
  criado_em timestamptz not null default now()
);

create index on public.restricao_eventos (restricao_id, criado_em);
create index on public.restricao_eventos (autor_id);

create or replace function app.registra_evento_restricao()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  campo text;
  antes jsonb;
  depois jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.restricao_eventos (restricao_id, autor_id, tipo)
    values (
      new.id,
      auth.uid(),
      (case when new.origem = 'importada' then 'importada' else 'criada' end)::public.evento_tipo
    );
    return new;
  end if;

  antes := to_jsonb(old);
  depois := to_jsonb(new);
  foreach campo in array array[
    'codigo', 'descricao', 'acao', 'responsavel_id', 'responsavel_nome',
    'responsavel_email', 'responsavel_telefone', 'status', 'prioridade',
    'descricao_status', 'causa_6m', 'classificacao', 'area', 'setor',
    'localizacao', 'id_atividade', 'atividade_impactada', 'inicio_atividade',
    'data_criacao', 'data_limite', 'previsao_conclusao', 'data_conclusao',
    'semana_programada', 'observacoes'
  ] loop
    if antes -> campo is distinct from depois -> campo then
      insert into public.restricao_eventos
        (restricao_id, autor_id, tipo, campo, valor_anterior, valor_novo)
      values
        (new.id, auth.uid(), 'alteracao', campo, antes ->> campo, depois ->> campo);
    end if;
  end loop;
  return new;
end;
$$;

create trigger registra_evento_restricao
  after insert or update on public.restricoes
  for each row execute function app.registra_evento_restricao();

-- ---------------------------------------------------------------------------
-- Chat da restrição
-- ---------------------------------------------------------------------------

create table public.restricao_comentarios (
  id uuid primary key default gen_random_uuid(),
  restricao_id uuid not null references public.restricoes(id) on delete cascade,
  -- `set null`: apagar a pessoa não apaga a conversa.
  autor_id uuid references public.perfis(id) on delete set null,
  texto text not null check (char_length(texto) between 1 and 4000),
  -- Usuários mencionados com @. Só membros do workspace recebem notificação.
  mencoes uuid[] not null default '{}',
  criado_em timestamptz not null default now()
);

create index on public.restricao_comentarios (restricao_id, criado_em);
create index on public.restricao_comentarios (autor_id);

-- ---------------------------------------------------------------------------
-- Notificações
-- ---------------------------------------------------------------------------

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis(id) on delete cascade,
  tipo public.notificacao_tipo not null,
  restricao_id uuid not null references public.restricoes(id) on delete cascade,
  comentario_id uuid references public.restricao_comentarios(id) on delete cascade,
  autor_id uuid references public.perfis(id) on delete set null,
  lida_em timestamptz,
  criado_em timestamptz not null default now()
);

create index on public.notificacoes (user_id, criado_em desc);
create index notificacoes_nao_lidas on public.notificacoes (user_id, criado_em desc)
  where lida_em is null;
create index on public.notificacoes (restricao_id);
create index on public.notificacoes (comentario_id);
create index on public.notificacoes (autor_id);

-- O array `mencoes` é entrada do usuário: nunca confiar nele.
create or replace function app.notifica_comentario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  ws uuid;
  responsavel uuid;
  mencionado uuid;
begin
  select o.workspace_id, r.responsavel_id into ws, responsavel
  from public.restricoes r
  join public.obras o on o.id = r.obra_id
  where r.id = new.restricao_id;

  for mencionado in
    select distinct m
    from unnest(new.mencoes) as m
    where m <> new.autor_id and app.usuario_no_ws(m, ws)
  loop
    insert into public.notificacoes (user_id, tipo, restricao_id, comentario_id, autor_id)
    values (mencionado, 'mencao', new.restricao_id, new.id, new.autor_id);
  end loop;

  if responsavel is not null
     and responsavel <> new.autor_id
     and not (responsavel = any (new.mencoes))
     and app.usuario_no_ws(responsavel, ws) then
    insert into public.notificacoes (user_id, tipo, restricao_id, comentario_id, autor_id)
    values (responsavel, 'comentario', new.restricao_id, new.id, new.autor_id);
  end if;
  return new;
end;
$$;

create trigger notifica_comentario
  after insert on public.restricao_comentarios
  for each row execute function app.notifica_comentario();

create or replace function app.notifica_atribuicao()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.responsavel_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    return new;
  end if;
  if new.responsavel_id = auth.uid() then
    return new;
  end if;
  insert into public.notificacoes (user_id, tipo, restricao_id, autor_id)
  values (new.responsavel_id, 'atribuicao', new.id, auth.uid());
  return new;
end;
$$;

create trigger notifica_atribuicao
  after insert or update of responsavel_id on public.restricoes
  for each row execute function app.notifica_atribuicao();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.perfis enable row level security;
alter table public.workspaces enable row level security;
alter table public.membros_workspace enable row level security;
alter table public.obras enable row level security;
alter table public.importacoes enable row level security;
alter table public.restricoes enable row level security;
alter table public.restricao_eventos enable row level security;
alter table public.restricao_comentarios enable row level security;
alter table public.notificacoes enable row level security;

revoke all on all tables in schema public from anon;

-- perfis: vejo a mim, quem divide workspace comigo, e tudo se sou admin global.
create policy perfis_select on public.perfis
  for select to authenticated using (
    id = auth.uid() or app.eh_admin() or app.divide_workspace(id)
  );
-- Só o próprio (nome) ou admin global altera. `admin`, `ativo` e `email`
-- são travados para o usuário comum.
create policy perfis_update on public.perfis
  for update to authenticated
  using (id = auth.uid() or app.eh_admin())
  with check (
    app.eh_admin()
    or (
      id = auth.uid()
      and admin = (select p.admin from public.perfis p where p.id = auth.uid())
      and ativo = (select p.ativo from public.perfis p where p.id = auth.uid())
      and email = (select p.email from public.perfis p where p.id = auth.uid())
    )
  );

-- workspaces: membro vê o seu; admin global cria/apaga; admin do workspace renomeia.
create policy workspaces_select on public.workspaces
  for select to authenticated using (app.eh_membro_ws(id));
create policy workspaces_insert on public.workspaces
  for insert to authenticated with check (app.eh_admin());
create policy workspaces_update on public.workspaces
  for update to authenticated using (app.eh_admin_ws(id)) with check (app.eh_admin_ws(id));
create policy workspaces_delete on public.workspaces
  for delete to authenticated using (app.eh_admin());

-- membros_workspace: membro vê quem está no workspace; admin do workspace gerencia.
create policy membros_ws_select on public.membros_workspace
  for select to authenticated using (app.eh_membro_ws(workspace_id));
create policy membros_ws_insert on public.membros_workspace
  for insert to authenticated with check (app.eh_admin_ws(workspace_id));
create policy membros_ws_update on public.membros_workspace
  for update to authenticated using (app.eh_admin_ws(workspace_id)) with check (app.eh_admin_ws(workspace_id));
create policy membros_ws_delete on public.membros_workspace
  for delete to authenticated using (app.eh_admin_ws(workspace_id));

-- obras: membro do workspace vê; admin do workspace administra.
create policy obras_select on public.obras
  for select to authenticated using (app.eh_membro_ws(workspace_id));
create policy obras_insert on public.obras
  for insert to authenticated with check (app.eh_admin_ws(workspace_id));
create policy obras_update on public.obras
  for update to authenticated using (app.eh_admin_ws(workspace_id)) with check (app.eh_admin_ws(workspace_id));
create policy obras_delete on public.obras
  for delete to authenticated using (app.eh_admin_ws(workspace_id));

-- importacoes: gestor (ou admin) do workspace da obra.
create policy importacoes_select on public.importacoes
  for select to authenticated using (app.eh_gestor_obra(obra_id));
create policy importacoes_insert on public.importacoes
  for insert to authenticated with check (app.eh_gestor_obra(obra_id) and criado_por = auth.uid());
create policy importacoes_update on public.importacoes
  for update to authenticated using (app.eh_gestor_obra(obra_id)) with check (app.eh_gestor_obra(obra_id));
create policy importacoes_delete on public.importacoes
  for delete to authenticated using (app.eh_gestor_obra(obra_id));

-- restricoes: membro vê/cria/edita; gestor apaga.
create policy restricoes_select on public.restricoes
  for select to authenticated using (app.eh_membro_obra(obra_id));
create policy restricoes_insert on public.restricoes
  for insert to authenticated with check (app.eh_membro_obra(obra_id) and criado_por = auth.uid());
create policy restricoes_update on public.restricoes
  for update to authenticated using (app.eh_membro_obra(obra_id)) with check (app.eh_membro_obra(obra_id));
create policy restricoes_delete on public.restricoes
  for delete to authenticated using (app.eh_gestor_obra(obra_id));

-- eventos: só leitura por membro; escrita é exclusiva do gatilho.
create policy eventos_select on public.restricao_eventos
  for select to authenticated using (
    exists (select 1 from public.restricoes r where r.id = restricao_id and app.eh_membro_obra(r.obra_id))
  );

-- comentarios: membro lê e escreve em nome próprio; apaga só o seu.
create policy comentarios_select on public.restricao_comentarios
  for select to authenticated using (
    exists (select 1 from public.restricoes r where r.id = restricao_id and app.eh_membro_obra(r.obra_id))
  );
create policy comentarios_insert on public.restricao_comentarios
  for insert to authenticated with check (
    autor_id = auth.uid()
    and exists (select 1 from public.restricoes r where r.id = restricao_id and app.eh_membro_obra(r.obra_id))
  );
create policy comentarios_delete on public.restricao_comentarios
  for delete to authenticated using (autor_id = auth.uid());

-- notificacoes: cada um vê e marca as suas. Inserção é exclusiva dos gatilhos.
create policy notificacoes_select on public.notificacoes
  for select to authenticated using (user_id = auth.uid());
create policy notificacoes_update on public.notificacoes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notificacoes_delete on public.notificacoes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime (chat, sino e grade). Insert/update passam pela RLS; eventos de
-- delete não (limitação do Supabase) e expõem só a chave primária.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.restricao_comentarios;
alter publication supabase_realtime add table public.notificacoes;
alter publication supabase_realtime add table public.restricoes;
