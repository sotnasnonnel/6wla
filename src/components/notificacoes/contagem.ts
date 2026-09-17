/**
 * Colunas da contagem de não lidas. O `!inner` com restrições é o mesmo filtro
 * da lista: a RLS de equipe esconde a restrição de quem saiu da obra, e sem o
 * join o sino contaria avisos que a tela de notificações não mostra.
 *
 * Mora fora de `src/server` porque o contador ao vivo (browser) usa a mesma
 * consulta.
 */
export const SELECT_CONTAGEM_NAO_LIDAS =
  "id, restricao:6wla_restricoes!inner(id)" as const;
