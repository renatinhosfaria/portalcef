# Correções Recomendadas da Auditoria — Plano de Implementação

> **Para execução:** usar a skill `superpowers:executing-plans` para executar este plano tarefa por tarefa, em um worktree isolado.

**Objetivo:** corrigir os riscos de segurança, isolamento de tenant, consistência financeira, sessões, operação e qualidade identificados na auditoria integral do Portal Digital Colégio Essência Feliz.

**Arquitetura:** o trabalho será dividido em ondas pequenas. A primeira protege dados e autorizações sem depender de atualização de dependências. A segunda corrige fluxos transacionais e invalidação de sessões. A terceira alinha health-check, rollback, migration e CI. A quarta padroniza os contratos dos frontends e fecha a cobertura de qualidade. Cada mudança começa por um teste que falha e termina com validação localizada e global.

**Tecnologias:** NestJS, Fastify, Drizzle/PostgreSQL, Redis, BullMQ, Stripe, Next.js, React, Vitest, Jest, Turborepo, Bash, Docker Compose e GitHub Actions.

---

## Ordem de execução

1. **P0 — Segurança imediata:** remover `passwordHash` das respostas, fechar autorização entre escolas, impedir mensagens internas de erro e corrigir o teste que imprime o ambiente.
2. **P0/P1 — Integridade de negócio:** tornar o cancelamento com refund Stripe idempotente e reconciliável; impedir documentos PDF presos em `PENDENTE`.
3. **P1 — Sessões e operação:** revogar sessões após alterações de acesso, corrigir logout, health-check, rollback, backup e imagem de desenvolvimento.
4. **P1/P2 — Contratos e qualidade:** padronizar proxies, hidratar identidade por `/api/auth/me`, corrigir menu móvel, scripts ausentes e CI versionado.
5. **P0 — Dependências:** atualizar Next.js e demais dependências vulneráveis em uma branch própria, após os testes de regressão estarem disponíveis.

Não executar migration de produção nem atualização ampla de dependências antes de concluir os testes de autorização e o procedimento de rollback.

## Tarefa 1: Preparar a branch e a evidência de segurança

