# Relatório da Tarefa 1

## Status
Concluída no commit `0116839` (`feat: adiciona contratos de rascunho e prontidao de eventos`).

## Entregas

- Adicionados `criarRascunhoSchema` e `atualizarRascunhoSchema`, com exportação pelo barrel compartilhado.
- Criada a rota `POST /eventos/admin/rascunhos` para criar evento mínimo com slug normalizado e único por escola.
- Ajustado o `PATCH /eventos/admin/:id` para autosave parcial, controle por `updatedAt`/`expectedUpdatedAt`, conflito explícito e proteção de slug publicado.
- Criado `GET /eventos/admin/:id/prontidao` com checklist de textos, sessões, locais, mapas, inventário vendável, ingressos, políticas e estado.
- Inventário considera somente `DISPONIVEL` e `LIBERADO`, comparando a capacidade da sessão.
- Mantida a validação de tenant e registrada a cobertura focada do contrato/readiness.

## Verificações

- `pnpm --filter @essencia/shared build` — passou.
- `pnpm --filter @essencia/api test -- --runInBand eventos.controller.spec.ts eventos-readiness.service.spec.ts` — 2 suítes, 4 testes passando.
- `pnpm --filter @essencia/api typecheck` — passou.

## Preocupações

- O typecheck da API depende do build prévio de `@essencia/shared` porque o workspace resolve os tipos publicados em `packages/shared/dist`; o build foi executado antes da verificação.
- Permanecem não versionados neste commit os documentos de plano/especificação já existentes no worktree.

Atualizado em: 2026-10-29

## Fix report — rodada 1

### Correções

- Corrigido o código de contrato para `EVENT_SLUG_IMMUTABLE`.
- PATCH agora preserva slug editado manualmente e retorna `slugSuggestion` ao trocar o título; slugs automáticos acompanham o título enquanto o evento não foi publicado.
- O controle de versão passou a incluir `updatedAt` no predicado do `UPDATE`; se nenhuma linha for atualizada com a versão esperada, a API retorna `VERSION_CONFLICT`.
- A regra de tenant foi centralizada em `assertSchoolScope`, reutilizada pelo serviço de prontidão e pelo serviço principal.
- Acrescentados testes comportamentais para criação/slug, tenant divergente, readiness, slug imutável, sugestão e conflitos de versão, incluindo corrida após leitura inicial.

### Comandos e resultados

- `pnpm --filter @essencia/shared build` — passou.
- `pnpm --filter @essencia/api test -- --runInBand --no-cache eventos.service.spec.ts eventos.controller.spec.ts eventos-readiness.service.spec.ts` — 4 suítes, 19 testes passando.
- `pnpm --filter @essencia/api typecheck` — passou.

Atualizado em: 2026-10-29
