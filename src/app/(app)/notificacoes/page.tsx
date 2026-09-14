import Link from "next/link";
import { exigeUsuario } from "@/server/auth";
import { listaNotificacoes } from "@/server/notificacoes/queries";
import {
  marcaLidaForm,
  marcaTodasLidasForm,
} from "@/server/notificacoes/actions";
import { CabecalhoPagina, Vazio } from "@/components/ui/basicos";
import { formataDataHora, formataNumero } from "@/lib/restricoes/dominio";

export const dynamic = "force-dynamic";

const TEXTO = {
  mencao: "mencionou você em",
  atribuicao: "atribuiu a você",
  comentario: "comentou em",
} as const;

export default async function PaginaNotificacoes() {
  const { perfil, supabase } = await exigeUsuario();
  const notificacoes = await listaNotificacoes(supabase, perfil.id);
  const naoLidas = notificacoes.filter((n) => !n.lida_em).length;

  return (
    <div className="max-w-3xl space-y-4">
      <CabecalhoPagina
        titulo="Notificações"
        apoio={
          naoLidas > 0
            ? `${naoLidas} ${naoLidas === 1 ? "não lida" : "não lidas"}`
            : "Você está em dia."
        }
        acoes={
          naoLidas > 0 ? (
            <form action={marcaTodasLidasForm}>
              <button
                type="submit"
                className="rounded-md border border-[var(--borda)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--tinta-media)] transition hover:border-[var(--marca-terracotta)] hover:text-[var(--marca-terracotta)]"
              >
                Marcar todas como lidas
              </button>
            </form>
          ) : null
        }
      />

      {notificacoes.length === 0 ? (
        <Vazio
          titulo="Nenhuma notificação"
          descricao="Você recebe um aviso aqui quando alguém menciona você num chat ou atribui uma restrição a você."
        />
      ) : (
        <ul className="divide-y divide-[var(--borda)] rounded-lg border border-[var(--borda)] bg-white">
          {notificacoes.map((n) => {
            const href = `/obras/${n.restricao.obra_id}/restricoes/${n.restricao.id}`;
            return (
              <li
                key={n.id}
                className={`flex gap-3 px-4 py-3 text-sm ${n.lida_em ? "bg-white" : "bg-[#eaf0f6]"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[var(--tinta-forte)]">
                    <span className="font-medium">
                      {n.autor?.nome ?? "Alguém"}
                    </span>{" "}
                    {TEXTO[n.tipo]}{" "}
                    <Link
                      href={href}
                      className="font-mono text-[var(--marca-terracotta)] hover:underline"
                    >
                      {formataNumero(n.restricao.numero)}
                    </Link>{" "}
                    <span className="text-[var(--tinta-media)]">
                      {n.restricao.descricao.slice(0, 90)}
                    </span>
                  </div>
                  {n.comentario?.texto ? (
                    <p className="mt-1 line-clamp-2 rounded bg-[var(--marca-gelo)] px-2 py-1 text-xs text-[var(--tinta-media)]">
                      {n.comentario.texto}
                    </p>
                  ) : null}
                  <div className="mt-1 text-xs text-[var(--tinta-fraca)]">
                    {formataDataHora(n.criado_em)}
                  </div>
                </div>
                {!n.lida_em ? (
                  <form action={marcaLidaForm}>
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      className="-m-2 shrink-0 p-2 text-xs text-[var(--tinta-fraca)] hover:text-[var(--tinta-forte)]"
                    >
                      marcar lida
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
