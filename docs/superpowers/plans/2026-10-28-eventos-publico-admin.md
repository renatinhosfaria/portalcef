# Eventos público e administrativo Implementation Plan

> **Para agentes de implementação:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`) para acompanhamento.

**Goal:** Separar o painel autenticado em `eventos-admin` e entregar uma vitrine pública multi-evento em `https://eventos.portalcef.com.br`, com catálogo, sessões, seleção de assentos e checkout convidado.

**Architecture:** O código administrativo atual será movido para `apps/eventos-admin`, com `basePath` `/eventos-admin`, porta 3016 e o mesmo layout autenticado. Um novo `apps/eventos`, sem sessão administrativa, atenderá a raiz do subdomínio na porta 3014 e consumirá somente endpoints HTTP públicos da API. O Nginx terá hosts/upstreams separados, preservará `/eventos` como redirecionamento para o painel e usará certificado cujo SAN inclua `eventos.portalcef.com.br`.

**Tech Stack:** Monorepo Turborepo + pnpm, Next.js 15 App Router, React 19, NestJS/Fastify, Drizzle/PostgreSQL, Redis para locks/expiração, Stripe Checkout hospedado, Nginx, Docker Compose e Buildx Bake.

**Spec:** [docs/superpowers/specs/2026-10-28-eventos-publico-admin-design.md](/var/www/essencia/docs/superpowers/specs/2026-10-28-eventos-publico-admin-design.md)

## Global Constraints

- Toda comunicação, código de domínio, commits, documentação e comentários permanecem em Português do Brasil.
- Apps nunca acessam PostgreSQL, Redis ou MinIO diretamente; usam API HTTP.
- O app público não usa `TenantProvider`, `Shell` administrativo ou `/api/auth/me` obrigatório.
- O primeiro fluxo público atende somente eventos do novo modelo multi-evento; `mae-por-inteiro` continua no fluxo legado.
- A consulta pública usa somente número do pedido; o número é aleatório, não sequencial, com rate limit e resposta mínima.
- Preço, tenant, status, disponibilidade e políticas são recalculados/validados pela API, dentro de transação quando houver reserva ou pedido.
- O checkout registra no pedido as versões das políticas aceitas e só confirma pagamento por webhook Stripe idempotente.
- Antes de cada commit/PR, executar `pnpm turbo lint && pnpm turbo typecheck`; antes de declarar deploy concluído, executar `./scripts/deploy.sh` e o health check completo.
- Nenhuma alteração de certificado ou publicação externa ocorre antes de `nginx -t`, build, testes e health checks locais/internos aprovados.

## Review Focus

- Visitante sem cookie em `eventos.portalcef.com.br/` deve receber catálogo `200`, sem login nem layout administrativo; teste em Task 2.
- Host público não pode alcançar controller/admin, `TenantProvider` ou dados de outra escola; testes de fonte/rotas e `@Public()` em Tasks 1 e 3.
- Payload adulterado com `schoolId`, preço, ticket ou assento inválido deve ser rejeitado e nunca alterar o total; testes de serviço em Task 3.
- Duas tentativas com a mesma chave ou assento concorrente devem ser idempotentes/serializadas, e reserva expirada deve liberar o inventário; testes em Tasks 3 e 4.
- TLS/SAN, assets do Next, `/eventos` legado e `/eventos-admin` precisam apontar para os upstreams corretos sem redirecionar o público para login; testes de configuração/smoke em Task 6.

## Mapa de arquivos e responsabilidades

