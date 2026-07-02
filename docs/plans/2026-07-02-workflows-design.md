# Modulo Workflows - Design

## Objetivo

Criar um modulo independente de Workflows para registrar, orientar e acompanhar processos internos da escola, como eventos, envio de documentos, entrada de aluno novo, Educacenso e inicio de ano letivo.

O modulo deve substituir o uso informal de ferramentas externas para protocolos operacionais, mantendo orientacoes, checklist, anexos e historico dentro do portal.

## Conceitos

### Workflow modelo

Um workflow modelo e o protocolo reutilizavel da unidade. Ele define:

- nome;
- categoria;
- descricao curta;
- status do modelo;
- blocos flexiveis de orientacao;
- fases;
- etapas.

O modelo pode estar em `RASCUNHO`, `PUBLICADO` ou `INATIVO`.

- `RASCUNHO`: visivel apenas para gestao, ainda em montagem.
- `PUBLICADO`: disponivel para usuarios iniciarem.
- `INATIVO`: indisponivel para novas execucoes, mantendo historico.

### Execucao de workflow

Uma execucao de workflow nasce quando um usuario inicia um workflow publicado e informa um titulo, por exemplo `Evento Dia dos Pais 2027`.

A execucao acompanha o modelo atual. Se a gestao alterar o modelo publicado, execucoes abertas recebem a alteracao. Se uma etapa ja concluida for alterada no modelo, essa etapa volta para pendente na execucao.

## Permissoes

O modulo fica disponivel no menu como `Workflows`, na rota `/workflows`, para todos os usuarios autenticados da unidade.

Todos os usuarios com acesso ao modulo podem:

- ver workflows publicados da unidade;
- iniciar execucoes reais;
- marcar etapas das proprias execucoes como concluidas ou pendentes;
- registrar observacao por etapa nas proprias execucoes;
- anexar arquivos em execucoes visiveis;
- remover anexos em execucoes visiveis;
- cancelar as proprias execucoes com motivo obrigatorio.

A gestao pode:

- criar, editar, publicar, inativar e duplicar workflows modelo;
- editar categorias;
- iniciar execucoes de teste de rascunho;
- ver todas as execucoes da unidade;
- editar titulo de qualquer execucao da unidade;
- anexar e remover arquivos em qualquer execucao visivel;
- cancelar qualquer execucao da unidade com motivo obrigatorio;
- reabrir execucao concluida com motivo obrigatorio.

Roles de gestao:

- `master`;
- `diretora_geral`;
- `gerente_unidade`;
- `coordenadora_geral`.

Usuarios comuns veem apenas as proprias execucoes. Gestao ve todas as execucoes da unidade.

## Escopo por unidade

Workflows, categorias, modelos e execucoes pertencem a uma unidade.

O isolamento de tenant deve vir sempre da sessao (`schoolId` e `unitId`). Payload enviado pelo app nunca deve decidir escola ou unidade.

## Categorias

A biblioteca de workflows tera categorias e busca.

Categorias sao padrao editaveis por unidade. O sistema deve nascer com sugestoes como:

- Eventos;
- Documentos;
- Matricula;
- Pedagogico;
- Administrativo.

A gestao pode criar, renomear e inativar categorias em uma tela ou modal simples.

Cada categoria pode ter sugestoes fixas de fases e etapas. Ao escolher uma categoria no editor de workflow, o sistema preenche automaticamente fases e etapas sugeridas. A gestao pode excluir, adicionar, editar e mover fases ou etapas livremente.

## Estrutura do workflow

### Blocos flexiveis de orientacao

Cada workflow possui blocos de orientacao configuraveis pela gestao. Cada bloco tem titulo, conteudo e ordem.

Exemplos para um workflow de evento:

- Objetivo;
- Publico;
- Materiais;
- Comunicacao com pais;
- Responsaveis.

Exemplos para envio a Superintendencia:

