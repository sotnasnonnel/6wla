# Git

- Branch a partir de `main`: `feat/`, `fix/`, `chore/`, `refactor/`.
- Commit no imperativo, escopo primeiro: `feat(auth): adiciona refresh de sessão`. Corpo explica o **porquê**.
- Um commit = uma mudança coerente. Não misture refactor com feature.
- Nunca `--no-verify`, nunca `push --force` em `main`, nunca amend em commit já pushado.
- Antes de abrir PR: `npm run typecheck && npm run lint && npm test` verdes.
- PR descreve: o que muda, por que, como testar, e riscos.
