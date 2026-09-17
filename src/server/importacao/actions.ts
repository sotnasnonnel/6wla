"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  erroInterno,
  exigeGestor,
  exigeUsuario,
  falha,
  sucesso,
  type Resultado,
} from "@/server/auth";
import {
  CAMPOS_IMPORTAVEIS,
  saneiaMapa,
  sugereMapa,
  type MapaColunas,
  type RestricaoImportada,
} from "@/lib/importacao/mapa";
import {
  GRAVANDO,
  planejaImportacao,
  travaVigente,
  type ModoImportacao,
} from "@/lib/importacao/plano";
import type { Json, TablesInsert, TablesUpdate } from "@/lib/database.types";
import { lePlanilha } from "./leitor";
import { iaDisponivel, sugereMapaComIA } from "./gemini";
import {
  buscaImportacao,
  codigosDaObra,
  gravadasDaImportacao,
  resumoDoPlano,
  type ItemRelatorio,
  type ResumoImportacao,
} from "./queries";

const TAMANHO_MAXIMO = 15 * 1024 * 1024;

const iniciaSchema = z.object({
  obraId: z.guid(),
  aba: z.string().trim().max(60).optional(),
});

export type EstadoImportacao = { erro?: string };

/** Etapa 1: lê o arquivo, guarda como rascunho com o mapa sugerido. */
export async function iniciaImportacao(
  _estado: EstadoImportacao,
  form: FormData,
): Promise<EstadoImportacao> {
  const parsed = iniciaSchema.safeParse({
    obraId: form.get("obraId"),
    aba: form.get("aba") || undefined,
  });
  if (!parsed.success) return { erro: "Dados inválidos" };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha um arquivo .xlsx" };
  if (!arquivo.name.toLowerCase().endsWith(".xlsx"))
    return { erro: "Só aceitamos .xlsx" };
  if (arquivo.size > TAMANHO_MAXIMO) return { erro: "Arquivo maior que 15 MB" };

  const { supabase, perfil } = await exigeGestor(parsed.data.obraId);

  let planilha;
  try {
    planilha = lePlanilha(
      new Uint8Array(await arquivo.arrayBuffer()),
      parsed.data.aba,
    );
  } catch (e) {
    return {
      erro: e instanceof Error ? e.message : "Não foi possível ler a planilha",
    };
  }
  if (planilha.linhas.length === 0)
    return { erro: "A aba não tem linhas de dados" };

  let mapa = sugereMapa(planilha.cabecalhos);
  let origem = "apelidos";
  if (iaDisponivel()) {
    const ia = await sugereMapaComIA(planilha.cabecalhos, planilha.linhas);
    if (ia && "mapa" in ia && Object.keys(ia.mapa).length > 0) {
      // IA manda; apelidos completam o que ela deixou de fora.
      mapa = { ...mapa, ...ia.mapa };
      origem = "ia";
    }
  }

  const { data, error } = await supabase
    .from("6wla_importacoes")
    .insert({
      obra_id: parsed.data.obraId,
      criado_por: perfil.id,
      arquivo_nome: arquivo.name,
      aba: planilha.aba,
      cabecalhos: planilha.cabecalhos,
      linhas: planilha.linhas as Json,
      mapa_colunas: mapa as Json,
      mapa_origem: origem,
      total_linhas: planilha.linhas.length,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[importacao.inicia]", error);
    return { erro: "Não foi possível guardar a planilha. Tente de novo." };
  }

  redirect(`/obras/${parsed.data.obraId}/importar/${data.id}`);
}

/** Botão "sugerir com IA" na tela de conferência. */
export async function resugereComIA(
  importacaoId: string,
): Promise<Resultado<MapaColunas>> {
  const id = z.guid().safeParse(importacaoId);
  if (!id.success) return falha("Identificador inválido");
  const { supabase } = await exigeUsuario();
  const imp = await buscaImportacao(supabase, id.data);
  if (!imp) return falha("Importação não encontrada");
  await exigeGestor(imp.obra_id);
  if (imp.status !== "rascunho") return falha("Importação já concluída");
  // Com linhas já gravadas o mapa fica fixo: é por ele que a retomada as reconhece.
  if ((await gravadasDaImportacao(supabase, imp.obra_id, imp.id)).length > 0)
    return falha("Parte desta planilha já foi gravada; o mapeamento não muda mais.");

  const ia = await sugereMapaComIA(imp.cabecalhos, imp.linhas);
  if (ia === null) return falha("IA não configurada (GEMINI_API_KEY)");
  if ("erro" in ia) return falha(ia.erro);
  const mapa = { ...sugereMapa(imp.cabecalhos), ...ia.mapa };
  await supabase
    .from("6wla_importacoes")
    .update({ mapa_colunas: mapa as Json, mapa_origem: "ia" })
    .eq("id", id.data);
  revalidatePath(`/obras/${imp.obra_id}/importar/${id.data}`);
  return sucesso(mapa);
}

/**
 * Campos da linha da planilha que vão para o banco. Em atualização, os nulos
 * são descartados antes: coluna vazia na planilha significa "não sei", não
 * "apague o que está lá" — quem importa não pode apagar sem querer o que
 * alguém preencheu no sistema.
 */
function camposDaLinha(
  r: RestricaoImportada,
  responsavelId: string | null,
): TablesUpdate<"6wla_restricoes"> {
  return {
    codigo: r.codigo,
    descricao: r.descricao,
    acao: r.acao,
    responsavel_id: responsavelId,
    responsavel_nome: r.responsavel_nome,
    responsavel_email: r.responsavel_email,
    responsavel_telefone: r.responsavel_telefone,
    status: r.status,
    prioridade: r.prioridade,
    descricao_status: r.descricao_status,
    causa_6m: r.causa_6m,
    classificacao: r.classificacao,
    area: r.area,
    setor: r.setor,
    localizacao: r.localizacao,
    id_atividade: r.id_atividade,
    atividade_impactada: r.atividade_impactada,
    inicio_atividade: r.inicio_atividade,
    data_limite: r.data_limite,
    previsao_conclusao: r.previsao_conclusao,
    data_conclusao: r.data_conclusao,
    semana_programada: r.semana_programada,
    observacoes: r.observacoes,
    extras: r.extras,
  };
}

/** Tira os campos vazios: o que a planilha não trouxe fica como está. */
function soPreenchidos(
  dados: TablesUpdate<"6wla_restricoes">,
): TablesUpdate<"6wla_restricoes"> {
  const limpo: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(dados)) {
    if (valor === null || valor === undefined) continue;
    // `extras` vazio não tem o que atualizar.
    if (campo === "extras" && Object.keys(valor as object).length === 0)
      continue;
    limpo[campo] = valor;
  }
  return limpo as TablesUpdate<"6wla_restricoes">;
}

