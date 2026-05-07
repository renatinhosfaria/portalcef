# Matriz Obrigatória de Invariantes e Testes por Módulo

Este documento consolida a matriz obrigatória de invariantes e testes para os módulos executáveis do monorepo. Ele complementa a matriz detalhada da loja em [docs/LOJA_INVARIANTES_TESTES.md](./LOJA_INVARIANTES_TESTES.md) e serve como checklist mínimo para qualquer alteração funcional em apps e módulos da API.

## Escopo

Em 27 de abril de 2026, esta matriz cobre:

- Apps executáveis em `apps/*`: `home`, `login`, `usuarios`, `escolas`, `turmas`, `planejamento`, `calendario`, `eventos`, `loja`, `loja-admin`, `tarefas` e `suporte`.
- Módulos Nest importados em [services/api/src/app.module.ts](../services/api/src/app.module.ts): `auth`, `calendar`, `health`, `plannings`, `plano-aula`, `plano-aula-periodo`, `schools`, `shop`, `stages`, `turmas`, `units`, `users`, `stats`, `storage`, `quinzena-documents`, `tarefas`, `suporte`, `prova-ciclo`, `prova`, `security`, `setup` e `sharepoint`.

Ficam fora desta versão:

- Pacotes de infraestrutura em `packages/*`, exceto quando forem arquivo-alvo de teste de um módulo.
- `services/api/src/modules/payments`, porque o diretório existe, mas o módulo não está importado no `AppModule` nesta data.

## Regra de Uso

Toda mudança funcional deve declarar explicitamente quais classes desta matriz foram tocadas e executar os testes correspondentes antes de considerar a tarefa pronta.

Quando um bug novo aparecer:

1. Classifique o bug na classe correta do módulo.
2. Escreva primeiro o teste da classe impactada.
3. Confirme a falha.
4. Implemente a correção mínima.
5. Execute o comando mínimo do módulo.
6. Execute o pipeline global obrigatório.

Quando o pacote ainda não tiver suíte mínima publicada, a primeira alteração no módulo deve criar os arquivos de teste indicados abaixo e passar a usar o comando `pnpm --filter <pacote> test`.

## Pipeline Global Obrigatório

```bash
pnpm turbo lint && pnpm turbo typecheck
```

## Convenção das Classes

- Prefixo `APP-`: invariantes de interface, navegação, contrato UI/BFF e experiência protegida por permissão.
- Prefixo `API-`: invariantes de controller, service, workflow, RBAC, tenant, transação e contrato HTTP.
- O número identifica a classe estável do módulo. Novos bugs da mesma família devem ampliar o teste da classe existente, e não criar casos isolados.

## Apps

### `home`

| Classe        | Área               | Invariante obrigatória                                                                           | Teste bloqueante              |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------- |
| `APP-HOME-01` | Conteúdo público   | A home renderiza sem sessão e nunca depende de cookies autenticados para SSR.                    | `apps/home/app/page.test.tsx` |
| `APP-HOME-02` | Widgets e fallback | Falha em calendário, feed ou estatísticas não derruba a página; a UI mostra fallback previsível. | `apps/home/app/page.test.tsx` |

Comando mínimo:

```bash
pnpm --filter home test
```

### `login`

| Classe         | Área                     | Invariante obrigatória                                                                             | Teste bloqueante                     |
| -------------- | ------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `APP-LOGIN-01` | Submissão de credenciais | Login envia credenciais apenas pelo fluxo BFF/API e nunca persiste token sensível no cliente.      | `criar apps/login/app/page.test.tsx` |
| `APP-LOGIN-02` | Erro e redirecionamento  | Erros de login são genéricos e sessão já autenticada redireciona para o módulo correto do usuário. | `criar apps/login/app/page.test.tsx` |

Comando mínimo:

```bash
pnpm --filter login test
```

### `usuarios`

| Classe            | Área                    | Invariante obrigatória                                                                                                 | Teste bloqueante                        |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `APP-USUARIOS-01` | Lista e filtros         | A tela lista apenas usuários dentro do escopo retornado pela API e não reaproveita filtros inválidos ao trocar tenant. | `criar apps/usuarios/app/page.test.tsx` |
| `APP-USUARIOS-02` | Formulário e permissões | O formulário não oferece combinações inválidas de role, escola e unidade e não expõe ações proibidas.                  | `criar apps/usuarios/app/page.test.tsx` |