- `apps/eventos-admin/`: origem do painel atual, com pacote `@essencia/eventos-admin`, `basePath` `/eventos-admin` e URLs administrativas corrigidas.
- `apps/eventos/`: novo app público, layout sem autenticação, páginas de catálogo/detalhe/sessão/checkout/pedido e cliente HTTP público.
- `services/api/src/modules/eventos/`: DTOs, controller público e `EventosPublicSalesService` para políticas, reservas, pedidos convidados, checkout, consulta e liberação.
- `services/api/src/modules/payments/`: encaminhamento idempotente dos eventos Stripe para pedidos de Eventos.
- `packages/components/src/shell/`: link e detecção do módulo administrativo em `/eventos-admin`.
- `docker-compose.prod.yml`, `docker-bake.hcl`: serviços, targets, portas, nomes de imagens e health checks separados.
- `nginx.conf`: hosts `eventos.portalcef.com.br`, `/eventos-admin`, redirect legado e assets/API.
- `scripts/health-check.sh`, `scripts/deploy-rolling.sh`: checks internos/externos e lista de imagens da release.
- `apps/loja-admin/__tests__/modulo-eventos.test.ts` e novos testes do módulo: contratos de localização, escopo e não regressão.

---

### Task 1: Mover o painel para `eventos-admin`

**Files:**
- Move: `apps/eventos/` → `apps/eventos-admin/` (preservar todo o painel e seus testes)
- Modify: `apps/eventos-admin/package.json`, `apps/eventos-admin/next.config.js`, `apps/eventos-admin/app/layout.tsx`, `pnpm-lock.yaml`
- Modify: arquivos do painel que contêm `/eventos/api` ou links `/eventos/...`
- Modify: `packages/components/src/shell/module-config.ts`, `packages/components/src/shell/app-sidebar.tsx`
- Modify: `apps/loja-admin/__tests__/modulo-eventos.test.ts`
- Test: `apps/eventos-admin/app/basepath.test.ts`, `apps/eventos-admin/app/page.test.ts`, testes existentes movidos

**Interfaces:**
- Produz `@essencia/eventos-admin`, `basePath: "/eventos-admin"`, `dev/start` na porta 3016 e chamadas administrativas em `/eventos-admin/api/eventos/admin/*`.
- Mantém as rotas internas do painel sob `/eventos-admin/eventos/*` e o fluxo legado administrativo sob `/eventos-admin/inscricoes-evento`.
- O link de navegação do Shell passa a ser `/eventos-admin`; `/eventos` deixa de ser uma URL primária do painel.

- [ ] **Step 1: Escrever os testes que fixam a nova fronteira administrativa**
  - Atualizar o teste de base path para exigir `/eventos-admin/api/eventos/admin`.
  - Adicionar teste que exige `basePath: "/eventos-admin"`, pacote `@essencia/eventos-admin`, porta `3016` e a presença de `TenantProvider`/`Shell` no layout.
  - Atualizar o teste de regressão do `loja-admin` para apontar para `apps/eventos-admin` e exigir que nenhum teste considere `apps/eventos` um painel.
- [ ] **Step 2: Rodar os testes e confirmar a falha**
  - Executar `pnpm --filter @essencia/eventos-admin test` depois do `git mv` inicial ou, se o pacote ainda não existir, `pnpm exec vitest run apps/eventos/app/basepath.test.ts apps/eventos/app/page.test.ts`.
  - Esperado: FAIL porque os manifestos e URLs ainda usam `eventos`/3014.
- [ ] **Step 3: Mover e ajustar o painel**
  - Usar `git mv apps/eventos apps/eventos-admin`.
  - Alterar `package.json` para `name: "@essencia/eventos-admin"`, scripts `--port 3016`, e `next.config.js` para `basePath: "/eventos-admin"`.
  - Corrigir todos os `fetch` administrativos e links absolutos de `/eventos/...` para `/eventos-admin/...`; manter intactos os endpoints legados da API `/api/eventos/:slug/...` usados pela inscrição legada.
  - Atualizar título/descrição do layout para painel administrativo e ajustar imports `@/` somente se o TypeScript exigir.
  - Atualizar `module-config.ts`, `app-sidebar.tsx` e os testes do `loja-admin` para a nova URL.
