# Relatório da Task 8 — Editor administrativo de cupons

## Status
Concluída.

## Implementação
- Criados contratos de domínio para cupons, normalização de código, payload versionado e validações de percentual, valor fixo, vigência e limites.
- Criado `CupomEditor` para código, nome, tipo, desconto, vigência, limites, ativo, usos confirmados e histórico; cupons usados não exibem exclusão.
- Integrada seção Cupons de desconto à etapa Ingressos com GET/PATCH autenticados, múltiplos cartões, autosave, estados de erro/conflito e atualização de versão.

## Testes
- `pnpm --filter @essencia/eventos-admin test -- features/eventos/cupons-contratos.test.ts features/eventos/cupom-editor.test.tsx app/eventos/[id]/ingressos/page.test.ts` — 11 testes aprovados.
- `pnpm --filter @essencia/eventos-admin typecheck` — aprovado.

## Preocupações
- Datas são convertidas para `Date` no payload para atender ao contrato compartilhado; inputs usam `datetime-local`.
