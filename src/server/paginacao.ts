import "server-only";

const PAGINA = 1000;

/**
 * Lê todas as páginas de uma consulta. O PostgREST corta em `max_rows`
 * (1000) sem avisar, e uma obra ou importação passa disso fácil.
 */
export async function todasAsPaginas<T>(
  pagina: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  contexto: string,
): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    if (error) throw new Error(`${contexto}: ${error.message}`);
    tudo.push(...(data ?? []));
    if (!data || data.length < PAGINA) return tudo;
  }
}