**Arquivos:**
- Criar branch/worktree: `fix/auditoria-seguranca-operacao`
- Consultar: `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, `docs/LOJA_INVARIANTES_TESTES.md`

**Passos:**

1. Confirmar árvore limpa e registrar o commit-base:

   ```bash
   git status --short --branch
   git rev-parse HEAD
   ```

2. Registrar os resultados atuais fora do repositório, sem salvar `.env`, `.env.docker` ou dumps:

   ```bash
   pnpm audit --prod --json > /tmp/essencia-audit-before.json
   pnpm turbo lint --force --concurrency=2
   pnpm turbo typecheck --force --concurrency=2
   ```

3. Rotacionar, fora do Git, qualquer credencial que tenha aparecido em logs de teste ou ferramentas de CI. O plano não deve copiar valores reais para fixtures, commits ou artefatos.

4. Criar commits pequenos por tarefa, sempre contendo teste e implementação da mesma correção.

**Critério de aceite:** a branch começa limpa, os números de referência estão registrados fora do checkout e nenhum segredo real está presente em novos arquivos.

## Tarefa 2: Remover dados sensíveis das execuções de workflows

**Arquivos:**
- Modificar: `services/api/src/modules/workflows/workflows-execucoes.service.ts`
- Modificar: `services/api/src/modules/workflows/workflows-execucoes.service.spec.ts`
- Modificar: `services/api/src/modules/workflows/workflows.controller.spec.ts`
- Consultar: `packages/db/src/schema/workflows.ts`

**Passos:**

1. Escrever um teste RED que simule uma relação `autor` e `enviadoPorUser` contendo `passwordHash`, `createdAt` e outros campos internos.

2. Executar somente os testes do módulo:

   ```bash
   pnpm --filter @essencia/api exec jest --runInBand \
     src/modules/workflows/workflows-execucoes.service.spec.ts \
     src/modules/workflows/workflows.controller.spec.ts
   ```

   **Esperado:** falha porque os objetos relacionados ainda carregam dados completos.

3. Criar uma projeção única de usuário público com apenas `id`, `name`, `email` e, se necessário, `role`.

4. Aplicar `columns` explícitas nas relações `historico.autor` e `anexos.enviadoPorUser`. Na normalização, construir novos objetos em vez de espalhar o item inteiro.

5. Verificar que a resposta de `GET /workflows/execucoes/:execucaoId` não contém `passwordHash`, hash, token ou objeto Drizzle bruto.

6. Reexecutar o teste e fazer commit:

   ```bash
   pnpm --filter @essencia/api exec jest --runInBand \
     src/modules/workflows/workflows-execucoes.service.spec.ts \
     src/modules/workflows/workflows.controller.spec.ts
   git add services/api/src/modules/workflows
   git commit -m "fix: remove dados sensíveis das execuções"
   ```

**Critério de aceite:** nenhuma resposta de execução contém material de credencial, inclusive quando o histórico e anexos possuem autores relacionados.

## Tarefa 3: Fechar o isolamento de escola e unidade

**Arquivos:**
- Criar: `services/api/src/common/tenant/tenant-scope.service.ts`
- Criar: `services/api/src/common/tenant/tenant-scope.module.ts`
- Criar: `services/api/src/common/tenant/tenant-scope.service.spec.ts`
- Criar: `services/api/src/modules/calendar/calendar.service.spec.ts`
- Criar: `services/api/src/modules/units/units.service.spec.ts`
- Modificar: `services/api/src/modules/calendar/calendar.service.ts`
- Modificar: `services/api/src/modules/calendar/calendar.module.ts`
- Modificar: `services/api/src/modules/units/units.service.ts`
- Modificar: `services/api/src/modules/units/units.module.ts`
- Modificar: `services/api/src/common/guards/tenant.guard.ts`

**Passos:**

1. Escrever testes RED para estes cenários:

   - `diretora_geral` lendo evento de uma unidade de outra escola;
   - `diretora_geral` criando evento com `unitId` de outra escola;
   - usuário sem `unitId` tentando listar eventos usando `query.unitId`;
   - leitura direta de unidade de outra escola;
   - acesso válido da diretora a duas unidades da própria escola.

2. Implementar `TenantScopeService` com operações explícitas:

   - resolver uma unidade e sua escola;
   - validar que uma unidade pertence à escola da sessão;
   - validar que um recurso pertence à unidade permitida pelo perfil;
   - retornar erro fechado quando `schoolId`, `unitId` ou sessão estiverem ausentes.

3. Usar o serviço em `CalendarService.getEvents`, `getEventById`, `createEvent`, `updateEvent`, `deleteEvent` e `getStats`. O `TenantGuard` continua protegendo parâmetros simples, mas a autorização relacional deve ocorrer no serviço que conhece o recurso.

4. Usar o mesmo serviço em `UnitsService.findById`, `findByIds`, `update` e `delete`, evitando que uma diretora obtenha unidade apenas porque conhece o UUID.

5. Executar os testes direcionados:

   ```bash
   pnpm --filter @essencia/api exec jest --runInBand \
     src/common/tenant/tenant-scope.service.spec.ts \
     src/modules/calendar/calendar.service.spec.ts \
     src/modules/units/units.service.spec.ts
   ```

   **Esperado:** todos os casos de outra escola retornam `ForbiddenException` ou `NotFoundException`, conforme o contrato do endpoint.

**Critério de aceite:** nenhum endpoint de calendário ou unidade depende apenas do papel `diretora_geral` para decidir pertencimento à escola.

## Tarefa 4: Garantir a consistência escola–unidade dos usuários

**Arquivos:**
- Modificar: `services/api/src/modules/users/users.controller.ts`
- Modificar: `services/api/src/modules/users/users.service.ts`
- Modificar: `services/api/src/modules/users/users.service.spec.ts`
- Modificar: `packages/shared/src/schemas/index.ts`
- Modificar: `packages/db/src/schema/users.ts`
- Modificar: `packages/db/src/schema/units.ts`
- Criar: `packages/db/drizzle/0040_restringe_usuario_unidade_escola.sql`

**Passos:**

1. Escrever testes RED para criação e atualização com `schoolId` de A e `unitId` de B, incluindo o caminho de `diretora_geral`.

2. Adicionar uma validação transacional que confirme a relação escola–unidade antes de inserir ou atualizar o usuário. A validação deve rejeitar unidade ausente, escola divergente e etapa incompatível quando o domínio exigir etapa.

3. Fazer o schema Zod validar o formato e deixar a regra relacional no serviço; não confiar em IDs vindos do payload como contexto de sessão.

4. Criar uma migration de defesa em profundidade somente após um preflight que liste registros inconsistentes. A migration deve falhar sem alterar dados quando encontrar inconsistências; a correção dos registros deve ser explícita e auditável.

5. Se o preflight estiver limpo, adicionar constraint composta que impeça futuramente `users.school_id` divergente de `units.school_id`.

6. Executar:

   ```bash
   pnpm --filter @essencia/api exec jest --runInBand src/modules/users/users.service.spec.ts
   pnpm --filter @essencia/db generate
   pnpm --filter @essencia/db typecheck
   ```

**Critério de aceite:** a API rejeita combinações escola–unidade inválidas antes da escrita e o banco possui proteção equivalente após a migration.

## Tarefa 5: Revogar sessões após mudanças de acesso e corrigir logout

**Arquivos:**
- Modificar: `services/api/src/modules/users/users.service.ts`
- Modificar: `services/api/src/modules/users/users.service.spec.ts`
- Modificar: `services/api/src/modules/auth/auth.service.ts`
- Modificar: `services/api/src/modules/auth/auth.service.spec.ts`
- Modificar: `apps/escolas/components/shell/master-sidebar.tsx`
- Modificar: `apps/escolas/components/shell/master-sidebar.test.tsx`
- Consultar: `services/api/src/modules/auth/session.service.ts`

**Passos:**

1. Escrever testes RED que esperem `deleteAllUserSessions(userId)` depois de alteração, exclusão e troca de senha. Cobrir mudança de role, escola, unidade, etapa e senha.

2. Reutilizar `SessionService.deleteAllUserSessions` já usado na inativação. A operação deve ocorrer em qualquer mutação de usuário que possa alterar autorização; não armazenar novo contexto no Redis depois da revogação.

3. Fazer `AuthService.changePassword` revogar todas as sessões após atualizar o hash.

4. Alterar “Sair do Master” para chamar `POST /api/auth/logout` com cookies, limpar o estado visual e redirecionar mesmo após a resposta. Não usar apenas `localStorage.removeItem` como logout.

5. Verificar:

   ```bash
   pnpm --filter @essencia/api exec jest --runInBand \
     src/modules/users/users.service.spec.ts src/modules/auth/auth.service.spec.ts
   pnpm --filter escolas test -- components/shell/master-sidebar.test.tsx
   ```

**Critério de aceite:** uma sessão antiga deixa de autenticar imediatamente após mudança de autorização ou senha, e todos os caminhos de logout invalidam a sessão no servidor.

## Tarefa 6: Tornar cancelamento e refund da loja idempotentes

**Arquivos:**
- Modificar: `packages/db/src/schema/shop.ts`
- Modificar: `packages/db/src/schema/shop-relations.ts` se uma tabela de refund for criada
- Criar: `packages/db/drizzle/0041_status_refund_pedido.sql`
- Modificar: `packages/shared/src/types/shop.ts`
- Modificar: `services/api/src/modules/payments/payments.service.ts`
- Modificar: `services/api/src/modules/shop/shop-orders.service.ts`
- Modificar: `services/api/src/modules/shop/shop-admin.controller.ts`
- Modificar: `services/api/src/modules/payments/payments-webhook.controller.ts`
- Modificar: `services/api/src/modules/shop/shop-orders.service.spec.ts`
- Modificar: `services/api/src/modules/shop/shop-regressions.spec.ts`

**Passos:**

1. Escrever testes RED para:

   - refund Stripe bem-sucedido, seguido de cancelamento e liberação de estoque;
   - refund que falha, mantendo o pedido conciliável e sem confirmar sucesso;
   - repetição do mesmo cancelamento sem criar dois refunds;
   - webhook `charge.refunded` atualizando o estado local;
   - cancelamento de pedido sem pagamento externo preservando o fluxo atual.

2. Adicionar estado persistente de refund, por exemplo `PENDENTE`, `PROCESSANDO`, `CONCLUIDO` e `ERRO`, além de `refundId`, erro sanitizado e timestamps. Usar uma tabela própria se o histórico de tentativas precisar ser auditável; não guardar mensagens completas do Stripe para o cliente.

3. Alterar `PaymentsService.refundPayment` para aceitar uma chave de idempotência determinística baseada no pedido e repassá-la ao Stripe.

4. Para pedido `PAGO` online, não marcar `CANCELADO` nem devolver estoque enquanto o refund não estiver confirmado. Em timeout ou erro desconhecido, manter estado conciliável, registrar retry e retornar erro controlado ao operador.

5. Adicionar um retry administrativo idempotente e reconciliar o resultado pelos webhooks Stripe. O retry deve usar os mesmos locks de pedido e estoque.

6. Atualizar a matriz da loja em `docs/LOJA_INVARIANTES_TESTES.md` com o fluxo de falha e retry.

7. Executar:

   ```bash
   pnpm --filter @essencia/api exec jest --runInBand \
     src/modules/shop/shop-orders.service.spec.ts \
     src/modules/shop/shop-regressions.spec.ts
   ```

**Critério de aceite:** nenhum pedido pago retorna “cancelado com sucesso” quando o dinheiro não foi estornado ou quando o resultado do Stripe é desconhecido.

## Tarefa 7: Corrigir filas de PDF e estados pendentes

**Arquivos:**
- Modificar: `services/api/src/modules/plano-aula/plano-aula-pdf-queue.service.ts`
- Modificar: `services/api/src/modules/plano-aula/plano-aula-pdf-queue.service.spec.ts`
- Modificar: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Modificar: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`
- Modificar: `services/api/src/modules/relatorio/relatorio-pdf-queue.service.ts`
- Modificar: `services/api/src/modules/relatorio/relatorio-pdf-queue.service.spec.ts`
- Modificar: `services/api/src/modules/relatorio/relatorio.service.ts`

