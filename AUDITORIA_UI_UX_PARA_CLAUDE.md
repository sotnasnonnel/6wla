# 6WLA — Auditoria de layout e usabilidade para implementação

Data: 08/09/2026. Entrega: diagnóstico e especificação; nenhuma alteração de interface foi implementada nesta etapa.

## 1. Como usar este documento

Este documento transforma a análise do projeto em tarefas para o Claude. Leia primeiro o resumo, preserve as regras de domínio e implemente por etapas. Cada item descreve a evidência, a mudança proposta e uma forma observável de verificar o resultado.

A análise combina revisão do agente principal e de um subagente dedicado a UI/UX. Foi baseada no código atual do workspace, incluindo alterações locais ainda não commitadas. O inventário do Computer Use retornou nenhum navegador conectado: **não houve inspeção de telas renderizadas, testes de interação, medição de desempenho nem entrevistas com usuários**. As referências são caminhos relativos ao repositório e símbolos pesquisáveis; números de linha pontuais podem mudar.

Classificação das conclusões:

- **Confirmado no código:** característica ou ausência localizada na implementação; não equivale a reprodução em navegador.
- **Risco a reproduzir:** consequência provável da implementação que exige teste de interação.
- **Proposta:** decisão de design recomendada, sujeita à validação com usuários e telas reais.

Não há nota numérica de usabilidade: atribuir uma sem observar usuários ou o produto renderizado daria uma precisão inexistente.

## 2. Diagnóstico principal

O produto já possui uma base coerente para operação de obra: contexto por obra, tabela editável, cartões no celular, componentes compartilhados, indicadores, histórico e comentários. A oportunidade principal é reduzir o esforço para localizar uma restrição, entender sua urgência, atualizar os dados e retomar o trabalho sem perder contexto.

As maiores prioridades são:

1. Tornar a edição confiável e perceptível: estados de salvamento, erros recuperáveis e atualização colaborativa sem dados locais obsoletos.
2. Enxugar a tabela inicial, manter a identificação visível e preservar busca/filtros ao abrir detalhes e voltar.
3. Corrigir a sincronização do menu recolhido e o comportamento de teclado da navegação móvel.
4. Dar acesso rápido ao chat e às informações principais da restrição no celular.
5. Explicar melhor os gráficos, suas legendas e o alcance dos filtros.
6. Aumentar legibilidade, consistência de formulários e clareza da importação.

### O que preservar

- Paleta da marca: azul estrutural, terracota para ações e verde como apoio; evoluir os tons funcionais quando necessário.
- Densidade adequada a uma ferramenta de trabalho. Evitar cartões gigantes, excesso de espaços e ornamentação que afaste os dados.
- A obra como contexto único. Não introduzir um filtro de obra em cada tela.
- Tabela no desktop e cartões já existentes no celular.
- Uso de texto junto às cores para situações e estados.
- Modal nativo com `dialog.showModal()`, foco inicial e Escape já implementados.
- Cabeçalho fixo da tabela, seletor de colunas e edição por Enter/F2 já existentes.
- Chips e limpeza de filtros já existentes no painel de indicadores; expandir a consistência para a tabela.
- Histórico automático, regras de autorização e validação do servidor.

## 3. Priorização

P0 = confiabilidade da tarefa ou barreira de navegação; P1 = ganho relevante no fluxo principal; P2 = refinamento ou escala. Esforço relativo: P pequeno, M médio, G grande. Não são estimativas de prazo.

| ID | Entrega | Prioridade | Esforço | Evidência |
|---|---|---|---|---|
| UX-01 | Edição de célula e atualização colaborativa confiáveis | P0 | G | Código + risco a reproduzir |
| UX-02 | Menu sincronizado e gaveta acessível | P0 | M | Código + risco a reproduzir |
| UX-03 | Contraste e estados acessíveis de componentes | P1 | M | Código + cálculo de contraste |
| UX-04 | Tabela com visão essencial e identificação fixa | P1 | M | Código + proposta |
| UX-05 | Filtros persistentes e ordenação no celular | P1 | M | Código + proposta |
| UX-06 | Detalhe, chat e preservação do texto enviado | P0/P1 | M | Código + risco a reproduzir |
| UX-07 | Salvamento e proteção de rascunhos | P1 | M | Código + risco a reproduzir |
| UX-08 | Importação guiada e falha parcial explícita | P0/P1 | G | Código + proposta |
| UX-09 | Painel com hierarquia e significado explícito | P1 | M | Código + proposta |
| UX-10 | Gráficos legíveis e consultáveis no celular | P1 | M | Código + risco a reproduzir |
| UX-11 | Contexto de obra e empresa no cabeçalho | P1 | M | Código + proposta |
| UX-12 | Obras localizáveis e atalhos operacionais | P2 | M | Código + proposta |
| UX-13 | Notificações com contagem e alcance claros | P2 | M | Código |
| UX-14 | Administração com ações claras e localizadas | P2 | M | Código + proposta |
| UX-15 | Login, carregamentos e linguagem consistentes | P2 | P/M | Código + proposta |

