"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  erroInterno,
  exigeGestor,
  exigeMembro,
  exigeUsuario,
  falha,
  sucesso,
  type Cliente,
  type Resultado,
} from "@/server/auth";
import {
  BUCKET_ANEXOS,
  TAMANHO_MAXIMO_ANEXO,
} from "@/lib/restricoes/anexos";
import { buscaRestricao } from "./queries";

/**
 * Anexos da restrição. Quem anexa e quem apaga é o gestor da obra; membro vê
 * e baixa. A regra vale em dois lugares: aqui (para a UI dar um erro
 * decente) e na RLS, que é quem de fato garante.
 *
 * O arquivo vive no Storage; a linha da tabela é o índice. As duas coisas
 * andam juntas — se a segunda falhar, a primeira é desfeita, para nunca
 * sobrar arquivo órfão que ninguém consegue listar nem apagar.
 */

const idSchema = z.guid();

/** `Projeto elétrico (rev. 2).pdf` → `projeto-eletrico-rev-2.pdf`. */
function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return limpo.slice(-80) || "arquivo";
}

async function contextoDaRestricao(supabase: Cliente, restricaoId: string) {
  const restricao = await buscaRestricao(supabase, restricaoId);
  if (!restricao) return null;
  return restricao;
}

export async function enviaAnexo(form: FormData): Promise<Resultado<string>> {
  const id = idSchema.safeParse(form.get("restricaoId"));
  if (!id.success) return falha("Identificador inválido");

  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return falha("Escolha um arquivo");
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO)
    return falha("Arquivo maior que 10 MB");

  const { supabase, perfil } = await exigeUsuario();
  const restricao = await contextoDaRestricao(supabase, id.data);
  if (!restricao) return falha("Restrição não encontrada");
  await exigeGestor(restricao.obra_id);

  const caminho = `${restricao.obra_id}/${restricao.id}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;

  const envio = await supabase.storage
    .from(BUCKET_ANEXOS)
    .upload(caminho, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });
  if (envio.error) return erroInterno("anexos.upload", envio.error);

  const { error } = await supabase.from("restricao_anexos").insert({
    restricao_id: restricao.id,
    caminho,
    // Nome de tela é o original; o do Storage é o higienizado.
    nome: arquivo.name.slice(0, 255),
    tamanho: arquivo.size,
    tipo_mime: arquivo.type || null,
    criado_por: perfil.id,
  });
  if (error) {
    // Índice sem arquivo é ruim; arquivo sem índice é invisível para sempre.
    await supabase.storage.from(BUCKET_ANEXOS).remove([caminho]);
    return erroInterno("anexos.insert", error);
  }

  revalidatePath(`/obras/${restricao.obra_id}/restricoes/${restricao.id}`);
  return sucesso(caminho);
}

export async function removeAnexo(anexoId: string): Promise<Resultado> {
  const id = idSchema.safeParse(anexoId);
  if (!id.success) return falha("Identificador inválido");

  const { supabase } = await exigeUsuario();
  const { data: anexo } = await supabase
    .from("restricao_anexos")
    .select("id, caminho, restricao_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!anexo) return falha("Anexo não encontrado");

  const restricao = await contextoDaRestricao(supabase, anexo.restricao_id);
  if (!restricao) return falha("Restrição não encontrada");
  await exigeGestor(restricao.obra_id);

  const { error } = await supabase
    .from("restricao_anexos")
    .delete()
    .eq("id", anexo.id);
  if (error) return erroInterno("anexos.delete", error);
  // Só depois do índice sair: se o arquivo sumir e o delete falhar, a lista
  // mostra um anexo que não existe mais.
  await supabase.storage.from(BUCKET_ANEXOS).remove([anexo.caminho]);

  revalidatePath(`/obras/${restricao.obra_id}/restricoes/${restricao.id}`);
  return sucesso(undefined);
}

/**
 * URL assinada de 60s. O bucket é privado: o link só existe depois de a RLS
 * confirmar que quem pediu é membro da obra, e vence antes de poder ser
 * repassado adiante com valor.
 *
 * `paraBaixar` decide entre salvar o arquivo e abri-lo: sem ele, o navegador
 * mostra imagem e PDF na própria aba, que é o que se espera ao clicar num
 * anexo. Com ele, o download sai com o nome original.
 */
export async function urlAnexo(
  anexoId: string,
  paraBaixar = false,
): Promise<Resultado<string>> {
  const id = idSchema.safeParse(anexoId);
  if (!id.success) return falha("Identificador inválido");

  const { supabase } = await exigeUsuario();
  const { data: anexo } = await supabase
    .from("restricao_anexos")
    .select("id, caminho, nome, restricao_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!anexo) return falha("Anexo não encontrado");

  const restricao = await contextoDaRestricao(supabase, anexo.restricao_id);
  if (!restricao) return falha("Restrição não encontrada");
  await exigeMembro(restricao.obra_id);

  const { data, error } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .createSignedUrl(
      anexo.caminho,
      60,
      paraBaixar ? { download: anexo.nome } : {},
    );
  if (error || !data) return erroInterno("anexos.url", error);
  return sucesso(data.signedUrl);
}
