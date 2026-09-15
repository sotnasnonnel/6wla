-- Rollback: exportar unidade antes de remover a coluna em uma nova migration.
alter table public.atividades_ppc
  add column unidade text not null default '' check (length(unidade) <= 50);
-- As policies existentes continuam protegendo leitura e gravação por obra.
