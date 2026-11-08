# Relatório da Tarefa 1

## Implementação

- Criado `@essencia/shared/eventos/ingresso` com alfabeto sem caracteres ambíguos, geração criptograficamente aleatória por padrão, formatação e normalização de números de ingresso.
- Acrescentados os contratos públicos `PublicMapLayout`, `ItemPedidoPublico`, `IngressoPublico`, `PagamentoEmbutidoResult` e `MeusIngressosResult` em `@essencia/shared/types`.
- Acrescentados `pagamentoEmbutidoSchema` e `meusIngressosSchema`, com seus tipos inferidos, preservando `checkoutPublicoSchema` e os demais contratos legados.
- Exportações adicionadas em `packages/shared/src/schemas/index.ts` e no campo `exports` de `packages/shared/package.json`.

## Arquivos

- `packages/shared/src/eventos/ingresso.ts`
- `packages/shared/src/eventos/ingresso.test.ts`
- `packages/shared/src/schemas/eventos-publico.test.ts`
- `packages/shared/src/schemas/eventos.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/types/eventos.ts`
- `packages/shared/package.json`

## Evidência TDD

1. RED: `pnpm --filter @essencia/shared test` falhou nos dois novos arquivos: módulo `./ingresso` inexistente e schemas ainda indefinidos (5 testes falhando; 35 testes legados passando).
2. GREEN: após a implementação, o mesmo comando passou com 9 arquivos, 45 testes e 0 falhas.

## Verificações

- `pnpm --filter @essencia/shared test`: PASSA (45/45).
- `pnpm turbo typecheck`: PASSA (22/22 tarefas).
- `pnpm turbo lint`: PASSA (21/21 tarefas; avisos preexistentes, 0 erros).
- `git diff --check`: PASSA.

## Self-review

- O alfabeto usado é exatamente `ABCDEFGHJKMNPQRSTUVWXYZ23456789` e a geração produz oito caracteres.
- A normalização remove separadores e espaços, converte para maiúsculas e rejeita tamanho ou caracteres fora do alfabeto.
- Os schemas usam `.strict()`, URL HTTPS e limites de tamanho pedidos, sem remover o checkout legado.
- Os tipos adicionados são somente acréscimos em `eventos.ts`.

## Preocupações

- O lint global mantém avisos já existentes em outros pacotes; não foram introduzidos erros de lint por esta tarefa.

Atualizado em: 2026-11-08
