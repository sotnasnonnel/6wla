---
name: new-route
description: Cria uma rota do App Router (page, layout, loading, error) ou um Route Handler / Server Action com validação Zod e checagem de autorização já no lugar. Use ao adicionar tela ou endpoint novo.
disable-model-invocation: true
---

# Nova rota

Alvo: `$ARGUMENTS`

## 1. Decida o tipo

| Precisa | Crie |
|---|---|
| Tela | `src/app/<seg>/page.tsx` (Server Component) |
| Mutação a partir de formulário | Server Action em `src/app/<seg>/actions.ts` |
| Endpoint consumido por terceiro / webhook | `src/app/api/<seg>/route.ts` |

Server Action é o padrão para mutação. Route Handler só quando quem chama não é o seu próprio front.

## 2. Arquivos que acompanham uma page com I/O

- `page.tsx` — Server Component, faz o fetch
- `loading.tsx` — skeleton
- `error.tsx` — `"use client"`, com `reset()`
- `not-found.tsx` — quando a rota busca um recurso por id

## 3. Esqueleto de Server Action

```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const Input = z.object({ id: z.string().uuid(), nome: z.string().min(1).max(200) });

export async function atualizar(raw: unknown) {
  // 1. valida
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false as const, erro: 'Dados inválidos' };

  // 2. autentica
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: 'Não autenticado' };

  // 3. autoriza + escreve (RLS é a segunda barreira, não a única)
  const { error } = await supabase
    .from('itens')
    .update({ nome: parsed.data.nome })
    .eq('id', parsed.data.id)
    .eq('owner_id', user.id);

  if (error) return { ok: false as const, erro: 'Falha ao salvar' }; // não vaze o erro do banco

  revalidatePath('/itens');
  return { ok: true as const };
}
```

## 4. Checklist

- [ ] Validação Zod na primeira linha da action/handler
- [ ] `getUser()` (não `getSession()`) para autenticar no server
- [ ] Autorização sobre o **recurso**, não só "está logado"
- [ ] `revalidatePath`/`revalidateTag` após mutação
- [ ] Erro devolvido ao cliente é genérico; o detalhe vai para o log
- [ ] `loading.tsx` e `error.tsx` se a rota faz I/O
- [ ] Rota protegida coberta pelo `middleware.ts`
- [ ] Rodar subagente `security-reviewer` ao final
