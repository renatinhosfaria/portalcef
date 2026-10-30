# Relatório da Task 1 — API e contratos de locais

## Status

Concluída.

## Implementação

- Adicionado `localEventoSchema` estrito, com tipos para criação/edição e contrato de alteração do local padrão.
- Criadas as rotas administrativas:
  - `GET /eventos/admin/:id/locais`
  - `POST /eventos/admin/:id/locais`
  - `PATCH /eventos/admin/:id/locais/:locationId`
  - `PATCH /eventos/admin/:id/local-padrao`
- Operações de serviço limitadas à escola do evento, usando `assertSchoolScope` e validando o pertencimento de cada local.
- Cadastro, edição e troca do padrão atualizam a versão do evento e registram auditoria dentro de transação.
- `expectedUpdatedAt` rejeita conflito com `VERSION_CONFLICT`; local inexistente e local de outra escola são rejeitados antes da mutação.
- Não foi criada exclusão de locais.

## TDD e validação

- RED confirmado antes da implementação: os testes falharam porque schema, métodos e rotas ainda não existiam.
- Testes focados: `40 passed` em `eventos.service.spec.ts` e `eventos.controller.spec.ts`.
- Suíte completa da API: `93 suites passed`, `954 tests passed`.
- `pnpm lint` na API: passou.
- `pnpm typecheck` na API: passou.
- `git diff --check`: passou.

## Commit

`feat: adiciona api de locais do evento`

## Preocupações

- O build do pacote compartilhado foi executado antes do typecheck para atualizar as declarações geradas locais; os artefatos `dist` são gerados e não fazem parte do commit.
- A suíte completa emite logs de erro esperados por testes de regressão, mas terminou sem falhas.