**Passos:**

1. Trocar os testes atuais que esperam resolução silenciosa após erro Redis por testes RED que exigem rejeição ou retorno estruturado de falha.

2. Fazer `adicionar` registrar contexto seguro, não engolir o erro e permitir que o serviço chamador marque `pdfStatus=ERRO` com mensagem sanitizada.

3. Garantir que `regerar-pdf` transite de `ERRO` ou `PENDENTE` para nova tentativa com retry BullMQ e que o documento nunca fique indefinidamente pendente sem possibilidade de ação.

4. Adicionar métrica/log estruturado para falhas de enqueue e teste de Redis indisponível nos dois módulos.

5. Executar os testes de fila, serviço e worker.

**Critério de aceite:** indisponibilidade do Redis aparece para o operador, gera estado recuperável e nunca é convertida em sucesso silencioso.

## Tarefa 8: Sanitizar o teste de ambiente e proteger segredos

**Arquivos:**
- Modificar: `services/api/src/modules/shop/shop-regressions.spec.ts`
- Criar: `services/api/test/fixtures/env.docker.fixture`
- Modificar: `.gitignore` apenas se necessário para manter fixtures sem segredos
- Modificar: `docs/SECURITY.md`

**Passos:**

1. Escrever um teste RED que valide apenas a leitura da chave `LOJA_PUBLIC_URL`, aceitando valor quoted e unquoted.

