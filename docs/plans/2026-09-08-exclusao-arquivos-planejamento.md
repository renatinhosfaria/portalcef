# Exclusão justificada de arquivos no planejamento — Plano de Implementação

> **Para Claude:** SUB-SKILL obrigatória: usar `superpowers:executing-plans` para executar este plano tarefa por tarefa.

**Objetivo:** permitir que qualquer perfil com acesso ao módulo exclua arquivos enviados por upload em planos de aula, provas e relatórios, desde que o documento ainda não esteja aprovado e o usuário informe um motivo com pelo menos 10 caracteres.

**Arquitetura:** reaproveitar as três rotas e serviços existentes, centralizar o contrato de validação e a experiência do modal no módulo compartilhado, registrar `DOCUMENTO_EXCLUIDO` no histórico específico de cada tipo de planejamento e executar a remoção dos relacionamentos em transação. O storage será limpo fora da transação, de forma tolerante a falhas.

**Stack:** NestJS, Drizzle/PostgreSQL, class-validator, Next.js/React, Vitest, pnpm/Turbo.

**Referências:** [design validado](./2026-09-08-exclusao-arquivos-planejamento-design.md).

## Estado inicial e cuidados

- Trabalhar no worktree `/var/www/essencia/.worktrees/exclusao-arquivos-planejamento`, branch `codex/exclusao-arquivos-planejamento`.
- Preservar as alterações preexistentes do worktree principal, que são relacionadas a relatórios e não fazem parte desta feature.
- O baseline de `pnpm test` apresentou um timeout preexistente em `apps/home/app/page.test.tsx` no teste `marca links dos modulos como externos`; os testes de planejamento executados antes da interrupção não indicaram falha relacionada a esta feature.
- Antes de qualquer commit, executar `pnpm turbo lint && pnpm turbo typecheck` e registrar o resultado.
- Usar `apply_patch` para edições manuais e manter domínio, mensagens, comentários e commits em Português do Brasil.

## Tarefa 1: contrato de exclusão, validação e mensagens

**Arquivos:**

- Criar `services/api/src/common/dto/excluir-documento.dto.ts`.
- Criar `services/api/src/common/documento-exclusao.ts` e seu teste.
- Alterar `packages/shared/src/types/historico.ts`.
- Alterar `packages/db/src/schema/plano-aula-historico.ts`.
- Alterar `packages/db/src/schema/prova-historico.ts`.
- Alterar `packages/db/src/schema/relatorio-historico.ts`.
- Alterar `apps/planejamento/lib/mensagens-erro.ts` e `apps/planejamento/lib/mensagens-erro.test.ts`.

**RED:** escrever testes que demonstrem que o DTO rejeita motivo ausente, vazio e menor que 10 caracteres após `trim`; aceita motivo válido e preserva o valor normalizado. Testar também os códigos de erro da exclusão convertidos para mensagens claras em Português.

**GREEN:** implementar `ExcluirDocumentoDto` com `@IsString`, `@IsNotEmpty`, `@MinLength(10)` e transformação/normalização por `trim`. Criar constantes ou uma função comum para lançar `BadRequestException` com o código técnico de motivo inválido. Adicionar `DOCUMENTO_EXCLUIDO` às ações tipadas dos três históricos e ao tipo compartilhado. Mapear os códigos de motivo inválido, documento aprovado, link, permissão, não encontrado e falha inesperada em `obterMensagemErro`.

**Verificação:** executar os testes unitários criados e `git diff --check`.

**Commit:** `feat(planejamento): define contrato para exclusão de documentos`.

## Tarefa 2: exclusão de documentos de plano de aula

**Arquivos:**

- `services/api/src/modules/plano-aula/plano-aula.controller.ts`.
- `services/api/src/modules/plano-aula/plano-aula.service.ts`.
- `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`.
- `services/api/src/modules/plano-aula/plano-aula.controller.spec.ts`.
- `services/api/src/modules/plano-aula/plano-aula-historico.service.ts` e testes, se necessário para aceitar o executor transacional.

