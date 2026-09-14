"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  exigeGestor,
  exigeUsuario,
  falha,
  sucesso,
  type Resultado,
} from "@/server/auth";
import {
  CAMPOS_IMPORTAVEIS,
  chaveCodigo,
  saneiaMapa,
  sugereMapa,
  traduzLinha,
  type MapaColunas,
  type RestricaoImportada,
} from "@/lib/importacao/mapa";
import type { Json, TablesInsert, TablesUpdate } from "@/lib/database.types";
import { lePlanilha } from "./leitor";
import { iaDisponivel, sugereMapaComIA } from "./gemini";
import { buscaImportacao, codigosDaObra } from "./queries";

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
    .from("importacoes")
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

  const ia = await sugereMapaComIA(imp.cabecalhos, imp.linhas);
  if (ia === null) return falha("IA não configurada (GEMINI_API_KEY)");
  if ("erro" in ia) return falha(ia.erro);
  const mapa = { ...sugereMapa(imp.cabecalhos), ...ia.mapa };
  await supabase
    .from("importacoes")
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
): TablesUpdate<"restricoes"> {
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
  dados: TablesUpdate<"restricoes">,
): TablesUpdate<"restricoes"> {
  const limpo: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(dados)) {
    if (valor === null || valor === undefined) continue;
    // `extras` vazio não tem o que atualizar.
    if (campo === "extras" && Object.keys(valor as object).length === 0)
      continue;
    limpo[campo] = valor;
  }
  return limpo as TablesUpdate<"restricoes">;
}

