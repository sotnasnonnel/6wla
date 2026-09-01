import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Testes de RLS batem no Supabase local (npx supabase start). Ficam fora do
// `npm test` para que a suite unitaria continue rodando sem Docker.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.rls-test.ts'],
    hookTimeout: 60000,
    testTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
