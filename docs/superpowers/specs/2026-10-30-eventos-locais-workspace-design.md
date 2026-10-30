# Cadastro de locais no Workspace de eventos

## Intenção

Permitir que o organizador cadastre e escolha o local padrão diretamente na etapa “Sessões e local”, eliminando o bloqueio atual em que a sessão não tem opções para selecionar.

## Objetivos

- Cadastrar locais vinculados à escola do evento.
- Definir um local padrão para o evento.
- Editar dados do local sem alterar sessões que usam uma exceção.
- Fazer sessões herdadas (`locationId = null`) usarem automaticamente o novo padrão.
- Atualizar a prontidão após salvar o local ou trocar o padrão.

## Fora do escopo

- Cadastro global de locais fora do contexto de eventos.
- Exclusão física de locais já usados por sessões.
- Alteração automática de sessões com local específico.

## Experiência

No topo de “Sessões e local”, antes dos cartões, exibir o bloco “Locais do evento”. O bloco lista os locais disponíveis com nome, endereço e sala. Cada item mostra seu estado (“Padrão” ou “Disponível”), oferece “Usar como padrão” e “Editar”.

O botão “Adicionar local” abre um formulário inline ou modal com nome obrigatório, endereço obrigatório, sala opcional, instruções e acessibilidade. Após salvar, o local aparece imediatamente na lista e fica disponível nos cartões de sessão. Ao definir o padrão, a interface confirma a escolha, atualiza a indicação visual e refresca a prontidão.

Se não houver locais, o bloco explica que o local padrão precisa ser cadastrado antes de concluir as sessões e oferece o botão de cadastro. Os cartões continuam permitindo “Usar local padrão” ou “Escolher outro local”.

## API proposta

- `GET /eventos/admin/:id/locais`: lista locais da escola do evento e informa `isDefault`.
- `POST /eventos/admin/:id/locais`: cria local com `name`, `address`, `room`, `instructions` e `accessibility`.
- `PATCH /eventos/admin/:id/locais/:locationId`: edita local dentro do escopo da escola.
- `PATCH /eventos/admin/:id/local-padrao`: define `defaultLocationId`, validando que o local pertence à escola do evento; aceita `null` apenas para remover o padrão.

Todas as mutações exigem autenticação, escopo da escola e auditoria. Um local usado por sessão não pode ser excluído nesta etapa; a edição preserva o ID.

## Prontidão e concorrência

Salvar ou definir o padrão chama `router.refresh()` após a resposta bem-sucedida. Atualizações concorrentes usam `expectedUpdatedAt` do evento quando a mutação altera o padrão; conflitos preservam o formulário e informam que o evento mudou.

## Dados

A entidade existente `eventoLocais` será reutilizada. O evento continua guardando `defaultLocationId`. Sessões herdadas permanecem com `locationId` nulo; sessões com exceção mantêm seu `locationId`.

## Critérios de aceite

- É possível cadastrar um local dentro do Workspace.
- O local aparece nos seletores dos cartões de sessão.
- É possível definir e trocar o local padrão.
- Sessões herdadas usam o novo padrão; exceções permanecem intactas.
- A prontidão deixa de apontar “Sessões e local” como pendente quando os demais requisitos estiverem atendidos.
- Erros de validação, escopo e conflito são exibidos sem perder os dados digitados.