Comando mínimo:

```bash
pnpm --filter usuarios test
```

### `escolas`

| Classe           | Área              | Invariante obrigatória                                                                          | Teste bloqueante                                                                                              |
| ---------------- | ----------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `APP-ESCOLAS-01` | Shell master      | Navegação e ações globais aparecem apenas para perfis que podem administrar escolas e unidades. | `apps/escolas/components/shell/master-sidebar.test.tsx`                                                       |
| `APP-ESCOLAS-02` | Unidades e etapas | Formulários e listas mantêm vínculo consistente entre escola, unidade, diretoria e etapas.      | `apps/escolas/components/units/unit-list.test.tsx` e `criar apps/escolas/components/units/unit-form.test.tsx` |

Comando mínimo:

```bash
pnpm --filter escolas test
```

### `turmas`

| Classe          | Área                 | Invariante obrigatória                                                                               | Teste bloqueante                                                                                              |
| --------------- | -------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `APP-TURMAS-01` | Catálogo de turmas   | A página mostra apenas turmas da unidade/etapa permitida e preserva o contexto ao paginar ou editar. | `apps/turmas/app/page.test.tsx`                                                                               |
| `APP-TURMAS-02` | Gestão de professora | O diálogo de professora não permite atribuição duplicada nem fora do contexto da turma.              | `apps/turmas/components/shell.test.tsx` e `criar apps/turmas/components/gerenciar-professora-dialog.test.tsx` |

Comando mínimo:

```bash
pnpm --filter @essencia/turmas test
```

### `calendario`

| Classe              | Área                    | Invariante obrigatória                                                                                                  | Teste bloqueante                          |
| ------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `APP-CALENDARIO-01` | Filtros de visualização | Filtros de escola, unidade, período e tipo nunca montam consultas incompatíveis com a API.                              | `criar apps/calendario/app/page.test.tsx` |
| `APP-CALENDARIO-02` | Edição e fallback       | Ações de criar, editar e excluir aparecem só para perfis autorizados e falhas de fetch preservam a agenda renderizável. | `criar apps/calendario/app/page.test.tsx` |

Comando mínimo:

```bash
pnpm --filter @essencia/calendario test
```

### `planejamento`

| Classe                | Área                   | Invariante obrigatória                                                                                                 | Teste bloqueante                                                                                                                                                                                                               |
| --------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APP-PLANEJAMENTO-01` | Navegação por workflow | A navegação respeita o papel da sessão e separa corretamente fluxos de planejamento, plano de aula e prova.            | `apps/planejamento/app/tarefas-navegacao.test.tsx` e `apps/planejamento/app/shared-provider.test.ts`                                                                                                                           |
| `APP-PLANEJAMENTO-02` | Contrato de tipos      | A UI consome exatamente o shape de `plano-aula`, `prova` e `plannings`, sem fallback incompatível.                     | `apps/planejamento/features/plano-aula/types.test.ts` e `criar apps/planejamento/features/prova/types.test.ts`                                                                                                                 |
| `APP-PLANEJAMENTO-03` | Documentos e revisão   | Lista, upload, editor e dashboard de documentos refletem estado real de sincronização, aprovação e bloqueio de edição. | `apps/planejamento/features/plano-aula/components/documento-list.test.tsx`, `apps/planejamento/features/plano-aula/components/documento-upload.test.tsx` e `apps/planejamento/features/plano-aula/hooks/use-dashboard.test.ts` |

Comando mínimo:

```bash
pnpm --filter planejamento test
```

### `loja`

| Classe        | Área                | Invariante obrigatória                                                                                 | Teste bloqueante                                                                                    |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `APP-LOJA-01` | Catálogo e detalhe  | Catálogo e detalhe público nunca expõem estoque interno, variantes inativas ou tenant incorreto.       | `apps/loja/__tests__/loja.test.ts`, `apps/loja/components/__tests__/ProductDetailCarousel.test.tsx` |
| `APP-LOJA-02` | Carrinho e checkout | Carrinho usa preço e quantidade compatíveis com a API e não permite checkout com estado inconsistente. | `apps/loja/__tests__/carrinho-page.test.tsx`, `apps/loja/__tests__/use-cart.test.tsx`               |

Comando mínimo:

```bash
pnpm --filter @essencia/loja test
```

Referência detalhada: [docs/LOJA_INVARIANTES_TESTES.md](./LOJA_INVARIANTES_TESTES.md)

### `loja-admin`

| Classe              | Área                       | Invariante obrigatória                                                                                | Teste bloqueante                                                                                                                                                                                    |
| ------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP-LOJA-ADMIN-01` | Permissões e dashboard     | A interface não oferece ações que a API negaria e consome o shape real do dashboard.                  | `apps/loja-admin/__tests__/permissions.test.ts` e `apps/loja-admin/__tests__/dashboard-source.test.ts`                                                                                              |
| `APP-LOJA-ADMIN-02` | Catálogo, estoque e upload | Fluxos de produto, estoque, imagem, pedidos e venda presencial mantêm contrato consistente com a API. | `apps/loja-admin/__tests__/admin.test.ts`, `apps/loja-admin/__tests__/inventory.test.ts`, `apps/loja-admin/__tests__/image-uploader.test.tsx`, `apps/loja-admin/__tests__/venda-presencial.test.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/loja-admin test
```