const simulaSchema = z.object({
  importacaoId: z.guid(),
  mapa: z.record(z.string(), z.string()),
  modo: z.enum(["adicionar", "atualizar"]),
});

/** Conferência: recalcula o resumo quando o gestor troca descrição/código/modo. */
export async function simulaImportacao(
  entrada: z.input<typeof simulaSchema>,
): Promise<Resultado<ResumoImportacao>> {
  const parsed = simulaSchema.safeParse(entrada);
  if (!parsed.success) return falha("Dados inválidos");
  const { supabase } = await exigeUsuario();
  const imp = await buscaImportacao(supabase, parsed.data.importacaoId);
  if (!imp) return falha("Importação não encontrada");
  await exigeGestor(imp.obra_id);
  if (imp.status !== "rascunho") return falha("Importação já concluída");
  const mapa = saneiaMapa(parsed.data.mapa, imp.cabecalhos);
  try {
    return sucesso(await resumoDoPlano(supabase, imp, mapa, parsed.data.modo));
  } catch (e) {
    console.error("[importacao.simula]", e);
    return falha("Não foi possível calcular o resumo agora.");
  }
}

/**
 * Etapa 2: gestor confirma o de-para e as linhas viram restrições.
 *
 * Pode ser repetida com segurança depois de uma falha parcial: o que esta
 * importação já inseriu é reconhecido (código + descrição, ver
 * `planejaImportacao`) e não entra de novo, e o mapa/modo da primeira
 * tentativa passam a valer — com outro mapa as linhas não seriam
 * reconhecidas.
 */
