-- Corrige o carimbo de alteração de status.
--
-- Defeito na versão anterior: o gatilho saía cedo quando `auth.uid()` era nulo
-- (caminho da sincronização, que roda como service_role) e, nesse caminho,
-- `status_alterado_em` NÃO era atualizado. Consequência: uma mudança de status
-- feita fora de uma sessão de usuário nunca entrava na fila de escrita de volta
-- — a planilha ficaria desatualizada em silêncio, sem erro em lugar nenhum.
--
-- Agora a regra é separada:
--   - o carimbo de TEMPO vale para qualquer origem;
--   - o carimbo de AUTOR só existe quando há usuário de verdade;
--   - a proteção do cadastro continua valendo apenas para usuário autenticado,
--     porque é justamente a sincronização que tem o direito de escrevê-lo.
--
-- Rollback: recriar a versão anterior de public.restricoes_protege_cadastro().

create or replace function public.restricoes_protege_cadastro()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- Cadastro é da planilha: um usuário não o altera, a sincronização sim.
  if v_uid is not null then
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
  end if;

  -- Vale para qualquer origem: sem isto a fila de escrita perde a alteração.
  if new.status is distinct from old.status then
    -- Só não sobrescreve quando quem chamou já informou o carimbo de propósito
    -- (é o caso da confirmação de escrita, que não mexe em status).
    if new.status_alterado_em is not distinct from old.status_alterado_em then
      new.status_alterado_em := now();
    end if;
    if v_uid is not null then
      new.status_alterado_por := v_uid;
    end if;
  end if;

  return new;
end;
$$;
