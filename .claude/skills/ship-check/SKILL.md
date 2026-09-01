---
name: ship-check
description: Portão de qualidade antes de commit ou PR — typecheck, lint, testes, audit e as revisões especializadas que a mudança exigir. Use ao terminar uma tarefa, antes de commitar ou abrir PR.
disable-model-invocation: true
---

# Ship check

## 1. Ver o que mudou (uma vez só)

```
git diff --stat && git diff --name-only
```

Use essa lista para decidir os passos 3 e 4. Não releia os arquivos.

## 2. Portão automático — tudo verde, sem exceção

```
npm run typecheck
npm run lint
npm test
```

Falhou? **Corrija.** Não relaxe a regra, não adicione `eslint-disable`, não pule com `--no-verify`.

Se a mudança tocou fluxo crítico (login, checkout, permissões): `npm run test:e2e`.

## 3. Revisões condicionais — dispare em paralelo, numa única mensagem

| Se o diff toca | Rode o subagente |
|---|---|
| `supabase/migrations/` | `db-reviewer` |
| auth, sessão, pagamento, upload, `src/server/admin/`, `route.ts`, `actions.ts` | `security-reviewer` |
| qualquer código novo sem teste correspondente | `test-writer` |

Depois, revisão geral: `/code-review` (ou o subagente `pr-review-toolkit:code-reviewer`).

## 4. Checklist manual

- [ ] Nenhum segredo, chave, token ou URL interna no diff (`git diff | grep -iE "key|secret|token|password"`)
- [ ] Nenhum `console.log`, `TODO` órfão, código comentado ou arquivo de rascunho
- [ ] Schema mudou → `src/lib/database.types.ts` regenerado e commitado
- [ ] Env var nova → documentada em `.env.example` e validada em `src/env.ts`
- [ ] Dependência nova → justificada, e `npm audit` sem vulnerabilidade alta/crítica

## 5. Entregar

Commit no imperativo com escopo (`feat(pedidos): ...`), corpo explicando o **porquê**.
Depois, se o usuário pedir: `/commit-push-pr`.

**Reporte o resultado real.** Se algo falhou ou foi pulado, diga qual e por quê — não declare "pronto" em cima de um passo não executado.
