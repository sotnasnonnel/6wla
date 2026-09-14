# Restrições 6WLA

Controle de restrições (Last Planner System / 6 Week Look Ahead) para obras.
Substitui o MS Planner e as planilhas por obra: tabela editável estilo Excel,
chat por restrição com @menção, histórico automático de alterações,
notificações no app, importação de Excel com conferência de colunas e API
para o Power BI.

Stack: Next.js (App Router) + TypeScript strict + Supabase (Postgres, Auth,
Realtime). Gerenciador: npm.

## Rodando local

1. Docker Desktop aberto.
2. `npm install`
3. `npx supabase start` (sobe Postgres/Auth/Realtime local) e depois
   `npx supabase db reset` (aplica migrations + `supabase/seed.sql`).
4. Crie `.env.local` (nunca commitado) com as chaves que
   `npx supabase status -o env` mostra:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Power BI: token que o relatório manda em "Authorization: Bearer ..."
# Sem esta chave a API /api/powerbi fica desligada.
POWERBI_API_TOKEN=<gere algo longo e aleatório, 24+ caracteres>

# Opcional: IA (Gemini) para sugerir o de-para de colunas na importação.
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
```

5. `npm run dev` → http://localhost:3000

Usuários do seed local (senha `senha123` para todos):

| e-mail            | papel                                           |
| ----------------- | ----------------------------------------------- |
| admin@6wla.local  | admin (vê tudo, cria obras e usuários)          |
| gestor@6wla.local | gestor da obra HRMS (importa, gerencia membros) |
| membro@6wla.local | membro da obra HRMS                             |

## Como o sistema se organiza

A **obra é o contexto de trabalho**. Ao entrar, tudo que aparece é daquela
obra: indicadores, tabela e importação. Não há filtro de obra em lugar nenhum,
porque nunca há mais de uma em cena.

```
workspace (empresa)
└── obra                     ← entrar aqui troca o contexto do sistema
    ├── Indicadores          painel da obra
    ├── Tabela               a planilha da obra
    └── Importar planilha    (gestor)
```

A barra lateral acompanha: fora de uma obra ela lista Obras e a
administração; dentro, troca para o menu daquela obra com um atalho de volta.
O botão no rodapé dela minimiza para uma faixa de ícones, e a escolha fica
salva.

## Fluxo

- **Obras** lista as obras do workspace com o placar de cada uma (concluídas,
  em aberto, atrasadas). "Criar obra" abre um modal.
- **Tabela** é a planilha da obra. Clique numa célula para editar (Enter
  salva, Esc cancela). "Adicionar restrição" abre um modal com todos os campos.
- **Nº (R-001)** abre a restrição: formulário completo, histórico de
  alterações e **chat**. Digite `@` no chat para mencionar um membro; ele
  recebe notificação.
- **Importar Excel** (gestor): sobe o `.xlsx`, o sistema sugere qual coluna
  vira qual campo (por nomes conhecidos ou pela IA), você confere e confirma.
  Colunas sem campo ficam guardadas em "Outras colunas da planilha".
- **Indicadores**: o painel que substitui o relatório do Power BI. Filtros
  cruzados: clicar numa barra de Área (ou Setor, Responsável, Classificação,
  ou numa causa do Pareto) refaz todos os outros gráficos com aquele recorte.
- **Pessoas** (admin do workspace): quem participa e com que papel.
- **Workspaces / Usuários** (admin global): cria workspaces e administra contas.

## Indicadores

A peça central é a **situação**, sempre calculada e nunca digitada:

| Situação | Regra |
|---|---|
| Concluída no prazo | concluída e `data_conclusao <= data_limite` |
| Concluída com atraso | concluída e `data_conclusao > data_limite` |
| No prazo | aberta e `data_limite >= hoje` |
| Atrasada | aberta e `data_limite < hoje` |
| Cancelada | status cancelada |

Indicadores do topo:

- **IRR** (índice de remoção de restrições): concluídas ÷ total, sem contar as
  canceladas no denominador.
- **Aderência ao prazo**: das concluídas, quantas fecharam dentro do prazo.
- **Resolução média**: dias entre criação e conclusão.
- **Atrasadas**: quantas e há quantos dias, em média.

Gráficos: índice de remoção por semana (barras de concluídas contra a linha de
previstas), Pareto das causas 6M com corte de 80%, barras empilhadas por área,
responsável, setor e classificação, e a tabela de detalhamento.

As cores das situações passam nos testes de daltonismo (protanopia,
deuteranopia e tritanopia) e todo valor tem rótulo visível — a cor nunca é o
único canal de informação.

## Regras de domínio que o banco garante

- "Atrasada" não é status: é `data_limite < hoje` com status aberto.
  "Concluída com atraso" é `data_conclusao > data_limite`.
- `prazo_original` guarda o primeiro prazo; cada mudança de `data_limite`
  incrementa `reprogramacoes`.
- `semana_programada` (linha de base) só pode ser alterada por gestor depois
  de definida.
- Toda alteração de campo vira linha em `restricao_eventos` (histórico).
- Menção e atribuição geram `notificacoes` por gatilho.

## Power BI

`GET /api/powerbi/restricoes` (opcionais `?workspace=CODIGO` e `?obra=CODIGO`) com header
`Authorization: Bearer <POWERBI_API_TOKEN>`. Devolve JSON plano com campos
calculados (`atrasada`, `concluida_com_atraso`, `dias_para_prazo`,
`tempo_resolucao_dias`, `semana_limite`, ...). No Power BI: Obter dados →
Web → Avançado → adicionar o cabeçalho `Authorization`.

## Comandos

| Ação            | Comando                             |
| --------------- | ----------------------------------- |
| dev             | `npm run dev`                       |
| typecheck       | `npm run typecheck`                 |
| lint            | `npm run lint`                      |
| testes          | `npm test`                          |
| migration nova  | `npx supabase migration new <nome>` |
| aplicar local   | `npx supabase db reset`             |
| regenerar tipos | `npm run db:types`                  |
