# Plano de implementação: concorrência de eventos

> Execução: superpowers:executing-plans, tarefa por tarefa, com TDD e revisão final independente.

**Objetivo:** remover os gargalos de concorrência mantendo as invariantes das compras.
**Arquitetura:** bloqueios compartilhados de configuração; checkout em duas fases com preparação persistida; consultas públicas com EXISTS e cache curto de mapa.
**Stack:** NestJS, PostgreSQL 16, Drizzle, Jest.
**Especificação:** docs/superpowers/specs/2026-11-17-eventos-concorrencia.md

## Restrições globais
- PT-BR; aplicativos acessam dados somente pela API.
- Não executar carga, migrations ou compras em produção.
- Não aumentar pool sem medição que justifique.
- Executar pnpm turbo lint e pnpm turbo typecheck antes de commit.

## Foco de revisão
- Reservas de lugares diferentes progridem enquanto a primeira transação está aberta; mesmo lugar tem um vencedor.
- Alterações administrativas continuam excluídas durante validação compartilhada da configuração.
- Falha/timeout da Stripe preserva chave e parâmetros para retomada segura em outra instância.
- Liberação/expiração e webhook durante checkout não recriam pedido nem deixam venda sem reserva.
- Catálogo preserva preço padrão, disponibilidade e regras de publicação; cache falho não persiste.

### Tarefa 1: reservas e prova com PostgreSQL real
Arquivos: eventos-public-sales.service.ts; teste de integração e runner/configuração isolada.
- [x] Escrever reprodução de bloqueio entre reservas independentes e de disputa pelo mesmo assento.
- [x] Confirmar falha antes da correção.
- [x] Usar bloqueios compartilhados de configuração e exclusivos de inventário, ordenados.
- [x] Executar integração e regressão de reservas.

### Tarefa 2: checkout sem transação durante Stripe
Arquivos: eventos-public-sales.service.ts; schema/eventos.ts; migration; testes de checkout.
Interface: preparação persistida em evento_pagamentos, com parâmetros e chave idempotente.
- [x] Testar espera da Stripe sem transação, retomada em instâncias distintas, falha, cancelamento e webhook.
- [x] Confirmar falha; implementar preparação, chamada externa e confirmação em transações separadas.
- [x] Revalidar estado e propriedade antes de registrar; proteger liberação concorrente.
- [x] Rodar regressões de checkout, pagamentos, cupons e expiração.

### Tarefa 3: consultas públicas e mapa
Arquivos: eventos.service.ts; cache-publico-eventos.ts; testes unitários e integração.
- [x] Testar projeção sem multiplicação de inventário, preços e sessão, cache compartilhado por chamadas simultâneas e falhas.
- [x] Confirmar falha; implementar consultas com EXISTS e ingressos separados; cache de mapa 1s com limite de entradas.
- [x] Rodar testes do módulo e medição sintética com banco isolado.

### Tarefa 4: verificação e revisão
- [x] Executar testes de eventos e frontend; lint e typecheck globais.
- [x] Revisão independente do diff e correções comprovadas por testes.
- [x] Registrar resultados, limitações e instruções para migration/deploy futuro.

## Registro de execução
- Branch codex/eventos-concorrencia em .worktrees/eventos-concorrencia; produção permanece em main.
- Decisão: execução direta autorizada pelo pedido de correções após a recomendação; sem nova rodada de aprovação para escolhas internas reversíveis.
- Pré-verificação: tarefas 1 e 2 compartilham getOrder; o bloqueio de leitura do pedido deve restringir OF ao pedido para não serializar eventos.

- Tarefa 1 concluída: bloqueio entre lugares distintos reproduzido por lock_timeout; após SHARE, integração progrediu. Disputa pelo mesmo lugar continua tendo um vencedor.
- Tarefa 2 concluída: espera transacional e alteração dos parâmetros na repetição reproduzidas; preparação persistida, metadata da geração e chamadas externas sem transação verificadas. Revisão encontrou prazo mínimo tardio e webhook antigo; ambos foram reproduzidos e corrigidos.
- Tarefa 3 concluída: catálogo antigo transferiu 210 linhas no cenário com 100 assentos; consulta nova passou com menos de 100 linhas totais de fixtures. Cache consolidou 100 leitores e recuperou falha.
- Tarefa 4: 14 integrações, 501 testes de eventos/pagamentos (19 PDFs em processos separados) e 208 testes do app passaram. Lint sem erros, com avisos; typecheck global verificado. Revisão independente sem achados concretos remanescentes. Resultados e limitações em docs/EVENTOS_CONCORRENCIA.md.
- Decisão: banco de teste aplica migrations do módulo e dependências mínimas, pois histórico legado completo falha em FK units no banco vazio; não alterar esse histórico fora do escopo.
- Decisão: commits somente ao final, depois do pipeline global; não publicar em produção sem etapa posterior de integração e deploy com migration.
