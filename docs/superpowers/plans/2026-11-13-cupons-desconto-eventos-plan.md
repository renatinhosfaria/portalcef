# Cupons de desconto nos eventos — Implementation Plan

> **Para agentes de implementação:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam caixas de seleção para acompanhamento.

**Objetivo:** Permitir o cadastro de vários cupons por evento, a aplicação no carrinho e a confirmação de pedidos pagos ou gratuitos com descontos acumulados.

**Arquitetura:** Criar entidades próprias para cupons, retenções e usos confirmados. Reutilizar o motor compartilhado de preços, aplicando a oferta por quantidade antes do cupom; guardar snapshot do cupom no pedido; confirmar ou reverter o uso em transações ligadas ao ciclo do pedido. O painel administrativo e a vitrine pública continuam consumindo a API HTTP existente.

**Stack:** Turborepo + pnpm, TypeScript, NestJS/Fastify, Drizzle/PostgreSQL, Next.js App Router, React, Vitest, Jest e Stripe Embedded Checkout.

**Spec:** `docs/superpowers/specs/2026-11-13-cupons-desconto-eventos-design.md`

## Restrições globais

- Comunicação, código de domínio, testes, commits e documentação em português do Brasil.
- Apps não acessam o banco diretamente; o app público e o workspace usam a API HTTP.
- A oferta automática por quantidade continua separada dos cupons e é aplicada primeiro.
- O cupom vale para o evento inteiro, sem filtros de sessão ou tipo de ingresso.
- Um cupom percentual pode chegar a 100%; total zero confirma o pedido sem Stripe.
- O uso só é confirmado após pagamento confirmado ou confirmação gratuita; reembolso/cancelamento reverte o uso.
- O pipeline obrigatório antes de commit/PR é `pnpm turbo lint && pnpm turbo typecheck`.
- Alterações em `services/api/src/modules/eventos` e `apps/eventos` precisam de testes focados antes do pipeline global.

## Foco de revisão

- Dois compradores concorrentes disputando o último uso do mesmo cupom: somente um deve confirmar e o outro deve receber erro sem emitir ingresso. (Tarefa 5.)
- Cupom de 100%: o pedido deve pular Stripe, registrar uso e emitir ingressos exatamente uma vez. (Tarefa 6.)
- Cupom editado/desativado depois de aplicado: o carrinho deve usar o snapshot congelado, enquanto novas aplicações devem ser recusadas. (Tarefas 4 e 5.)
- Reembolso/cancelamento depois de confirmação: o uso deve ser revertido uma única vez e ficar auditado. (Tarefa 7.)
- Limite por comprador: coincidir e-mail **ou** telefone normalizado deve bloquear nova utilização, sem permitir contorno trocando apenas um contato. (Tarefas 1 e 5.)

### Task 1: Contratos compartilhados, normalização e cálculo sequencial

**Arquivos:**
- Criar: `packages/shared/src/eventos/cupons.ts`
- Criar: `packages/shared/src/eventos/cupons.test.ts`
- Modificar: `packages/shared/src/eventos/precos.ts`
- Modificar: `packages/shared/src/eventos/precos.test.ts`
- Modificar: `packages/shared/src/schemas/eventos.ts`
- Modificar: `packages/shared/src/schemas/eventos-cupom.test.ts` (criar se o arquivo ainda não existir)
- Modificar: `packages/shared/src/schemas/index.ts`
- Modificar: `packages/shared/src/types/eventos.ts`

**Interfaces:**
- Produz `TipoPrecoCupom`, `CupomPreco`, `CupomAdmin`, `CupomAplicado`, `normalizarCodigoCupom(codigo: string): string` e `identidadeCupomDoComprador(input: { email: string; phone: string }): { email: string; phone: string }`.
- Estende `calcularPrecoPedido(input: { items: ItemPreco[]; offers: OfertaPreco[]; coupon?: CupomPreco | null; minimumTotalCents?: number }): ResultadoPrecoPedido` para retornar `offerDiscountCents`, `couponDiscountCents`, `discountCents`, `totalCents`, `appliedOffer`, `appliedCoupon` e os preços finais dos itens.
- Produz schemas para CRUD administrativo, aplicação pública de cupom e os tipos correspondentes exportados por `@essencia/shared/schemas` e `@essencia/shared/types`.

