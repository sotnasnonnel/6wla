# Arquitetura Claude Code — 6wla

Como as peças se encaixam e como manter.

## Camadas

| Camada | Onde | Quando carrega |
|---|---|---|
| Memória do projeto | `CLAUDE.md` | Sempre. Mantenha curto — cada linha custa contexto em toda sessão. |
| Regras detalhadas | `.claude/rules/*.md` | Sob demanda, quando o assunto aparece. |
| Skills | `.claude/skills/*/SKILL.md` | Sob demanda ou via `/nome`. |
| Subagentes | `.claude/agents/*.md` | Em contexto próprio, descartável. |
| Hooks | `.claude/hooks/*.mjs` | Automático, nos eventos de ferramenta. |
| Permissões / MCP | `.claude/settings.json`, `.mcp.json` | Sessão. |

Princípio: **o que sempre vale fica no CLAUDE.md; o resto é carregado sob demanda.**

## Hooks

Node puro, cross-platform, sem dependências. Todos degradam em silêncio se o projeto ainda não tem `package.json`/`node_modules`.

| Hook | Evento | Faz |
|---|---|---|
| `session-start.mjs` | SessionStart | Briefing: scripts npm, branch, arquivos sujos. |
| `guard-paths.mjs` | PreToolUse (edições) | Bloqueia `.env`, lock files, `.git/`, `node_modules/`, migration já criada. |
| `guard-bash.mjs` | PreToolUse (Bash) | Bloqueia `push --force`, `--no-verify`, `rm -rf /`, `curl \| sh`, `cat .env`, db remoto. |
| `post-edit.mjs` | PostToolUse (edições) | Prettier (silencioso) → ESLint → `tsc`. Falha devolve o erro ao agente (exit 2). |
| `review-nudge.mjs` | PostToolUse (edições) | Aponta o subagente certo quando o arquivo é sensível. |

Testar um hook manualmente:
```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":".env"}}' | node .claude/hooks/guard-paths.mjs; echo "exit=$?"
```
Exit 0 = permite · Exit 2 = bloqueia, com stderr indo para o agente.

## Subagentes

Rodam em contexto isolado — a conversa principal recebe só a conclusão.

- `security-reviewer` — auditoria de auth/RLS/pagamento/endpoint. Só reporta exploração concreta.
- `db-reviewer` — migrations: RLS, índice, tipo, lock em produção, reversibilidade.
- `test-writer` — escreve e **executa** testes; propõe refactor quando o código é intestável.
- `context-scout` — busca ampla, devolve mapa curto. É a peça central de economia de contexto.

## Fluxo típico

```
/context-map <assunto>      → mapa, sem despejar código
/new-route  ou  /new-component  ou  /supabase-migration
   ↳ hooks formatam, lintam e type-checam a cada edição
   ↳ review-nudge aponta o revisor quando a área é sensível
/ship-check                 → portão: typecheck, lint, testes, revisores, checklist
/commit-push-pr             → entrega
```

## MCP

`.mcp.json` traz só `context7` (docs de bibliotecas em versão atual — reduz alucinação de API).
Supabase, Vercel, Playwright e GitHub vêm da conta/plugins, fora do repositório.

> O MCP `github` está falhando a conexão nesta máquina (`Authorization header is badly formatted`). Reautentique se precisar de PR/issues via MCP; `gh` CLI segue funcionando.

## Manutenção

- Convenção nova e duradoura → `.claude/rules/`, não no CLAUDE.md.
- Erro que se repete → vire hook (`/hookify`) em vez de mais uma linha de instrução.
- Trecho do CLAUDE.md que o agente ignora → provavelmente está longo demais. Corte.
- `.claude/settings.local.json` é pessoal e fica fora do git; `settings.json` é do time.
