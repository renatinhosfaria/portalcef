# Fluxo de Provas Direto para Analise - Design

## Objetivo

Alterar o fluxo das provas para refletir o processo fisico real: depois que a gestao imprime todos os documentos, a prova vai diretamente para analise pedagogica no portal. A professora recebe a prova fisicamente, responde o gabarito fisicamente e entrega para a analista pedagogica fora do sistema.

## Fluxo aprovado

O fluxo normal de provas passa a ser:

```text
RASCUNHO -> AGUARDANDO_IMPRESSAO -> AGUARDANDO_ANALISTA -> APROVADO
                                                  |
                                                  v
                                         DEVOLVIDO_ANALISTA
```

A etapa `AGUARDANDO_RESPOSTA` deixa de ser uma etapa ativa do portal. Ela pode continuar existindo temporariamente por compatibilidade historica, mas nao deve ser promovida nas telas como caminho normal.

## Regras de gestao

Na tela de gestao da prova, o cartao "Fluxo de Impressao" deve orientar que a gestao imprima todos os documentos e envie a prova para analise pedagogica.

O botao principal muda de "Enviar para Resposta" para "Enviar para Analise".

Esse botao fica habilitado somente quando todos os documentos imprimiveis da prova estiverem com impressao confirmada no portal (`printedAt` preenchido). Se faltar algum documento, a tela deve informar quantos documentos ainda precisam ser impressos.

A API deve validar a mesma regra. Mesmo que alguem chame o endpoint diretamente, uma prova em `AGUARDANDO_IMPRESSAO` so pode ir para `AGUARDANDO_ANALISTA` se todos os documentos imprimiveis estiverem impressos.

## Regras da analista

A tela de analise de provas deve espelhar a tela de analise dos planos de aula, com textos adaptados ao dominio "prova".

Funcionalidades esperadas:

- visualizar documento;
- editar Word;
- comentar;
- aprovar documento;
- desfazer aprovacao;
- imprimir e registrar impressao;
- regerar PDF de impressao quando necessario;
- ver marcacao de documento impresso;
- ver estado de PDF em preparacao;
- enviar documento corrigido;
- adicionar link;
- visualizar historico;
- aprovar prova;
- devolver para professora;
- criar tarefa vinculada a prova.

## Tarefas vinculadas a prova

O modulo de tarefas sera ampliado com `provaId` no contexto da tarefa. A tarefa continuara com `modulo: PLANEJAMENTO`, mas podera carregar um vinculo real com a prova, alem de turma, etapa e professora quando disponiveis.

## Migracao

Todas as provas que estiverem em `AGUARDANDO_RESPOSTA` no momento da implantacao devem ser migradas para `AGUARDANDO_ANALISTA`, porque a etapa de resposta no portal nao faz mais sentido para o fluxo novo.

## Criterios de aceite

- Gestao nao consegue enviar prova para analise enquanto houver documento imprimivel sem impressao confirmada.
- Gestao consegue enviar prova totalmente impressa para `AGUARDANDO_ANALISTA`.
- Prova enviada pela gestao aparece na fila da analista.
- Tela da analista de provas tem os mesmos controles da tela da analista de planos, incluindo criar tarefa vinculada a prova.
- Tarefas manuais aceitam contexto com `provaId`.
- Provas antigas em `AGUARDANDO_RESPOSTA` sao migradas para `AGUARDANDO_ANALISTA`.
