-- Rollback: exportar conferido antes de remover a coluna em uma nova migration.
alter table public.atividades_ppc add column conferido boolean not null default false;
-- Toda alteração dos dados da atividade exige nova conferência.
create function app.invalida_conferencia_ppc() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - array['conferido','atualizado_em'])
     is distinct from (to_jsonb(old) - array['conferido','atualizado_em']) then
    new.conferido := false;
  end if;
  return new;
end;
$$;
revoke all on function app.invalida_conferencia_ppc() from public;
create trigger invalida_conferencia_ppc before update on public.atividades_ppc
for each row execute function app.invalida_conferencia_ppc();
