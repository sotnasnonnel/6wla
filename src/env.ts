import { z } from "zod";

/**
 * Todas as variáveis de ambiente passam por aqui. Nenhum `process.env.X` solto
 * no resto do código — se faltar uma chave, a aplicação falha ao subir, não no
 * meio de uma requisição do usuário.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Origem pública dos links de e-mail (convite, redefinir senha). Opcional:
  // sem ela, vale o host da requisição (ver src/lib/site-url.ts).
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

const serverSchema = z.object({
  // Ignora RLS. Só é lida no servidor, e apenas por src/server/admin/.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Token que o Power BI manda no header Authorization para ler a API.
  POWERBI_API_TOKEN: z.string().min(24).optional(),
  // Token do fluxo n8n que entrega os e-mails das automações. Sem ele, as
  // rotas /api/automacoes/* respondem 503.
  AUTOMACOES_TOKEN: z.string().min(24).optional(),
  // API do n8n: a aba Automações cria o fluxo "<código> - Restrições" de cada
  // obra. Sem as quatro, a sincronização fica desligada (a aba avisa).
  N8N_URL: z.url().optional(),
  N8N_API_KEY: z.string().min(1).optional(),
  // Ids das credenciais já cadastradas no n8n (SMTP e Header Auth com o
  // Bearer do AUTOMACOES_TOKEN). O app só as referencia.
  N8N_CREDENCIAL_SMTP_ID: z.string().min(1).optional(),
  N8N_CREDENCIAL_TOKEN_ID: z.string().min(1).optional(),
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
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
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
    AUTOMACOES_TOKEN: process.env.AUTOMACOES_TOKEN || undefined,
    N8N_URL: process.env.N8N_URL || undefined,
    N8N_API_KEY: process.env.N8N_API_KEY || undefined,
    N8N_CREDENCIAL_SMTP_ID: process.env.N8N_CREDENCIAL_SMTP_ID || undefined,
    N8N_CREDENCIAL_TOKEN_ID: process.env.N8N_CREDENCIAL_TOKEN_ID || undefined,
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