**RED:** adicionar testes para motivo inválido, documento aprovado, link do YouTube, documento fora do plano, falta de acesso, exclusão bem-sucedida e falha tolerada no storage. No sucesso, verificar remoção do documento, comentários e arquivos derivados, além de histórico `DOCUMENTO_EXCLUIDO` com ator, nome, tipo, tamanho e motivo. No controller, verificar recebimento e repasse do corpo e uso de todos os perfis que já podem acessar o planejamento.

**GREEN:** alterar a assinatura para receber sessão, identificadores e motivo; validar acesso com a sessão antes da mutação; localizar o documento pelo vínculo com o plano; bloquear aprovação e link; capturar metadados; remover original e PDF derivado via `StorageService`; executar exclusão de comentários, histórico e documento em transação; manter falhas do storage apenas em log. Atualizar a rota `DELETE /plano-aula/:id/documentos/:docId` para receber `ExcluirDocumentoDto` e autorizar `VISUALIZAR_ACCESS`.

**Verificação:** executar os testes de serviço e controller do plano de aula.

**Commit:** `feat(plano-aula): permite excluir documento com motivo`.

## Tarefa 3: exclusão de documentos de prova

**Arquivos:**

- `services/api/src/modules/prova/prova.controller.ts`.
- `services/api/src/modules/prova/prova.service.ts`.
- `services/api/src/modules/prova/prova.service.spec.ts`.
- `services/api/src/modules/prova/prova.controller.spec.ts`.
- `services/api/src/modules/prova/prova-historico.service.ts` e testes, se necessário para aceitar o executor transacional.

**RED:** cobrir os mesmos cenários da Tarefa 2 para prova: contrato do motivo, aprovação, link, vínculo, acesso, sucesso, limpeza do storage e histórico completo. Verificar que o controller repassa o motivo na rota atual.

**GREEN:** aplicar as regras ao serviço de prova, usando a sessão para o acesso e transação para histórico e registros relacionais. Atualizar `DELETE /prova/:id/documentos/:docId` para aceitar `ExcluirDocumentoDto` e usar a lista de perfis com acesso de visualização.

**Verificação:** executar os testes de serviço e controller de prova.

**Commit:** `feat(prova): permite excluir documento com motivo`.

## Tarefa 4: exclusão de documentos de relatório

**Arquivos:**

- `services/api/src/modules/relatorio/relatorio.controller.ts`.
- `services/api/src/modules/relatorio/relatorio.service.ts`.
- `services/api/src/modules/relatorio/relatorio.service.spec.ts`.
- `services/api/src/modules/relatorio/relatorio.controller.spec.ts`.
- `services/api/src/modules/relatorio/relatorio-historico.service.ts` e testes, se necessário para aceitar o executor transacional.

**RED:** cobrir motivo inválido, aprovação, link, documento inexistente, acesso por todos os perfis do módulo, sucesso, limpeza do original/PDF e histórico. Incluir explicitamente o cenário de `gerente_financeiro` e confirmar que a exclusão não fica limitada ao autor quando o perfil possui acesso ao relatório.

**GREEN:** alterar `removerDocumento` para usar a sessão, validar o documento e as regras comuns, corrigir a limpeza para remover o original e PDF quando existirem, registrar a ação e apagar o registro em transação. Atualizar `DELETE /relatorio/:id/documento/:docId` para receber o DTO e autorizar todos os perfis que possuem acesso ao módulo, mantendo o escopo de unidade/etapa aplicado por `buscarPorId`.

**Verificação:** executar os testes de serviço e controller de relatório.

**Commit:** `feat(relatorio): permite excluir documento com motivo`.

## Tarefa 5: modal reutilizável e lista de documentos

**Arquivos:**

- Criar `apps/planejamento/features/plano-aula/components/confirmar-exclusao-documento-dialog.tsx`.
- Criar `apps/planejamento/features/plano-aula/components/confirmar-exclusao-documento-dialog.test.tsx`.
- Alterar `apps/planejamento/features/plano-aula/components/documento-list.tsx`.
- Alterar `apps/planejamento/features/plano-aula/components/documento-list.test.tsx`.

**RED:** testar que o modal exibe o arquivo, exige 10 caracteres válidos, mantém o motivo em erro, sinaliza carregamento e chama `onConfirmar` apenas com motivo válido. Testar que a lista não mostra exclusão para links ou documentos aprovados e mostra para upload pendente quando `canDelete` estiver habilitado.

