/**
 * Constantes e formatação dos anexos de restrição. Fica fora do módulo de
 * Server Actions porque arquivo `"use server"` só pode exportar função async
 * — e o limite de tamanho precisa valer também no navegador, para o erro
 * aparecer antes de subir 10 MB à toa.
 */

/** Bucket privado do Storage. O mesmo nome está na migration. */
export const BUCKET_ANEXOS = "6wla-anexos";

/** 10 MB — o mesmo `file_size_limit` declarado no bucket. */
export const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;

/** `1536000` → `1,5 MB`. */
export function formataTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Rótulo curto do tipo, para quem lê a lista saber o que vai baixar. */
export function tipoDeArquivo(nome: string, mime: string | null): string {
  const ext = /\.([a-z0-9]+)$/i.exec(nome)?.[1]?.toUpperCase();
  if (ext) return ext;
  if (mime?.startsWith("image/")) return "IMAGEM";
  return "ARQUIVO";
}

export function ehImagem(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}