## 4. Direção visual proposta

### 4.1 Estrutura geral

Desktop: manter a barra lateral compactável. O cabeçalho deve informar empresa/workspace e obra atual; a página deve apresentar título, apoio curto e uma ação primária claramente identificada. A tabela usa a largura disponível; formulários devem limitar o comprimento das linhas e agrupar campos relacionados.

Celular: cabeçalho com abrir menu, obra identificável e acesso às notificações. Mostrar primeiro o conteúdo necessário à ação, deixando filtros avançados e campos complementares em expansão. Ações fixas só quando não ocultarem o conteúdo, especialmente com teclado virtual aberto.

Esboço de organização da tabela no desktop — proposta, não captura de tela:

```text
[Menu] [Empresa / Obra atual]                         [Notificações]
       Restrições                         [+ Adicionar restrição]
       [Buscar descrição, número ou responsável...] [Filtros (2)]
       [Responsável: Ana ×] [Atrasadas ×] [Limpar filtros]
       18 de 120 restrições          [Visão essencial] [Colunas] [Exportar]
       Nº fixo | Restrição fixa | Responsável | Prazo | Situação | ...
       R-001   | ...            | ...         | ...   | ...      | ...
```

### 4.2 Tokens e dimensões

São parâmetros iniciais de implementação a conferir no navegador, não medições do produto atual.

| Elemento | Direção proposta |
|---|---|
| Título de página | 22–24 px, peso 600, linha curta de apoio |
| Título de seção | 16 px, peso 600 |
| Texto de trabalho | 14 px no desktop; 16 px nos campos do celular |
| Metadados | 12–13 px; evitar 10–11 px para informação necessária à decisão |
| Espaçamento | Escala 4, 8, 12, 16, 24, 32 px |
| Superfícies | Fundo gelo, conteúdo branco, borda sutil |
| Cantos | 6–8 px na maioria dos componentes |
| Ação primária | Uma por bloco de tarefa; texto que diga o resultado |
| Controles de toque | Meta interna de área acionável de pelo menos 44 × 44 px |
| Linha da tabela | Aproximadamente 36–40 px na visão normal; validar densidade com dados reais |
| Foco | Indicador perceptível em todos os controles, inclusive células e links de ícone |

Não fazer uma troca indiscriminada de tamanho em todo o CSS: tabela, formulário e gráfico têm necessidades diferentes. Não trocar a biblioteca de tabela ou os gráficos apenas por preferência estética.

## 5. Especificações por problema

### UX-01 — Edição e colaboração precisam transmitir confiança

**Referências:** `src/components/restricoes/celula.tsx`, função `salvar`; `src/components/restricoes/grade.tsx`, estado `sobrescritas` e composição de `linhas`.

**Evidência:** a célula salva por Enter e blur, sem tratamento local de exceção com `finally` nem guarda síncrona de operação em andamento. A grade prefere `sobrescritas[r.id]` aos dados recebidos. Uma sobrescrita local de registro inteiro pode prevalecer sobre uma versão mais recente do servidor.

**Riscos a reproduzir:** salvamento duplicado na sequência Enter/blur, célula presa em salvamento após rejeição inesperada e informação antiga reaparecendo ou permanecendo após edição de outro usuário.

**Implementação proposta:**

1. Modelar estados visíveis: leitura, edição, salvando, salvo e erro.
2. Garantir uma operação por célula por vez e finalizar o estado de espera mesmo se a promessa rejeitar.
3. Manter o rascunho quando houver erro e oferecer tentar novamente ou cancelar; não exigir redigitar.
4. Não anunciar sucesso antes da resposta do servidor.
5. Reconciliar o retorno confirmado com os dados novos. Evitar uma cópia completa local e permanente que masque mudanças em outros campos.
6. Definir como tratar atualização remota durante edição: preservar rascunho e comunicar a mudança. Detecção forte de conflito pode exigir versão/timestamp e suporte no servidor; separar essa extensão da correção visual.
7. Dar nome acessível ao editor com coluna e restrição, por exemplo “Prazo de R-001”.

**Aceite:** Enter seguido de perda de foco gera uma única alteração; falha de rede mantém o texto e permite retry; Escape cancela; a célula nunca fica indefinidamente desabilitada por uma exceção; atualização de outro campo em uma segunda sessão aparece sem recarregar manualmente. Testar com duas sessões locais autorizadas, sem editar dados de produção.

### UX-02 — Corrigir recolhimento e gaveta móvel

**Referências:** `src/components/layout/sidebar.tsx:47`, `src/components/layout/rodape-sidebar.tsx`, `src/app/(app)/layout.tsx`.

**Confirmado no código:** `Sidebar` mantém `colapsada` em estado local, mas recebe `rodape` já construído com o valor do cookie lido pelo servidor. O clique atualiza a sidebar e o cookie, sem atualizar diretamente a prop do rodapé. Na gaveta móvel, esconder usa transformação CSS; não há no componente tratamento de Escape, foco preso ou `inert` para os controles fora da tela.

