import type { Tables } from "@/lib/database.types";
type Item = Pick<
  Tables<"atividades_ppc">,
  "unidade" | "quantidade_prevista" | "quantidade_realizada"
>;
export function resumoQuantidades(registros: Item[]) {
  const grupos = new Map<string, Item[]>();
  for (const r of registros) {
    const unidade = r.unidade.trim().toLowerCase();
    grupos.set(unidade, [...(grupos.get(unidade) ?? []), r]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([unidade, itens]) => {
      const media = unidade === "%";
      const realizados = itens.filter((r) => r.quantidade_realizada !== null);
      return {
        unidade: unidade || "Sem unidade",
        media,
        total: itens.length,
        semReal: itens.length - realizados.length,
        prevista: unidade
          ? itens.reduce((s, r) => s + r.quantidade_prevista, 0) /
            (media ? itens.length : 1)
          : null,
        realizada:
          unidade && realizados.length
            ? realizados.reduce(
                (s, r) => s + (r.quantidade_realizada ?? 0),
                0,
              ) / (media ? realizados.length : 1)
            : null,
      };
    });
}
