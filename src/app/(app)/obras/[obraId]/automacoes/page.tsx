import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { env } from "@/env";
import {
  FUSO_PADRAO,
  formataInstante,
  horaCurta,
  hojeNoFuso,
  proximaExecucao,
  resumoDias,
} from "@/lib/automacoes/agenda";
import { configDoBanco } from "@/lib/automacoes/schema";
import { origemDoSite } from "@/lib/site-url";
import { sincronizacaoLigada } from "@/server/admin/fluxos";
import { ehGestor, exigeMembro } from "@/server/auth";
import { restricoesAbertasParaEmail } from "@/server/automacoes/dados";
import { listaAutomacoes, listaEnvios } from "@/server/automacoes/queries";
import {
  PainelAutomacoes,
  type AutomacaoVista,
  type EnvioVista,
} from "@/components/automacoes/painel";
import { Alerta, CabecalhoPagina } from "@/components/ui/basicos";

export const dynamic = "force-dynamic";

/**
 * Automações da obra: relatórios de restrições por e-mail. Só gestor da obra
 * (ou admin) configura; o envio é feito pelo n8n, que chama a API do 6wla.
 */
export default async function PaginaAutomacoes({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  if (!z.guid().safeParse(obraId).success) notFound();

  const { supabase, perfil, papel, obra } = await exigeMembro(obraId);
  if (!ehGestor(papel)) {
    return (
      <div className="max-w-3xl">
        <CabecalhoPagina titulo="Automações" />
        <Alerta tipo="info">
          Só gestores da obra configuram automações. Peça a um gestor de{" "}
          {obra.nome} se quiser receber o relatório por e-mail.
        </Alerta>
      </div>
    );
  }

  const [automacoes, restricoes, { data: dono }, { data: fluxo }] =
    await Promise.all([
      listaAutomacoes(supabase, obraId),
      restricoesAbertasParaEmail(supabase, obraId),
      // O gestor dono da obra vai em cópia de todo e-mail; a prévia mostra.
      obra.criado_por
        ? supabase
            .from("6wla_perfis")
            .select("email")
            .eq("id", obra.criado_por)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("6wla_automacao_fluxos")
        .select("nome, ativo, erro")
        .eq("obra_id", obraId)
        .maybeSingle(),
    ]);
  const envios = await listaEnvios(
    supabase,
    automacoes.map((a) => a.id),
  );

  const agora = new Date();
  const nomes = new Map(automacoes.map((a) => [a.id, a.nome]));
  const vistas: AutomacaoVista[] = automacoes.map((a) => {
    const config = configDoBanco(a);
    const proxima = a.ativa
      ? proximaExecucao(agora, {
          dias: config.dias_semana,
          hora: config.hora,
          fuso: config.fuso,
        })
      : null;
    const ultimo = envios.find(
      (e) => e.automacao_id === a.id && !e.teste && e.status === "enviado",
    );
    return {
      id: a.id,
      config,
      resumo: `${resumoDias(config.dias_semana)} · ${horaCurta(config.hora)} · ${
        config.destino === "lista" ? "lista fixa" : "por responsável"
      }`,
      proxima: proxima ? formataInstante(proxima, config.fuso) : null,
      ultimoEnvio: ultimo
        ? formataInstante(
            new Date(ultimo.confirmado_em ?? ultimo.criado_em),
            config.fuso,
          )
        : null,
    };
  });
  const historico: EnvioVista[] = envios.map((e) => ({
    id: e.id,
    automacao: nomes.get(e.automacao_id) ?? "",
    destinatario: e.destinatario,
    status: e.status,
    total: e.total_itens,
    horario: formataInstante(new Date(e.criado_em), FUSO_PADRAO),
    erro: e.erro,
    teste: e.teste,
  }));

  // Só para a prévia no navegador: aqui o host da requisição serve.
  const h = await headers();
  const site = origemDoSite({
    configurada: env.NEXT_PUBLIC_SITE_URL,
    proto: h.get("x-forwarded-proto"),
    host: h.get("x-forwarded-host") ?? h.get("host"),
  });

  return (
    <div className="max-w-6xl">
      <PainelAutomacoes
        obra={{ id: obra.id, codigo: obra.codigo, nome: obra.nome }}
        automacoes={vistas}
        envios={historico}
        restricoes={restricoes}
        site={site}
        hoje={hojeNoFuso(agora, FUSO_PADRAO)}
        meuEmail={perfil.email}
        copiasFixas={dono?.email ? [dono.email] : []}
        fluxo={{
          ligada: sincronizacaoLigada(),
          existe: fluxo !== null,
          nome: fluxo?.nome ?? "",
          ativo: fluxo?.ativo ?? false,
          erro: fluxo?.erro ?? null,
        }}
      />
    </div>
  );
}