- [ ] **Step 4: Rodar testes e typecheck do app**
  - Executar `pnpm --filter @essencia/eventos-admin test` e `pnpm --filter @essencia/eventos-admin typecheck`.
  - Esperado: PASS, sem referências de build/URL administrativa para `/eventos`.
- [ ] **Step 5: Commit**
  ```bash
  git add apps/eventos-admin packages/components/src/shell apps/loja-admin/__tests__/modulo-eventos.test.ts
  git commit -m "refactor: separa painel administrativo de eventos"
  ```

### Task 2: Criar a vitrine pública de Eventos

**Files:**
- Create: `apps/eventos/package.json`, `apps/eventos/next.config.js`, `apps/eventos/tsconfig.json`, `apps/eventos/postcss.config.js`, `apps/eventos/tailwind.config.ts`, `apps/eventos/.eslintrc.cjs`
- Create: `apps/eventos/app/layout.tsx`, `apps/eventos/app/globals.css`, `apps/eventos/app/page.tsx`
- Create: `apps/eventos/app/evento/[slug]/page.tsx`, `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`, `apps/eventos/app/checkout/page.tsx`, `apps/eventos/app/pedido/[orderNumber]/page.tsx`
- Create: `apps/eventos/components/catalogo-eventos.tsx`, `apps/eventos/components/detalhe-evento.tsx`, `apps/eventos/components/mapa-assentos.tsx`, `apps/eventos/components/formulario-checkout.tsx`, `apps/eventos/components/consulta-pedido.tsx`
- Create: `apps/eventos/lib/eventos-api.ts`, `apps/eventos/lib/eventos-api.test.ts`, `apps/eventos/app/publico.test.tsx`
- Modify: `pnpm-lock.yaml`
- Copy/modify: `apps/eventos/public/favicon.ico`, `apps/eventos/public/logo.png`

**Interfaces:**
- `listarEventosPublicos(): Promise<PublicEventCard[]>`
- `obterEventoPublico(slug: string): Promise<PublicEventDetail>`
- `listarSessoesPublicas(slug: string): Promise<PublicEventSession[]>`
- `obterMapaSessao(sessionId: string): Promise<PublicMap>`
- `buscarApiPublica(path: string, init?: RequestInit): Promise<Response>` resolve `API_INTERNAL_URL` no servidor e `/api` no navegador; nunca encaminha cookie de sessão administrativa.
- Os métodos de escrita serão adicionados na Task 5 com os tipos retornados pela API da Task 3.
- Todas as funções usam `fetch` HTTP para `/api/eventos/public/*`, `cache: "no-store"` para disponibilidade e propagam erro sem redirecionar para `/login`.

- [ ] **Step 1: Escrever testes falhando para o app anônimo**
  - Testar que o `package.json` usa `@essencia/eventos`, porta 3014 e que `next.config.js` não define `basePath`.
  - Testar que o layout não contém `TenantProvider`, `Shell` ou chamada obrigatória a `/api/auth/me`.
  - Testar que a página inicial renderiza “Eventos disponíveis” e links `/evento/{slug}` a partir do contrato público.
  - Testar que o detalhe renderiza sessões/políticas e que o mapa distingue `available`, `reserved`, `sold` e `blocked` sem transformar estado reservado em disponível.
- [ ] **Step 2: Rodar os testes para confirmar a falha**
  - Executar `pnpm --filter @essencia/eventos test`.
  - Esperado: FAIL porque o pacote/app público ainda não existe.
- [ ] **Step 3: Implementar o esqueleto público**
  - Criar o pacote Next standalone sem `basePath`, com layout visual independente e idioma `pt-BR`.
  - Implementar `lib/eventos-api.ts` com validação mínima de `response.ok` e retorno tipado usando os tipos públicos de `@essencia/shared`.
  - Implementar as quatro páginas de leitura: catálogo, detalhe, sessão/mapa e consulta/checkout como componentes client somente onde houver interação.
  - No mapa, desabilitar assentos indisponíveis e passar ao checkout apenas IDs selecionados; nunca aceitar preço/tenant do navegador como fonte de verdade.
  - Exibir link explícito para consulta por número do pedido, sem pedir conta ou cookie.