/** Etapa 2: gestor confirma o de-para e as linhas viram restrições. */
export async function confirmaImportacao(
  _estado: EstadoImportacao,
  form: FormData,
): Promise<EstadoImportacao> {
  const id = z.guid().safeParse(form.get("importacaoId"));
  if (!id.success) return { erro: "Identificador inválido" };
  // Sem modo escolhido, o comportamento seguro é o que não mexe no que existe.
  const modo = form.get("modo") === "atualizar" ? "atualizar" : "adicionar";

  const { supabase, perfil } = await exigeUsuario();
  const imp = await buscaImportacao(supabase, id.data);
  if (!imp) return { erro: "Importação não encontrada" };
  await exigeGestor(imp.obra_id);
  if (imp.status !== "rascunho")
    return { erro: "Esta importação já foi processada" };

  const bruto: Record<string, string> = {};
  for (const campo of CAMPOS_IMPORTAVEIS) {
    const v = form.get(`mapa.${campo}`);
    if (typeof v === "string" && v.length > 0) bruto[campo] = v;
  }
  const mapa = saneiaMapa(bruto, imp.cabecalhos);
  if (!mapa.descricao)
    return { erro: "Escolha qual coluna é a descrição da restrição" };
  if (modo === "atualizar" && !mapa.codigo)
    return {
      erro: "Para atualizar o que já existe, escolha a coluna do código: é por ele que a linha encontra a restrição.",
    };

  const traduzidas = imp.linhas
    .map((l) => traduzLinha(l, mapa))
    .filter((r) => r.ok);
  if (traduzidas.length === 0)
    return { erro: "Nenhuma linha válida com esse mapeamento" };

  // Casa responsável por e-mail com usuários existentes.
  const emails = [
    ...new Set(
      traduzidas
        .map((r) => r.restricao.responsavel_email)
        .filter((e): e is string => !!e),
    ),
  ];
  const porEmail = new Map<string, string>();
  if (emails.length > 0) {
    const { data: perfis } = await supabase
      .from("perfis")
      .select("id, email")
      .in("email", emails);
    for (const p of perfis ?? []) porEmail.set(p.email.toLowerCase(), p.id);
  }

  // O que já existe na obra, por código. Vale nos dois modos: em "adicionar"
  // para pular, em "atualizar" para achar quem atualizar.
  const existentes = await codigosDaObra(supabase, imp.obra_id);
  const novosCodigos = new Set<string>();

  const novas: TablesInsert<"restricoes">[] = [];
  const alteracoes: Array<{ id: string; dados: TablesUpdate<"restricoes"> }> =
    [];
  let ignoradas = 0;

  for (const { restricao: r } of traduzidas) {
    const responsavelId = r.responsavel_email
      ? (porEmail.get(r.responsavel_email) ?? null)
      : null;
    const chave = chaveCodigo(r.codigo);
    const jaExiste = chave ? existentes.get(chave) : undefined;

    if (jaExiste) {
      if (modo === "adicionar") ignoradas += 1;
      else
        alteracoes.push({
          id: jaExiste,
          dados: {
            ...soPreenchidos(camposDaLinha(r, responsavelId)),
            importacao_id: imp.id,
          },
        });
      continue;
    }
    // Código repetido dentro da própria planilha: a primeira linha manda, as
    // seguintes são ruído de planilha, não restrições diferentes.
    if (chave && novosCodigos.has(chave)) {
      ignoradas += 1;
      continue;
    }
    if (chave) novosCodigos.add(chave);

    novas.push({
      ...camposDaLinha(r, responsavelId),
      descricao: r.descricao,
      obra_id: imp.obra_id,
      ...(r.data_criacao ? { data_criacao: r.data_criacao } : {}),
      origem: "importada",
      importacao_id: imp.id,
      criado_por: perfil.id,
    });
  }

  /** Fecha (ou marca o estrago de) a importação e devolve o erro, se houver. */
  const encerra = async (
    importadas: number,
    atualizadas: number,
    erro?: string,
  ): Promise<EstadoImportacao> => {
    await supabase
      .from("importacoes")
      .update({
        ...(erro
          ? {}
          : {
              status: "concluida",
              concluido_em: new Date().toISOString(),
              // Linhas brutas já cumpriram o papel; não guardamos o arquivo.
              linhas: [],
            }),
        modo,
        importadas,
        atualizadas,
        ignoradas,
        mapa_colunas: mapa as Json,
        mapa_origem: "manual",
      })
      .eq("id", imp.id);
    return { erro };
  };

  let importadas = 0;
  for (let i = 0; i < novas.length; i += 200) {
    const lote = novas.slice(i, i + 200);
    const { error } = await supabase.from("restricoes").insert(lote);
    if (error) {
      console.error("[importacao.confirma.insert]", error);
      return encerra(
        importadas,
        0,
        importadas > 0
          ? `${importadas} restrição(ões) já foram gravadas e continuam no sistema. O lote seguinte falhou; confira o mapeamento e importe de novo apenas o que faltou — em "só adicionar as novas", as já gravadas são puladas pelo código.`
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
        supabase.from("restricoes").update(a.dados).eq("id", a.id),
      ),
    );
    const falhou = resultados.find((r) => r.error);
    if (falhou?.error) {
      console.error("[importacao.confirma.update]", falhou.error);
      return encerra(
        importadas,
        atualizadas,
        `${importadas} adicionada(s) e ${atualizadas} atualizada(s) foram gravadas. A atualização parou no meio; repetir a importação em "atualizar" refaz o restante sem duplicar nada.`,
      );
    }
    atualizadas += lote.length;
  }

  await encerra(importadas, atualizadas);

  revalidatePath(`/obras/${imp.obra_id}/tabela`);
  revalidatePath(`/obras/${imp.obra_id}/indicadores`);
  redirect(
    `/obras/${imp.obra_id}/tabela?importadas=${importadas}&atualizadas=${atualizadas}&ignoradas=${ignoradas}`,
  );
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
  await supabase
    .from("importacoes")
    .update({ status: "cancelada", linhas: [] })
    .eq("id", id.data)
    .eq("status", "rascunho");
  revalidatePath(`/obras/${imp.obra_id}/importar`);
  return sucesso(undefined);
}
