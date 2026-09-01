---
name: project-conventions
description: Convenções obrigatórias do projeto 6wla (Next.js App Router + TypeScript strict + Supabase). Carregue ANTES de escrever ou revisar qualquer código, migration, teste ou componente neste repositório.
user-invocable: false
---

# Convenções do 6wla

Regra completa em `.claude/rules/`. Leia **apenas o arquivo relevante** à tarefa — não carregue todos.

| Tarefa | Leia |
|---|---|
| Tipos, Zod, tratamento de erro, env | `.claude/rules/typescript.md` |
| Rota, layout, Server Action, cache, `"use client"` | `.claude/rules/nextjs.md` |
| Tabela, policy, migration, client Supabase | `.claude/rules/supabase.md` |
| Escrever ou corrigir teste | `.claude/rules/testing.md` |
| Auth, segredo, upload, autorização | `.claude/rules/security.md` |
| Branch, commit, PR | `.claude/rules/git.md` |

## Invariantes que valem sempre

1. Server Component é o padrão; `"use client"` é exceção justificada e fica na folha da árvore.
2. Toda entrada externa é validada por Zod antes de tocar lógica ou banco.
3. Toda Server Action e Route Handler é um endpoint público: valida entrada **e** checa autorização.
4. Toda tabela nova tem RLS habilitada e policies na mesma migration.
5. `service_role` nunca alcança código client. Isolada em `src/server/admin/`.
6. Sem `any`, sem `@ts-ignore`, sem barrel files.
7. Bug corrigido ganha teste que falha antes do fix.

## Antes de dizer "pronto"

- `npm run typecheck` e `npm run lint` verdes.
- Testes do que você mexeu, executados de verdade.
- Se tocou auth/pagamento/RLS/admin: subagente `security-reviewer` rodado.
- Se tocou `supabase/migrations/`: subagente `db-reviewer` rodado e tipos regenerados.