- [ ] **Passo 1: Escrever os testes que falham** para normalização de código, identidade por e-mail/telefone, cupom percentual/fixo, cupom de 100%, total entre 1 e 99 centavos, arredondamento e soma sequencial oferta→cupom.
- [ ] **Passo 2: Executar os testes focados e confirmar a falha**

  Executar: `pnpm --filter @essencia/shared test -- src/eventos/cupons.test.ts src/eventos/precos.test.ts src/schemas/eventos-cupom.test.ts`

  Esperado: FAIL porque os tipos, schemas e campos de cupom ainda não existem.
- [ ] **Passo 3: Implementar os contratos e o cálculo mínimo** nas assinaturas acima. Reutilizar a alocação determinística atual por maior resto, calculando primeiro a alocação da oferta e depois a do cupom sobre o subtotal restante; preservar o limite de total zero e a rejeição de valores positivos abaixo de R$ 1,00.
- [ ] **Passo 4: Executar os testes e confirmar aprovação**

  Executar o mesmo comando do Passo 2. Esperado: PASS.
- [ ] **Passo 5: Commit**

  `git add packages/shared/src/eventos packages/shared/src/schemas packages/shared/src/types/eventos.ts && git commit -m "feat: adiciona contratos e calculo de cupons"`

### Task 2: Persistência, índices e migração dos cupons

**Arquivos:**
- Modificar: `packages/db/src/schema/eventos.ts`
- Modificar: `packages/db/src/schema/eventos.test.ts`
- Criar: `packages/db/drizzle/0057_eventos_cupons.sql`
- Modificar: `packages/db/src/schema/index.ts` se os novos símbolos ainda não forem reexportados automaticamente

**Interfaces:**
- Produz `eventoCupons`, `eventoCupomRetencoes` e `eventoCupomUsos`, com os tipos Drizzle de select/insert.
- Adiciona ao `eventoPedidos` `appliedCouponId`, `couponSnapshot` e `couponDiscountCents`.
- Usa estados de retenção `ATIVA`, `CONVERTIDA`, `LIBERADA` e de uso `CONFIRMADO`, `REVERTIDO`; mantém unicidade por cupom/pedido e código normalizado por evento.

- [ ] **Passo 1: Escrever testes de schema que falham** verificando checks de percentual 1–100, valor fixo não negativo, datas coerentes, limites positivos, índice único `(event_id, code)`, colunas do pedido e unicidade das retenções/usos.
- [ ] **Passo 2: Executar o teste de schema e confirmar a falha**

  Executar: `pnpm --filter @essencia/db test`. Esperado: FAIL pela ausência das tabelas/colunas.
- [ ] **Passo 3: Implementar tabelas e a migration `0057_eventos_cupons.sql`** seguindo as convenções de `packages/db/src/schema/eventos.ts`, com FKs que preservem os pedidos e permitam histórico de uso revertido.
- [ ] **Passo 4: Executar o teste de schema e validar a migration gerada**

  Executar: `pnpm --filter @essencia/db test && pnpm --filter @essencia/db typecheck`. Esperado: PASS e migration consistente com o schema.
- [ ] **Passo 5: Commit**

  `git add packages/db/src/schema packages/db/drizzle/0057_eventos_cupons.sql && git commit -m "feat: cria persistencia de cupons de eventos"`

### Task 3: Serviço administrativo de cupons e rotas protegidas

**Arquivos:**
- Criar: `services/api/src/modules/eventos/eventos-cupons.service.ts`
- Criar: `services/api/src/modules/eventos/eventos-cupons.service.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos-admin.controller.ts`
- Modificar: `services/api/src/modules/eventos/eventos.module.ts`
- Modificar: `services/api/src/modules/eventos/eventos.controller.spec.ts` ou criar teste de rotas de cupons

