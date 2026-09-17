import { notFound } from "next/navigation";
import { z } from "zod";
import { ehDonoObra, exigeMembro } from "@/server/auth";
import { listaEquipe } from "@/server/obras/queries";
import { listaMembrosWorkspace } from "@/server/workspaces/queries";
import { EquipeObra } from "@/components/obras/equipe";
import { contasComConvitePendente } from "@/server/admin/convites";
import { CabecalhoPagina } from "@/components/ui/basicos";

export const dynamic = "force-dynamic";

/**
 * Equipe da obra: quem enxerga e trabalha nela. Todos da equipe veem a
 * lista; só o dono (gestor que criou) e o admin incluem e tiram pessoas.
 */
export default async function PaginaEquipe({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  if (!z.guid().safeParse(obraId).success) notFound();

  const { supabase, perfil, papel, obra } = await exigeMembro(obraId);
  const souDono = ehDonoObra(perfil, papel, obra);
  const [equipe, doWorkspace] = await Promise.all([
    listaEquipe(supabase, obraId),
    souDono
      ? listaMembrosWorkspace(supabase, obra.workspace_id)
      : Promise.resolve([]),
  ]);
  // Só o dono vê quem ainda não aceitou o convite, e só como booleano das
  // pessoas que ele já enxerga na equipe.
  const pendentes = souDono
    ? await contasComConvitePendente(equipe.map((p) => p.id))
    : new Set<string>();
  const equipeComConvite = equipe.map((p) => ({
    ...p,
    convitePendente: pendentes.has(p.id),
  }));
  const naEquipe = new Set(equipe.map((p) => p.id));
  const candidatos = doWorkspace
    .filter((p) => p.ativo && !naEquipe.has(p.id))
    .map(({ id, nome, email, papel: p }) => ({ id, nome, email, papel: p }));

  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        titulo="Equipe"
        apoio={
          souDono
            ? `Quem pode ver e trabalhar em ${obra.nome}. Só pessoas incluídas aqui enxergam a obra.`
            : `Quem pode ver e trabalhar em ${obra.nome}.`
        }
      />
      <EquipeObra
        obraId={obraId}
        equipe={equipeComConvite}
        candidatos={candidatos}
        souDono={souDono}
        meuId={perfil.id}
      />
    </div>
  );
}