Referência detalhada: [docs/LOJA_INVARIANTES_TESTES.md](./LOJA_INVARIANTES_TESTES.md)

### `eventos`

| Classe          | Área             | Invariante obrigatória                                                                 | Teste bloqueante                                  |
| --------------- | ---------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `APP-EVENTOS-01` | Limite de módulo | Inscrições de evento são publicadas em `/eventos` e não ficam acopladas ao `loja-admin`. | `apps/loja-admin/__tests__/modulo-eventos.test.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/loja-admin test -- modulo-eventos
pnpm --filter eventos typecheck
```

### `tarefas`

| Classe           | Área                     | Invariante obrigatória                                                                                       | Teste bloqueante                                                                                                               |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `APP-TAREFAS-01` | Lista, filtros e detalhe | A UI exibe apenas tarefas autorizadas, mantém filtros estáveis e não mistura tarefas de outro contexto.      | `criar apps/tarefas/app/page.test.tsx` e `criar apps/tarefas/app/[id]/page.test.tsx`                                           |
| `APP-TAREFAS-02` | Criação e notificações   | Criar tarefa, concluir e receber eventos em tempo real não pode duplicar estado nem perder prioridade/prazo. | `criar apps/tarefas/app/criar/page.test.tsx` e `criar apps/tarefas/features/notificacoes/tarefa-notificacao-provider.test.tsx` |

Comando mínimo:

```bash
pnpm --filter tarefas test
```

### `suporte`

| Classe           | Área                | Invariante obrigatória                                                                                            | Teste bloqueante                                                                     |
| ---------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `APP-SUPORTE-01` | Lista e detalhe     | A interface lista e abre apenas chamados do escopo autorizado, sem vazar mensagens ou anexos de outro tenant.     | `criar apps/suporte/app/page.test.tsx` e `criar apps/suporte/app/[id]/page.test.tsx` |
| `APP-SUPORTE-02` | Workflow do chamado | Responder, alterar status e excluir ficam indisponíveis quando o status ou o papel do usuário não permite a ação. | `criar apps/suporte/app/[id]/page.test.tsx`                                          |

Comando mínimo:

```bash
pnpm --filter suporte test
```

## API

### `auth`