**Interfaces:**
- Produz `EventosCuponsService.listarAdmin(eventId: string, actor: EventoActor): Promise<CupomAdmin[]>`.
- Produz `EventosCuponsService.atualizar(eventId: string, inputs: AtualizarCupomInput[], actor: EventoActor): Promise<CupomAdmin[]>` com versionamento otimista, normalização do código, validação de datas/limites e auditoria.
- Expõe `GET /eventos/admin/:id/cupons` e `PATCH /eventos/admin/:id/cupons`, protegidos pelos mesmos `AuthGuard`, `RolesGuard` e `EVENTOS_ADMIN_ROLES` das ofertas.

- [ ] **Passo 1: Escrever testes que falham** para escopo de escola, criação/edição de vários cupons, código duplicado normalizado, datas inválidas, limites, conflito de versão, ativação/desativação, histórico e auditoria.
- [ ] **Passo 2: Executar os testes focados e confirmar a falha**

  Executar: `pnpm --filter @essencia/api exec jest src/modules/eventos/eventos-cupons.service.spec.ts --runInBand`. Esperado: FAIL porque o serviço não existe.
- [ ] **Passo 3: Implementar o serviço e as rotas** com transação e lock da linha do evento, mantendo cupons inativos em vez de apagar registros. O resumo administrativo deve incluir usos confirmados e limite, mas nunca dados de retenções internas.
- [ ] **Passo 4: Executar os testes focados e os contratos do controller**

  Executar: `pnpm --filter @essencia/api exec jest src/modules/eventos/eventos-cupons.service.spec.ts src/modules/eventos/eventos.controller.spec.ts --runInBand`. Esperado: PASS.
- [ ] **Passo 5: Commit**

  `git add services/api/src/modules/eventos packages/shared/src/schemas packages/shared/src/types && git commit -m "feat: adiciona administracao de cupons"`

### Task 4: Aplicação pública, snapshot e recálculo do pedido reservado

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public.controller.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`
- Modificar: `apps/eventos/lib/eventos-api.ts`
- Modificar: `packages/shared/src/types/eventos.ts`

**Interfaces:**
- Produz `EventosPublicSalesService.aplicarCupom(orderNumber: string, raw: unknown): Promise<PedidoPublicoResult>` e a rota `POST /eventos/public/pedidos/:orderNumber/cupom` com `{ code: string }`, aceitando vazio para remover.
- `ReservaPublicaResult` e `PedidoPublicoResult` passam a expor `appliedCoupon`, `couponDiscountCents`, `offerDiscountCents` e `discountCents` total.
- A API pública expõe `aplicarCupom(orderNumber: string, code: string): Promise<PedidoPublicoResult>` com idempotência por pedido/código normalizado.

- [ ] **Passo 1: Escrever testes que falham** para código válido/normalizado, inválido, inativo, fora da validade, limite esgotado, total 1–99 centavos, cupom 100%, remoção, substituição, snapshot após desativação e preservação da reserva/expiração.
- [ ] **Passo 2: Executar os testes focados e confirmar a falha**

  Executar: `pnpm --filter @essencia/api exec jest src/modules/eventos/eventos-public-sales.service.spec.ts --runInBand`. Esperado: FAIL nos novos casos.
- [ ] **Passo 3: Implementar o endpoint transacional**: carregar pedido e assentos com lock, validar o código atual somente na aplicação, recalcular oferta→cupom, atualizar os itens/pedido e guardar snapshot; ao ler um pedido que já tem snapshot, não consultar a validade atual para mudar o preço.
- [ ] **Passo 4: Executar os testes focados e os testes do cliente API**

  Executar: `pnpm --filter @essencia/api exec jest src/modules/eventos/eventos-public-sales.service.spec.ts --runInBand && pnpm --filter @essencia/eventos test -- lib/eventos-api.test.ts`. Esperado: PASS.
- [ ] **Passo 5: Commit**

  `git add services/api/src/modules/eventos/eventos-public-sales.service.ts services/api/src/modules/eventos/eventos-public.controller.ts services/api/src/modules/eventos/eventos-public-sales.service.spec.ts apps/eventos/lib/eventos-api.ts packages/shared/src/types/eventos.ts && git commit -m "feat: aplica cupons no pedido publico"`

### Task 5: Retenções, limites concorrentes e reversão do uso

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/eventos-cupons.service.ts`
- Modificar: `services/api/src/modules/eventos/eventos-cupons.service.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`
- Modificar: `services/api/src/modules/eventos/jobs/eventos-expiration.job.ts`
- Modificar: `services/api/src/modules/eventos/eventos-pagamentos.service.ts`

