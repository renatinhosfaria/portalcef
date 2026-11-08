# Relatório da Tarefa 3

## Implementação

- Atualizados `PublicSeat` e `PublicMap` para expor rotação opcional e layout opcional/nulo.
- `getPublicMap` agora lê `seat.metadata.rotacao`, normaliza valores não finitos para `0` e monta o layout confirmado do mapa.
- Layout ausente ou malformado é retornado como `null`; rótulos são filtrados às fileiras que possuem assentos na sessão, preservando elementos de palco, entrada e saída.
- Fixtures existentes foram preservados; o fake DB dos testes passou a suportar joins usados pelo método.

## Testes TDD

- RED: `pnpm --filter @essencia/api test -- eventos.service.spec` falhou inicialmente porque o fake DB não suportava `innerJoin` e porque o método ainda não retornava layout/rotação.
- GREEN: `pnpm --filter @essencia/api test -- eventos.service.spec` — 2 suítes, 49 testes passando.
- `pnpm turbo lint` — 21 tarefas concluídas, somente avisos preexistentes.
- `pnpm turbo typecheck` — 22 tarefas concluídas.

## Commit

`feat(eventos): mapa público com palco, letras e rotação`

Atualizado em: 2026-11-08