**Implementação proposta:** compartilhar uma única fonte de estado de recolhimento entre corpo e rodapé. Conservar a leitura inicial do cookie para evitar mudança de largura após carregar. Para a gaveta móvel, usar comportamento modal consistente, fechar por Escape e navegação, restaurar foco no acionador e tornar o fundo inerte enquanto aberta. Quando fechada, seus links não podem entrar na sequência de Tab. Associar o acionador ao painel por `aria-controls` e `aria-expanded`.

**Aceite:** recolher e expandir atualiza imediatamente conta, notificações e sair; recarregar preserva a preferência; no celular, Tab não alcança menu fechado e não escapa da gaveta aberta; Escape fecha e devolve foco. A preferência de desktop não deve estreitar a gaveta móvel.

### UX-03 — Legibilidade e componentes compartilhados

**Referências:** `src/app/globals.css`, `src/components/ui/basicos.tsx`, `src/components/ui/modal.tsx`, `src/components/indicadores/pecas.tsx`.

**Confirmado:** `--tinta-fraca: #7a7a7a` aparece em textos pequenos; o botão primário usa branco sobre `#c35e1e`. Cálculo estático de luminância sRGB, sem opacidade: cinza sobre branco ≈ **4,29:1**, cinza sobre gelo `#f2f2f2` ≈ **3,83:1**, branco sobre terracota ≈ **4,25:1**. Não é medição de tela nem laudo de conformidade.

Adotar como meta interna contraste mínimo 4,5:1 para texto pequeno. Usar tinta mais escura nos metadados funcionais. O terracota escuro existente `#a54f19` com branco resulta em ≈ 5,63:1 e é candidato ao preenchimento de botões; validar hover, foco, disabled e links antes de aplicar. Preservar a marca sem assumir que todo tom da marca serve para texto pequeno.

`CampoRotulado` mostra erro, mas não associa automaticamente a mensagem ao campo. `Alerta` não estabelece região de anúncio. O modal usa o ID fixo `modal-titulo` e não associa sua descrição.

**Implementar:** IDs únicos por modal; `aria-describedby` para descrição/erro quando aplicável; `aria-invalid` no campo inválido; mensagens de resultado anunciadas sem duplicação; foco no primeiro erro de formulário; nomes explícitos para botões de ícone. Usar alertas assertivos apenas quando necessário, sem transformar toda atualização em interrupção.

**Aceite:** erro identifica o campo e é compreensível pelo leitor de tela; dois modais montados não duplicam IDs; sucesso de salvar é anunciado uma vez; foco é visível; cores finais são medidas por combinação real de texto/fundo. Não afirmar conformidade de acessibilidade sem auditoria completa.

### UX-04 — Tabela essencial e colunas fixas

**Referência:** `src/components/restricoes/grade.tsx`, definições de colunas, visibilidade e contêiner `overflow-auto`.

**Confirmado:** há muitas colunas visíveis e rolagem horizontal; o cabeçalho já é fixo, mas a identificação da restrição não está fixada horizontalmente. O seletor de colunas já existe.

**Proposta:** iniciar com Nº, Restrição, Responsável, Prazo, Situação, Prioridade e Ação, nesta ordem. Conservar todos os outros campos em “Colunas” e em uma visão “Completa”. “Situação” é calculada; manter “Status” disponível para edição sem confundir os conceitos. Se a célula Ação ficar estreita, permitir expansão controlada, sem depender exclusivamente de `title`.

Fixar Nº e, onde houver largura suficiente, Restrição. Garantir fundo opaco, separador e camadas corretas na interseção com o cabeçalho. Se fixar duas colunas deixar pouca área de trabalho, fixar apenas Nº. Usar texto de duas linhas no máximo na visão normal e abrir o detalhe para leitura completa.

O seletor de colunas deve fechar com Escape/clique externo, ter rótulos associados às opções e permitir “Restaurar visão padrão”. Não ocultar todos os caminhos de identificação e abertura da restrição.

**Aceite:** em 1366 × 768, a visão essencial apresenta contexto suficiente sem buscar a descrição fora da tela; ao rolar horizontalmente, Nº permanece visível; cabeçalho e colunas fixas não cobrem menus ou erros; a visão completa continua acessível; preferências não vazam entre usuários.

### UX-05 — Filtros, retorno e ordenação

**Referências:** `grade.tsx`, estados `busca`, filtros, `ordenacao`, `visiveis`; `cartoes.tsx`; `indicadores/painel.tsx`, estado `f`.

**Confirmado:** os filtros são locais aos componentes. O painel tem chips e “limpar tudo”, enquanto a tabela precisa de tratamento equivalente. O celular usa cartões e não dispõe dos cabeçalhos clicáveis da tabela para escolher ordenação.

**Implementar:** busca com propósito explícito; chips removíveis e botão “Limpar filtros” na tabela; resumo “18 de 120 restrições”; indicação de filtros ativos mesmo quando recolhidos; seletor de ordenação no celular. Opções iniciais: prazo mais próximo, maior atraso, prioridade e mais recentes, respeitando valores e regras existentes.