| Classe        | Área            | Invariante obrigatória                                                                                | Teste bloqueante                                                                                               |
| ------------- | --------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `API-AUTH-01` | Sessão e cookie | `login`, `logout` e `me` mantêm sessão íntegra em cookie `HttpOnly` e nunca retornam hash ou segredo. | `criar services/api/src/modules/auth/auth.service.spec.ts` e `criar services/api/test/auth.controller.spec.ts` |
| `API-AUTH-02` | Troca de senha  | Troca de senha exige validação do usuário corrente, persiste hash e invalida sessões afetadas.        | `criar services/api/src/modules/auth/auth.service.spec.ts`                                                     |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/auth/auth.service.spec.ts test/auth.controller.spec.ts --runInBand
```

### `calendar`

| Classe            | Área               | Invariante obrigatória                                                                                  | Teste bloqueante                                                                                                     |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `API-CALENDAR-01` | Escopo e filtros   | Eventos, estatísticas e dias letivos respeitam escola, unidade, período e perfil da sessão.             | `services/api/test/calendar.controller.spec.js` e `criar services/api/src/modules/calendar/calendar.service.spec.ts` |
| `API-CALENDAR-02` | Mutação de eventos | Criar, editar e excluir eventos valida intervalos, tipo e permissão sem produzir calendário incoerente. | `services/api/test/calendar.controller.spec.js`                                                                      |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- test/calendar.controller.spec.js src/modules/calendar/calendar.service.spec.ts --runInBand
```

### `health`

| Classe          | Área                    | Invariante obrigatória                                                                                         | Teste bloqueante                                    |
| --------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `API-HEALTH-01` | Shape da resposta       | `/health` sempre retorna `status`, `timestamp`, `uptime`, `database` e `redis` sem vazar configuração interna. | `criar services/api/test/health.controller.spec.ts` |
| `API-HEALTH-02` | Dependências degradadas | Falha de banco ou Redis é refletida de forma explícita e estável no payload de saúde.                          | `criar services/api/test/health.controller.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- test/health.controller.spec.ts --runInBand
```

### `plannings`

| Classe             | Área                    | Invariante obrigatória                                                                               | Teste bloqueante                                                                                              |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `API-PLANNINGS-01` | Draft, submit e revisão | Rascunho, submissão, aprovação e devolução obedecem transições de status e papel do usuário.         | `services/api/src/modules/plannings/plannings.service.spec.ts`                                                |
| `API-PLANNINGS-02` | Dashboard e escopo      | Dashboard, feedback, revisões e consultas por segmento respeitam turma, quinzena e tenant da sessão. | `services/api/src/modules/plannings/plannings.service.spec.ts` e `services/api/test/plannings.module.spec.js` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/plannings/plannings.service.spec.ts test/plannings.module.spec.js --runInBand
```

### `plano-aula`

| Classe              | Área                  | Invariante obrigatória                                                                                                  | Teste bloqueante                                                           |
| ------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `API-PLANO-AULA-01` | Workflow pedagógico   | Criar, submeter, recuperar, aprovar e devolver respeitam status, prazo e role sem saltos inválidos.                     | `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`           |
| `API-PLANO-AULA-02` | Histórico e auditoria | Toda mutação relevante gera histórico consistente e nunca perde autoria nem timestamp lógico.                           | `services/api/src/modules/plano-aula/plano-aula-historico.service.spec.ts` |
| `API-PLANO-AULA-03` | Documentos            | Upload, link, sync, download, aprovação e impressão preservam ownership do plano, vínculo com documento e idempotência. | `criar services/api/src/modules/plano-aula/plano-aula.controller.spec.ts`  |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts src/modules/plano-aula/plano-aula-historico.service.spec.ts src/modules/plano-aula/plano-aula.controller.spec.ts --runInBand
```

### `plano-aula-periodo`

