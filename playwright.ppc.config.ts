import { defineConfig } from "@playwright/test";

// Executar com o app e Supabase locais iniciados; nunca contra produção.
export default defineConfig({
  testDir: "./tests",
  testMatch: "ppc.spec.ts",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    actionTimeout: 15000,
    baseURL: "http://localhost:3000",
    channel: "msedge",
    viewport: { width: 1440, height: 960 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