- [ ] **Step 4: Rodar testes e validação do app**
  - Executar `pnpm --filter @essencia/eventos test`, `pnpm --filter @essencia/eventos lint` e `pnpm --filter @essencia/eventos typecheck`.
  - Esperado: PASS; `curl` local na raiz do app retorna HTML do catálogo e não `/login`.
- [ ] **Step 5: Commit**
  ```bash
  git add apps/eventos
  git commit -m "feat: cria vitrine pública de eventos"
  ```

### Task 3: Expor políticas e vendas públicas com invariantes de preço e estoque

**Files:**
- Create: `services/api/src/modules/eventos/dto/eventos-public.dto.ts`
- Create: `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- Create: `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`
- Modify: `services/api/src/modules/eventos/eventos-public.controller.ts`, `services/api/src/modules/eventos/eventos.module.ts`
- Modify: `packages/db/src/schema/eventos.ts`, `packages/db/src/schema/eventos.test.ts`
- Modify: `packages/shared/src/schemas/eventos.ts`, `packages/shared/src/types/eventos.ts`, índices de export correspondentes
- Test: `services/api/src/modules/eventos/eventos-public.controller.spec.ts`

**Interfaces:**
- `GET /api/eventos/public/:slug/politicas` retorna somente a política ativa de maior versão por tipo (`PRIVACIDADE`, `COMPRA`, `CANCELAMENTO_REEMBOLSO`, `ACESSIBILIDADE`, `CONTATO`).
- `POST /api/eventos/public/reservas` recebe `{ sessionId, seats: [{ seatId, ticketTypeId, participantIndex }], buyer: { name, email, phone }, idempotencyKey }` e retorna `{ reservationId, orderNumber, expiresAt, totalCents, items }`. Ele cria um pedido `INICIADO` como rascunho, verifica evento/sessão publicados, calcula os preços atuais e reserva os inventários dentro de transação.
- `POST /api/eventos/public/pedidos/:orderNumber/finalizar` recebe `{ participants, acceptances, idempotencyKey }`, valida que a reserva pertence ao pedido, que cada aceite corresponde à versão ativa e registra `eventoParticipantes`/`eventoAceites`; os cinco tipos de política são aceitos no contrato e o enum de aceite do schema é ampliado para acompanhar as políticas versionadas.
- `POST /api/eventos/public/pedidos/:orderNumber/checkout` recebe `{ successUrl, cancelUrl, idempotencyKey }`, cria/retorna Checkout Session Stripe e grava `eventoPagamentos`; resposta `{ checkoutUrl, expiresAt, orderNumber }`.
- `GET /api/eventos/public/pedidos/:orderNumber` retorna somente `{ orderNumber, status, eventTitle, session, totalCents, items, tickets? }`, sem e-mail/telefone completos, dados administrativos ou ações de alteração.
- `EventosPublicSalesService` expõe `reservarAssentos`, `finalizarPedidoConvidado`, `iniciarCheckout`, `consultarPedido` e `liberarReservasExpiradas`, todos rejeitando `schoolId`, preço, status ou disponibilidade enviados pelo cliente.
- Tipos compartilhados produzidos: `ReservaPublicaInput`, `ReservaPublicaResult`, `FinalizarPedidoInput`, `PedidoPublicoResult`, `CheckoutPublicoInput`, `ConsultaPedidoPublica` e `PoliticaPublica`.

- [ ] **Step 1: Escrever testes de contrato e segurança antes do serviço**
  - Testar que controller público é `@Public()`, aplica `@Throttle` nas rotas de escrita/consulta e não usa `AuthGuard`/`RolesGuard`.
  - Testar que política pública escolhe apenas a versão ativa mais alta.
  - Testar rejeição de evento/sessão/assento/ticket não publicados, de outro evento ou não vendável.
  - Testar que total é calculado por `eventoTiposIngresso.priceCents`/ofertas atuais e ignora qualquer preço do payload.
  - Testar que `schoolId` enviado pelo cliente não altera escopo nem consulta outra escola.
  - Testar idempotência por chave e conflito quando dois pedidos tentam o mesmo inventário.
- [ ] **Step 2: Rodar a suíte para confirmar a falha**
  - Executar `pnpm --filter @essencia/api test -- eventos-public` ou `pnpm exec vitest run services/api/src/modules/eventos/eventos-public-sales.service.spec.ts services/api/src/modules/eventos/eventos-public.controller.spec.ts`.
  - Esperado: FAIL com serviço/rotas ainda não definidos.
- [ ] **Step 3: Implementar DTOs, serviço e controller**
  - Validar UUIDs, listas não vazias, limite por pedido, e-mail/telefone normalizados, URLs `https` permitidas e chave de idempotência limitada.
  - Usar transação Drizzle e lock/condição no inventário para mover somente `DISPONIVEL`/reserva expirada para `RESERVADO`, gravando `reservationExpiresAt`, `reservedByOrderId` e evidência de preço nos itens.
  - Gerar `orderNumber` aleatório de 12 caracteres alfanuméricos, não sequencial, repetir em colisão de índice único e nunca derivá-lo do UUID exposto.
  - Ampliar `eventoAceiteTipoEnum` para os tipos de política versionada e cobrir essa mudança no teste de schema; a coluna é `text`, portanto a alteração não exige migration estrutural.
  - Retornar respostas mínimas e erros estáveis (`EVENT_NOT_FOUND`, `SEAT_UNAVAILABLE`, `POLICY_VERSION_MISMATCH`, `IDEMPOTENCY_CONFLICT`).
  - Manter o controller de inscrição legado sem alteração de contrato e sem incluir `mae-por-inteiro` no catálogo novo.
- [ ] **Step 4: Rodar testes e typecheck da API**
  - Executar `pnpm exec vitest run services/api/src/modules/eventos/eventos-public-sales.service.spec.ts services/api/src/modules/eventos/eventos-public.controller.spec.ts`, `pnpm --filter @essencia/api typecheck` e os testes existentes de Eventos.
  - Esperado: PASS, inclusive nas regressões de mapas/admin.
- [ ] **Step 5: Commit**
  ```bash
  git add services/api/src/modules/eventos packages/shared/src/schemas/eventos.ts packages/shared/src/types/eventos.ts packages/shared/src/schemas/index.ts packages/shared/src/types/index.ts
  git commit -m "feat: adiciona vendas públicas de eventos"
  ```

### Task 4: Integrar Stripe e expiração de reservas de Eventos

**Files:**
- Create: `services/api/src/modules/eventos/jobs/eventos-expiration.job.ts`
- Create: `services/api/src/modules/eventos/eventos-pagamentos.service.ts`, `services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts`
- Modify: `services/api/src/modules/eventos/eventos.module.ts`
- Modify: `services/api/src/modules/payments/payments-webhook.controller.ts`, `services/api/src/modules/payments/payments-webhook.controller.spec.ts` ou suíte de regressões existente

**Interfaces:**
- `EventosPagamentosService.confirmarCheckout(input: { checkoutSessionId: string; paymentIntentId?: string; amountCents: number }): Promise<void>` confirma somente o pedido correspondente, valida valor e converte reservas em ingressos após webhook.
- `EventosPagamentosService.falharCheckout(input: { checkoutSessionId?: string; paymentIntentId?: string; reason: string }): Promise<void>` cancela o pedido e libera assentos ainda não vendidos.
- `EventosExpirationJob.liberarExpirados(now = new Date()): Promise<number>` roda a cada minuto e é idempotente.

- [ ] **Step 1: Escrever testes falhando para webhook e expiração**
  - Testar que `checkout.session.completed` com valor divergente não vende assentos.
  - Testar que evento Stripe repetido não cria ingressos duplicados nem altera pedido já confirmado.
  - Testar que sessão expirada/falha libera reservas, marca pedido cancelado e não libera pedido pago.
  - Testar que o job pode rodar duas vezes sem efeitos duplicados.
- [ ] **Step 2: Rodar os testes para confirmar a falha**
  - Executar `pnpm exec vitest run services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts services/api/src/modules/payments/payments-webhook.controller.spec.ts`.
  - Esperado: FAIL nas funções de encaminhamento e job.
- [ ] **Step 3: Implementar reconciliação**
  - Reutilizar `PaymentsService` para criar/expirar Checkout Session, com metadata `eventOrderId`/`orderNumber` e idempotency key do pedido.
  - Acrescentar no webhook Stripe os tipos de checkout necessários, delegando para Eventos quando a metadata identificar pedido de Evento e mantendo o fluxo da loja intacto.
  - Criar ingressos com tokens assinados/QR somente após confirmação, persistir `eventoPagamentos`, e registrar auditoria sem logar PII ou segredos.
  - Registrar cron de um minuto no módulo de Eventos para liberar `ATIVA` vencida, limpar `reservedByOrderId`/`reservationExpiresAt` e cancelar rascunhos não pagos.
- [ ] **Step 4: Rodar testes completos da integração**
  - Executar a suíte de Eventos e Payments, `pnpm --filter @essencia/api typecheck` e `pnpm turbo test --filter=@essencia/api`.
  - Esperado: PASS sem regressão nos webhooks e jobs da loja.
- [ ] **Step 5: Commit**
  ```bash
  git add services/api/src/modules/eventos services/api/src/modules/payments
  git commit -m "feat: confirma pagamentos e expira reservas de eventos"
  ```

### Task 5: Ligar checkout e consulta no app público

**Files:**
- Modify: `apps/eventos/lib/eventos-api.ts`
- Modify: `apps/eventos/components/formulario-checkout.tsx`, `apps/eventos/components/consulta-pedido.tsx`
- Modify: `apps/eventos/app/checkout/page.tsx`, `apps/eventos/app/pedido/[orderNumber]/page.tsx`, `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`
- Create: `apps/eventos/components/__tests__/formulario-checkout.test.tsx`, `apps/eventos/components/__tests__/consulta-pedido.test.tsx`

**Interfaces:**
- `reservarAssentos(input: ReservaPublicaInput): Promise<ReservaPublicaResult>` chama `/api/eventos/public/reservas` com chave idempotente criada no navegador e mantém `orderNumber`/`reservationId` em memória/URL, nunca em cookie administrativo.
- `finalizarPedido(orderNumber: string, input: FinalizarPedidoInput): Promise<PedidoPublicoResult>` envia participantes e aceites.
- `iniciarCheckout(orderNumber: string, input: CheckoutPublicoInput): Promise<{ checkoutUrl: string }>` redireciona somente para URL Stripe retornada pela API.
- `consultarPedido(orderNumber: string): Promise<ConsultaPedidoPublica>` aceita somente o número e mostra resposta mínima/rate-limit amigável.

- [ ] **Step 1: Escrever testes falhando para o fluxo convidado**
  - Testar seleção de assento disponível, rejeição visual de reservado/vendido/bloqueado e envio de `ticketTypeId`/`seatId`.
  - Testar campos obrigatórios de comprador/participantes, aceite das políticas ativas e bloqueio do botão sem aceite.
  - Testar que o app usa a URL Stripe retornada, não monta URL própria e exibe “pagamento pendente” antes do webhook.
  - Testar consulta somente por número, sem e-mail/senha e sem renderizar campos sensíveis da resposta.
- [ ] **Step 2: Rodar os testes e confirmar a falha**
  - Executar `pnpm --filter @essencia/eventos test`.
  - Esperado: FAIL porque o cliente de escrita e os formulários ainda são placeholders.
- [ ] **Step 3: Implementar o fluxo**
  - Implementar chamadas tipadas com `Idempotency-Key`/corpo consistente, tratamento de `409` para assento ocupado e preservação de seleção ao voltar do erro.
  - Carregar as políticas da API, mostrar conteúdo e versão, e enviar os aceites exatamente como exibidos.
  - Após finalizar, chamar checkout e redirecionar ao Stripe; após retorno, consultar pedido e orientar que a confirmação depende do webhook.
  - Aplicar mensagens PT-BR, acessibilidade básica de formulário/mapa e não incluir links para `/eventos-admin` na vitrine.
- [ ] **Step 4: Rodar testes e build do app**
  - Executar `pnpm --filter @essencia/eventos test`, `pnpm --filter @essencia/eventos lint`, `pnpm --filter @essencia/eventos typecheck` e `pnpm --filter @essencia/eventos build`.
  - Esperado: PASS e build standalone produzido para a porta 3014.
- [ ] **Step 5: Commit**
  ```bash
  git add apps/eventos
  git commit -m "feat: conecta checkout público de eventos"
  ```

### Task 6: Publicar os dois apps no Docker, Nginx e health check

**Files:**
- Modify: `docker-bake.hcl`
- Modify: `docker-compose.prod.yml`
- Modify: `nginx.conf`
- Modify: `scripts/health-check.sh`, `scripts/deploy-rolling.sh`
- Create: `nginx.conf.test` ou teste de contrato equivalente em `scripts/health-check.test.sh`

**Interfaces:**
- Target `eventos`: `APP_NAME=eventos`, `PACKAGE_NAME=@essencia/eventos`, `APP_PORT=3014`, health `/`.
- Target `eventos-admin`: `APP_NAME=eventos-admin`, `PACKAGE_NAME=@essencia/eventos-admin`, `APP_PORT=3016`, health `/eventos-admin`.
- Serviço `essencia-eventos` serve somente o app público; serviço `essencia-eventos-admin` serve somente o painel.
- Host HTTP/HTTPS `eventos.portalcef.com.br` redireciona para HTTPS e proxy `/`, `/_next/static/` e `/api` no app/API corretos; `www.portalcef.com.br/eventos-admin` vai para 3016; `/eventos` e `/eventos/*` retornam 301 para `/eventos-admin`.

- [ ] **Step 1: Escrever testes de configuração falhando**
  - Testar presença dos dois targets/serviços, portas 3014/3016, containers e paths de health.
  - Testar blocos Nginx para ACME, SAN host, upstream público, assets públicos, admin e redirect legado.
  - Testar health externo inclui `https://eventos.portalcef.com.br/` e `/eventos-admin` no domínio `www`.
- [ ] **Step 2: Rodar validações para confirmar a falha**
  - Executar `docker buildx bake --print` e o teste de configuração.
  - Esperado: FAIL pela ausência de `eventos-admin`, host público e checks novos.
- [ ] **Step 3: Implementar o wiring**
  - Adicionar target/serviço/admin e corrigir o target público para pacote escopado; alterar health interno de público para `/`.
  - Criar os servidores Nginx HTTP/HTTPS para `eventos.portalcef.com.br`, replicando headers/rate limits seguros e mantendo desafio ACME; adicionar `/api` no host público apontando para `essencia-api:3002`.
  - Separar assets `/_next/static` do host público e `/eventos-admin/_next/static` do host `www`; remover a regra antiga que encaminhava `/eventos` ao painel e substituí-la por redirect.
  - Atualizar scripts e manter `eventos-admin` na lista de imagens/containers da release.
- [ ] **Step 4: Rodar `nginx -t`, Compose e checks**
  - Executar `docker compose -f docker-compose.prod.yml --env-file .env.docker config`, `docker buildx bake --print`, `docker compose ... run --rm --entrypoint nginx nginx -t -c /etc/nginx/nginx.conf` com o volume/config montado, e `./scripts/health-check.sh` após subir staging/local.
  - Esperado: PASS; nenhum upstream usa porta/nome do app errado.
- [ ] **Step 5: Commit**
  ```bash
  git add docker-bake.hcl docker-compose.prod.yml nginx.conf scripts/health-check.sh scripts/deploy-rolling.sh
  git commit -m "chore: publica eventos e painel em hosts separados"
  ```

### Task 7: Emitir certificado, executar verificação externa e preparar deploy

**Files:**
- Modify: `docs/DEPLOYMENT.md` ou documento operacional existente, se o procedimento de certificado precisar ser registrado
- Test: comandos de smoke externos e saída de `openssl s_client`

**Interfaces:**
- Certificado ativo contém `portalcef.com.br`, `www.portalcef.com.br`, `loja.portalcef.com.br` e `eventos.portalcef.com.br` no SAN.
- `https://eventos.portalcef.com.br/` responde 200 com catálogo sem `-k`.
- `https://www.portalcef.com.br/eventos` responde 301 para `/eventos-admin` e `https://www.portalcef.com.br/eventos-admin` leva visitante sem sessão ao login.

- [ ] **Step 1: Confirmar DNS e o caminho do certificado**
  - Verificar `dig +short eventos.portalcef.com.br` e listar certificados com `docker compose -f docker-compose.prod.yml --env-file .env.docker run --rm --entrypoint certbot certbot certificates`.
  - Esperado: DNS apontando para `207.180.244.166` e volume identificado antes de qualquer emissão.
- [ ] **Step 2: Emitir/expandir o certificado via HTTP-01**
  - Usar o nome real do certificado e o webroot montado, incluindo os quatro domínios, sem expor valores de `.env`:
    `docker compose -f docker-compose.prod.yml --env-file .env.docker run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot --cert-name <nome-confirmado> -d portalcef.com.br -d www.portalcef.com.br -d loja.portalcef.com.br -d eventos.portalcef.com.br`.
  - Validar `openssl s_client -connect eventos.portalcef.com.br:443 -servername eventos.portalcef.com.br </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -ext subjectAltName`.
- [ ] **Step 3: Subir release e recarregar Nginx**
  - Confirmar árvore limpa, executar `./scripts/deploy.sh`, e recarregar/recriar Nginx somente depois de o certificado estar no volume.
  - Esperado: lint, typecheck, testes, Bake, Compose e `health-check.sh` PASS.
- [ ] **Step 4: Rodar smoke tests externos finais**
  - Executar `curl -fsS https://eventos.portalcef.com.br/`, `curl -fsS https://eventos.portalcef.com.br/evento/<slug-publicado>`, `curl -fsSI https://www.portalcef.com.br/eventos`, `curl -fsSI https://www.portalcef.com.br/eventos-admin` e o health check.
  - Validar manualmente que a consulta de pedido não expõe e-mail/telefone e que a reserva/checkout usa o Stripe de teste/configurado.
- [ ] **Step 5: Commit/documentação final**
  ```bash
  git add docs/DEPLOYMENT.md
  git commit -m "docs: registra publicação do portal público de eventos"
  ```

### Verificação final obrigatória

- [ ] `git status --short` vazio e `git log -1 --oneline` identifica a release.
- [ ] `pnpm turbo lint && pnpm turbo typecheck` passa na árvore final.
- [ ] Suítes direcionadas de `apps/eventos`, `apps/eventos-admin`, API Eventos/Payments e regressões da loja passam.
- [ ] `./scripts/deploy.sh` passa sem migration nova; se uma migration surgir durante a implementação, executar o fluxo aprovado com `--migrar` e registrar backup/resultado.
- [ ] Health interno/externo, `nginx -t`, certificado sem `-k`, catálogo anônimo, redirect legado e login do admin foram comprovados com saída dos comandos.
