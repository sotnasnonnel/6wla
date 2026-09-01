# TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Proibido: `any`, `as unknown as X`, `@ts-ignore`. Use `unknown` + narrowing, ou `@ts-expect-error` com motivo.
- Valide toda entrada externa (request body, searchParams, env, resposta de API) com **Zod**. Tipos derivam do schema (`z.infer`), nunca duplicados à mão.
- Env vars: um único `src/env.ts` validado por Zod na inicialização. Nada de `process.env.X` espalhado.
- Erros: `Result<T, E>` ou exceção tipada nas bordas; não engula erro em `catch` vazio nem retorne `null` silencioso.
- Nomes: `PascalCase` para tipos/componentes, `camelCase` para valores, `SCREAMING_SNAKE` para constantes de módulo.
- Prefira `type` a `interface` salvo quando precisar de declaration merging.
- Sem barrel files (`index.ts` reexportando tudo) — quebram tree-shaking e inflam o grafo de imports.