Persistir filtros e ordenação preferencialmente na URL, com validação dos parâmetros. Evitar colocar texto sensível de busca na URL sem avaliar o contexto; quando adequado, usar estado de sessão. Preferências de colunas podem ficar no armazenamento local, com chave por usuário/obra, versão e valor inicial consistente. Limpar preferências pessoais no encerramento de sessão quando aplicável.

**Aceite:** filtrar, abrir uma restrição e voltar conserva o recorte; limpar remove todos os filtros e atualiza a contagem; link com parâmetro inválido não quebra a página; troca de obra não herda filtros incompatíveis; usuário móvel consegue ordenar; busca por R-001 encontra o item se esse formato for apresentado como suportado.

Conferir também a busca pelo nome do responsável vinculado: a lista pode exibir o nome resolvido por ID enquanto o texto pesquisável usa `responsavel_nome`. A busca deve encontrar o mesmo nome que o usuário vê, incluindo responsáveis externos. Adicionar nomes acessíveis aos filtros e `aria-sort` aos cabeçalhos ordenáveis.

### UX-06 — Detalhe orientado à tarefa e chat alcançável

**Referências:** `src/components/restricoes/detalhes.tsx`, `chat.tsx`, `historico.tsx`, rota `src/app/(app)/obras/[obraId]/restricoes/[restricaoId]/page.tsx`.

**Problema:** o formulário completo reúne muitos campos; no empilhamento móvel, conversa e histórico disputam espaço com o formulário longo. O chat usa rolagem automática, cujo efeito sobre o restante da página precisa ser reproduzido.

**Proposta de layout:** cabeçalho com R-001, descrição, situação, responsável e prazo; abaixo, abas “Detalhes”, “Conversa” e “Histórico”. No desktop amplo, manter conversa lateral se isso facilitar o trabalho; no celular, abas devem dar acesso direto sem atravessar todos os campos.

Agrupar formulário em: informações principais; responsável; planejamento e prazos; classificação e localização; informações complementares. Abrir inicialmente as informações principais e os campos essenciais de prazo. Manter erros de seções recolhidas visíveis no resumo e abrir a seção ao focar o erro.

No chat, rolar automaticamente apenas quando a pessoa já estiver próxima ao fim ou quando ela enviar a mensagem. Se estiver lendo mensagens antigas, mostrar “Novas mensagens” sem deslocá-la. Tratar a rolagem dentro do painel, sem puxar a página inteira. Explicar como mencionar alguém e oferecer seleção acessível por teclado.

**Aceite:** no celular, uma ação a partir do detalhe abre a conversa; alternar abas preserva rascunhos; nova mensagem não retira o usuário de um campo ou de uma mensagem antiga; o menu de menções funciona com setas, Enter e Escape e não envia a mensagem ao selecionar uma pessoa.

**Correção P0 dentro deste item — envio do chat:** `chat.tsx`, função `enviar`, captura o texto para envio, mas limpa `texto` e menções depois da resposta; o editor permite continuar digitando. Isso cria risco de apagar uma mensagem nova escrita durante a espera. Preservar o texto posterior ao envio, distinguindo-o do conteúdo enviado, ou bloquear explicitamente o editor durante a operação. Proteger também o atalho Ctrl/Cmd+Enter contra submissões concorrentes. A seleção atual de menções escolhe a primeira candidata em Enter/Tab; permitir selecionar outras por setas e acioná-las por teclado/toque, sem depender apenas de `onMouseDown`.

**Aceite adicional:** com resposta artificialmente lenta, enviar A e digitar B nunca apaga B; repetir o atalho não duplica A; selecionar a segunda pessoa da lista funciona sem mouse; texto longo ou URL não estoura o painel.

### UX-07 — Formulários e modais sem perda silenciosa

**Referências:** `modal-nova.tsx`, `detalhes.tsx`, `ui/modal.tsx`, `obras/lista-obras.tsx`.

**Confirmado:** o modal compartilhado fecha por Escape, botão e clique no fundo. Desabilitar “Cancelar” durante um envio não bloqueia esses outros caminhos. O formulário de detalhe tem mensagem de salvo, mas precisa comunicar quando uma nova edição torna essa confirmação antiga.

**Implementar:** estado de formulário alterado; redefinir “Salvo” ao editar; rodapé de ações acessível; proteger fechamento com alterações não salvas; durante envio, não permitir que o usuário perca a percepção do resultado. Oferecer “Continuar editando” e “Descartar alterações” somente quando houver um rascunho real. Não adicionar confirmação a toda navegação sem alterações.

Na criação, priorizar descrição, responsável e prazo visualmente, sem tornar obrigatórios campos opcionais do domínio. Abrir complementares sob demanda; não mudar defaults de negócio inadvertidamente. “Salvar e adicionar outra” é uma extensão opcional, posterior à confiabilidade do salvamento.

