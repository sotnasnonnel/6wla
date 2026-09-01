import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

export function hasScript(name) {
  const p = path.join(root, 'package.json');
  if (!existsSync(p)) return false;
  try {
    return Boolean(JSON.parse(readFileSync(p, 'utf8')).scripts?.[name]);
  } catch {
    return false;
  }
}

/** Caminhos tocados por um tool_input de Edit/Write/MultiEdit/NotebookEdit. */
export function touchedPaths(input) {
  const t = input.tool_input || {};
  const out = [t.file_path, t.notebook_path].filter(Boolean);
  if (Array.isArray(t.edits)) {
    for (const e of t.edits) if (e.file_path) out.push(e.file_path);
  }
  return [...new Set(out)];
}

export function run(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: opts.timeout ?? 90000,
      shell: process.platform === 'win32',
    });
    return { ok: true, out: stdout };
  } catch (e) {
    const merged = `${e.stdout || ''}${e.stderr || ''}`.trim();
    return { ok: false, out: merged || String(e.message) };
  }
}

/** Bloqueia a acao e devolve o motivo ao Claude. */
export function block(reason) {
  console.error(reason);
  process.exit(2);
}
