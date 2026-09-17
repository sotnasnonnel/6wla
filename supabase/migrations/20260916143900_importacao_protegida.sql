-- Importação protegida, senha provisória valendo no banco e encerramento
-- de sessões.
--
-- 1. A retomada de uma importação que falhou no meio reconhece as linhas já
--    gravadas por `importacao_id` (src/lib/importacao/plano.ts). Sem trava,
--    qualquer membro da obra poderia inserir pelo PostgREST uma restrição com
--    `origem = 'importada'` e o `importacao_id` de um rascunho: a linha falsa
--    contaria como gravada e a verdadeira seria pulada. Agora só entra linha
--    importada de quem é gestor da obra, apontando para um rascunho da MESMA
--    obra. (No update, o gatilho antes_de_atualizar_restricao já preserva
--    origem e importacao_id.)
-- 2. O relatório do que não entrou (descartadas/ignoradas) ganha coluna
--    própria em vez de ocupar `linhas`, que guarda a planilha bruta.
--
-- 3. Senha provisória (app_metadata.troca_senha) passa a valer também na RLS.
--    O app já mandava para /primeiro-acesso, mas quem conhece a senha
--    provisória (quem cadastrou) podia entrar direto pela API com a chave
--    anon e agir como a pessoa. Agora `eh_admin` e `papel_ws` (base de todas
--    as funções de acesso) respondem "sem acesso" enquanto o JWT tiver a
--    marca, assim como as policies que olham só `auth.uid()` (próprio
--    perfil, comentários, notificações) e `divide_workspace`. A troca de
--    senha renova a sessão, e o JWT novo vem sem a marca.
--    Limite conhecido: um access token emitido ANTES de uma redefinição de
--    senha vale até expirar (jwt_expiry do projeto); conferir a sessão a
--    cada linha da RLS custaria uma consulta por chamada.
-- 4. `6wla_encerra_sessoes`: o admin, ao redefinir a senha de alguém, derruba
--    as sessões abertas (senão um invasor com refresh token válido passaria
--    pelo primeiro acesso e tomaria a conta de novo). Só service_role executa.
--
-- Rollback:
--   set lock_timeout = '3s';
--   drop function public."6wla_encerra_sessoes"(uuid);
--   eh_admin e papel_ws: voltar ao corpo de 20260903113139_esquema_inicial.sql;
--   policies perfis_update, comentarios_delete, notificacoes_select/update/
--   delete e a função divide_workspace: voltar ao texto de 20260903113139;
--   drop function "6wla_app".sessao_liberada();
--   drop trigger valida_origem_importada on public."6wla_restricoes";
--   drop function "6wla_app".valida_origem_importada();
--   alter table public."6wla_importacoes" drop column relatorio;

set lock_timeout = '3s';

alter table public."6wla_importacoes"
  add column relatorio jsonb not null default '[]'::jsonb;

comment on column public."6wla_importacoes".relatorio is
  'Linhas da planilha que não viraram restrição (descartadas/ignoradas), com número e motivo.';

create or replace function "6wla_app".valida_origem_importada()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.origem = 'importada' or new.importacao_id is not null then
    if new.origem <> 'importada' or new.importacao_id is null then
      raise exception 'Restrição importada precisa de origem e importação juntas.'
        using errcode = 'check_violation';
    end if;
    if not "6wla_app".eh_gestor_obra(new.obra_id) then
      raise exception 'Só gestor da obra grava restrição importada.'
        using errcode = 'insufficient_privilege';
    end if;
    if not exists (
      select 1 from public."6wla_importacoes" i
      where i.id = new.importacao_id
        and i.obra_id = new.obra_id
        and i.status = 'rascunho'
    ) then
      raise exception 'A importação não é um rascunho desta obra.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger valida_origem_importada
  before insert on public."6wla_restricoes"
  for each row execute function "6wla_app".valida_origem_importada();

-- Função de gatilho: sem grant (o gatilho roda como dono da função).
revoke execute on function "6wla_app".valida_origem_importada() from public;