**Responsável interno/externo:** hoje o formulário oferece campos de usuário e texto simultaneamente. Propor escolha explícita “Pessoa da equipe”, “Responsável externo” e “Sem responsável”, com campos pertinentes e indicação de qual nome será usado. Preservar dados importados ao alternar a apresentação; nunca apagar nome/e-mail/telefone silenciosamente. Trocar o fallback isolado `?` da grade por uma mensagem legível, como “Usuário indisponível”, preservando o identificador e a integridade do vínculo.

**Aceite:** Escape em formulário vazio fecha normalmente; Escape com alterações permite preservá-las; salvar não duplica registro; falha conserva os campos; editar após sucesso deixa claro que há alterações pendentes; erro em campo recolhido pode ser encontrado e corrigido.

### UX-08 — Importação com percurso e prévia interpretada

**Referências:** `src/components/importacao/upload.tsx`, `mapeamento.tsx`, `src/server/importacao/actions.ts`, `leitor.ts`, `src/lib/importacao/`.

**Confirmado:** há upload, mapeamento, sugestão por IA, amostra das cinco primeiras linhas e explicação de colunas extras. Os seletores do mapeamento têm títulos visuais em `div`, sem associação explícita ao controle. A amostra é da planilha de origem, com indicação de destino por coluna.

**Implementar por etapas:**

1. Mostrar progresso “Arquivo → Conferência → Resultado”, empresa/obra de destino e nome do arquivo.
2. Informar `.xlsx` e limite atual de **15 MB**, confirmado em `src/server/importacao/actions.ts`, junto ao seletor de arquivo; conferir se o limite continua igual ao implementar. Não prometer suporte a CSV/XLS sem implementação.
3. Associar cada seletor ao rótulo. Destacar campo obrigatório não mapeado e conflito de origem repetida com mensagem específica.
4. Agrupar mapeamentos essenciais e complementares; preservar a opção de revisar todos.
5. Mostrar amostra transformada: descrição, responsável, status, prazo e avisos por linha. Deixar a amostra original consultável.
6. Explicar “Salva em campos extras” no lugar de aparentar descarte das colunas não mapeadas.
7. Identificar sugestões de IA como sugestões revisáveis, sem fabricar porcentagem de confiança.
8. Antes de confirmar, mostrar o que é conhecido: destino, quantidade de linhas lidas e campos mapeados. Só mostrar totais de válidas/inválidas se houver validação de todas as linhas.
9. No resultado, distinguir importadas, ignoradas e com erro conforme os dados reais retornados. Oferecer “Abrir tabela” e acesso aos problemas.

**Dependência:** prévia normalizada e relatório de validação podem exigir reaproveitar a transformação no servidor; não duplicar regras de datas/status de modo divergente no cliente. Retentativa segura e prevenção de duplicidade devem seguir o mecanismo existente ou ser uma entrega separada de backend.

**Mapeamento sem surpresa:** `mapeamento.tsx`, função `define`, remove a associação anterior quando a mesma coluna é escolhida para outro campo. Avisar “Coluna X transferida de A para B”, com possibilidade de desfazer, ou exigir escolha explícita antes da transferência. A descrição obrigatória não deve perder seu mapeamento sem aviso. Preservar o fluxo já existente para continuar rascunhos de importação.

**Correção P0 dentro deste item — falha parcial:** `server/importacao/actions.ts` grava lotes de 200 e conserva a contagem `importadas` se um lote falhar. A mensagem atual recomenda tentar novamente sem dizer claramente quantos registros já foram gravados. Mostrar a quantidade confirmada e o estado efetivo, evitando induzir duplicação. Exemplo condicionado ao resultado real: “200 restrições foram importadas. O próximo lote não foi concluído.” Só oferecer retomada quando o servidor garantir que não repetirá lotes já confirmados. Não confundir índice da lista processada com número original da linha na planilha.

**Aceite:** arquivo inválido produz orientação recuperável; falha de IA não impede mapeamento manual; campos têm nomes acessíveis; usuário consegue conferir como uma data e um status serão gravados; falha não apaga o mapeamento; os números do resultado correspondem à operação efetiva.

**Aceite adicional:** simular falha depois do primeiro lote deixa explícito que já há registros persistidos; nenhuma ação de repetição cria duplicação silenciosa; trocar uma coluna de destino comunica qual associação foi removida.

### UX-09 — Hierarquia do painel e significado dos números

**Referências:** `indicadores/painel.tsx:248`, `pecas.tsx`, `lib/restricoes/indicadores.ts`, página de indicadores.

**Confirmado:** sete KPIs aparecem em uma faixa flexível; IRR tem destaque; semanal, Pareto e ranking ocupam blocos sucessivos; a legenda compartilhada das situações é inserida depois dos gráficos por dimensão. O filtro semanal usa `data_conclusao ?? data_limite`.

**Proposta:** dar prioridade visual a Atrasadas, No prazo, Concluídas e IRR. Colocar aderência e resolução média em segunda faixa, com total e escopo claramente visíveis. Mostrar legenda de situações junto ao início dos gráficos correspondentes, sem depender de rolar até o fim. No desktop amplo, testar semanal e Pareto lado a lado; se os rótulos ficarem ilegíveis, manter largura completa.