2. Substituir `readFileSync` do ambiente real por fixture sanitizada ou parser que extraia somente a variável esperada.

3. Remover qualquer matcher que inclua o conteúdo integral do arquivo na mensagem de falha.

4. Adicionar regra de revisão: `.env`, `.env.docker`, backups e logs nunca entram em fixtures, snapshots ou mensagens de erro.

5. Executar somente a regressão da loja e verificar que a saída não contém linhas de ambiente.

**Critério de aceite:** a suíte passa com configuração quoted/unquoted e uma falha futura não imprime conteúdo de arquivo de ambiente.

## Tarefa 9: Tornar erros 500 seguros

**Arquivos:**
- Criar: `services/api/src/common/filters/api-exception.filter.spec.ts`
- Modificar: `services/api/src/common/filters/api-exception.filter.ts`
- Modificar: `services/api/src/common/middleware/correlation-id.middleware.ts` se for necessário incluir o ID na resposta

**Passos:**

1. Escrever teste RED para `new Error("detalhe interno fictício")`, esperando status 500, mensagem genérica e ausência do detalhe no corpo.

2. Preservar mensagens somente para exceções HTTP controladas e erros Fastify de cliente. Para erro interno desconhecido, devolver `INTERNAL_ERROR` e mensagem genérica.

