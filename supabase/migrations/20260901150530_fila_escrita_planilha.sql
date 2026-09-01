-- Fila da escrita de volta na planilha.
--
-- Por que uma função e não um filtro no client: a condição é
-- `status_alterado_em > status_escrito_em`, uma comparação entre DUAS COLUNAS
-- da mesma linha. O PostgREST não expressa isso — `.gt('a', 'b')` compara a
-- coluna `a` com a string literal 'b'. Sem esta função, a fila devolveria a
-- lista errada em silêncio, que é a pior falha possível numa sincronização.
--
-- Rollback:
--   drop function public.restricoes_pendentes_escrita(uuid);

create or replace function public.restricoes_pendentes_escrita(p_obra uuid)
returns table (
  id uuid,
  linha_planilha integer,
  status public.restricao_status,
  status_alterado_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.linha_planilha, r.status, r.status_alterado_em
  from public.restricoes r
  where r.obra_id = p_obra
    and not r.removida_da_planilha
    and r.linha_planilha is not null
    and (r.status_escrito_em is null or r.status_alterado_em > r.status_escrito_em)
  order by r.linha_planilha;
$$;

-- A sincronização roda com service_role. Nenhum usuário autenticado precisa
-- desta função, e ela ignora RLS por ser security definer — então revogamos.
revoke execute on function public.restricoes_pendentes_escrita(uuid) from public, anon, authenticated;
grant execute on function public.restricoes_pendentes_escrita(uuid) to service_role;
