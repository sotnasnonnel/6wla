# Next.js (App Router)

## Boundaries
- Server Component é o padrão. `"use client"` só com estado, efeito, event handler ou API de browser.
- Empurre o `"use client"` para a folha da árvore. Nunca no layout raiz.
- Segredo (service_role, API key) só existe em Server Component, Route Handler, Server Action ou `middleware`. `NEXT_PUBLIC_*` é público — trate como tal.

## Data
- Fetch no server, o mais próximo possível de quem consome. Nada de fetch em `useEffect` para dados iniciais.
- Mutações via **Server Actions** com validação Zod na primeira linha e checagem de autorização logo depois. Uma Server Action é um endpoint público.
- `revalidatePath`/`revalidateTag` após mutação; não confie em refresh manual.
- Cache explícito: declare `export const dynamic` / `revalidate` quando o comportamento não for óbvio.

## Estrutura
```
src/app/            rotas, layouts, route handlers
src/components/ui/  primitivos sem lógica de domínio
src/components/     componentes de domínio
src/lib/            utilitários puros e testáveis
src/server/         acesso a dados, casos de uso (nunca importado por client)
src/env.ts          env validado
```
- `loading.tsx` e `error.tsx` em toda rota que faz I/O.
- `next/image` para imagens, `next/font` para fontes. Sem `<img>` cru.