**GREEN:** criar o `ConfirmarExclusaoDocumentoDialog` com `AlertDialog`, `Textarea`, validação no cliente, estado de carregamento e área de erro amigável. Alterar a callback para `onDelete(docId, motivo): Promise<void>` e renderizar a ação apenas para upload sem aprovação. Em sucesso, fechar o modal; em erro, mantê-lo aberto e preservar o texto.

**Verificação:** executar os testes dos componentes.

**Commit:** `feat(planejamento): cria confirmação de exclusão de documento`.

## Tarefa 6: hooks e telas de plano, prova e relatório

**Arquivos principais:**

- `apps/planejamento/features/plano-aula/hooks/use-plano-aula.ts` e teste novo do hook.
- `apps/planejamento/features/prova/hooks/use-prova.ts` e testes existentes/novos.
- `apps/planejamento/features/relatorio/hooks/use-relatorio.ts` e testes existentes/novos.
- `apps/planejamento/app/plano-aula/[quinzenaId]/plano-content.tsx`.
- `apps/planejamento/app/analise/[planoId]/revisao-content.tsx`.
- `apps/planejamento/app/provas/[cicloId]/prova-content.tsx`.
- `apps/planejamento/app/provas/analise/[provaId]/revisao-content.tsx`.
- `apps/planejamento/app/provas/gestao/provas/[provaId]/prova-gestao-content.tsx`.
- `apps/planejamento/app/relatorios/[semestreId]/relatorio-content.tsx`.
- `apps/planejamento/app/relatorios/analise/[relatorioId]/revisao-content.tsx`.

**RED:** testar que os hooks enviam `{ body: { motivo } }` em `api.delete`, que uma exclusão bem-sucedida atualiza o planejamento/histórico e que falha de API mantém a confirmação disponível. Nos fluxos de relatório, testar também a lista personalizada da análise.

**GREEN:** adaptar os três hooks para receber o motivo e chamar `api.delete` com corpo JSON. Habilitar `canDelete` nos pontos de documento que já possuem acesso ao planejamento, mantendo a decisão final baseada em tipo/aprovação. Adicionar handlers que chamem o hook, recarreguem dados e histórico e exibam sucesso. Reutilizar o diálogo na lista personalizada de análise de relatório. Converter erros por `obterMensagemErro` sem exibir detalhes técnicos.

**Verificação:** executar os testes dos hooks, telas e componentes de documentos.

**Commit:** `feat(planejamento): conecta exclusão justificada às telas`.

## Tarefa 7: histórico visível para o usuário

**Arquivos:**

- `apps/planejamento/features/plano-aula/components/historico-timeline.tsx` e teste.
- `apps/planejamento/app/relatorios/[semestreId]/relatorio-content.tsx` e teste correspondente.
- Qualquer helper de rótulos de histórico compartilhado que seja necessário.

**RED:** testar que `DOCUMENTO_EXCLUIDO` aparece com rótulo “Documento excluído”, ícone/estilo coerente, nome do arquivo e motivo, sem despejar o objeto técnico na tela.

**GREEN:** adicionar o novo rótulo, ícone, cor e composição de detalhes na timeline. Atualizar a visualização de histórico do relatório, que hoje mostra apenas o valor bruto de `acao`, para apresentar o mesmo texto compreensível.

**Verificação:** executar os testes de histórico e o typecheck do módulo de planejamento.

**Commit:** `feat(planejamento): exibe auditoria da exclusão de documentos`.

## Tarefa 8: verificação integrada e revisão

1. Executar testes direcionados de API para plano, prova e relatório.
2. Executar testes direcionados do app de planejamento.
3. Executar `pnpm turbo lint && pnpm turbo typecheck`.
4. Executar `git diff --check`.
5. Executar `pnpm test`; se o timeout preexistente de `apps/home/app/page.test.tsx` continuar, registrar claramente a falha e separar o resultado dos testes afetados pela feature.
6. Revisar o diff completo procurando bypass de tenant, autorização incorreta, exclusão de aprovado, motivo salvo apenas no cliente ou mensagens técnicas expostas.
7. Solicitar revisão de código usando `requesting-code-review` antes de integrar a branch.

**Commit final, se necessário:** somente correções de revisão, em commits separados e com mensagem em Português.
