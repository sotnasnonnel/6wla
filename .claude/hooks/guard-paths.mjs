#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit|NotebookEdit): impede escrita em arquivos sensíveis.
import path from 'node:path';
import { readInput, touchedPaths, root, block } from './_lib.mjs';

const DENY = [
  {
    re: /(^|[\\/])\.env(\.|$)/i,
    msg: 'Arquivos .env contêm segredos e nunca devem ser editados pelo agente. Peça ao usuário para editar manualmente e documente a chave em .env.example.',
  },
  {
    re: /(^|[\\/])(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb)$/i,
    msg: 'Lock files não são editados à mão. Use o gerenciador de pacotes (npm install <pkg>).',
  },
  {
    re: /(^|[\\/])\.git[\\/]/i,
    msg: 'Não escreva dentro de .git/. Use comandos git.',
  },
  {
    re: /(^|[\\/])node_modules[\\/]/i,
    msg: 'node_modules é gerado. Edite a origem ou use um patch (patch-package).',
  },
  {
    re: /(^|[\\/])\.claude[\\/]settings\.local\.json$/i,
    msg: 'settings.local.json é pessoal do usuário. Proponha a mudança em vez de escrevê-la.',
  },
];

// Migration existente é imutável: correção vira nova migration.
const MIGRATION = /supabase[\\/]migrations[\\/].+\.sql$/i;

const input = readInput();
for (const p of touchedPaths(input)) {
  const rel = path.relative(root, path.resolve(root, p)).replace(/\\/g, '/');
  for (const rule of DENY) {
    if (rule.re.test(rel) || rule.re.test(p)) block(`Bloqueado: ${rel}\n${rule.msg}`);
  }
  if (MIGRATION.test(rel) && input.tool_name !== 'Write') {
    block(
      `Bloqueado: ${rel}\nMigrations já criadas são imutáveis. Gere uma nova migration (npx supabase migration new <nome>) em vez de editar esta.`
    );
  }
}
process.exit(0);