**Interfaces:**
- Produz `reterUso(orderId: string, checkoutKey: string, buyer: { email: string; phone: string }, expiresAt: Date, db: Database): Promise<void>`.
- Produz `confirmarUso(orderId: string, db: Database): Promise<void>`, `liberarRetencao(orderId: string, motivo: string, db: Database): Promise<void>` e `reverterUso(orderId: string, motivo: string, db: Database): Promise<void>`; todas são idempotentes.
- `iniciarCheckout` revalida o snapshot, cria a retenção e só cria Stripe para total maior que zero; `confirmarCheckout` delega a confirmação ao serviço compartilhado, que converte a retenção sob lock do cupom.

- [ ] **Passo 1: Escrever testes que falham** para limite total, limite por e-mail ou telefone, mesma retenção idempotente, corrida entre dois pedidos, liberação por expiração/liberarPedido/falha do gateway, conversão única e reversão única em cancelamento/reembolso.
- [ ] **Passo 2: Executar os testes focados e confirmar a falha**

  Executar: `pnpm --filter @essencia/api exec jest src/modules/eventos/eventos-cupons.service.spec.ts src/modules/eventos/eventos-public-sales.service.spec.ts --runInBand`. Esperado: FAIL nos novos cenários.
- [ ] **Passo 3: Implementar locks e estados de retenção/uso**: contar retenções ativas junto dos usos confirmados, bloquear se qualquer contato coincidir, liberar retenções nos caminhos existentes de expiração/liberação e registrar auditoria para conversão/reversão.
- [ ] **Passo 4: Executar os testes focados e o typecheck da API**

  Executar: `pnpm --filter @essencia/api exec jest src/modules/eventos/eventos-cupons.service.spec.ts src/modules/eventos/eventos-public-sales.service.spec.ts --runInBand && pnpm --filter @essencia/api typecheck`. Esperado: PASS.
- [ ] **Passo 5: Commit**

  `git add services/api/src/modules/eventos && git commit -m "feat: controla usos concorrentes de cupons"`

### Task 6: Pedido gratuito de cupom de 100% e confirmação compartilhada

**Arquivos:**
- Criar: `services/api/src/modules/eventos/eventos-confirmacao.service.ts`
- Criar: `services/api/src/modules/eventos/eventos-confirmacao.service.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- Modificar: `services/api/src/modules/eventos/eventos-pagamentos.service.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts`
- Modificar: `packages/shared/src/types/eventos.ts`

**Interfaces:**
- Produz `EventosConfirmacaoService.confirmarPedido(orderId: string, origem: "STRIPE" | "CORTESIA_100", db: Database): Promise<void>` para emitir ingressos, converter reservas, confirmar pedido e chamar `confirmarUso` exatamente uma vez.
- `FinalizacaoPublicaResult` passa a informar `pagamentoNecessario: boolean`; `finalizarPedidoConvidado` chama a confirmação gratuita quando `totalCents === 0`, e o cliente não chama `iniciarPagamento` nesse caso.

- [ ] **Passo 1: Escrever testes que falham** para confirmação gratuita de total zero, ausência de registro Stripe, emissão de ingressos, idempotência, uso do cupom e manutenção do fluxo pago existente.
- [ ] **Passo 2: Executar os testes focados e confirmar a falha**

  Executar: `pnpm --filter @essencia/api exec jest src/modules/eventos/eventos-confirmacao.service.spec.ts src/modules/eventos/eventos-public-sales.service.spec.ts src/modules/eventos/eventos-pagamentos.service.spec.ts --runInBand`. Esperado: FAIL.
- [ ] **Passo 3: Extrair a confirmação transacional compartilhada** do serviço de pagamentos, implementar o caminho gratuito após os aceites e manter a verificação de mínimo de R$ 1,00 somente para totais positivos.
- [ ] **Passo 4: Executar os testes focados e validar a API**

  Executar o mesmo comando do Passo 2. Esperado: PASS.
- [ ] **Passo 5: Commit**

  `git add services/api/src/modules/eventos packages/shared/src/types/eventos.ts && git commit -m "feat: confirma pedidos gratuitos com cupom"`

### Task 7: Reversão do uso em reembolso e cancelamento

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/eventos-cupons.service.ts`
- Modificar: `services/api/src/modules/eventos/eventos-cupons.service.spec.ts`
- Modificar: `services/api/src/modules/payments/payments-webhook.controller.ts`
- Modificar: testes do webhook de pagamentos que já cobrem `charge.refunded`
- Modificar: o serviço administrativo de reembolso/cancelamento de eventos, caso a branch já o contenha

