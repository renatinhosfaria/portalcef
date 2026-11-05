# Relatório da correção final — versões de mapa

**Data:** 2026-11-04
**Branch:** `feat/eventos-versoes-mapa`
**Parecer corrigido:** `final-review.md`

## Correções

- A publicação direta de evento valida todas as sessões contra `event.defaultMapId`; mapas diferentes e `null` em evento com mapa confirmado são recusados com `SESSION_MAP_MISMATCH`. As regras de publicação e a prontidão usam a mesma igualdade estrita. O mapa público também filtra o inventário pelo mapa da sessão.
- `excluirVersao` identifica sessões legadas pelo inventário que aponta para assentos da versão excluída, migra essas sessões para a versão atual antes da exclusão e `listar` exibe a sessão na versão inferida pelo inventário.
- `sincronizarInventarioMapa` passou a executar em transação quando disponível, bloqueia evento e sessões e revalida o `mapId` depois da leitura do inventário e antes de inserir. O teste de interleaving confirma que assento antigo não é reinserido.
- `editarProposta` adquire os locks globais e aplica `carregarTrava`, recusando `VENDA_CONFIRMADA`, `COMPRA_EM_ANDAMENTO` e `OPERACAO_ATIVA` antes de gravar. O painel desabilita edição de lugares, fileiras, legenda, pontos, inclusão e reenvio quando a trava está ativa.
- O objeto aninhado de `criarEventoSchema.sessions` agora usa `.strict()` e recusa `mapId` com `safeParse`.

## TDD e testes de regressão

Os testes novos foram executados em RED antes da implementação:

- schema aninhado: `criarEventoSchema.safeParse` retornava `success: true` para `mapId`;
- publicação direta: a promessa resolvia e atualizava o evento em sessão v2 ou `null`;
- sincronização: o inventário antigo era inserido após a troca simulada de mapa;
- exclusão/listagem: sessão `mapId: null` não era migrada nem listada pelo inventário antigo;
- edição/proposta: as três travas não impediam a gravação;
- painel: controles de edição permaneciam habilitados.

Depois das correções, os mesmos testes passaram.

## Verificação executada

- `pnpm turbo lint && pnpm turbo typecheck` — **22 tarefas de lint e 22 de typecheck concluídas com sucesso** (há avisos preexistentes de ESLint).
- API focada: `eventos.service.spec.ts`, `eventos-rules.service.spec.ts`, `eventos-readiness.service.spec.ts`, `mapas.service.spec.ts`, `mapas.controller.spec.ts`, `levar-sessoes.spec.ts` — **6 suítes, 139 testes passando**.
- Painel focado: suíte `features/eventos/conferencia` e páginas de mapa/sessões — **6 arquivos, 47 testes passando**.
- Shared: `packages/shared/src/schemas/eventos-mapa.test.ts` — **3 testes passando**.

A execução focada da API registrou apenas o aviso ambiental já conhecido de worker que precisou ser encerrado à força; não houve falha de teste.

Atualizado em: 2026-11-04