export async function confirmaImportacao(
  _estado: EstadoImportacao,
  form: FormData,
): Promise<EstadoImportacao> {
  const id = z.guid().safeParse(form.get("importacaoId"));
  if (!id.success) return { erro: "Identificador inválido" };
  // Sem modo escolhido, o comportamento seguro é o que não mexe no que existe.
  const modoPedido: ModoImportacao =
    form.get("modo") === "atualizar" ? "atualizar" : "adicionar";

  const { supabase, perfil } = await exigeUsuario();
  const imp = await buscaImportacao(supabase, id.data);
  if (!imp) return { erro: "Importação não encontrada" };
  await exigeGestor(imp.obra_id);
  if (imp.status !== "rascunho")
    return { erro: "Esta importação já foi processada" };

  const caminho = `/obras/${imp.obra_id}/importar/${imp.id}`;
  const gravadas = await gravadasDaImportacao(supabase, imp.obra_id, imp.id);

  let mapa: MapaColunas;
  let modo: ModoImportacao;
  if (gravadas.length > 0) {
    // Retomada: vale o que foi usado na primeira tentativa.
    mapa = imp.mapa_colunas;
    modo = imp.modo;
  } else {
    const bruto: Record<string, string> = {};
    for (const campo of CAMPOS_IMPORTAVEIS) {
      const v = form.get(`mapa.${campo}`);
      if (typeof v === "string" && v.length > 0) bruto[campo] = v;
    }
    mapa = saneiaMapa(bruto, imp.cabecalhos);
    modo = modoPedido;
  }
  if (!mapa.descricao)
    return { erro: "Escolha qual coluna é a descrição da restrição" };
  if (modo === "atualizar" && !mapa.codigo)
    return {
      erro: "Para atualizar o que já existe, escolha a coluna do código: é por ele que a linha encontra a restrição.",
    };

  // Trava contra dois envios simultâneos (duplo clique, duas abas):
  // compare-and-swap na marca lida. Grava mapa e modo ANTES de inserir, para
  // uma tentativa que morra no meio ainda deixar registrado com o que gravou.
  const agora = Date.now();
  if (travaVigente(imp.mapa_origem, agora))
    return {
      erro: "Esta importação já está sendo gravada. Aguarde alguns instantes e recarregue a página.",
    };
  const { data: travou, error: erroTrava } = await supabase
    .from("6wla_importacoes")
    .update({
      mapa_origem: `${GRAVANDO}${agora}`,
      mapa_colunas: mapa as Json,
      modo,
    })
    .eq("id", imp.id)
    .eq("status", "rascunho")
    .eq("mapa_origem", imp.mapa_origem)
    .select("id");
  if (erroTrava) {
    console.error("[importacao.confirma.trava]", erroTrava);
    return { erro: "Não foi possível iniciar a gravação. Nada foi salvo." };
  }
  if (!travou || travou.length === 0)
    return {
      erro: "Esta importação mudou enquanto você conferia. Recarregue a página.",
    };
  const marca = `${GRAVANDO}${agora}`;

  // O que foi lido antes da trava pode estar velho: outra tentativa pode ter
  // gravado e soltado a trava nesse meio-tempo. Relê já com a trava na mão;
  // se mudou, devolve mapa e modo anteriores e pede recarga.
  const gravadasAgora = await gravadasDaImportacao(
    supabase,
    imp.obra_id,
    imp.id,
  );
  if (gravadasAgora.length !== gravadas.length) {
    await supabase
      .from("6wla_importacoes")
      .update({
        mapa_origem: "manual",
        mapa_colunas: imp.mapa_colunas as Json,
        modo: imp.modo,
      })
      .eq("id", imp.id)
      .eq("mapa_origem", marca);
    return {
      erro: "Esta importação mudou enquanto você conferia. Recarregue a página.",
    };
  }

  const existentes = await codigosDaObra(supabase, imp.obra_id, imp.id);
  const plano = planejaImportacao({
    linhas: imp.linhas,
    mapa,
    modo,
    existentes,
    gravadas,
  });

  // Casa responsável por e-mail com usuários existentes.
  const emails = [
    ...new Set(
      [...plano.novas, ...plano.atualizar]
        .map((l) => l.restricao.responsavel_email)
        .filter((e): e is string => !!e),
    ),
  ];
  const porEmail = new Map<string, string>();
  if (emails.length > 0) {
    const { data: perfis } = await supabase
      .from("6wla_perfis")
      .select("id, email")
      .in("email", emails);
    for (const p of perfis ?? []) porEmail.set(p.email.toLowerCase(), p.id);
  }
  const responsavelDe = (r: RestricaoImportada): string | null =>
    r.responsavel_email ? (porEmail.get(r.responsavel_email) ?? null) : null;

  const novas: TablesInsert<"6wla_restricoes">[] = plano.novas.map(
    ({ restricao: r }) => ({
      ...camposDaLinha(r, responsavelDe(r)),
      descricao: r.descricao,
      obra_id: imp.obra_id,
      ...(r.data_criacao ? { data_criacao: r.data_criacao } : {}),
      origem: "importada",
      importacao_id: imp.id,
      criado_por: perfil.id,
    }),
  );
  // `importacao_id` não vai no update: o gatilho preserva o da origem.
  const alteracoes = plano.atualizar.map(({ id: alvo, restricao: r }) => ({
    id: alvo,
    dados: soPreenchidos(camposDaLinha(r, responsavelDe(r))),
  }));
  const ignoradas = plano.ignoradas.length;
  const jaGravadas = plano.jaGravadas;

  /**
   * Sucesso: conclui e troca as linhas brutas pelo relatório do que não
   * entrou. Falha: continua rascunho (para a retomada), só solta a trava e
   * guarda as contagens.
   */
  const encerra = async (
    importadas: number,
    atualizadas: number,
    erro?: string,
  ): Promise<EstadoImportacao> => {
    const relatorio: ItemRelatorio[] = [
      ...plano.descartadas.map((d) => ({ tipo: "descartada" as const, ...d })),
      ...plano.ignoradas.map((d) => ({ tipo: "ignorada" as const, ...d })),
    ].sort((a, b) => a.numero - b.numero);
    const { error } = await supabase
      .from("6wla_importacoes")
      .update({
        ...(erro
          ? {}
          : {
              status: "concluida",
              concluido_em: new Date().toISOString(),
              // Linhas brutas já cumpriram o papel; não guardamos o arquivo.
              linhas: [],
              relatorio: relatorio as Json,
            }),
        importadas,
        atualizadas,
        ignoradas,
        mapa_origem: "manual",
      })
      .eq("id", imp.id)
      .eq("status", "rascunho")
      // Só solta a trava que é desta tentativa.
      .eq("mapa_origem", marca);
    if (error) console.error("[importacao.confirma.encerra]", error);
    revalidatePath(caminho);
    revalidatePath(`/obras/${imp.obra_id}/importar`);
    revalidatePath(`/obras/${imp.obra_id}/tabela`);
    revalidatePath(`/obras/${imp.obra_id}/indicadores`);
    return erro ? { erro } : {};
  };

  let importadas = 0;
  for (let i = 0; i < novas.length; i += 200) {
    const lote = novas.slice(i, i + 200);
    // Um insert é uma instrução só: o lote entra inteiro ou não entra.
    const { error } = await supabase.from("6wla_restricoes").insert(lote);
    if (error) {
      console.error("[importacao.confirma.insert]", error);
      const total = jaGravadas + importadas;
      return encerra(
        total,
        0,
        total > 0
          ? `${total} restrição(ões) desta planilha já estão gravadas e continuam no sistema; ${novas.length - importadas} ainda faltam. Tente de novo: as já gravadas são reconhecidas e não se repetem.`
          : "Falha ao gravar a primeira leva de linhas. Nada foi salvo; confira o mapeamento e tente de novo.",
      );
    }
    importadas += lote.length;
  }

  // Cada atualização é um UPDATE próprio (valores diferentes por linha), em
  // lotes paralelos para uma planilha de centenas de linhas não virar
  // centenas de idas e voltas em fila.
  let atualizadas = 0;
  for (let i = 0; i < alteracoes.length; i += 25) {
    const lote = alteracoes.slice(i, i + 25);
    const resultados = await Promise.all(
      lote.map((a) =>
        supabase.from("6wla_restricoes").update(a.dados).eq("id", a.id),
      ),
    );
    const falhou = resultados.find((r) => r.error);
    if (falhou?.error) {
      console.error("[importacao.confirma.update]", falhou.error);
      return encerra(
        jaGravadas + importadas,
        atualizadas,
        `${jaGravadas + importadas} adicionada(s) e ${atualizadas} atualizada(s) foram gravadas; ${alteracoes.length - atualizadas} atualização(ões) faltam. Tentar de novo refaz só a atualização, sem duplicar nada.`,
      );
    }
    atualizadas += lote.length;
  }

  await encerra(jaGravadas + importadas, atualizadas);
  redirect(caminho);
}
export async function cancelaImportacao(
  importacaoId: string,
): Promise<Resultado> {
  const id = z.guid().safeParse(importacaoId);
  if (!id.success) return falha("Identificador inválido");
  const { supabase } = await exigeUsuario();
  const imp = await buscaImportacao(supabase, id.data);
  if (!imp) return falha("Importação não encontrada");
  await exigeGestor(imp.obra_id);
  // Cancelar no meio de uma gravação deixaria metade gravada e a outra
  // metade recusada pelo banco.
  if (travaVigente(imp.mapa_origem))
    return falha(
      "Esta importação está sendo gravada. Aguarde terminar para cancelar.",
    );
  const { data, error } = await supabase
    .from("6wla_importacoes")
    .update({ status: "cancelada", linhas: [] })
    .eq("id", id.data)
    .eq("status", "rascunho")
    .eq("mapa_origem", imp.mapa_origem)
    .select("id");
  if (error) return erroInterno("importacao.cancela", error);
  if (data.length === 0)
    return falha("Esta importação mudou. Recarregue a página.");
  revalidatePath(`/obras/${imp.obra_id}/importar`);
  return sucesso(undefined);
}