3. Manter stack e detalhe apenas no log sanitizado, com correlation ID e sem cookies, tokens ou senha.

4. Executar o teste do filtro e o conjunto de testes da API.

**Critério de aceite:** detalhes internos não são enviados ao cliente em nenhum caminho de erro 500.

## Tarefa 10: Corrigir health-check e observabilidade básica

**Arquivos:**
- Criar: `services/api/src/modules/health/health.service.ts`
- Criar: `services/api/src/modules/health/health.service.spec.ts`
- Modificar: `services/api/src/modules/health/health.controller.ts`
- Modificar: `services/api/src/modules/health/health.controller.spec.ts`
- Modificar: `services/api/src/modules/health/health.module.ts`
- Modificar: `services/api/src/modules/auth/session.service.ts` para expor `ping()` seguro, se necessário
- Modificar: `scripts/health-check.sh`
- Modificar: `scripts/health-check.test.sh`

**Passos:**

1. Escrever testes RED para API, PostgreSQL e Redis disponíveis, indisponíveis e com timeout.

2. Implementar verificações curtas de `SELECT 1` e `PING`, sem retornar URL, host, senha ou detalhes de conexão.

3. Fazer o endpoint distinguir `ok` e `degraded/unhealthy`, mantendo o formato documentado em `docs/DEPLOYMENT.md`.

4. Alterar `health-check.sh` para marcar `FAILED=1` quando a chamada externa inicial falhar, testar cada endpoint configurado e usar explicitamente `--env-file .env.docker` onde houver Compose.

5. Adicionar teste shell em que a home pública falha e o script retorna código diferente de zero.

**Critério de aceite:** o deploy falha quando API, banco, Redis ou endpoints públicos não estão disponíveis; um endpoint superficial não consegue declarar produção saudável.

## Tarefa 11: Alinhar rollback, migration e imagem de desenvolvimento

