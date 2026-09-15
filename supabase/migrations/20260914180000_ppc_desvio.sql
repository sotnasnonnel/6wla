-- Rollback: exportar o campo antes de remover desvio em uma nova migration.
alter table public.atividades_ppc
  add column desvio text not null default '' check (length(desvio) <= 5000);
-- Mantém as policies e permissões da tabela: leitura por membros e edição por gestores.
