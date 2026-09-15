import type { Tables } from "@/lib/database.types";
import { normalizaChave } from "@/lib/importacao/mapa";
type Registro = Tables<"atividades_ppc">;
export function paginasTelao<T extends Pick<Registro, "encarregado">>(
  registros: T[],
  tamanho = 2,
) {
  const grupos = new Map<string, { encarregado: string; atividades: T[] }>();
  for (const r of registros) {
    const nome = r.encarregado.trim();
    const id = normalizaChave(nome);
    const grupo = grupos.get(id) ?? { encarregado: nome, atividades: [] };
    grupo.atividades.push(r);
    grupos.set(id, grupo);
  }
  return [...grupos.values()]
    .sort((a, b) => a.encarregado.localeCompare(b.encarregado, "pt-BR"))
    .flatMap((grupo) => {
      const paginas = [];
      for (let i = 0; i < grupo.atividades.length; i += Math.max(1, tamanho))
        paginas.push({
          encarregado: grupo.encarregado,
          total: grupo.atividades.length,
          parte: Math.floor(i / Math.max(1, tamanho)) + 1,
          partes: Math.ceil(grupo.atividades.length / Math.max(1, tamanho)),
          atividades: grupo.atividades.slice(i, i + Math.max(1, tamanho)),
        });
      return paginas;
    });
}
