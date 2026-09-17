import Link from "next/link";
import { z } from "zod";
import { exigeUsuario } from "@/server/auth";
import {
  contaNaoLidas,
  listaNotificacoes,
  MAXIMO_NOTIFICACOES,
  PAGINA_NOTIFICACOES,
} from "@/server/notificacoes/queries";
import { CabecalhoPagina, Vazio } from "@/components/ui/basicos";
import {
  FormMarcarTodas,
  ItemNotificacao,
} from "@/components/notificacoes/item";
import { formataDataHora, formataNumero } from "@/lib/restricoes/dominio";

export const dynamic = "force-dynamic";

/** `?limite=` cresce de página em página com "Carregar mais"; valor ruim volta ao padrão. */
const parametrosSchema = z.object({
  limite: z.coerce
    .number()
    .int()
    .min(PAGINA_NOTIFICACOES)
    .max(MAXIMO_NOTIFICACOES)
    .catch(PAGINA_NOTIFICACOES),
});

export default async function PaginaNotificacoes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { limite } = parametrosSchema.parse(await searchParams);
  const { perfil, supabase } = await exigeUsuario();
  const [{ itens, temMais }, naoLidas] = await Promise.all([
    listaNotificacoes(supabase, perfil.id, limite),
    contaNaoLidas(supabase, perfil.id),
  ]);
  const proximo = Math.min(limite + PAGINA_NOTIFICACOES, MAXIMO_NOTIFICACOES);

  return (
    <div className="max-w-3xl space-y-4">
      <CabecalhoPagina
        titulo="Notificações"
        apoio={
          naoLidas > 0
            ? `${naoLidas} ${naoLidas === 1 ? "não lida" : "não lidas"}`
            : "Você está em dia."
        }
        acoes={naoLidas > 0 ? <FormMarcarTodas /> : null}
      />

      {itens.length === 0 ? (
        <Vazio
          titulo="Nenhuma notificação"
          descricao="Você recebe um aviso aqui quando alguém menciona você num chat ou atribui uma restrição a você."
        />
      ) : (
        <>
          <ul className="divide-y divide-[var(--grade)] overflow-hidden rounded-xl border border-[var(--borda)] bg-white shadow-[var(--sombra-sm)]">
            {itens.map((n) => (
              <ItemNotificacao
                key={n.id}
                n={{
                  id: n.id,
                  tipo: n.tipo,
                  lida: n.lida_em !== null,
                  autor: n.autor?.nome ?? "Alguém",
                  numero: formataNumero(n.restricao.numero),
                  descricao: n.restricao.descricao.slice(0, 90),
                  obra: n.restricao.obra
                    ? `${n.restricao.obra.codigo} · ${n.restricao.obra.nome}`
                    : "Obra",
                  comentario: n.comentario?.texto ?? null,
                  quando: formataDataHora(n.criado_em),
                  href: `/obras/${n.restricao.obra_id}/restricoes/${n.restricao.id}`,
                }}
              />
            ))}
          </ul>
          {temMais ? (
            limite < MAXIMO_NOTIFICACOES ? (
              <div className="flex justify-center">
                <Link
                  href={`/notificacoes?limite=${proximo}`}
                  scroll={false}
                  className="inline-flex min-h-10 items-center rounded-lg border border-[var(--borda)] bg-white px-4 text-sm font-semibold text-[var(--tinta-media)] transition hover:border-[var(--borda-forte)] hover:text-[var(--tinta-forte)]"
                >
                  Carregar mais
                </Link>
              </div>
            ) : (
              <p className="text-center text-xs text-[var(--tinta-fraca)]">
                Mostrando as {MAXIMO_NOTIFICACOES} mais recentes. As mais
                antigas continuam nas próprias restrições.
              </p>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
