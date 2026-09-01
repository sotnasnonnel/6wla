#!/usr/bin/env node
// SessionStart: injeta um briefing curto e barato do estado do repositório.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { root, run } from './_lib.mjs';

const out = [];
const pkgPath = path.join(root, 'package.json');

if (!existsSync(pkgPath)) {
  out.push(
    'Projeto ainda não inicializado (sem package.json). Para começar: `npx create-next-app@latest . --typescript --app --eslint`.'
  );
} else {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const scripts = Object.keys(pkg.scripts || {}).join(', ');
    out.push(`Scripts npm: ${scripts || '(nenhum)'}`);
  } catch {
    out.push('package.json presente mas ilegível.');
  }
  if (!existsSync(path.join(root, 'node_modules'))) {
    out.push('node_modules ausente - rode `npm install` antes de lint/testes.');
  }
}

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { timeout: 5000 });
if (branch.ok) {
  const status = run('git', ['status', '--porcelain'], { timeout: 5000 });
  const dirty = status.ok ? status.out.trim().split('\n').filter(Boolean).length : 0;
  out.push(`Branch: ${branch.out.trim()} - ${dirty} arquivo(s) modificado(s).`);
} else {
  out.push('Sem repositório git. Rode `git init` antes de qualquer trabalho versionado.');
}

console.log(out.join('\n'));
process.exit(0);
