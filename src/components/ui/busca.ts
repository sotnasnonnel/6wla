/**
 * Busca de texto das listas (pessoas, obras): ignora maiúsculas, acentos e
 * espaços nas pontas. "joao" acha "João"; termo vazio acha tudo.
 */

export function normalizaBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Mantém os itens em que algum dos campos contém o termo. */
export function filtraPorTermo<T>(
  itens: readonly T[],
  termo: string,
  campos: (item: T) => ReadonlyArray<string>,
): T[] {
  const t = normalizaBusca(termo);
  if (!t) return [...itens];
  return itens.filter((item) =>
    campos(item).some((c) => normalizaBusca(c).includes(t)),
  );
}
