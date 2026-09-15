# Análise da PPC.xlsx para importar previsto e realizado

Análise de 14/09/2026 da cópia `PPC.xlsx` na raiz do projeto. Leitura do
conteúdo Open XML, das mesclagens, das fórmulas (inclusive compartilhadas) e
dos resultados salvos. O arquivo original não foi alterado. As somas diárias
foram conferidas independentemente em JavaScript; não houve recálculo no Excel.

## Conclusão sobre as quantidades

Usar **Z / PPC**, na linha identificada como **Previsto** e na linha
identificada como **Real**. Conferir esse resultado contra os lançamentos
diários. Não usar **Q / QTD.** como fonte automática das quantidades semanais.

Não é apenas uma diferença entre quantidade total e quantidade semanal:
existem fórmulas incorretas na coluna Q. Exemplos:

| Par de linhas | QTD. prevista / real | PPC previsto / real | Evidência |
|---|---|---|---|
| 1546–1547 | 27,12 / 26,12 | 13,06 / 13,06 | Q soma S:AF: inclui os dias e o próprio total Z novamente; na linha prevista inclui também o índice AA. Z soma apenas S:Y. |
| 1612–1613 | 15.002,266666… / 34.000 | 7.500 / 17.000 | A mesma soma ampliada duplica as quantidades e mistura um índice na linha prevista. Unidade: m. |
| 1944–1945 | 1,5666 / 3 | 0,9999 / 0,7833 | Q1944 soma S1945:AF1945, isto é, a linha Real. A fórmula compartilhada de Q1945 aponta para a linha seguinte. |

Contagem das fórmulas de Q: 902 células com fórmula, das quais 898 incluem
o intervalo até AF e 518 referenciam outra linha. Há 427 divergências
numéricas no Previsto e 342 no Real entre Q e Z, usando tolerância relativa
de 1e-8 para não contar ruído de ponto flutuante. Erros de fórmula não foram
contados como números nem substituídos por zero.

As 2.444 células Z contêm somas da própria linha: 232 usam T:X (segunda a
sexta) e 2.212 usam S:Y (domingo a sábado). Os resultados salvos de **2.443**
delas conferem com a soma independente do intervalo indicado pela fórmula.
A exceção é **Z1732**, descrita adiante.

## Estrutura da aba

- O arquivo chama-se PPC.xlsx, mas a aba com os dados chama-se **Programação**.
- Linhas 1–2: cabeçalhos, alguns mesclados e outros com subtítulos por dia.
- Linha 3: conteúdo auxiliar, não uma atividade.
- Linhas 4–2447: **1.222 pares**, todos com Previsto seguido de Real na coluna R.
- Há **37.892 mesclagens**, incluindo cabeçalhos e dados. As mesclagens
  verticais observadas abrangem duas linhas.
- A atividade não corresponde a cada linha física: cada par deve originar
  **um registro semanal**, contendo as duas quantidades.

Exemplo: A10:D11 identifica uma atividade. R10 indica Previsto e R11 indica
Real. Z10 = 1 e Z11 = 0,5. A linha de destino deve conter previsto = 1,
realizado = 0,5, compartilhando o ID e a descrição do par.

## Mapeamento recomendado

| Campo de destino | Origem | Tratamento |
|---|---|---|
| ID do cronograma | A | Compartilhar dentro do par. Pode repetir entre atividades; não é a chave única da programação. |
| Local | B | Preservar para contextualizar e diferenciar atividades. |
| Disciplina | C; AY também contém disciplina | Usar a coluna escolhida na conferência; divergências entre cópias devem ser apontadas. |
| Nome da atividade | D | Preservar o texto completo, inclusive observações/restrições já incorporadas ao nome. |
| Líder imediato | G | Compartilhar dentro do par; ausência na origem permanece ausência. |
| Encarregado | H, ENCARREGADO / LIDER | Compartilhar dentro do par. |
| Fiscal de implantação | I | Não renomear silenciosamente como responsável: é um papel distinto. |
| Unidade de medida | P | Preservar: existem unidades, m, m², m³, t e %. Não somar grandezas diferentes. |
| Tipo de linha | R | Determina se a quantidade é prevista ou realizada. Não inferir apenas por número par/ímpar. |
| Quantidade prevista | Z da linha Previsto | Conferir com os dias contemplados pela fórmula. |
| Quantidade realizada | Z da linha Real | Conferir com os dias contemplados pela fórmula; preservar zero válido. |
| Lançamentos diários | S:Y | Preservar a associação dia/tipo; servem à conferência do total semanal. |
| Observações | AB | Compartilhar dentro do par. Não carregar a observação da atividade anterior. |
| Desvios e responsáveis por dia | AC:AP | Cabeçalho superior contém o dia; subtítulos alternam DESVIO e RESPONS. Manter essa associação. |
| Status Planejamento | AU | É calculado comparando Z do Previsto e do Real. Compartilhar o status dentro do par. |
| Semana | AV | Presente nas duas linhas de todos os pares. |
| Início da semana | AW | Presente nas duas linhas. Não confundir com E, início da atividade. |
| Término da semana | AX | Presente nas duas linhas. Não confundir com F, término da atividade. |

Os campos de porcentagem/índice em AA, AQ, AR e AS não são quantidades.
Valores fracionários devem manter a unidade da origem: 0,5 pode ser parte de
uma unidade, e não significa necessariamente que a coluna seja percentual.

