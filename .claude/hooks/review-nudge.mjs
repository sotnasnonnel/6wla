#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): lembra de acionar o revisor certo em área sensível.
import path from 'node:path';
import { readInput, touchedPaths, root } from './_lib.mjs';

const RULES = [
  [/supabase[\\/]migrations[\\/]/i, 'db-reviewer', 'migration de banco'],
  [/(auth|session|login|signup|password|token|middleware)/i, 'security-reviewer', 'autenticação/sessão'],
  [/(payment|checkout|stripe|billing|webhook)/i, 'security-reviewer', 'pagamento/webhook'],
  [/src[\\/]server[\\/]admin[\\/]/i, 'security-reviewer', 'código com privilégio de admin'],
  [/(actions?\.ts|route\.ts)$/i, 'security-reviewer', 'endpoint público (Server Action / Route Handler)'],
];

const hits = new Map();
for (const p of touchedPaths(readInput())) {
  const rel = path.relative(root, path.resolve(root, p)).replace(/\\/g, '/');
  for (const [re, agent, why] of RULES) {
    if (re.test(rel)) {
      if (!hits.has(agent)) hits.set(agent, new Set());
      hits.get(agent).add(`${rel} (${why})`);
    }
  }
}

if (hits.size) {
  const lines = [...hits].map(([a, s]) => `- subagente \`${a}\` -> ${[...s].join('; ')}`);
  console.log(`Área sensível tocada. Antes de concluir a tarefa, rode:\n${lines.join('\n')}`);
}
process.exit(0);