Explicar as fórmulas com ajuda acessível por clique e teclado. Especificar que IRR exclui canceladas do denominador e que aderência considera concluídas. O gráfico “Índice de remoção por semana” exibe contagens de concluídas/previstas: revisar o título para algo como “Previstas e concluídas por semana”, caso corresponda ao cálculo efetivo. Não acrescentar símbolo de porcentagem a uma contagem.

Explicar qual data determina o filtro de semana; não apresentar esse filtro como uma janela de planejamento 6WLA sem implementação correspondente. Uma janela explícita de próximas seis semanas é uma possível evolução de produto, fora da correção visual inicial.

Manter o comportamento de filtro cruzado, incluindo a exceção da própria dimensão, mas informar: “Os demais gráficos usam este recorte; esta dimensão mantém as alternativas para comparação”. Não afirmar que os totais de todas as barras sempre igualam o KPI filtrado.

**Aceite:** legenda aparece próxima das barras; período e quantidade filtrada são identificáveis; nenhum número muda apenas por reorganizar o layout; canceladas e campos sem datas mantêm a regra atual; uma amostra conhecida produz os mesmos indicadores antes/depois.

### UX-10 — Gráficos em telas pequenas e leitura alternativa

**Referências:** `indicadores/pecas.tsx`, `BarrasEmpilhadas`; `semanal.tsx`, `pareto.tsx`, `ranking.tsx`, `detalhamento.tsx`.

**Confirmado:** barras empilhadas reservam 150 px ao rótulo por padrão; segmentos estreitos deixam de mostrar valor; detalhes usam `title`. O detalhamento já oferece alternativa tabular, com área de rolagem de altura limitada.

**Risco:** em largura móvel, sobra pouca área para barras e valores. `title` não é uma solução suficiente para consulta em toque.

**Implementar:** rótulo acima da barra em telas estreitas, valor total sempre legível e detalhe por toque/foco com todas as situações. Oferecer acesso próximo a “Ver dados” utilizando a tabela existente. Mostrar unidades “dias” em resolução/atraso e distinguir ausência de informação de zero. Para categorias limitadas por ranking/top N, informar o limite; só oferecer “Ver todas” se os dados completos estiverem disponíveis.

**Aceite:** em 360 px e zoom de 200%, nomes, valores e comandos continuam acessíveis; categoria longa pode ser consultada sem hover; todas as contagens por situação têm alternativa textual; navegação por teclado permite filtrar e limpar; o detalhamento não é removido durante a reorganização.

### UX-11 — Obra e empresa reconhecíveis em todas as telas

**Referências:** `src/app/(app)/layout.tsx`, `layout/sidebar.tsx`, `workspaces/seletor.tsx`.

**Confirmado:** o cabeçalho mostra o seletor de workspace; com um único workspace, mostra apenas seu código. O nome da obra está na sidebar, que fica recolhida/oculta em diferentes modos. A seleção ativa de “Tabela” é por URL exata e não inclui automaticamente a rota de detalhe.

**Implementar:** mostrar contexto resumido no cabeçalho ou breadcrumb: empresa → obra → tela. Tornar nomes completos consultáveis no toque, não apenas em `title`. Manter “Tabela” como seção ativa ao abrir restrição, sem marcar dois links como página atual. O retorno ao detalhe deve respeitar a origem quando houver retorno seguro conhecido, ou usar a tabela da obra como fallback.

Na troca de workspace, mostrar estado de transição e impedir envios repetidos. Garantir tratamento de nomes longos sem estouro da largura.

**Aceite:** com menu recolhido e no celular, a obra continua identificável; em detalhe, a navegação conserva o contexto; empresa com nome longo não cobre o botão de menu; troca lenta tem indicação perceptível.

### UX-12 — Lista de obras mais operacional

**Referência:** `obras/lista-obras.tsx`.

**Confirmado:** lista em cartões, sem busca ou ordenação no componente; o cartão inteiro abre indicadores. Mostra abertas, atrasadas, concluídas e total, com barra de progresso.

**Proposta:** adicionar busca por nome/código, filtro de ativas/inativas e ordenação por nome ou quantidade de atrasadas. Explicar “Atrasadas fazem parte das em aberto”, evitando a leitura como totais independentes. Usar ações distintas “Abrir indicadores” e “Abrir tabela” quando o volume e o fluxo justificarem. Não aninhar links ou botões dentro do link do cartão: reestruturar a marcação.

**Aceite:** busca sem resultado difere de workspace sem obras; limpar busca recupera cartões; nomes longos quebram linha; não há controles interativos aninhados; contadores mantêm semântica de negócio, inclusive canceladas no total conforme cálculo existente.

### UX-13 — Notificações sem falsa impressão de completude

**Referências:** `src/app/(app)/notificacoes/page.tsx`, `src/server/notificacoes/queries.ts`, `layout/rodape-sidebar.tsx`.

