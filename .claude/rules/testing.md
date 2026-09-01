# Testes

## Pirâmide
- **Vitest** — lógica pura em `src/lib/`, `src/server/`, schemas Zod. Rápido, sem mocks de framework.
- **Testing Library** — componentes com comportamento (formulário, estado). Não teste markup estático.
- **Playwright** — fluxos críticos ponta a ponta: login, checkout, permissões/RLS.

## Regras
- Teste comportamento observável, não implementação. Sem asserção em estado interno.
- Um `expect` significativo por caso; nome descreve o cenário: `retorna 403 quando usuário não é dono do recurso`.
- Todo bug corrigido ganha um teste que falha antes do fix (red → green).
- Não faça mock do que você é dono — teste de verdade. Mock só na borda (rede, relógio, aleatoriedade).
- Testes de RLS: sempre com dois usuários — o dono e o intruso. O caso do intruso é o que importa.
- Sem teste flaky: sem `sleep` fixo, use `expect.poll` / `await expect(locator)`.
- Fixtures em `tests/fixtures/`, isoladas por teste. Nenhum teste depende da ordem de execução.
