---
name: new-component
description: Cria um componente React seguindo a estrutura do projeto — Server por padrão, props tipadas, acessibilidade e teste junto. Use ao adicionar componente de UI ou de domínio.
disable-model-invocation: true
---

# Novo componente

Alvo: `$ARGUMENTS`

## 1. Onde colocar

| É | Vai em |
|---|---|
| Primitivo sem lógica de domínio (Button, Input, Dialog) | `src/components/ui/` |
| Componente de domínio (PedidoCard, FiltroClientes) | `src/components/<dominio>/` |
| Usado por uma rota só | colocalizado em `src/app/<rota>/_components/` |

Colocalize por padrão. Promova para `src/components/` só no segundo uso.

## 2. Antes de criar

Procure um equivalente: `grep -ri "<conceito>" src/components src/app --include=*.tsx -l`. Duplicar componente é o erro mais comum aqui.

## 3. Esqueleto

```tsx
type Props = {
  pedido: Pedido;
  onSelecionar?: (id: string) => void;
};

export function PedidoCard({ pedido, onSelecionar }: Props) {
  return (
    <article aria-labelledby={`pedido-${pedido.id}`}>
      <h3 id={`pedido-${pedido.id}`}>{pedido.titulo}</h3>
      {/* ... */}
    </article>
  );
}
```

- Sem `React.FC`. Sem `export default` (exceto `page.tsx`/`layout.tsx`, que o Next exige).
- `"use client"` **só** se houver `useState`, `useEffect`, handler de evento ou API de browser — e só neste arquivo, não no pai.
- Props tipadas explicitamente. Nada de `any` ou `props: any`.

## 4. Acessibilidade (não opcional)

- Elemento semântico antes de `div` (`button`, `nav`, `article`, `label`).
- Todo input tem `<label>` associado. Todo ícone-botão tem `aria-label`.
- Foco visível; interativo alcançável por teclado.
- Contraste mínimo 4.5:1 em texto.

## 5. Fechamento

- Componente com comportamento (formulário, estado) ganha teste em Testing Library, no mesmo diretório: `PedidoCard.test.tsx`.
- Markup estático não precisa de teste.
- Para direção visual (tipografia, cor, layout), use o skill `frontend-design`.