**Arquivos:**
- Modificar: `scripts/rollback.sh`
- Criar: `scripts/rollback.test.sh`
- Modificar: `scripts/migrate.sh`
- Modificar: `scripts/migrate.test.sh`
- Modificar: `scripts/deploy-rolling.sh`
- Modificar: `docker/Dockerfile.dev`
- Modificar: `docker-compose.prod.yml`
- Modificar: `docs/DEPLOYMENT.md`

**Passos:**

1. Escrever testes RED para rollback local sem registry, rollback com imagem ausente, Compose sem `.env.docker` e migration com `pg_dump` que escreve dados parciais e termina com erro.

2. Fazer `rollback.sh` usar `set -euo pipefail`, `--env-file .env.docker` e `IMAGE_TAG` em todos os comandos. Separar claramente modo local e modo registry; o modo local não deve executar `pull`.

3. Fazer `migrate.sh` gravar em arquivo temporário, abortar quando `pg_dump` retornar erro, remover o temporário e somente depois renomear para o backup final. Manter permissões `600`.

4. Remover o `docker image prune -af` global do caminho rolling. Se houver limpeza, restringir por labels/tags do projeto e preservar a quantidade mínima de versões de rollback.

5. Remover a cópia de `services/worker/package.json` do `Dockerfile.dev` ou restaurar formalmente esse workspace; a escolha deve refletir o `pnpm-workspace.yaml` atual.

6. Versionar o serviço `landing-mae` com a mesma tag da release, evitando `latest` em uma release que usa SHA.

7. Executar:

   ```bash
   bash scripts/deploy.test.sh
   bash scripts/health-check.test.sh
   bash scripts/migrate.test.sh
   bash scripts/rollback.test.sh
   docker build -f docker/Dockerfile.dev .
   ```

**Critério de aceite:** backup parcial, imagem ausente ou ambiente incompleto interrompem a operação antes de alterar produção; rollback validado usa exatamente a tag escolhida.

## Tarefa 12: Versionar CI e separar os modos de deploy

**Arquivos:**
- Modificar: `.gitignore`
- Adicionar ao Git: `.github/workflows/deploy.yml`
- Criar: `.github/workflows/quality.yml` se a separação simplificar o pipeline
- Modificar: `docs/DEPLOYMENT.md`
- Modificar: `scripts/deploy-rolling.sh`

**Passos:**

1. Remover a regra `.github/` do `.gitignore` e revisar o workflow existente antes de adicioná-lo.

2. Definir explicitamente dois caminhos documentados:

   - `deploy.sh`: build local, backup/migration opcional e imagens carregadas no host;
   - `deploy-rolling.sh`: imagens imutáveis de registry, `pull` explícito e Compose com ambiente completo.

3. Fazer o CI executar lint, typecheck, testes, build e audit antes de publicar imagens. O deploy deve usar a mesma tag SHA em todos os serviços.

4. Remover do workflow comandos Compose sem `--env-file` e a limpeza global de imagens.

5. Verificar `git ls-files .github`, a configuração YAML e um run de CI em branch de teste.

**Critério de aceite:** o pipeline usado para publicar e fazer rollback está versionado no repositório e não depende de arquivos ignorados localmente.

## Tarefa 13: Padronizar proxies e identidade entre aplicações

**Arquivos:**
- Criar: `packages/lib/src/server/api-proxy.ts`
- Modificar: `packages/lib/package.json`
- Modificar: `apps/home/app/api/[...path]/route.ts`
- Modificar: `apps/login/app/api/[...path]/route.ts`
- Modificar: `apps/usuarios/app/api/[...path]/route.ts`
- Modificar: `apps/escolas/app/api/[...path]/route.ts`
- Modificar: `apps/turmas/app/api/[...path]/route.ts`
- Modificar: `apps/calendario/app/api/[...path]/route.ts`
- Modificar: `apps/tarefas/app/api/[...path]/route.ts`
- Modificar: `apps/planejamento/app/api/[...path]/route.ts`
- Criar: testes de contrato para o helper e cada proxy
- Modificar: `packages/components/src/shell/app-sidebar.tsx`
- Modificar: `packages/components/src/shell/AdminShell.tsx` se o componente compartilhado não cobrir a loja
- Modificar: `packages/shared/src/providers/tenant.tsx`
- Criar: `packages/shared/src/providers/tenant.test.tsx`

