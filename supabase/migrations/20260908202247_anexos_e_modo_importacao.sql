-- Anexos de restrição e modo de importação.
--
-- 1. Anexos: uma restrição pode ter vários arquivos (foto da frente de
--    serviço, projeto, e-mail de fornecedor). O arquivo vive no Storage, num
--    bucket PRIVADO (`6wla-anexos`); a tabela guarda o metadado e é ela que a RLS protege.
--    Quem anexa e quem apaga é o gestor da obra; membro só vê e baixa
--    (decisão do usuário: o membro interage pelo chat, não pelo acervo).
--
-- 2. Importação: o gestor escolhe, na hora de confirmar, se a planilha
--    ATUALIZA as restrições que já existem (casadas pelo código) ou se só
--    ADICIONA as que ainda não existem.
--
-- Rollback (SÓ depois de desfazer 20260915164858):
--   0. set lock_timeout = '3s';
--   1. pela Storage API, com service_role (delete direto em storage.* deixa
--      arquivo órfão e é bloqueado nas versões novas):
--      emptyBucket('6wla-anexos'); deleteBucket('6wla-anexos');
--   2. drop policy "6wla_anexos_objetos_select" on storage.objects;
--      drop policy "6wla_anexos_objetos_insert" on storage.objects;
--      drop policy "6wla_anexos_objetos_delete" on storage.objects;
--   3. drop table public."6wla_restricao_anexos";
--   4. drop index public."6wla_restricoes_obra_id_codigo_idx";
--   5. alter table public."6wla_importacoes"
--        drop column modo, drop column atualizadas, drop column ignoradas;
--   6. drop type public."6wla_importacao_modo";

-- storage.objects é compartilhada com o PHD View em produção: `create policy`
-- pega lock exclusivo nela. Melhor falhar rápido e reaplicar do que enfileirar
-- e travar os uploads do outro app.
set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- Modo de importação
-- ---------------------------------------------------------------------------

create type public."6wla_importacao_modo" as enum ('adicionar', 'atualizar');

alter table public."6wla_importacoes"
  add column modo public."6wla_importacao_modo" not null default 'adicionar',
  -- Quantas linhas atualizaram uma restrição existente e quantas foram
  -- puladas por já existirem. Junto com `importadas`, é o que a tela de
  -- histórico precisa para explicar o que a importação fez.
  add column atualizadas integer not null default 0,
  add column ignoradas integer not null default 0;

-- O casamento é por código dentro da obra. Sem índice, cada importação de
-- centenas de linhas viraria varredura da tabela inteira.
create index "6wla_restricoes_obra_id_codigo_idx"
  on public."6wla_restricoes" (obra_id, codigo)
  where codigo is not null;

-- ---------------------------------------------------------------------------
-- Anexos
-- ---------------------------------------------------------------------------

create table public."6wla_restricao_anexos" (
  id uuid primary key default gen_random_uuid(),
  restricao_id uuid not null references public."6wla_restricoes"(id) on delete cascade,
  -- Caminho no bucket: <obra_id>/<restricao_id>/<uuid>-<nome>. A primeira
  -- pasta é a obra porque é ela que as policies do Storage checam.
  caminho text not null unique,
  -- Nome original, para o download sair com o nome que a pessoa reconhece.
  nome text not null check (char_length(nome) between 1 and 255),
  tamanho bigint not null check (tamanho > 0),
  tipo_mime text,
  -- `set null`: apagar a pessoa não apaga o acervo da obra.
  criado_por uuid references public."6wla_perfis"(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index on public."6wla_restricao_anexos" (restricao_id, criado_em);
create index on public."6wla_restricao_anexos" (criado_por);

alter table public."6wla_restricao_anexos" enable row level security;
revoke all on public."6wla_restricao_anexos" from anon;

-- Membro da obra vê a lista; gestor anexa e apaga. Não há update: trocar um
-- anexo é apagar e subir de novo — assim o metadado nunca descreve outro
-- arquivo que não o que está no Storage.
create policy anexos_select on public."6wla_restricao_anexos"
  for select to authenticated using (
    exists (
      select 1 from public."6wla_restricoes" r
      where r.id = restricao_id and "6wla_app".eh_membro_obra(r.obra_id)
    )
  );
create policy anexos_insert on public."6wla_restricao_anexos"
  for insert to authenticated with check (
    criado_por = auth.uid()
    and exists (
      select 1 from public."6wla_restricoes" r
      where r.id = restricao_id and "6wla_app".eh_gestor_obra(r.obra_id)
    )
  );
create policy anexos_delete on public."6wla_restricao_anexos"
  for delete to authenticated using (
    exists (
      select 1 from public."6wla_restricoes" r
      where r.id = restricao_id and "6wla_app".eh_gestor_obra(r.obra_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: bucket privado `anexos`
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('6wla-anexos', '6wla-anexos', false, 10485760)
-- Se já existir (criado à mão), força privado: adotar um bucket público
-- exporia os anexos pela URL.
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- As policies do objeto espelham as da tabela: a primeira pasta do caminho é
-- o id da obra. O teste de formato antes do cast evita que um caminho
-- inventado derrube a policy com erro de conversão.
create policy "6wla_anexos_objetos_select" on storage.objects
  for select to authenticated using (
    bucket_id = '6wla-anexos'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and "6wla_app".eh_membro_obra(((storage.foldername(name))[1])::uuid)
  );
create policy "6wla_anexos_objetos_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = '6wla-anexos'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and "6wla_app".eh_gestor_obra(((storage.foldername(name))[1])::uuid)
  );
create policy "6wla_anexos_objetos_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = '6wla-anexos'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and "6wla_app".eh_gestor_obra(((storage.foldername(name))[1])::uuid)
  );
