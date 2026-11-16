# Relatório da Task 2 — Remover configuração administrativa de ofertas

## Status

Implementação concluída e commitada. A página administrativa de ingressos permanece com ingressos e cupons, sem seção, carregamento ou autosave de ofertas. As rotas administrativas de ofertas, o editor, os contratos e o serviço foram removidos.

## Alterações

- Removidos estados, effects, autosave e renderização de ofertas da página de ingressos.
- Mantidos carregamento, edição, exclusão e autosave de cupons.
- Removidos `GET/PATCH /eventos/admin/:id/ofertas` do controller.
- Removido `EventosOfertasService` do módulo e excluídos serviço/testes correspondentes.
- Removidos editor e contratos administrativos de ofertas.
- Removidos schema/tipos exclusivos de edição administrativa (`atualizarOfertaSchema`, `AtualizarOfertaInput`, `EventoOfertaAdmin`).
- Mantidos `OfertaPrecoPublica` e `appliedOffer` para contratos históricos e respostas públicas.
- Atualizado o teste da página para exigir ausência da configuração de ofertas e teste do controller para exigir ausência das rotas.

## Verificação

- Testes focados não puderam iniciar porque as dependências locais do worktree estão ausentes (`vitest: not found`, `jest: not found`).
- Typecheck do pacote `@essencia/eventos-admin` também não pôde concluir pela mesma condição (dependências `next`, `react`, `vitest` e outras não instaladas).

## Preocupações

A validação automatizada completa deve ser repetida após instalar as dependências do monorepo. O `EventosService` mantém uma dependência opcional estrutural para leitura pública histórica de ofertas, sem registrar `EventosOfertasService` no módulo administrativo.

Atualizado em: 2026-11-16

## Fix round 1

- Reintroduzido o leitor interno `EventosOfertasPublicService`, limitado a `listarPublicas`, e registrado como provider do `EventosModule`.
- `EventosService` injeta esse leitor explicitamente para manter o detalhe público compilável e consistente enquanto a Task 3 ainda não remove seus consumidores. Nenhuma rota administrativa de ofertas ou capacidade de edição foi reexposta.
- Criados symlinks locais ignorados para os `node_modules` do worktree `cupons-desconto-eventos`, permitindo executar a validação sem instalar dependências duplicadas.

## Verificação da rodada

- `pnpm --filter @essencia/eventos-admin test -- app/eventos/[id]/ingressos/page.test.ts`: PASS — 1 arquivo, 8 testes.
- `pnpm --filter @essencia/api test -- eventos-admin.controller.spec.ts`: PASS — nenhum teste encontrado; comando encerrou com código 0 (`--passWithNoTests`).
- `pnpm --filter @essencia/eventos-admin typecheck && pnpm --filter @essencia/api typecheck && pnpm --filter @essencia/shared typecheck`: PASS.

Atualizado em: 2026-11-16
