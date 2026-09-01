#!/usr/bin/env node
// PreToolUse(Bash): barra comandos destrutivos ou que contornam salvaguardas.
import { readInput, block } from './_lib.mjs';

const cmd = (readInput().tool_input?.command || '').replace(/\s+/g, ' ');

const DENY = [
  [
    /\bgit\s+push\b(?!.*--force-with-lease).*(--force|\s-f\b)/,
    'push --force é proibido. Use --force-with-lease, e nunca em main.',
  ],
  [/\bgit\s+(commit|push|merge)\b.*--no-verify/, '--no-verify pula os checks. Corrija o que está falhando.'],
  [/\bgit\s+reset\s+--hard\b/, 'reset --hard descarta trabalho. Confirme com o usuário; considere git stash.'],
  [/\bgit\s+clean\s+-[a-z]*f/, 'git clean -f apaga arquivos não rastreados. Confirme com o usuário.'],
  [/\brm\s+-[a-z]*r[a-z]*f?\s+[/~]/, 'rm -rf em caminho absoluto ou home. Recuse e confirme com o usuário.'],
  [
    /\bsupabase\s+db\s+(reset|push)\b.*--linked/,
    'Operação de banco contra o projeto remoto. Só com pedido explícito do usuário.',
  ],
  [/\bnpm\s+publish\b|\bnpm\s+version\b/, 'Publicação de pacote é ação do usuário, não do agente.'],
  [/\bcurl\b[^|]*\|\s*(ba)?sh\b/, 'curl | sh executa código remoto sem revisão. Baixe, leia, então execute.'],
  [
    /(^|[;&|]\s*)(cat|head|tail|less|type|Get-Content)\b[^;&|]*\.env\b/,
    'Não leia .env. As chaves estão documentadas em .env.example.',
  ],
  [/\bchmod\s+777\b/, 'chmod 777 é permissivo demais.'],
];

for (const [re, msg] of DENY) {
  if (re.test(cmd)) block(`Comando bloqueado.\n${msg}\nComando: ${cmd}`);
}
process.exit(0);