**Confirmado:** a consulta da lista limita a 100 registros; o cabeçalho conta não lidas dessa lista, enquanto o contador global consulta todas as não lidas. Portanto, “Você está em dia” pode não representar a totalidade quando há não lidas fora do recorte.

**Implementar:** usar contagem global ou escrever explicitamente “não lidas nesta lista”; adicionar paginação/carregar mais e opção de não lidas, com suporte na consulta. Exibir obra de origem quando disponível, estado textual de não lida e link claro para a restrição. Mostrar estado de envio ao marcar lida, com erro recuperável.

**Aceite:** conjunto de mais de 100 notificações, com não lidas antigas, não produz indicação falsa de nenhuma pendência; a ação “Marcar todas” informa o alcance real; abrir item leva à obra correta; feedback de leitura atualiza lista e contador.

### UX-14 — Pessoas e usuários com menos ambiguidade

**Referências:** `components/admin/usuarios.tsx`, `components/workspaces/pessoas.tsx`, `lista-workspaces.tsx`.

**Confirmado:** há ações globais diretas de ativação/admin e estado de espera compartilhado; remoção de pessoa usa `window.confirm`. Listas precisam de busca para escalar.

**Proposta:** busca por nome/e-mail; etiquetas explícitas de papel e situação; estados de espera por linha/ação quando não houver operação global. Agrupar ações secundárias, identificar a pessoa e o alcance de alterações administrativas. Para remover acesso ou conceder admin global, usar confirmação contextual com nome e consequência; ações de consulta continuam diretas. A confirmação visual não substitui autorização no servidor.

**Aceite:** operar em uma pessoa não apresenta todas como estando em processamento; confirmação nomeia alvo e efeito; cancelar não envia alteração; erro permanece junto à ação; rótulos não dependem de nome riscado. Se alterar auth/RLS, cumprir revisão de segurança prevista em `CLAUDE.md`.

### UX-15 — Acabamento dos fluxos e linguagem

**Referências:** `app/login/form-login.tsx`, `app/login/page.tsx`, `components/ui/basicos.tsx`, rotas em `app/(app)`.

Manter o login simples. Adicionar mostrar/ocultar senha com nome acessível, permitir colagem e respeitar autocomplete. Orientação de recuperação deve refletir o processo real existente: não criar um link “Esqueci minha senha” sem fluxo funcional.

Criar estados de carregamento consistentes nas rotas que precisarem, mantendo a geometria aproximada do conteúdo; falhas devem oferecer tentativa novamente e retorno à obra. Distinguir ausência de dados, nenhum resultado de filtro, falta de acesso e erro de carregamento. Não mostrar uma lista vazia para disfarçar erro.

Padronizar “Limpar filtros”, “Salvar alterações”, “Adicionar restrição”, “Sem responsável” e “Sem prazo informado”. Explicar “Workspace” como empresa/ambiente de trabalho sem renomear entidades do banco. Não usar o mesmo rótulo para ausência de dado e valor zero.

**Aceite:** login funciona por teclado; visibilidade da senha não envia o formulário; ação pendente impede duplicação e informa andamento; cada estado vazio sugere uma próxima ação apropriada ao papel do usuário.

## 6. Regras de domínio que o redesign deve respeitar

1. “Atrasada” é situação calculada, não um novo status editável.
2. Preservar cálculo de concluída com atraso, IRR, aderência e tempos; não recalcular métricas apenas no componente visual.
3. Preservar prazo original, reprogramações, semana programada e histórico automático.
4. Permissões dependem de contexto e servidor. Ocultar um botão não concede nem revoga acesso.
5. Preservar menções, atribuições, Realtime, importação e exportação.
6. Não transformar datas ausentes em datas de hoje ou números zero. A revisão da classificação de registros sem prazo é decisão separada de domínio.
7. Não modificar schema, RLS ou autenticação como efeito colateral de um ajuste de layout. Se indispensável, documentar em etapa própria e seguir `CLAUDE.md`.
8. Não introduzir gravação offline, ações em lote, Kanban, novas notificações automáticas ou nova janela temporal como parte implícita desta auditoria.

## 7. Ordem recomendada de execução pelo Claude

### Etapa 1 — Base confiável

UX-01, UX-02, parte funcional de UX-03 e correções P0 de envio do chat (UX-06) e falha parcial de importação (UX-08). Corrigir estados e navegação antes de expandir componentes. Registrar reprodução e testes da célula/realtime. Resultado: editar e navegar com feedback consistente.

### Etapa 2 — Operação diária

UX-04, UX-05, UX-06, UX-07 e UX-11. Resultado: encontrar, abrir, atualizar e retornar a uma restrição com menos esforço. Validar desktop e celular antes de considerar concluída.

### Etapa 3 — Análise e entrada de dados

UX-08, UX-09 e UX-10. Separar ajustes visuais da importação das dependências de validação no backend. Resultado: entender números e conferir dados antes de importar.

