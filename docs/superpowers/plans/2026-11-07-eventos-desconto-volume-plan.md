# Desconto automático por volume e seleção de lugares — Plano de implementação

> **Para agentes de implementação:** use obrigatoriamente `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Marque cada passo com `[ ]`.

**Objetivo:** permitir que ofertas percentuais configuráveis deem 15% de desconto a pedidos com 10 ou mais lugares, com seleção de até 20 assentos, preço autoritativo no backend e total correto no Stripe.

**Arquitetura:** uma função pura compartilhada calcula subtotal, desconto, rateio em centavos e total. O banco versiona uma oferta ativa por evento e guarda subtotal, desconto, oferta aplicada e preços finais dos itens; a API recalcula tudo durante a reserva. O mapa e o checkout usam a configuração pública apenas para prévia, enquanto o Stripe recebe linhas cujo total é exatamente o pedido persistido.

**Stack:** TypeScript, pnpm/Turborepo, NestJS/Fastify, PostgreSQL/Drizzle, Zod, Next.js/React, Vitest, Jest e Stripe Checkout.

**Especificação:** `docs/superpowers/specs/2026-11-07-eventos-desconto-volume-design.md`

## Restrições globais

- Comunicação, domínio, mensagens de usuário, testes e comentários em português do Brasil.
- A regra é `quantity >= 10`, 15% exatos sobre todos os tipos de ingresso do pedido; 10 adultos de R$ 45,00 totalizam R$ 382,50.
- O limite público atual de 20 lugares permanece.
- O cálculo confiável usa preços persistidos no backend; valores do navegador são apenas prévia.
- A seleção local não cria reserva; o hold continua sendo criado somente ao avançar para o checkout.
- Uma única oferta ativa é permitida por evento na primeira entrega.
- Pedidos abaixo de R$ 1,00 são recusados antes de criar pedido ou alterar inventário.
- Antes de commit ou PR, executar `pnpm turbo lint && pnpm turbo typecheck`.

## Foco da revisão

- **Fronteira 9/10/20 lugares:** 9 não recebe desconto, 10 recebe, 20 é aceito e o 21º não entra; testar em `packages/shared/src/eventos/precos.test.ts` e `apps/eventos/components/__tests__/mapa-assentos.test.tsx`.
- **Pedido misto e arredondamento:** 6 adultos + 4 crianças gera 15% do subtotal, e centavos distribuídos pelo maior resto fecham o total; testar no cálculo compartilhado e no serviço de vendas.
- **Entrada malformada/replay:** assento duplicado, tipo de outro evento, total abaixo do mínimo e repetição idempotente não podem deixar mutação parcial; testar em `eventos-public-sales.service.spec.ts`.
- **Oferta histórica/conflitante:** oferta `VALOR_FIXO` legada preserva preço total da faixa e uma segunda oferta ativa é rejeitada; testar em `eventos-ofertas.service.spec.ts` e na migration/schema.
- **Gateway divergente:** as linhas do Stripe somam `eventoPedidos.totalCents`, e o webhook recusa valor diferente; testar no serviço de vendas/pagamentos.

---

### Tarefa 1: cálculo compartilhado e contratos públicos

**Arquivos:**
- Criar: `packages/shared/src/eventos/precos.ts`
- Criar: `packages/shared/src/eventos/precos.test.ts`
- Modificar: `packages/shared/src/types/eventos.ts`
- Modificar: `packages/shared/src/schemas/eventos.ts`
- Modificar: `packages/shared/src/types/index.ts`
- Modificar: `packages/shared/src/schemas/index.ts`

**Interfaces:**
- Produz `type OfertaPreco = { id: string; version: number; name: string; pricingType: "PERCENTUAL" | "VALOR_FIXO"; minQuantity: number; maxQuantity: number | null; priceCents: number | null; discountPercent: number | null; active: boolean }`.
- Produz `type ItemPreco = { seatId: string; ticketTypeId: string; participantIndex: number; basePriceCents: number }`.
- Produz `type ResultadoPrecoPedido = { subtotalCents: number; discountCents: number; totalCents: number; appliedOffer: OfertaPrecoResumo | null; items: Array<{ seatId: string; ticketTypeId: string; participantIndex: number; baseUnitPriceCents: number; allocatedDiscountCents: number; unitPriceCents: number; totalPriceCents: number }> }`.
- Produz `calcularPrecoPedido(input: { items: ItemPreco[]; offers: OfertaPreco[]; minimumTotalCents?: number }): ResultadoPrecoPedido`, sem dependência de banco, React ou Stripe.
- Produz `OfertaPrecoPublica`/`OfertaPrecoResumo` para `PublicEventSession`, `ReservaPublicaResult` e `PedidoPublicoResult`, além de `AtualizarOfertaInput` e `EventoOfertaAdmin` para o painel.

- [ ] **Passo 1: escrever os testes que falham.** Cubra 9 lugares sem desconto, 10 adultos (`45000 -> 6750 -> 38250`), 11 lugares, mistura 6 adultos + 4 crianças (`36000 -> 5400 -> 30600`), oferta inativa, faixa incompatível, valor fixo legado, total mínimo e rateio com frações.
- [ ] **Passo 2: executar os testes para confirmar a falha.** Execute `pnpm --filter @essencia/shared test -- packages/shared/src/eventos/precos.test.ts`; espere falha por módulo/função inexistente.
- [ ] **Passo 3: implementar o cálculo.** Selecionar a única oferta ativa elegível, calcular o desconto arredondado ao centavo e distribuir o valor líquido pelo método do maior resto; empates usam `participantIndex` e depois `seatId`.
- [ ] **Passo 4: implementar tipos e schemas.** Adicionar os contratos públicos e o schema administrativo de oferta, incluindo faixa aberta, percentual de 0 a 100, modo fixo e validação de faixa.
- [ ] **Passo 5: executar os testes e o typecheck do pacote.** Execute `pnpm --filter @essencia/shared test` e `pnpm --filter @essencia/shared typecheck`; espere PASS.
- [ ] **Passo 6: commit.** `git add packages/shared && git commit -m "feat: adicionar cálculo compartilhado de desconto por volume"`.

### Tarefa 2: modelo Drizzle e migration de preço

**Arquivos:**
- Modificar: `packages/db/src/schema/eventos.ts`
- Modificar: `packages/db/src/schema/eventos.test.ts`
- Criar por geração: `packages/db/drizzle/0053_eventos_desconto_volume.sql`
- Atualizar por geração: `packages/db/drizzle/meta/*`

**Interfaces:**
- `eventoOfertas` passa a ter `pricingType`, `discountPercent`, `priceCents` nullable, `maxQuantity` nullable, `version` e `active`.
- `eventoPedidos` passa a ter `subtotalCents`, `discountCents` e `appliedOfferId` nullable com FK `set null`.
- O relacionamento `eventoPedidos.appliedOffer` permite recuperar a oferta sem alterar pedidos quando uma versão futura for arquivada.

- [ ] **Passo 1: escrever os testes que falham.** Em `eventos.test.ts`, verifique os campos novos, os enums `PERCENTUAL/VALOR_FIXO` e que dinheiro do pedido continua em centavos.
- [ ] **Passo 2: executar o teste do banco.** Execute `pnpm --filter @essencia/db test`; espere falha nos campos/enums ausentes.
- [ ] **Passo 3: alterar o schema.** Adicione os campos, checks de percentual/faixa/valores não negativos e relações; mantenha ofertas legadas semanticamente como preço total da faixa.
- [ ] **Passo 4: gerar e revisar a migration.** Execute `pnpm --filter @essencia/db generate`; confira que a migration define defaults/backfill (`pricingType = VALOR_FIXO`, subtotal antigo igual ao total, desconto zero) sem apagar pedidos ou ofertas.
- [ ] **Passo 5: executar testes e typecheck.** Execute `pnpm --filter @essencia/db test && pnpm --filter @essencia/db typecheck`; espere PASS.
- [ ] **Passo 6: commit.** `git add packages/db && git commit -m "feat: versionar ofertas e detalhar preço dos pedidos de eventos"`.

### Tarefa 3: API administrativa e oferta pública por evento

**Arquivos:**
- Criar: `services/api/src/modules/eventos/eventos-ofertas.service.ts`
- Criar: `services/api/src/modules/eventos/eventos-ofertas.service.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos.module.ts`
- Modificar: `services/api/src/modules/eventos/eventos-admin.controller.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public.controller.ts`
- Modificar: `services/api/src/modules/eventos/eventos.service.ts`
- Modificar: `services/api/src/modules/eventos/eventos.service.spec.ts`

**Interfaces:**
- `EventosOfertasService.listarAdmin(eventId: string, actor: EventoActor): Promise<EventoOfertaAdmin[]>`.
- `EventosOfertasService.atualizar(eventId: string, inputs: AtualizarOfertaInput[], actor: EventoActor): Promise<EventoOfertaAdmin[]>`.
- `EventosOfertasService.listarPublicas(eventId: string): Promise<OfertaPrecoPublica[]>`.
- Rotas `GET/PATCH /eventos/admin/:id/ofertas` usam o guard e escopo já aplicados no `EventosAdminController`.
- `EventosService.listarSessoesPublicas` inclui somente a oferta percentual ativa em `PublicEventSession.offers`; versões arquivadas não chegam à vitrine.

- [ ] **Passo 1: escrever testes de serviço/controlador.** Cubra escopo de escola, percentual inválido, faixa aberta, preservação/versionamento de oferta, rejeição de duas ofertas ativas, listagem pública somente ativa e inclusão na resposta de sessões.
- [ ] **Passo 2: executar os testes para confirmar a falha.** Execute `pnpm --filter @essencia/api test -- eventos-ofertas.service.spec.ts eventos.service.spec.ts`; espere falha por serviço/rotas ausentes.
- [ ] **Passo 3: implementar o serviço.** Ler evento no escopo do ator, versionar a oferta em transação, desativar a versão anterior, registrar auditoria e rejeitar mais de uma ativa.
- [ ] **Passo 4: conectar módulo e controladores.** Registrar o provider, adicionar as rotas administrativas e injetar a leitura pública na montagem das sessões.
- [ ] **Passo 5: executar testes da API.** Execute `pnpm --filter @essencia/api test -- eventos-ofertas.service.spec.ts eventos.service.spec.ts eventos-public.controller.spec.ts`; espere PASS.
- [ ] **Passo 6: commit.** `git add services/api packages/shared && git commit -m "feat: configurar ofertas de eventos por evento"`.

### Tarefa 4: reserva, pedido e snapshot do preço

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public.controller.spec.ts`

**Interfaces:**
- `reservarAssentos(raw)` continua recebendo somente a seleção, comprador e idempotency key; passa a devolver `subtotalCents`, `discountCents`, `totalCents`, `appliedOffer` e itens com preços finais.
- `pedidoResult` e `reservaResult` usam o mesmo `ResultadoPrecoPedido` persistido.

- [ ] **Passo 1: escrever testes que falham.** Adicione casos para 9/10/20 lugares, 6 adultos + 4 crianças, oferta fixa legada, assento duplicado, tipo de outro evento, total abaixo de R$ 1,00 e repetição idempotente preservando o snapshot.
- [ ] **Passo 2: executar a suíte focada.** Execute `pnpm --filter @essencia/api test -- eventos-public-sales.service.spec.ts`; espere falhas nos totais e códigos novos.
- [ ] **Passo 3: validar antes de mutar.** Rejeitar duplicidades, carregar tipos e preços do banco, carregar a oferta ativa, chamar `calcularPrecoPedido` e recusar total abaixo de 100 centavos antes do insert/update de pedido/inventário.
- [ ] **Passo 4: persistir o resultado.** Gravar subtotal, desconto, oferta aplicada, preços finais e `pricingEvidence` (preço-base, rateio e participante) no pedido/itens; preservar a chave de idempotência.
- [ ] **Passo 5: retornar o detalhamento.** Ajustar `reservaResult`, `pedidoResult` e consultas para retornar o snapshot sem recalcular com configuração atual.
- [ ] **Passo 6: executar a suíte e commit.** Execute `pnpm --filter @essencia/api test -- eventos-public-sales.service.spec.ts eventos-public.controller.spec.ts`; depois `git add services/api packages/shared && git commit -m "feat: aplicar desconto de volume na reserva de eventos"`.

### Tarefa 5: fechar o valor no Stripe e no webhook

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts`

**Interfaces:**
- `iniciarCheckout` monta cada linha com `eventoItensPedido.unitPriceCents`, valida que a soma das linhas é `eventoPedidos.totalCents` e grava `expectedAmountCents` com o mesmo total.
- A confirmação existente continua comparando o valor recebido com `expectedAmountCents`/`order.totalCents`.

- [ ] **Passo 1: escrever testes que falham.** Mockar `PaymentsService` e afirmar que 10 adultos geram linhas cuja soma é R$ 382,50, que o pagamento esperado recebe 38250 e que uma divergência não chama o Stripe; cobrir webhook recusando valor diferente.
- [ ] **Passo 2: executar os testes focados.** Execute `pnpm --filter @essencia/api test -- eventos-public-sales.service.spec.ts eventos-pagamentos.service.spec.ts`; espere falha.
- [ ] **Passo 3: implementar o fechamento.** Trocar a fonte das linhas para preços finais persistidos, validar soma/quantidade antes de `createCheckoutSession` e preservar metadata do pedido/oferta.
- [ ] **Passo 4: executar testes e commit.** Execute as duas suítes novamente; espere PASS e faça `git add services/api && git commit -m "fix: fechar linhas do Stripe com desconto de eventos"`.

### Tarefa 6: prévia pública e seleção de 10 ou mais assentos

**Arquivos:**
- Modificar: `apps/eventos/components/mapa-assentos.tsx`
- Modificar: `apps/eventos/components/resumo-assentos.tsx`
- Modificar: `apps/eventos/components/formulario-checkout.tsx`
- Modificar: `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`
- Modificar: `apps/eventos/app/checkout/page.tsx`
- Modificar: `apps/eventos/components/__tests__/mapa-assentos.test.tsx`
- Modificar: `apps/eventos/components/__tests__/formulario-checkout.test.tsx`
- Modificar: `apps/eventos/app/checkout-page.test.tsx`

**Interfaces:**
- `MapaAssentosProps` e `ResumoAssentosProps` recebem `offers: PublicEventOffer[]`.
- O resumo usa `calcularPrecoPedido` com os preços públicos apenas para prévia e mostra quantidade, subtotal, desconto e total; o href continua carregando todos os IDs/tipos.
- A página de sessão passa `session.offers`; o checkout recebe a mesma configuração para exibir a prévia antes da reserva.

- [ ] **Passo 1: escrever testes que falham.** Renderizar 9, 10 e 20 assentos, conferir a mensagem de desconto, testar 21º bloqueado, trocar quatro itens para criança e conferir 15%, manter botão habilitado abaixo de 10 e conservar reidratação após conflito.
- [ ] **Passo 2: executar os testes da app.** Execute `pnpm --filter @essencia/eventos test -- mapa-assentos.test.tsx formulario-checkout.test.tsx checkout-page.test.tsx`; espere falha pela nova propriedade/comportamento.
- [ ] **Passo 3: implementar o resumo.** Integrar a função compartilhada, atualizar resumo completo e barra fixa, formatar subtotal/desconto/total e manter o botão bloqueado somente por seleção incompleta.
- [ ] **Passo 4: implementar o limite de seleção.** Permitir até 20 lugares disponíveis, emitir estado acessível ao tentar o 21º, manter tipos por assento e não criar POST durante cliques.
- [ ] **Passo 5: integrar páginas.** Propagar ofertas da sessão para mapa, checkout e resumo; atualizar fixtures tipadas de `PublicEventSession`; manter query de retorno e seleção reidratada.
- [ ] **Passo 6: executar testes e commit.** Execute `pnpm --filter @essencia/eventos test`; depois `git add apps/eventos && git commit -m "feat: exibir desconto e selecionar até 20 lugares"`.

### Tarefa 7: configuração de ofertas no painel administrativo

**Arquivos:**
- Criar: `apps/eventos-admin/features/eventos/ofertas-contratos.ts`
- Criar: `apps/eventos-admin/features/eventos/ofertas-contratos.test.ts`
- Criar: `apps/eventos-admin/features/eventos/oferta-editor.tsx`
- Modificar: `apps/eventos-admin/app/eventos/[id]/ingressos/page.tsx`
- Modificar: `apps/eventos-admin/app/eventos/[id]/ingressos/page.test.ts`

**Interfaces:**
- `OfertaValue` representa nome, modo, mínimo, máximo opcional, percentual, preço fixo opcional, versão e estado.
- `construirPayloadOferta(value)` produz o payload aceito por `PATCH /eventos/admin/:id/ofertas`; `ofertaProntaParaSalvar` bloqueia percentual fora de 0–100, faixa inválida e segunda oferta ativa.
- `OfertaEditor` recebe `initialValue`, `onChange` e `disabled` e mostra a regra em português.

- [ ] **Passo 1: escrever testes de contrato e tela.** Cobrir payload de 15%/mínimo 10, validação de máximo, estado arquivado, erro de duas ativas e renderização do resumo “15% a partir de 10 lugares”.
- [ ] **Passo 2: executar os testes para confirmar a falha.** Execute `pnpm --filter @essencia/eventos-admin test -- ofertas-contratos.test.ts ingressos/page.test.ts`; espere falha.
- [ ] **Passo 3: implementar contratos/editor.** Seguir o padrão de autosave da etapa de ingressos, sem permitir valores que a API rejeitará.
- [ ] **Passo 4: integrar carregamento e salvamento.** Buscar ofertas junto dos ingressos, salvar com credenciais no endpoint administrativo, mostrar estado de salvamento e atualizar versão retornada.
- [ ] **Passo 5: executar testes e commit.** Execute `pnpm --filter @essencia/eventos-admin test -- ofertas-contratos.test.ts ingressos/page.test.ts`; espere PASS e faça `git add apps/eventos-admin && git commit -m "feat: configurar descontos de eventos no painel"`.

### Tarefa 8: aceite integrado e configuração do evento

**Arquivos:**
- Modificar: `apps/eventos/scripts/smoke-publico.mjs`
- Modificar: `apps/eventos/app/publico.test.tsx`
- Modificar: `services/api/src/modules/eventos/eventos-public.controller.spec.ts`
- Modificar: documentação operacional do evento somente se o teste revelar um passo manual novo.

**Interfaces:**
- O smoke público deve conseguir ler a oferta ativa, selecionar dez assentos, verificar subtotal/desconto/total e confirmar que nenhum POST de reserva ocorre antes de “Continuar”.
- O aceite administrativo deve cadastrar no evento de ballet uma oferta percentual ativa com `minQuantity = 10`, `maxQuantity = null` e `discountPercent = 15`.

- [ ] **Passo 1: escrever o cenário de aceite.** Adicionar ao mock do smoke 20 assentos, tipos adulto/criança e oferta; afirmar 9 sem desconto, 10 com 15% e 6+4 com total correto.
- [ ] **Passo 2: executar o smoke para confirmar a falha.** Execute o comando do script conforme a documentação atual do app; espere falha nas novas asserções.
- [ ] **Passo 3: ajustar o fluxo integrado.** Corrigir contratos, serialização ou acessibilidade que só apareçam quando o cenário atravessar catálogo, mapa, checkout e retorno.
- [ ] **Passo 4: executar validação completa.** Execute os testes específicos dos três pacotes, `pnpm turbo lint`, `pnpm turbo typecheck` e o smoke público; espere todos PASS.
- [ ] **Passo 5: commit final.** `git add apps/eventos services/api packages/shared packages/db apps/eventos-admin docs && git commit -m "test: validar desconto de volume no fluxo de eventos"`.

## Verificação final do plano

- A Tarefa 1 cobre cálculo, arredondamento, rateio e contratos compartilhados.
- A Tarefa 2 cobre migration, defaults e compatibilidade de pedidos/ofertas existentes.
- A Tarefa 3 cobre painel/API, versionamento, escopo e exposição pública.
- As Tarefas 4 e 5 cobrem autoridade do backend, idempotência, Stripe e webhook.
- A Tarefa 6 cobre seleção de 10–20 lugares, mistura de tipos, prévia e reidratação.
- A Tarefa 7 cobre a configuração que ativa a regra no evento.
- A Tarefa 8 cobre o caminho integrado e a configuração inicial do ballet.

Cada tarefa começa por teste que falha, termina com teste específico passando e commit independente. Nenhuma tarefa altera o mapa gerado, o TTL de reserva ou o gateway.