-- ---------------------------------------------------------------------------
-- Senha provisória vale no banco
-- ---------------------------------------------------------------------------

-- Falso enquanto o JWT carregar a marca de senha provisória.
create or replace function "6wla_app".sessao_liberada()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'troca_senha')::boolean, false) = false;
$$;

create or replace function "6wla_app".eh_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select "6wla_app".sessao_liberada() and coalesce(
    (select p.admin and p.ativo from public."6wla_perfis" p where p.id = auth.uid()),
    false
  );
$$;

create or replace function "6wla_app".papel_ws(ws uuid)
returns public."6wla_workspace_papel"
language sql stable security definer set search_path = ''
as $$
  select m.papel
  from public."6wla_membros_workspace" m
  join public."6wla_perfis" p on p.id = m.user_id
  where m.workspace_id = ws and m.user_id = auth.uid() and p.ativo
    and "6wla_app".sessao_liberada();
$$;

-- Chamada pelas funções definer e direto por policies.
revoke execute on function "6wla_app".sessao_liberada() from public;
grant execute on function "6wla_app".sessao_liberada() to authenticated;

create or replace function "6wla_app".divide_workspace(alvo uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select "6wla_app".sessao_liberada() and exists (
    select 1
    from public."6wla_membros_workspace" meu
    join public."6wla_membros_workspace" dele on dele.workspace_id = meu.workspace_id
    where meu.user_id = auth.uid() and dele.user_id = alvo
  );
$$;

-- Policies que olham só `auth.uid()`: também exigem sessão liberada. O
-- `perfis_select` do próprio perfil fica como está (o app lê o perfil só
-- depois de desviar para /primeiro-acesso, e esse fluxo não usa RLS).
drop policy perfis_update on public."6wla_perfis";
create policy perfis_update on public."6wla_perfis"
  for update to authenticated
  using ((id = auth.uid() and "6wla_app".sessao_liberada()) or "6wla_app".eh_admin())
  with check (
    "6wla_app".eh_admin()
    or (
      id = auth.uid()
      and "6wla_app".sessao_liberada()
      and admin = (select p.admin from public."6wla_perfis" p where p.id = auth.uid())
      and ativo = (select p.ativo from public."6wla_perfis" p where p.id = auth.uid())
      and email = (select p.email from public."6wla_perfis" p where p.id = auth.uid())
    )
  );

drop policy comentarios_delete on public."6wla_restricao_comentarios";
create policy comentarios_delete on public."6wla_restricao_comentarios"
  for delete to authenticated
  using (autor_id = auth.uid() and "6wla_app".sessao_liberada());

drop policy notificacoes_select on public."6wla_notificacoes";
drop policy notificacoes_update on public."6wla_notificacoes";
drop policy notificacoes_delete on public."6wla_notificacoes";
create policy notificacoes_select on public."6wla_notificacoes"
  for select to authenticated
  using (user_id = auth.uid() and "6wla_app".sessao_liberada());
create policy notificacoes_update on public."6wla_notificacoes"
  for update to authenticated
  using (user_id = auth.uid() and "6wla_app".sessao_liberada())
  with check (user_id = auth.uid() and "6wla_app".sessao_liberada());
create policy notificacoes_delete on public."6wla_notificacoes"
  for delete to authenticated
  using (user_id = auth.uid() and "6wla_app".sessao_liberada());

-- ---------------------------------------------------------------------------
-- Encerrar sessões de uma conta (redefinição de senha pelo admin)
-- ---------------------------------------------------------------------------

-- Apaga as sessões (os refresh tokens caem junto, por cascata). Não mexe na
-- conta em si. O login é compartilhado com o PHD View, então a pessoa sai
-- dos dois apps — é o esperado ao redefinir a senha, que também vale lá.
create or replace function public."6wla_encerra_sessoes"(p_user uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from auth.sessions where user_id = p_user;
$$;

revoke all on function public."6wla_encerra_sessoes"(uuid) from public, anon, authenticated;
grant execute on function public."6wla_encerra_sessoes"(uuid) to service_role;