- Documentos necessarios;
- Onde enviar;
- Como acompanhar aprovacao;
- Prazo esperado.

Nao havera campos obrigatorios fixos como `O que`, `Como`, `Quando`, `Onde` e `Quem`. Esses nomes podem ser usados como sugestoes, mas cada workflow monta sua propria estrutura.

### Fases

Fases agrupam etapas e possuem apenas nome e ordem.

Exemplos:

- Preparacao;
- Comunicacao;
- Execucao;
- Finalizacao.

O nome da fase funciona como status visual intermediario da execucao, por exemplo `Em Comunicacao`, mas nao como status tecnico rigido.

### Etapas

Cada etapa possui:

- titulo;
- instrucao opcional;
- ordem dentro da fase.

Nao havera responsavel por etapa no MVP. O checklist e interno da execucao e nao cria tarefas automaticas no modulo Tarefas.

## Comportamento da execucao

Status tecnico da execucao:

- `EM_ANDAMENTO`;
- `CONCLUIDA`;
- `CANCELADA`.

A fase atual e calculada pelo checklist:

- quando todas as etapas de uma fase sao concluidas, a execucao avanca automaticamente para a proxima fase;
- quando todas as fases estao concluidas, a execucao fica pronta para finalizar;
- mesmo com tudo concluido, o usuario ainda precisa clicar em `Concluir workflow`;
- a conclusao so e permitida quando todas as etapas estao concluidas.

Cancelamento exige motivo obrigatorio. Quem iniciou pode cancelar a propria execucao. Gestao pode cancelar qualquer execucao da unidade.

Reabertura de execucao concluida exige motivo obrigatorio e e permitida somente para gestao.

Execucoes de teste de workflows em rascunho sao isoladas, visiveis apenas para gestao e descartaveis.

## Telas

### Tela principal `/workflows`

A tela principal possui tres abas:

- `Workflows`: biblioteca de modelos publicados;
- `Em andamento`: execucoes abertas;
- `Concluidos`: execucoes finalizadas.

Nao havera dashboard separado no MVP. As abas podem exibir contadores.

Cards da biblioteca exibem:

- nome;
- categoria;
- descricao curta.

### Editor de workflow

Editor simples para gestao, com:

- dados basicos do modelo;
- categoria;
- status;
- blocos flexiveis de orientacao;
- fases;
- etapas.

O editor deve permitir:

- adicionar fase;
- adicionar etapa dentro da fase;
- excluir fase;
- excluir etapa;
- mover fase para cima ou baixo;
- mover etapa para cima ou baixo dentro da fase;
- editar nome de fase;
- editar titulo e instrucao de etapa;
- duplicar workflow modelo.

### Tela da execucao

A tela de execucao possui cabecalho com:

- titulo da execucao;
- workflow usado;
- status geral;
- fase atual;
- acoes disponiveis.

Dentro da execucao ha abas internas:

- `Orientacoes`;
- `Checklist`;
- `Anexos`;
- `Historico`.

Na aba `Orientacoes`, o usuario ve os blocos flexiveis do modelo atual.

Na aba `Checklist`, o usuario ve fases e etapas, marca etapa como concluida ou pendente e registra observacao por etapa.

Na aba `Anexos`, ficam arquivos gerais da execucao, nao ligados a etapas. Qualquer usuario que veja a execucao pode anexar e remover arquivos. A implementacao deve respeitar limite padrao do sistema e validacoes tecnicas de seguranca.

Na aba `Historico`, aparece auditoria detalhada da execucao.

Se o modelo for atualizado enquanto a execucao estiver aberta, a execucao deve exibir o aviso:

```text
Este workflow foi atualizado pela gestao. Revise as etapas pendentes.
```

## Historico

O historico deve registrar eventos detalhados:

- workflow iniciado;
- etapa marcada como concluida;
- etapa marcada como pendente;
- observacao de etapa alterada;
- anexo enviado;
- anexo removido;
- titulo da execucao editado;
- workflow modelo atualizado;
- execucao concluida;
- execucao cancelada;
- execucao reaberta.