**Passos:**

1. Escrever teste RED que converta `/app/api/auth/me` em `/api/auth/me` no backend, preservando cookies, query string, JSON e multipart.

2. Implementar um helper de proxy server-only e substituir as oito cópias divergentes. O contrato deve manter o prefixo `/api`, pois o NestJS usa esse prefixo global.

3. Escrever teste RED em que `/api/auth/me` preenche `userId`, `schoolId`, `unitId`, `stageId`, `role`, `name` e `email`.

4. Fazer `TenantProvider` hidratar identidade pelo endpoint autenticado. Remover `userId` e `stageId` do payload de URL/localStorage; qualquer unidade escolhida por um usuário de gestão deve ser contexto selecionado e validado pela API, nunca identidade confiável.

5. Remover `tenantPayload` dos links do sidebar quando ele transportar apenas identidade. Manter limpeza de query antiga para compatibilidade de transição.

6. Executar os testes de proxy, provider e sidebar, incluindo uma requisição real com `NextRequest`.

**Critério de aceite:** todas as aplicações locais chamam a mesma rota `/api`, a identidade vem da sessão do servidor e nenhum campo de autorização depende de query string ou `localStorage`.

## Tarefa 14: Corrigir menu móvel e logout visual

**Arquivos:**
- Modificar: `packages/components/src/shell/shell.tsx`
- Modificar: `packages/components/src/shell/app-sidebar.tsx`
- Modificar: `packages/components/src/shell/app-sidebar.test.tsx`
- Modificar: `apps/loja-admin/components/AdminShell.tsx`
- Criar/Modificar: testes de `AdminShell`

**Passos:**

1. Escrever testes RED para abrir e fechar o menu em viewport móvel, exibir nome acessível no botão, prender foco e fechar com Escape.

2. Implementar drawer compartilhado com estado controlado, backdrop, `aria-expanded`, `aria-controls` e foco inicial.

3. Reutilizar o mesmo comportamento na Loja Admin, removendo a implementação paralela.

4. Confirmar que logout continua disponível no drawer e que a navegação não depende da sidebar desktop.

5. Executar testes de componentes e uma verificação manual em viewport de 375px.

**Critério de aceite:** usuário móvel consegue abrir módulos, fechar o menu, sair e navegar sem acessar elementos escondidos ou sem rótulo.

## Tarefa 15: Completar scripts de qualidade e testes ausentes

**Arquivos:**
- Modificar: `apps/home/package.json`
- Modificar: `apps/login/package.json`
- Modificar: `apps/usuarios/package.json`
- Modificar: `apps/eventos/package.json`
- Modificar: `apps/suporte/package.json`
- Modificar: `apps/tarefas/package.json`
- Modificar: `apps/home/tsconfig.json`
- Criar testes smoke nos cinco apps sem `test`
- Modificar: `apps/home/app/page.test.tsx`

**Passos:**

1. Adicionar `typecheck` a `home`, `login` e `usuarios`.

2. Corrigir os tipos dos matchers Jest DOM no `home` usando a configuração de tipos do Vitest/Jest DOM, mantendo o teste de link real.

3. Adicionar scripts `test` com `--passWithNoTests` apenas durante a transição; antes de concluir, cada app deve possuir ao menos um teste smoke de renderização, proxy ou sessão.

4. Criar testes de logout, carregamento de sessão e contrato do proxy nos apps administrativos prioritários. Registrar explicitamente qualquer app que permaneça sem cobertura funcional.

5. Verificar que o Turbo passa a contabilizar todos os apps:

   ```bash
   pnpm turbo lint --force --concurrency=2
   pnpm turbo typecheck --force --concurrency=2
   pnpm turbo test --force --concurrency=1 --continue
   ```