| Classe                      | Área                 | Invariante obrigatória                                                                               | Teste bloqueante                                                                    |
| --------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `API-PLANO-AULA-PERIODO-01` | Escopo de período    | Um período sempre pertence à turma correta e não pode ser lido ou alterado fora do escopo da sessão. | `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.spec.ts` |
| `API-PLANO-AULA-PERIODO-02` | Integridade de datas | Criação, edição e exclusão validam datas, sobreposição e consistência mínima do ciclo.               | `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`    |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula-periodo/plano-aula-periodo.controller.spec.ts src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts --runInBand
```

### `prova`

| Classe         | Área                 | Invariante obrigatória                                                                                                  | Teste bloqueante                                                |
| -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `API-PROVA-01` | Workflow de prova    | Criar, enviar para impressão, enviar para análise, reenviar, responder e recuperar seguem transições válidas por papel. | `criar services/api/src/modules/prova/prova.service.spec.ts`    |
| `API-PROVA-02` | Documentos e revisão | Upload, edição Word, sincronização, aprovação, desaprovação e impressão preservam vínculo, autoria e estado.            | `criar services/api/src/modules/prova/prova.controller.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/prova/prova.service.spec.ts src/modules/prova/prova.controller.spec.ts --runInBand
```

### `prova-ciclo`

| Classe               | Área            | Invariante obrigatória                                                                                     | Teste bloqueante                                                            |
| -------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `API-PROVA-CICLO-01` | Escopo do ciclo | Um ciclo de prova pertence à turma certa e não pode ser criado, editado ou removido fora do tenant válido. | `criar services/api/src/modules/prova-ciclo/prova-ciclo.service.spec.ts`    |
| `API-PROVA-CICLO-02` | Janela temporal | Datas, ordem cronológica e unicidade lógica do ciclo precisam ser validadas antes da persistência.         | `criar services/api/src/modules/prova-ciclo/prova-ciclo.controller.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/prova-ciclo/prova-ciclo.service.spec.ts src/modules/prova-ciclo/prova-ciclo.controller.spec.ts --runInBand
```

### `quinzena-documents`

| Classe                 | Área               | Invariante obrigatória                                                                               | Teste bloqueante                                                                          |
| ---------------------- | ------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `API-QUINZENA-DOCS-01` | Upload e vínculo   | Upload só aceita documento válido, associa à quinzena correta e persiste metadados de forma atômica. | `criar services/api/src/modules/quinzena-documents/quinzena-documents.service.spec.ts`    |
| `API-QUINZENA-DOCS-02` | Listagem e remoção | Listar e excluir documentos respeita role, tenant e ownership do registro.                           | `criar services/api/src/modules/quinzena-documents/quinzena-documents.controller.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/quinzena-documents/quinzena-documents.service.spec.ts src/modules/quinzena-documents/quinzena-documents.controller.spec.ts --runInBand
```

### `schools`

| Classe           | Área                   | Invariante obrigatória                                                                             | Teste bloqueante                                                 |
| ---------------- | ---------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `API-SCHOOLS-01` | CRUD e RBAC            | Apenas perfis autorizados administram escolas; IDs e payload nunca expandem escopo real da sessão. | `services/api/test/schools.controller.spec.js`                   |
| `API-SCHOOLS-02` | Integridade relacional | Alterar ou remover escola nunca pode produzir unidades, usuários ou estatísticas órfãs.            | `criar services/api/src/modules/schools/schools.service.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- test/schools.controller.spec.js src/modules/schools/schools.service.spec.ts --runInBand
```

### `security`

| Classe            | Área                   | Invariante obrigatória                                                                                | Teste bloqueante                                                        |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `API-SECURITY-01` | Ingestão de CSP report | Payloads suportados são normalizados sem quebrar a API e sem incluir segredos ou PII indevida em log. | `services/api/src/modules/security/csp-report.util.spec.ts`             |
| `API-SECURITY-02` | Robustez do endpoint   | Relatórios inválidos ou incompletos retornam resposta estável e nunca derrubam o request pipeline.    | `criar services/api/src/modules/security/csp-report.controller.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/security/csp-report.util.spec.ts src/modules/security/csp-report.controller.spec.ts --runInBand
```

### `setup`

| Classe         | Área                  | Invariante obrigatória                                                                                  | Teste bloqueante                                             |
| -------------- | --------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `API-SETUP-01` | Status e idempotência | `status`, `init` e `reset` concordam entre si e não deixam o ambiente em estado intermediário.          | `criar services/api/src/modules/setup/setup.service.spec.ts` |
| `API-SETUP-02` | Guardas de ambiente   | Rotas de setup só executam quando o ambiente permitir explicitamente e nunca ficam abertas em produção. | `criar services/api/test/setup.controller.spec.ts`           |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/setup/setup.service.spec.ts test/setup.controller.spec.ts --runInBand
```

### `shop`