**Interfaces:**
- Produz `EventosCuponsService.reverterUsoPorPedido(orderId: string, motivo: string, db: Database): Promise<void>`, idempotente para estados `REVERTIDO` e ausências.
- O webhook de `charge.refunded` identifica pagamentos de eventos e chama a reversão sem alterar o fluxo de pedidos da loja.
- Qualquer caminho administrativo que altere um pedido confirmado para `REEMBOLSADO` ou `CANCELADO` chama a mesma operação antes de concluir a transação.

- [ ] **Passo 1: Escrever testes que falham** para reverter uso pago e gratuito, ignorar reembolso duplicado, manter auditoria e não afetar pedidos da loja.
- [ ] **Passo 2: Executar os testes focados e confirmar a falha**

  Executar: `pnpm --filter @essencia/api exec jest src/modules/payments/payments-webhook.controller.spec.ts src/modules/eventos/eventos-cupons.service.spec.ts --runInBand`. Esperado: FAIL nos novos cenários.
- [ ] **Passo 3: Implementar a reversão idempotente e o branch de webhook**; se não existir ainda uma rota de cancelamento administrativo de pedidos de eventos, deixar o método transacional pronto para o serviço que fizer essa transição, sem criar um novo fluxo de cancelamento nesta entrega.
- [ ] **Passo 4: Executar os testes focados e confirmar aprovação**

  Executar o mesmo comando do Passo 2. Esperado: PASS.
- [ ] **Passo 5: Commit**

  `git add services/api/src/modules/eventos services/api/src/modules/payments && git commit -m "feat: reverte uso de cupom em reembolso"`

### Task 8: Editor administrativo de cupons no workspace

**Arquivos:**
- Criar: `apps/eventos-admin/features/eventos/cupons-contratos.ts`
- Criar: `apps/eventos-admin/features/eventos/cupons-contratos.test.ts`
- Criar: `apps/eventos-admin/features/eventos/cupom-editor.tsx`
- Criar: `apps/eventos-admin/features/eventos/cupom-editor.test.tsx`
- Modificar: `apps/eventos-admin/app/eventos/[id]/ingressos/page.tsx`
- Modificar: `apps/eventos-admin/app/eventos/[id]/ingressos/page.test.ts`

**Interfaces:**
- Produz `CupomValue`, `cupomInicial`, `construirPayloadCupom(value: CupomValue): AtualizarCupomInput` e `cupomProntoParaSalvar(value: CupomValue): boolean`.
- `CupomEditor` edita código, nome, tipo, percentual/valor, vigência, limites e ativo; mostra usos confirmados/limite e nunca permite apagar cupom usado.

- [ ] **Passo 1: Escrever testes que falham** para payload, uppercase do código, validação de 100%, valores fixos, datas, limites, vários cartões, histórico inativo, autosave e conflito de versão.
- [ ] **Passo 2: Executar os testes focados e confirmar a falha**

  Executar: `pnpm --filter @essencia/eventos-admin test -- features/eventos/cupons-contratos.test.tsx app/eventos/[id]/ingressos/page.test.ts`. Esperado: FAIL porque os contratos/editor não existem.
- [ ] **Passo 3: Implementar contratos, editor e integração** usando `useEventoAutosave`, a seção **Cupons de desconto** na etapa **Ingressos** e os endpoints protegidos do workspace.
- [ ] **Passo 4: Executar os testes focados e confirmar aprovação**

  Executar o mesmo comando do Passo 2. Esperado: PASS.