Eventos de cancelamento e reabertura registram motivo obrigatorio.

## Arquitetura

Criar app independente `apps/workflows`, servido em `/workflows`, usando:

- Next.js App Router;
- `TenantProvider`;
- `Shell` compartilhado;
- sidebar compartilhada;
- chamadas HTTP para API.

O app nao acessa banco diretamente.

Na API, criar modulo `workflows` em `services/api/src/modules/workflows`, com endpoints para:

- categorias;
- workflows modelo;
- orientacoes;
- fases;
- etapas;
- execucoes;
- progresso do checklist;
- anexos;
- historico.

Os guards e services devem usar `schoolId` e `unitId` da sessao para isolamento.

## Modelo de dados proposto

Tabelas principais:

- `workflow_categorias`: categorias por unidade, nome, status ativo/inativo e ordem.
- `workflow_modelos`: modelo do workflow, categoria, status, descricao curta, unidade e auditoria.
- `workflow_orientacoes`: blocos flexiveis do modelo, titulo, conteudo e ordem.
- `workflow_fases`: fases do modelo, nome e ordem.
- `workflow_etapas`: etapas do modelo, titulo, instrucao opcional, ordem e controle de atualizacao.
- `workflow_execucoes`: execucao iniciada por usuario, titulo, status, flag de teste e auditoria.
- `workflow_etapa_progresso`: progresso por etapa em cada execucao, observacao e conclusao.
- `workflow_anexos`: anexos gerais da execucao.
- `workflow_historico`: eventos detalhados da execucao.

Como a execucao acompanha o modelo atual, orientacoes, fases e etapas ficam no modelo. A execucao guarda progresso, observacoes, anexos e historico.

Quando uma etapa do modelo muda, a API deve resetar o progresso dessa etapa nas execucoes abertas e registrar historico.

## Fora do MVP

Nao faz parte do MVP:

- criar tarefas automaticas no modulo Tarefas;
- responsavel por etapa;
- dependencias entre etapas;
- dashboard com graficos;
- duplicar execucao;
- comentarios gerais da execucao;
- anexos por etapa;
- sugestoes por IA;
- arrastar e soltar fases ou etapas.

## Criterios de aceite

- Todos os usuarios autenticados da unidade conseguem acessar `/workflows`.
- Usuarios comuns veem workflows publicados e conseguem iniciar execucoes reais.
- Usuarios comuns veem apenas as proprias execucoes.
- Gestao ve todas as execucoes da unidade.
- Apenas gestao cria, edita, publica, inativa, duplica e testa workflows modelo.
- Workflow em rascunho nao aparece para usuarios comuns iniciarem.
- Gestao consegue iniciar execucao de teste de rascunho e descarta-la.
- Categorias padrao existem por unidade e podem ser editadas pela gestao.
- Escolher categoria preenche sugestoes fixas de fases e etapas.
- Gestao consegue editar, excluir, adicionar e mover fases e etapas sugeridas.
- Execucao iniciada pede apenas titulo.
- Execucao possui abas `Orientacoes`, `Checklist`, `Anexos` e `Historico`.
- Concluir etapa avanca fase automaticamente quando a fase fica completa.
- Concluir workflow exige todas as etapas concluidas e clique explicito.
- Cancelar execucao exige motivo.
- Reabrir execucao concluida exige motivo e e permitido apenas para gestao.
- Editar etapa do modelo publicado reseta essa etapa em execucoes abertas.
- Execucao aberta mostra aviso quando o modelo foi atualizado.
- Usuario pode registrar observacao por etapa.
- Anexos sao gerais da execucao.
- Qualquer usuario que veja a execucao pode anexar e remover arquivos.
- Historico mostra eventos detalhados da execucao.
- Apps nao acessam banco diretamente; toda operacao passa pela API HTTP.
