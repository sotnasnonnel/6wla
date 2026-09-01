# 6wla

Next.js (App Router) + TypeScript strict + Supabase. Gerenciador: **npm**.

## Comandos

| Ação | Comando |
|---|---|
| dev | `npm run dev` |
| build | `npm run build` |
| typecheck | `npm run typecheck` |
| lint | `npm run lint` |
| testes unit | `npm test` |
| testes e2e | `npm run test:e2e` |
| migration | `npx supabase migration new <nome>` |

## Regras invioláveis

1. **Nunca** commitar segredos. `.env*` é bloqueado por hook — não tente contornar.
2. **Nunca** usar a `service_role` key em código que roda no browser (`"use client"`, `NEXT_PUBLIC_*`).
3. Toda tabela nova nasce com **RLS habilitada** e policies explícitas na mesma migration.
4. Schema muda **apenas** por migration versionada em `supabase/migrations/`. Nada de `execute_sql` ad-hoc em produção.
5. TypeScript strict: sem `any`, sem `@ts-ignore`, sem `!` non-null salvo justificado em comentário.
6. Server Components por padrão; `"use client"` só quando houver estado/efeito/evento.
7. Migrations e mudanças em auth/pagamento/RLS exigem revisão do subagente `security-reviewer` antes de concluir.

## Regras detalhadas (leia só quando o assunto aparecer)

- `.claude/rules/typescript.md` — convenções de tipos, erros, nomes
- `.claude/rules/nextjs.md` — App Router, boundaries, data fetching, cache
- `.claude/rules/supabase.md` — RLS, migrations, clients, tipos gerados
- `.claude/rules/testing.md` — o que testar, Vitest + Playwright
- `.claude/rules/security.md` — checklist de segredos, input, authz
- `.claude/rules/git.md` — branches, commits, PR

## Como trabalhar aqui (economia de contexto)

- Comece pelo `.claude/skills/context-map` (`/context-map`) em vez de varrer o repo.
- Busca ampla → delegue ao subagente `Explore`; traga só a conclusão, não os arquivos.
- Leia trechos (`sed -n`, `grep`), não arquivos inteiros. Não releia o que você acabou de editar.
- Antes de criar arquivo/função, procure equivalente existente.
