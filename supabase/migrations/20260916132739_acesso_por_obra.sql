-- Acesso por OBRA (não mais por workspace).
--
-- Decisões do usuário (2026-09-16):
--   - Cada pessoa está em UM workspace, com UM papel: gestor ou membro. Não
--     existe mais "admin de workspace"; admin é só o global (`perfis.admin`),
--     que vê e administra tudo (workspaces, usuários, todas as obras).
--   - Gestor cria obra no próprio workspace e vira dono dela
--     (`obras.criado_por`). O dono monta a equipe da obra
--     (`6wla_membros_obra`), escolhendo pessoas do mesmo workspace.
--   - Membro só vê as obras em cuja equipe está. Gestor vê as que criou e as
--     de outros gestores em cuja equipe está; nestas tem poderes de gestor
--     (apagar restrição, mexer na semana-base, importar), mas não mexe na
--     equipe.
--   - Responsável e menções passam a ser validados contra a equipe da obra,
--     não contra o workspace inteiro.
--
-- Todas as policies das tabelas filhas (restrições, eventos, comentários,
-- anexos, tarefas, importações, storage) já passam por `eh_membro_obra` /
-- `eh_gestor_obra`; redefinir essas funções muda o acesso de todas de uma vez.
-- `eh_admin_ws` passa a ser só o admin global, o que fecha a gestão de
-- workspaces e de vínculos para quem não é admin.
--
-- Dados existentes: a obra ganha como dono quem era admin do workspace
-- dela (o primeiro vínculo, por data); depois esse vínculo 'admin' vira
-- 'gestor'. Obra sem admin no workspace fica sem dono: só o admin global a vê
-- até montar a equipe. Se alguém estiver em mais de um workspace, a migration
-- FALHA no `unique` de propósito — resolver à mão antes (decidir em qual a
-- pessoa fica).
--
-- Rollback, NESTA ORDEM (policies e funções antigas voltam antes dos drops;
-- `drop function` de SQL não acusa dependência de outra função, e as policies
-- das tabelas filhas quebrariam):
--   set lock_timeout = '3s';
--   1. drop policy obras_select, obras_insert, obras_update, obras_delete
--      on public."6wla_obras" e recriá-las com o texto de
--      20260903113139_esquema_inicial.sql (eh_membro_ws / eh_admin_ws).
--   2. create or replace, com o corpo de 20260903113139: eh_admin_ws,
--      eh_membro_obra, eh_gestor_obra, numera_restricao,
--      antes_de_atualizar_restricao, notifica_comentario.
--   3. drop trigger limpa_equipes_ao_sair_do_workspace on public."6wla_membros_workspace";
--      drop function "6wla_app".limpa_equipes_ao_sair_do_workspace();
--      drop table public."6wla_membros_obra";
--      drop function "6wla_app".eh_dono_obra(uuid);
--      drop function "6wla_app".participa_obra(uuid);
--      drop function "6wla_app".usuario_na_obra(uuid, uuid);
--      alter table public."6wla_obras" drop column criado_por;
--      alter table public."6wla_membros_workspace"
--        drop constraint "6wla_membros_workspace_um_por_pessoa",
--        drop constraint "6wla_membros_workspace_papel_valido";
--   4. comment on table de 6wla_workspaces e 6wla_obras com os textos de
--      20260903113139.
-- Os vínculos convertidos de 'admin' para 'gestor' não voltam sozinhos.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- Vínculo com workspace: um por pessoa, papel gestor|membro
-- ---------------------------------------------------------------------------

alter table public."6wla_obras"
  add column criado_por uuid references public."6wla_perfis"(id) on delete set null;

-- Antes de converter os papéis: quem administrava o workspace vira dono das
-- obras dele, para não perder o acesso.
update public."6wla_obras" o
set criado_por = (
  select m.user_id
  from public."6wla_membros_workspace" m
  where m.workspace_id = o.workspace_id and m.papel = 'admin'
  order by m.criado_em, m.user_id
  limit 1
)
where o.criado_por is null;

update public."6wla_membros_workspace" set papel = 'gestor' where papel = 'admin';

alter table public."6wla_membros_workspace"
  add constraint "6wla_membros_workspace_um_por_pessoa" unique (user_id),
  add constraint "6wla_membros_workspace_papel_valido" check (papel in ('gestor', 'membro'));

comment on table public."6wla_workspaces" is
  'Empresa/contrato. Cada pessoa está em um só; o acesso a dados é por obra (6wla_membros_obra).';

-- ---------------------------------------------------------------------------
-- Dono da obra e equipe
-- ---------------------------------------------------------------------------

create index on public."6wla_obras" (criado_por);