| Classe        | Área                              | Invariante obrigatória                                                                                                  | Teste bloqueante                                                                                                                                                                                                                                          |
| ------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API-SHOP-01` | Tenant, RBAC e superfície pública | Nenhum recurso administrativo ou público escapa do escopo de tenant, role e identificadores válidos.                    | `services/api/src/modules/shop/shop-regressions.spec.ts`                                                                                                                                                                                                  |
| `API-SHOP-02` | Catálogo, estoque e pedidos       | Catálogo, inventário, reserva, confirmação de pagamento, retirada e interesse permanecem consistentes sob concorrência. | `services/api/src/modules/shop/shop-products.service.spec.ts`, `services/api/src/modules/shop/shop-inventory.service.spec.ts`, `services/api/src/modules/shop/shop-orders.service.spec.ts`, `services/api/src/modules/shop/shop-interest.service.spec.ts` |
| `API-SHOP-03` | Configuração e contratos UI/API   | Dashboard, payloads administrativos e contratos consumidos por `loja` e `loja-admin` preservam o shape acordado.        | `services/api/src/modules/shop/shop-locations.service.spec.ts` e `services/api/src/modules/shop/shop-regressions.spec.ts`                                                                                                                                 |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts src/modules/shop/shop-products.service.spec.ts src/modules/shop/shop-inventory.service.spec.ts src/modules/shop/shop-orders.service.spec.ts src/modules/shop/shop-interest.service.spec.ts src/modules/shop/shop-locations.service.spec.ts --runInBand
```

Referência detalhada: [docs/LOJA_INVARIANTES_TESTES.md](./LOJA_INVARIANTES_TESTES.md)

### `stages`

| Classe          | Área                        | Invariante obrigatória                                                                               | Teste bloqueante                                               |
| --------------- | --------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `API-STAGES-01` | Escopo por unidade          | Etapas por unidade respeitam `unitId`, tenant e relação com a escola da sessão.                      | `services/api/test/stages.controller.spec.js`                  |
| `API-STAGES-02` | Conjunto canônico de etapas | Criar, atualizar e remover etapas valida enum, evita duplicidade lógica e mantém ordenação coerente. | `criar services/api/src/modules/stages/stages.service.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- test/stages.controller.spec.js src/modules/stages/stages.service.spec.ts --runInBand
```

### `stats`

| Classe         | Área                  | Invariante obrigatória                                                                                       | Teste bloqueante                                             |
| -------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `API-STATS-01` | Escopo das métricas   | `dashboard` e `master-overview` agregam somente dados permitidos ao usuário corrente.                        | `criar services/api/src/modules/stats/stats.service.spec.ts` |
| `API-STATS-02` | Consistência numérica | Totais, contagens e recortes temporais precisam fechar entre si e nunca retornar shape parcial incompatível. | `criar services/api/test/stats.controller.spec.ts`           |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/stats/stats.service.spec.ts test/stats.controller.spec.ts --runInBand
```

### `suporte`

| Classe           | Área                 | Invariante obrigatória                                                                            | Teste bloqueante                                              |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `API-SUPORTE-01` | Chamado e mensagens  | Chamados, mensagens e contagens respeitam tenant, autoria e escopo do usuário.                    | `services/api/src/modules/suporte/suporte.service.spec.ts`    |
| `API-SUPORTE-02` | Workflow operacional | Abrir, responder, mudar status e excluir só ocorre em transições válidas e com permissão correta. | `services/api/src/modules/suporte/suporte.controller.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/suporte/suporte.service.spec.ts src/modules/suporte/suporte.controller.spec.ts --runInBand
```

### `tarefas`

| Classe           | Área                | Invariante obrigatória                                                                               | Teste bloqueante                                                                                                                      |
| ---------------- | ------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `API-TAREFAS-01` | Acesso e resumo     | Criar, listar, detalhar e resumir tarefas respeita `TarefaAccessGuard`, escopo e filtros do usuário. | `services/api/src/modules/tarefas/tarefas.service.spec.ts` e `criar services/api/src/modules/tarefas/tarefas.controller.spec.ts`      |
| `API-TAREFAS-02` | Conclusão e eventos | Concluir tarefa é idempotente, registra data corretamente e emite evento uma única vez.              | `services/api/src/modules/tarefas/tarefas.service.spec.ts` e `criar services/api/src/modules/tarefas/tarefas-eventos.service.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/tarefas/tarefas.service.spec.ts src/modules/tarefas/tarefas.controller.spec.ts src/modules/tarefas/tarefas-eventos.service.spec.ts --runInBand
```

### `turmas`

| Classe          | Área               | Invariante obrigatória                                                                                | Teste bloqueante                                                                                                     |
| --------------- | ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `API-TURMAS-01` | Escopo da turma    | Toda turma pertence à unidade e etapa válidas da escola da sessão; busca por ID não atravessa tenant. | `criar services/api/src/modules/turmas/turmas.service.spec.ts` e `criar services/api/test/turmas.controller.spec.ts` |
| `API-TURMAS-02` | Professora titular | Definir, trocar ou remover professora mantém unicidade da titularidade e valida disponibilidade real. | `criar services/api/src/modules/turmas/turmas.service.spec.ts`                                                       |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/turmas/turmas.service.spec.ts test/turmas.controller.spec.ts --runInBand
```

