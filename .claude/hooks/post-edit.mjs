#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): formata, faz lint e type-check do que mudou.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readInput, touchedPaths, root, hasScript, run } from './_lib.mjs';

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const FMT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|md|mdx|ya?ml)$/i;

const files = touchedPaths(readInput())
  .map((p) => path.resolve(root, p))
  .filter((p) => existsSync(p) && !p.includes('node_modules'));

// Sem arquivos, sem projeto instalado: nada a fazer.
if (!files.length) process.exit(0);
if (!existsSync(path.join(root, 'package.json'))) process.exit(0);
if (!existsSync(path.join(root, 'node_modules'))) process.exit(0);

const rel = files.map((p) => path.relative(root, p).replace(/\\/g, '/'));
const problems = [];

// 1. Formatação: conserta em silêncio, não bloqueia.
const toFormat = rel.filter((f) => FMT.test(f));
if (toFormat.length) {
  run('npx', ['--no-install', 'prettier', '--write', '--ignore-unknown', ...toFormat], { timeout: 30000 });
}

const code = rel.filter((f) => CODE.test(f));

// 2. Lint apenas dos arquivos alterados.
if (code.length) {
  const r = run('npx', ['--no-install', 'eslint', '--max-warnings=0', ...code], { timeout: 60000 });
  if (!r.ok && r.out.trim()) problems.push(`ESLint:\n${r.out.trim().slice(0, 3000)}`);
}

// 3. Type-check do projeto (tsc não checa arquivo isolado de forma confiável).
if (code.length && hasScript('typecheck')) {
  const r = run('npm', ['run', '--silent', 'typecheck'], { timeout: 120000 });
  if (!r.ok && r.out.trim()) problems.push(`TypeScript:\n${r.out.trim().slice(0, 3000)}`);
}

if (problems.length) {
  console.error(`Corrija antes de seguir (arquivos: ${rel.join(', ')}):\n\n${problems.join('\n\n')}`);
  process.exit(2);
}
process.exit(0);