comment on table public."6wla_obras" is
  'Obras de um workspace. Vê quem é dono (criado_por) ou está na equipe (6wla_membros_obra); admin vê todas.';

create table public."6wla_membros_obra" (
  obra_id uuid not null references public."6wla_obras"(id) on delete cascade,
  user_id uuid not null references public."6wla_perfis"(id) on delete cascade,
  adicionado_por uuid references public."6wla_perfis"(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  primary key (obra_id, user_id)
);

create index on public."6wla_membros_obra" (user_id);
create index on public."6wla_membros_obra" (adicionado_por);

comment on table public."6wla_membros_obra" is
  'Equipe da obra, montada pelo dono (gestor que criou) ou pelo admin.';

-- ---------------------------------------------------------------------------
-- Funções de autorização
-- ---------------------------------------------------------------------------

-- Não existe mais admin de workspace: só o global.
create or replace function "6wla_app".eh_admin_ws(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select "6wla_app".eh_admin();
$$;

-- Usuário logado participa da obra: é dono ou está na equipe, E continua
-- ativo no workspace dela (quem sai do workspace perde o acesso na hora).
create or replace function "6wla_app".participa_obra(obra uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public."6wla_obras" o
    where o.id = obra
      and "6wla_app".papel_ws(o.workspace_id) is not null
      and (
        o.criado_por = auth.uid()
        or exists (
          select 1 from public."6wla_membros_obra" m
          where m.obra_id = o.id and m.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function "6wla_app".eh_membro_obra(obra uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select "6wla_app".eh_admin() or "6wla_app".participa_obra(obra);
$$;

create or replace function "6wla_app".eh_gestor_obra(obra uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select "6wla_app".eh_admin()
    or (
      "6wla_app".participa_obra(obra)
      and "6wla_app".papel_ws("6wla_app".obra_ws(obra)) = 'gestor'
    );
$$;

-- Dono (gestor que criou, e ainda gestor) ou admin: mexe na obra e na equipe.
create or replace function "6wla_app".eh_dono_obra(obra uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select "6wla_app".eh_admin()
    or exists (
      select 1 from public."6wla_obras" o
      where o.id = obra
        and o.criado_por = auth.uid()
        and "6wla_app".papel_ws(o.workspace_id) = 'gestor'
    );
$$;

-- Usuário X participa da obra Y (validar responsável e menção). Admin global
-- fora da equipe não conta: ele não recebe notificação de obra alheia.
create or replace function "6wla_app".usuario_na_obra(usuario uuid, obra uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public."6wla_obras" o
    join public."6wla_membros_workspace" w on w.workspace_id = o.workspace_id and w.user_id = usuario
    join public."6wla_perfis" p on p.id = usuario
    where o.id = obra
      and p.ativo
      and (
        o.criado_por = usuario
        or exists (
          select 1 from public."6wla_membros_obra" m
          where m.obra_id = o.id and m.user_id = usuario
        )
      )
  );
$$;

-- Quem sai do workspace (ou é removido) sai das equipes das obras dele. O
-- acesso já cairia pela `participa_obra`; isto só evita lixo na equipe.
create or replace function "6wla_app".limpa_equipes_ao_sair_do_workspace()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public."6wla_membros_obra" m
  using public."6wla_obras" o
  where o.id = m.obra_id
    and o.workspace_id = old.workspace_id
    and m.user_id = old.user_id;
  return null;
end;
$$;

create trigger limpa_equipes_ao_sair_do_workspace
  after delete or update of workspace_id on public."6wla_membros_workspace"
  for each row execute function "6wla_app".limpa_equipes_ao_sair_do_workspace();

-- ---------------------------------------------------------------------------
-- Gatilhos de restrição e notificação: validam contra a equipe da obra
-- ---------------------------------------------------------------------------

create or replace function "6wla_app".numera_restricao()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Espaço de duas chaves (6 = 6wla): o de chave única é do banco inteiro,
  -- dividido com o PHD View.
  perform pg_advisory_xact_lock(6, hashtext(new.obra_id::text));
  select coalesce(max(numero), 0) + 1 into new.numero
  from public."6wla_restricoes" where obra_id = new.obra_id;
  if new.prazo_original is null then
    new.prazo_original := new.data_limite;
  end if;
  if new.status = 'concluida' and new.data_conclusao is null then
    new.data_conclusao := current_date;
  end if;
  -- Responsável precisa estar na obra; senão fica só o texto.
  if new.responsavel_id is not null
     and not "6wla_app".usuario_na_obra(new.responsavel_id, new.obra_id) then
    new.responsavel_id := null;
  end if;
  return new;
end;
$$;

create or replace function "6wla_app".antes_de_atualizar_restricao()
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
     and not "6wla_app".eh_gestor_obra(old.obra_id) then
    raise exception 'Só gestor altera a semana programada (linha de base).'
      using errcode = 'insufficient_privilege';
  end if;

  if new.responsavel_id is distinct from old.responsavel_id
     and new.responsavel_id is not null
     and not "6wla_app".usuario_na_obra(new.responsavel_id, old.obra_id) then
    raise exception 'O responsável precisa estar na equipe da obra.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- O array `mencoes` é entrada do usuário: nunca confiar nele.
create or replace function "6wla_app".notifica_comentario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  obra uuid;
  responsavel uuid;
  mencionado uuid;
begin
  select r.obra_id, r.responsavel_id into obra, responsavel
  from public."6wla_restricoes" r
  where r.id = new.restricao_id;

  for mencionado in
    select distinct m
    from unnest(new.mencoes) as m
    where m <> new.autor_id and "6wla_app".usuario_na_obra(m, obra)
  loop
    insert into public."6wla_notificacoes" (user_id, tipo, restricao_id, comentario_id, autor_id)
    values (mencionado, 'mencao', new.restricao_id, new.id, new.autor_id);
  end loop;

  if responsavel is not null
     and responsavel <> new.autor_id
     and not (responsavel = any (new.mencoes))
     and "6wla_app".usuario_na_obra(responsavel, obra) then
    insert into public."6wla_notificacoes" (user_id, tipo, restricao_id, comentario_id, autor_id)
    values (responsavel, 'comentario', new.restricao_id, new.id, new.autor_id);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- obras: o select usa as colunas da própria linha (e não só
-- `eh_membro_obra(id)`), porque no `insert ... returning` a função ainda não
-- enxerga a linha recém-criada.
drop policy obras_select on public."6wla_obras";
drop policy obras_insert on public."6wla_obras";
drop policy obras_update on public."6wla_obras";
drop policy obras_delete on public."6wla_obras";

create policy obras_select on public."6wla_obras"
  for select to authenticated using (
    "6wla_app".eh_admin()
    or (criado_por = auth.uid() and "6wla_app".papel_ws(workspace_id) is not null)
    or "6wla_app".participa_obra(id)
  );
-- Gestor cria no próprio workspace, em nome próprio; admin cria em qualquer um.
create policy obras_insert on public."6wla_obras"
  for insert to authenticated with check (
    "6wla_app".eh_admin()
    or (criado_por = auth.uid() and "6wla_app".papel_ws(workspace_id) = 'gestor')
  );
-- Dono edita, mas não troca a obra de workspace nem de dono (o `with check`
-- repete a condição de dono sobre a linha NOVA).
create policy obras_update on public."6wla_obras"
  for update to authenticated
  using ("6wla_app".eh_dono_obra(id))
  with check (
    "6wla_app".eh_admin()
    or (criado_por = auth.uid() and "6wla_app".papel_ws(workspace_id) = 'gestor')
  );
create policy obras_delete on public."6wla_obras"
  for delete to authenticated using ("6wla_app".eh_dono_obra(id));

alter table public."6wla_membros_obra" enable row level security;
revoke all on public."6wla_membros_obra" from anon;

-- equipe: quem participa da obra vê a equipe; dono (ou admin) inclui e tira,
-- e só pessoas ativas do workspace da obra.
create policy membros_obra_select on public."6wla_membros_obra"
  for select to authenticated using ("6wla_app".eh_membro_obra(obra_id));
create policy membros_obra_insert on public."6wla_membros_obra"
  for insert to authenticated with check (
    "6wla_app".eh_dono_obra(obra_id)
    and "6wla_app".usuario_no_ws(user_id, "6wla_app".obra_ws(obra_id))
    and adicionado_por = auth.uid()
  );
create policy membros_obra_delete on public."6wla_membros_obra"
  for delete to authenticated using ("6wla_app".eh_dono_obra(obra_id));

-- ---------------------------------------------------------------------------
-- Permissões das funções novas
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema "6wla_app" from public;
grant execute on function
  "6wla_app".eh_admin(),
  "6wla_app".papel_ws(uuid),
  "6wla_app".eh_membro_ws(uuid),
  "6wla_app".eh_gestor_ws(uuid),
  "6wla_app".eh_admin_ws(uuid),
  "6wla_app".obra_ws(uuid),
  "6wla_app".eh_membro_obra(uuid),
  "6wla_app".eh_gestor_obra(uuid),
  "6wla_app".divide_workspace(uuid),
  "6wla_app".usuario_no_ws(uuid, uuid),
  "6wla_app".participa_obra(uuid),
  "6wla_app".eh_dono_obra(uuid)
to authenticated;
-- `usuario_na_obra` e o gatilho de limpeza ficam sem grant: só gatilhos
-- `security definer` os chamam.