### `units`

| Classe         | Área                   | Invariante obrigatória                                                                                   | Teste bloqueante                                             |
| -------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `API-UNITS-01` | Rota aninhada          | `schools/:schoolId/units` nunca cria, lê, atualiza ou exclui unidade de outra escola.                    | `criar services/api/test/units.controller.spec.ts`           |
| `API-UNITS-02` | Integridade de unidade | Diretoria, etapas e metadados da unidade permanecem consistentes após CRUD e não deixam vínculos órfãos. | `criar services/api/src/modules/units/units.service.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- test/units.controller.spec.ts src/modules/units/units.service.spec.ts --runInBand
```

### `users`

| Classe         | Área                  | Invariante obrigatória                                                                                   | Teste bloqueante                                                                               |
| -------------- | --------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `API-USERS-01` | Escopo e privilégio   | CRUD de usuários respeita escola, unidade e teto de role do usuário autenticado, sem elevação indevida.  | `services/api/test/users.service.spec.js` e `criar services/api/test/users.controller.spec.ts` |
| `API-USERS-02` | Sigilo e consistência | Senha, hash e campos sensíveis nunca vazam nas respostas; role, escola e unidade precisam ser coerentes. | `services/api/test/users.service.spec.js`                                                      |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- test/users.service.spec.js test/users.controller.spec.ts --runInBand
```

### `storage`

| Classe           | Área            | Invariante obrigatória                                                                                | Teste bloqueante                                                   |
| ---------------- | --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `API-STORAGE-01` | Conteúdo seguro | Upload aceita apenas tipos suportados validados por assinatura real do arquivo.                       | `services/api/src/common/storage/storage.service.spec.ts`          |
| `API-STORAGE-02` | Rota de upload  | Endpoint de upload exige autenticação e retorna apenas metadados canônicos necessários ao consumidor. | `criar services/api/src/common/storage/storage.controller.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/common/storage/storage.service.spec.ts src/common/storage/storage.controller.spec.ts --runInBand
```

### `sharepoint`

| Classe              | Área                     | Invariante obrigatória                                                                              | Teste bloqueante                                                                                                                                         |
| ------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API-SHAREPOINT-01` | Link de edição e sync    | Links de edição, sincronização e visualização respeitam ownership do documento, expiração e tenant. | `services/api/src/common/sharepoint/sharepoint.service.spec.ts`                                                                                          |
| `API-SHAREPOINT-02` | Cleanup e geração de PDF | Limpeza de artefatos e geração de PDF são idempotentes e não deixam arquivos temporários órfãos.    | `criar services/api/src/common/sharepoint/pdf-generator.service.spec.ts` e `criar services/api/src/common/sharepoint/sharepoint-cleanup.service.spec.ts` |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/common/sharepoint/sharepoint.service.spec.ts src/common/sharepoint/pdf-generator.service.spec.ts src/common/sharepoint/sharepoint-cleanup.service.spec.ts --runInBand
```

## Critério de Saída por Mudança

Uma alteração só pode ser considerada pronta quando:

1. As classes impactadas estiverem declaradas no PR, na issue ou na descrição técnica.
2. Cada classe impactada tiver teste novo ou ampliado.
3. O comando mínimo do módulo tiver sido executado.
4. O pipeline global `pnpm turbo lint && pnpm turbo typecheck` tiver passado.
5. Para `loja` e `loja-admin`, a matriz detalhada de [docs/LOJA_INVARIANTES_TESTES.md](./LOJA_INVARIANTES_TESTES.md) também tiver sido seguida.
