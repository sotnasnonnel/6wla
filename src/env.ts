import { z } from "zod";

/**
 * Todas as variáveis de ambiente passam por aqui. Nenhum `process.env.X` solto
 * no resto do código — se faltar uma chave, a aplicação falha ao subir, não no
 * meio de uma requisição do usuário.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Ainda sem domínio publicado: por enquanto o app só roda em `npm run dev`.
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  // Ignora RLS. Só é lida no servidor, e apenas por src/server/admin/.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Token que o Power BI manda no header Authorization para ler a API.
  POWERBI_API_TOKEN: z.string().min(24).optional(),
  // Gemini: sugestão de mapeamento de colunas na importação. Opcional —
  // sem a chave, vale só a detecção por apelidos.
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash"),
});

/**
 * Next.js só substitui `process.env.NEXT_PUBLIC_*` quando a chave aparece
 * literalmente no código. Acessar por variável devolve undefined no browser.
 */
const publicEnv = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!publicEnv.success) {
  throw new Error(
    `Variáveis de ambiente públicas inválidas:\n${z.prettifyError(publicEnv.error)}`,
  );
}

export const env = publicEnv.data;

/**
 * Só pode ser chamado em código de servidor. Lançar aqui é melhor do que
 * devolver undefined e vazar uma chave vazia para o cliente Supabase.
 */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error(
      "serverEnv() foi chamado no browser. Isso vazaria segredos.",
    );
  }

  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    POWERBI_API_TOKEN: process.env.POWERBI_API_TOKEN || undefined,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: process.env.GEMINI_MODEL || undefined,
  });

  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente de servidor inválidas:\n${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
}