**Critério de aceite:** a validação global não omite aplicações por falta de script e `home` passa no typecheck sem suprimir o teste.

## Tarefa 16: Atualizar dependências vulneráveis com validação incremental

**Arquivos:**
- Modificar: `apps/*/package.json` que usam Next.js/React
- Modificar: `services/api/package.json`
- Modificar: `packages/db/package.json`
- Modificar: `pnpm-lock.yaml`
- Modificar: `docs/SECURITY.md`

**Passos:**

1. Abrir uma branch de atualização separada da branch de correções de domínio. Fixar uma versão corrigida do Next.js compatível com Node 22 e atualizar todos os apps no mesmo commit lógico.

2. Atualizar React e ferramentas relacionadas somente quando exigido pela versão escolhida do Next.js. Não misturar mudança visual ou de arquitetura nessa branch.

3. Tratar os alertas de Fastify, Nest Fastify, Drizzle, Axios, Sharp, `tar`, `fast-xml-parser` e `@fastify/middie` individualmente. Para mudança major, registrar incompatibilidades e criar tarefa separada em vez de mascarar o advisory.

4. Reexecutar build, lint, typecheck, testes API/frontend, testes shell e `pnpm audit --prod`. Documentar exceções temporárias com pacote, advisory, motivo e data de expiração.

5. Validar `next/image`, uploads, AVIF/WEBP, rotas App Router, cookies e build standalone em ambiente de staging.

**Critério de aceite:** nenhum advisory crítico/alto fica sem decisão documentada; o build de todas as aplicações e a suíte de regressão passam na versão atualizada.

## Tarefa 17: Documentar e executar a validação de release

**Arquivos:**
- Modificar: `docs/DEPLOYMENT.md`
- Modificar: `docs/SECURITY.md`
- Modificar: `docs/LOJA_INVARIANTES_TESTES.md`
- Modificar: `docs/README.md`
- Criar: `docs/runbooks/incidente-refund.md`
- Criar: `docs/runbooks/rollback.md`

**Passos:**

1. Documentar o contrato de health com banco e Redis, o fluxo de refund pendente, a revogação de sessões e o procedimento de rollback.

2. Executar a matriz completa antes do merge:

   ```bash
   pnpm turbo lint --force --concurrency=2
   pnpm turbo typecheck --force --concurrency=2
   pnpm turbo test --force --concurrency=1 --continue
   bash scripts/deploy.test.sh
   bash scripts/health-check.test.sh
   bash scripts/migrate.test.sh
   bash scripts/rollback.test.sh
   pnpm audit --prod
   ```

3. Fazer build das imagens com tag SHA e executar smoke tests em staging: login, logout, troca de senha, acesso entre escolas, consulta de workflow, cancelamento com refund, PDF e `/api/health` com Redis/banco parados em testes controlados.

4. Criar backup e executar um ensaio de restauração antes da primeira migration de produção. Guardar o resultado sem dados sensíveis.

5. Publicar em janela controlada, observar erros 5xx, sessões, jobs PDF, refunds e health por pelo menos um ciclo operacional. Manter a imagem anterior disponível para rollback.

**Critérios finais de aceite:**

- Todas as correções P0 têm testes de regressão passando.
- Não há resposta HTTP com `passwordHash`, token ou mensagem interna de 500.
- Requests entre escolas retornam bloqueio consistente.
- Refund com falha nunca confirma cancelamento financeiro como sucesso.
- Sessões são invalidadas após mudanças de autorização.
- Health-check detecta banco, Redis e indisponibilidade pública.
- Rollback e migration falham de forma segura e foram testados com simuladores.
- Todos os workspaces entram no lint, typecheck e test do Turbo.
- Dependências críticas/altas têm correção ou exceção formal com prazo.