- [ ] **Passo 5: Commit**

  `git add apps/eventos-admin/app/eventos/[id]/ingressos apps/eventos-admin/features/eventos && git commit -m "feat: configura cupons no workspace de eventos"`

### Task 9: Campo de cupom, resumo e caminho gratuito na vitrine

**Arquivos:**
- Criar: `apps/eventos/components/checkout/cupom-pedido.tsx`
- Criar: `apps/eventos/components/checkout/__tests__/cupom-pedido.test.tsx`
- Modificar: `apps/eventos/components/checkout/resumo-pedido.tsx`
- Modificar: `apps/eventos/components/checkout/fluxo-checkout.tsx`
- Modificar: `apps/eventos/components/checkout/__tests__/resumo-pedido.test.tsx` (criar se necessário)
- Modificar: `apps/eventos/components/__tests__/checkout*.test.tsx` conforme os testes existentes
- Modificar: `apps/eventos/lib/eventos-api.ts` e seus testes

**Interfaces:**
- Produz `CupomPedido({ pedido, onAtualizar }: { pedido: PedidoPublicoResult; onAtualizar: (pedido: PedidoPublicoResult) => void }): JSX.Element`.
- O resumo mostra oferta automática, cupom, descontos separados, total e mensagens de aplicação/remoção.
- `FluxoCheckout.enviar` usa `pagamentoNecessario`; quando falso, direciona para a página de ingressos sem chamar Stripe.

- [ ] **Passo 1: Escrever testes que falham** para aplicar/remover, loading, códigos inválido/expirado/limite, atualização do total, subtotal zero, mensagem de pedido gratuito e ausência da chamada de pagamento quando `pagamentoNecessario === false`.
- [ ] **Passo 2: Executar os testes focados e confirmar a falha**

  Executar: `pnpm --filter @essencia/eventos test -- components/checkout/__tests__/cupom-pedido.test.tsx components/checkout/__tests__/resumo-pedido.test.tsx app/checkout-page.test.tsx`. Esperado: FAIL.
- [ ] **Passo 3: Implementar o componente e integrar o estado retornado pela API** sem recalcular preços no navegador; preservar o relógio e a ação de alterar lugares.
- [ ] **Passo 4: Executar os testes focados e confirmar aprovação**

  Executar o mesmo comando do Passo 2. Esperado: PASS.
- [ ] **Passo 5: Commit**

  `git add apps/eventos/components/checkout apps/eventos/lib/eventos-api.ts apps/eventos/app/checkout apps/eventos/components/__tests__ && git commit -m "feat: aplica cupons no checkout publico"`

### Task 10: Integração, regressão e verificação final

**Arquivos:**
- Modificar: testes existentes de `services/api/src/modules/eventos`, `packages/shared/src/eventos`, `apps/eventos` e `apps/eventos-admin` apenas quando os novos contratos exigirem atualização.
- Modificar: `docs/API.md` e documentação do módulo de eventos se os endpoints públicos/admin ainda não estiverem descritos.

- [ ] **Passo 1: Executar os testes focados de todos os pacotes**

  Executar: `pnpm --filter @essencia/shared test && pnpm --filter @essencia/db test && pnpm --filter @essencia/api exec jest src/modules/eventos --runInBand && pnpm --filter @essencia/eventos test && pnpm --filter @essencia/eventos-admin test`.
- [ ] **Passo 2: Executar lint e typecheck globais**

  Executar: `pnpm turbo lint && pnpm turbo typecheck`. Esperado: PASS sem warnings novos introduzidos pela feature.
- [ ] **Passo 3: Revisar a migration em banco de desenvolvimento**

  Executar: `pnpm db:generate` apenas se o arquivo gerado divergir do schema; aplicar com `pnpm db:migrate` no ambiente de desenvolvimento e confirmar índices, checks e FKs.
- [ ] **Passo 4: Revisar a árvore e documentar o resultado**

  Confirmar que não há `.env`, segredos, pedidos reais ou modificações fora do escopo; atualizar a documentação de API e registrar os comandos executados.
- [ ] **Passo 5: Commit final**

  `git add docs/API.md docs/superpowers/plans/2026-11-13-cupons-desconto-eventos-plan.md && git commit -m "docs: registra plano e contratos de cupons"`
