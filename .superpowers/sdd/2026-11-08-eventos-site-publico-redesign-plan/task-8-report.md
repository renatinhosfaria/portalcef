# Relatório da Tarefa 8 — número curto na emissão do ingresso

## Resultado

- A emissão de ingressos agora preenche `numero` com `gerarNumeroIngresso()` antes do insert em `eventoIngressos`.
- O teste verifica oito caracteres usando exatamente o alfabeto permitido (`ABCDEFGHJKMNPQRSTUVWXYZ2-9`).

## Evidência TDD

- RED: `pnpm --filter @essencia/api test -- eventos-pagamentos.service.spec.ts --runInBand` falhou no novo teste porque `numero` estava indefinido.
- GREEN: o mesmo comando passou com 1 suíte e 15 testes.

## Verificações

- `pnpm turbo lint`: PASSA (21 tarefas; somente avisos preexistentes).
- `pnpm turbo typecheck`: PASSA (22 tarefas).
- `git diff --check`: PASSA.

## Commit

`393100a feat(eventos): número curto no ingresso`

## Arquivos

- `services/api/src/modules/eventos/eventos-pagamentos.service.ts`
- `services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts`

Atualizado em: 2026-11-08
