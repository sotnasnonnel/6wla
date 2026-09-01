import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Testes de RLS batem no Supabase local (npx supabase start). Ficam fora do
// `npm test` para que a suite unitaria continue rodando sem Docker.
export default defineConfig({
  test: {
    environment: 'node',
    // Chaves publicas do Supabase local (`npx supabase start`), identicas em
    // qualquer maquina. Nenhum segredo real mora aqui.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      SUPABASE_SERVICE_ROLE_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
      N8N_WEBHOOK_SECRET: 'segredo-local-de-desenvolvimento-1234',
    },
    globals: true,
    include: ['src/**/*.rls-test.ts'],
    hookTimeout: 60000,
    testTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Fora do Next, `server-only` resolve para a entrada de cliente e lanca.
      // O pacote real continua no build de producao, onde ele de fato protege.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