## Regra para preencher para baixo

1. Identificar o cabeçalho e os subtítulos sem tratar a segunda linha do
   cabeçalho como dado.
2. Ler as mesclagens, recuperar o valor da célula superior esquerda e
   disponibilizá-lo nas demais células **do mesmo intervalo mesclado**.
3. Identificar os pares pelo TIPO, conferir sua sequência e a semana e
   associar o Real ao Previsto do mesmo bloco.
4. Compartilhar os campos descritivos dentro desse par, inclusive quando o
   formato usa uma célula vazia em vez de mesclagem explícita.
5. Manter Q, R, S:Y e Z separados por tipo. Nunca preencher uma quantidade
   vazia com a quantidade da outra linha.
6. Não atravessar a fronteira para a atividade seguinte nem mudar de semana
   ao preencher. Campo vazio na própria linha Previsto não possui um valor
   original que possa ser recuperado da mesclagem.

Os campos AV, AW e AX já estão preenchidos nas duas linhas de todos os pares
do arquivo analisado. Não precisam de preenchimento para baixo nesta cópia.

## Ausências e inconsistências que exigem conferência

### Um previsto não pode ser determinado automaticamente

W1732 tem `#VALUE!`. Sua fórmula é
`O1730+O1728+O1726+O1724+O1722`, mas essas células O contêm o texto `S`
(atividade crítica). O erro chega a Z1732 e Q1732.

O par é da atividade **A3080 / S27**, linhas 1732–1733. O realizado salvo em
Z1733 é **1,47**, mas o previsto está inválido. Não é correto substituir o
erro por zero ou copiar o previsto de outra atividade. Mostrar a pendência
com a célula de origem e solicitar a correção do valor/fórmula na planilha.

Há outros erros nos índices, observações e Q. Eles não devem invalidar uma
quantidade Z válida por associação, nem ser silenciosamente convertidos em
um apontamento zero. Deve-se distinguir o campo afetado e preservar a origem.

### Campos realmente ausentes

- **17 IDs** vazios na própria linha Previsto: 504, 632, 972, 1658, 1676,
  1678, 1890, 1892, 1932, 2014, 2062, 2236, 2258, 2260, 2262, 2278 e 2404.
- **48 atividades sem unidade**.
- **5 atividades sem encarregado**, **1 sem líder imediato** e **1 sem fiscal**.
- Nome da atividade, local, disciplina, semana e datas semanais estão
  presentes em todos os pares.

Não preencher esses IDs com o ID da atividade anterior sem uma regra de
negócio confirmada. Exibir “ID não informado” e manter identificação interna
e referência à linha de origem é uma opção para permitir sua conferência.

### ID repetido não significa duplicata

Há 214 grupos de ID + semana + início repetidos, abrangendo 595 pares.
Parte deles é composta por atividades diferentes do mesmo cronograma.

Mesmo ID, nome, local e semana não bastam: as linhas 302 e 306 têm o mesmo
ID A54250 e o mesmo nome/local, mas uma mede **t** e a outra **%**. Juntá-las
misturaria grandezas. As linhas 70 e 72, por outro lado, são candidatas a
duplicata e precisam ser conferidas, não eliminadas automaticamente.

Cada bloco de programação precisa de identidade interna própria e origem
(arquivo, aba, linhas Previsto/Real). Reimportação idêntica deve ser
idempotente; conciliar versões alteradas exige uma regra explícita de
casamento e tratamento das repetições.

### 6M+S e responsável

Não existe um cabeçalho único 6M+S na aba. Existem desvios por dia, como falta
de material, condição meteorológica e baixa produtividade. RESPONS. registra
organizações/responsabilidades, como IMC, VALE e COMPARTILHADA.

Preservar dia + desvio + responsável como dados da origem. Uma classificação
em 6M+S precisa de um mapeamento definido, mantendo o desvio original. Não
trocar automaticamente uma organização pelo nome do fiscal ou encarregado.

## Ajustes necessários no importador atual

O importador atual foi feito para uma linha por atividade, com quantidades
em duas colunas separadas. Essa premissa não corresponde ao arquivo real.

- Expor as mesclagens e erros de célula no leitor, além dos valores.
- Reconhecer os cabeçalhos ID CRONOGRAMA, ATIVIDADES e ENCARREGADO / LIDER,
  além do cabeçalho hierárquico de desvios e responsáveis.
- Normalizar os pares Previsto/Real antes da conferência e da validação.
- Obter previsto e realizado de Z, mantendo dias e unidade para auditoria.
- Mostrar uma prévia por atividade, com referências às duas linhas da origem.
- Tratar faltantes e erros separadamente de zeros e campos opcionais vazios.
- Rever a regra de unicidade e a política de reimportação para não bloquear
  ou apagar atividades diferentes com o mesmo ID de cronograma.
- Testar os exemplos 10–11, 1546–1547, 1612–1613 e o erro 1732–1733, além
  dos IDs ausentes, medidas distintas e preenchimento limitado ao par.

Critério de aceite: reconhecer os **1.222 pares**, conferir todos os
**2.444 totais**, obter **2.443 quantidades verificáveis** e apresentar
**uma quantidade prevista inválida**, sem inventar valor para essa exceção.
