---
name: context-map
description: Mapeia onde algo vive no codebase e devolve um resumo curto (arquivo:linha + fluxo), sem despejar código na conversa. Use no início de qualquer tarefa de implementação ou depuração, no lugar de varrer o repositório manualmente.
---

# Mapear contexto

Objetivo: gastar tokens em um subagente descartável, não na conversa principal.

## Procedimento

1. **Não faça a busca aqui.** Delegue ao subagente `context-scout` (ou `Explore`) com um pedido concreto:

   > Onde vive `$ARGUMENTS`? Devolva arquivo:linha, o fluxo entrada→saída, quais arquivos editar e as pegadinhas. Máximo 25 linhas. Não cole código.

2. Se a pergunta cobrir áreas independentes (ex.: "auth" e "checkout"), dispare **um subagente por área na mesma mensagem** para rodarem em paralelo.

3. Com o mapa em mãos, leia **só** os trechos que você vai editar (`Read` com `offset`/`limit`, ou `sed -n '40,80p'`). Nunca o arquivo inteiro "por garantia".

4. Se o mapa não bastar, mande uma pergunta de follow-up ao mesmo subagente via `SendMessage` — o contexto dele já está carregado. Não abra outro do zero.

## Regras de economia

- Um símbolo conhecido (nome exato de função/arquivo) → `Grep` direto, sem subagente. Subagente é para busca ampla.
- Nunca leia `node_modules/`, `.next/`, `dist/`, lock files ou tipos gerados (`database.types.ts`) — consulte a fonte.
- Depois de editar um arquivo, **não releia** para conferir. A ferramenta teria falhado.
- Prefira `git diff` a reler arquivos para saber o que mudou.