### Etapa 4 — Escala e acabamento

UX-12 a UX-15 e revisão final de consistência visual. Resultado: listas e tarefas administrativas mais claras.

Não reescrever o aplicativo inteiro de uma vez. Cada etapa deve ser revisável e manter os fluxos anteriores funcionando. Não sobrescrever alterações locais alheias.

## 8. Plano de validação

### Matriz visual e funcional

| Cenário | Verificação |
|---|---|
| Desktop 1366 × 768 e 1920 × 1080 | Tabela, identificação fixa, painel e aproveitamento de largura |
| Tablet 768 × 1024 | Transição entre grade/cartões, menu e toque |
| Celular 360 × 800 e 390 × 844 | Ordem do conteúdo, teclado virtual, chat, ações e ausência de overflow global |
| Zoom 200% | Sem conteúdo essencial inacessível ou foco encoberto |
| Teclado | Login, gaveta, modal, célula, filtros, gráficos e menções |
| Dados extensos | Descrições longas, nomes grandes, 0/1/500 restrições, muitas obras e mais de 100 notificações |
| Estados de falha | Servidor rejeita, conexão cai, importação falha, sessão expira |
| Colaboração | Segunda sessão atualiza registro durante/após edição local |
| Papéis | Membro, gestor e administrador veem e executam apenas ações permitidas |

Capturar antes/depois com a mesma massa de dados e mesma resolução. Usar dados locais ou de teste e registrar quais cenários foram efetivamente executados. Este documento não contém capturas nem resultados desses testes.

### Verificações automatizadas pertinentes

- Executar `npm run typecheck`, `npm run lint`, `npm test` e `npm run build` ao concluir implementação, registrando falhas preexistentes separadamente.
- Adicionar testes de comportamento para salvamento duplicado, rejeição de promessa, preservação de rascunho e reconciliação de atualização remota.
- Testar teclado/foco da gaveta e modais, retorno com filtros e ordenação móvel.
- Preservar testes existentes de indicadores e importação; ampliar apenas quando houver comportamento novo ou risco concreto.
- Existe script `npm run test:e2e`, mas a disponibilidade de configuração e cenários Playwright deve ser verificada antes de anunciar cobertura. Não afirmar que testes passaram apenas porque o script existe.
- Para ajustes puramente visuais, usar inspeção de renderização; evitar testes que apenas repetem classes CSS.

### Pequeno roteiro com usuários, se disponíveis

Pedir a um gestor e a um membro que encontrem uma restrição atrasada, atualizem o prazo, enviem uma menção, retornem à lista filtrada e expliquem um KPI. Registrar sucesso sem ajuda, tentativas erradas, perda de contexto e dúvidas. Comparar antes/depois; não inventar metas de ganho percentual sem baseline. Perguntar qual informação precisam enxergar em uma reunião de planejamento para ajustar a visão essencial.

## 9. Prompt pronto para enviar ao Claude

```text
Leia AUDITORIA_UI_UX_PARA_CLAUDE.md e o CLAUDE.md do projeto 6WLA.

Implemente as melhorias por etapas, começando pela Etapa 1 e seguindo a ordem
do documento. Antes de cada item, confira a implementação atual: a auditoria
é estática e alguns riscos precisam ser reproduzidos no navegador.

Preserve a identidade visual, as regras de domínio e as alterações locais
existentes. Reutilize os componentes compartilhados e mantenha tabela no
desktop e cartões no celular. Não trate recomendações visuais como autorização
para mudar cálculos, schema, permissões ou autenticação sem separar a mudança
e cumprir as regras do projeto.

Para cada etapa, entregue código, lista dos IDs atendidos, verificação dos
critérios de aceite, testes pertinentes e capturas antes/depois quando houver
ambiente renderizado. Informe objetivamente o que não conseguiu testar.
Não dê por concluído um item só por aplicar classes CSS.

Priorize confiabilidade da edição, navegação, preservação de filtros,
legibilidade da tabela e acesso ao chat no celular. Ao terminar cada etapa,
resuma o resultado e prossiga para a próxima enquanto houver condições.
Dependências reais de backend devem ser identificadas e tratadas em mudanças
separadas. Não publique nem faça deploy como parte deste pedido.
```

## 10. Checklist de entrega final da implementação

- [ ] UX-01 a UX-15 atendidos ou acompanhados de pendência específica e justificativa.
- [ ] Nenhuma mudança acidental de regra de domínio, permissão ou cálculo.
- [ ] Fluxos principais verificados em desktop e celular.
- [ ] Edição, erro, salvamento e atualização remota com comportamento definido.
- [ ] Navegação e filtros conservam contexto ao abrir e voltar de detalhes.
- [ ] Contrastes, foco e rótulos conferidos nos componentes finais.
- [ ] Importação comunica destino, transformação e resultado real.
- [ ] Indicadores conservam valores e explicam período, legenda e fórmulas.
- [ ] Testes executados, resultados e limitações registrados sem presumir sucesso.
- [ ] Alterações existentes do usuário preservadas.
