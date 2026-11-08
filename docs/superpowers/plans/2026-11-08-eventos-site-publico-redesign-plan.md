# Reforma do site público de eventos — Plano de implementação

> **Para agentes de implementação:** use obrigatoriamente `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Marque cada passo com `[ ]`.

**Objetivo:** deixar `eventos.portalcef.com.br` com cara de site sério e com a identidade do colégio. Isso inclui um mapa de assentos que dá para usar, lugares guardados com relógio, mapa ao vivo, pagamento com cartão ou Pix sem sair do site, e o ingresso (QR e número) entregue na confirmação.

**Arquitetura:** a API passa a:
- enviar o desenho do teatro (palco, letras, rotação dos assentos);
- reservar sem dados do comprador, que entram na finalização, junto com a geração de um link seguro;
- liberar pedidos;
- criar a sessão da Stripe no modo embutido, sem mudar a loja;
- emitir ingressos com número curto e entregá-los só por link seguro ou por "Meus ingressos".

O app `apps/eventos` é redesenhado sobre a base atual (Next 15, Tailwind, Radix de `@essencia/ui`, Framer Motion). O mapa reaproveita o `MapaEstiloB` de `@essencia/components`, estendido sem mudar o comportamento do painel.

**Stack:** TypeScript, pnpm/Turborepo, NestJS/Fastify, PostgreSQL/Drizzle, Zod, Next.js/React 19, Tailwind 3, d3-zoom, Framer Motion, Stripe Embedded Checkout (`@stripe/react-stripe-js`), `qrcode`, `jspdf`, Vitest, Jest, `node:test` e Playwright (smoke).

**Especificação:** `docs/superpowers/specs/2026-11-08-eventos-site-publico-redesign-design.md`. Ela é a fonte da verdade para textos, cores e comportamento; leia antes de cada tarefa.

**Onde trabalhar:** worktree `/var/www/essencia/.worktrees/eventos-site-publico-redesign`, branch `feat/eventos-site-publico-redesign`. A worktree nasce sem `node_modules`: rode `pnpm install --frozen-lockfile` antes da Tarefa 1. Quando uma tarefa adicionar dependências, rode `pnpm install` (atualiza o lockfile) e commite o `pnpm-lock.yaml` junto.

## Restrições globais

### Regras de trabalho

- Tudo em português do Brasil: domínio, mensagens, testes, comentários e commits.
- TDD obrigatório: escrever o teste, ver falhar, implementar, ver passar.
- Antes de cada commit: `pnpm turbo lint && pnpm turbo typecheck`.
- **Nunca** criar pedido de teste no evento do ballet (`545179cf-5638-44e5-9ef0-a834b249d8a7`). Um único ingresso emitido trava o mapa para sempre.
- Este plano não faz deploy. Isso exige `./scripts/deploy.sh --migrar` e reinício do nginx, e é decidido com o Renato depois da revisão.

### Loja e regras de venda que não mudam

- A loja não muda: `PaymentsService.createCheckoutSession` mantém exatamente os mesmos parâmetros enviados à Stripe. Os testes da loja precisam continuar passando.
- O limite é de 20 lugares por pedido. O desconto continua vindo das ofertas existentes (15% a partir de 10 lugares, com total de R$ 382,50 para 10 inteiras de R$ 45,00).
- **Prazo da reserva:** 15 minutos ao clicar em "Continuar" (`15 * 60_000`). Ao iniciar o pagamento, a API já estende o prazo para no mínimo 30 minutos, porque a Stripe exige. O relógio mostra **sempre** o `expiresAt` devolvido pela API.

### Visual

- Para quem compra, `reserved`, `sold` e `blocked` aparecem como **Ocupado**. Na lista e no `aria-label`, o lugar livre aparece como "livre".
- **Cores da interface:**

  | Uso | Cor |
  |---|---|
  | Fundo | `#faf9f5` |
  | Cartão | `#ffffff` |
  | Texto | `#1f2a24` |
  | Texto secundário | `#5b6660` |
  | Linha | `#e6e9e1` |
  | **Botão de ação único** | `#3f6f12` (hover `#355e0f`), texto branco |
  | Verde do colégio (detalhes) | `#a3d154` |
  | Faixa do relógio | fundo `#fff7e6`, texto `#6b4a00` |

  Nenhum `bg-blue-*` em página pública.
- **Cadeirinhas do mapa** (preenchimento / contorno / número):

  | Estado | Preenchimento | Contorno | Número |
  |---|---|---|---|
  | Livre | `#ffffff` | `#9fb08a` | `#1f2a24` |
  | Seu lugar | `#3f6f12` | `#2a4d0a` | `#ffffff` |
  | Ocupado | `#e4e6e1` | `#c9cdc6` | `#8a918c` |
  | Acessível livre (`CADEIRANTE`, `OPCIONAL_CADEIRANTE`, `OBESO`) | `#eff6ff` | `#3b82f6` | `#1e3a8a` |

- Fontes: Outfit (títulos) e DM Sans (texto), as atuais.
- `prefers-reduced-motion: reduce` desliga animações e vibração.

### Dados institucionais (constantes exatas)

- `Colégio Essência Feliz`
- CNPJ `65.481.923/0001-58`
- Endereço `R. Lourdes de Carvalho, 1212 - Segismundo Pereira, Uberlândia - MG, 38408-268`
- Telefone `(34) 3292-7388`, `tel:+553432927388`

O site nunca diz "WhatsApp" para esse número.

### Textos exatos

Nenhum texto promete e-mail, porque o sistema não envia.

| Onde | Texto |
|---|---|
| Relógio | `Seus lugares estão guardados por MM:SS` |
| Tempo esgotado | `O tempo acabou e os lugares foram liberados` |
| Lugar pego no mapa ao vivo | `O lugar G20 acabou de ser escolhido por outra pessoa` (rótulo curto = fileira + número) |
| Aceite | `Li e aceito as políticas do evento` |
| Dados do comprador | `Usamos para identificar seu pedido e falar com você, se precisar.` |
| Pagamento | `Pagamento processado pela Stripe. Os dados do seu cartão não passam pelo nosso servidor.` |
| Ingresso | `Na entrada, mostre o QR code ou informe o número.` |
| Confirmação pendente | `Confirmando seu pagamento…` |
| Meus ingressos, não encontrado | `Não encontramos um pedido com esses dados` |
| Lista de lugares | `Prefere uma lista? Ver lugares em lista` |
| Oferta (falta pouco) | `Escolha mais {n} lugares e ganhe {p}% de desconto em todos.` |
| Oferta (aplicada) | `{p}% de desconto aplicado.` |
| Etiqueta do campo de telefone | `Celular (WhatsApp)` (refere-se ao celular do comprador) |
| Botão do checkout | `Ir para o pagamento` |

**Rótulos das políticas:**

| Tipo | Rótulo |
|---|---|
| `PRIVACIDADE` | Privacidade |
| `COMPRA` | Compra e meia-entrada |
| `CANCELAMENTO_REEMBOLSO` | Cancelamento e reembolso |
| `ACESSIBILIDADE` | Acessibilidade |
| `CONTATO` | Contato |

Nenhum nome interno aparece na tela.

### Segurança

- QR code e PDF são gerados dentro do sistema. Nunca usar serviço externo: o conteúdo do QR é a credencial de entrada.
- QR code e número do ingresso nunca saem da API sem token de acesso válido.

## Foco da revisão

1. **O relógio chega a zero no meio do formulário ou do pagamento.** A tela troca para o tempo esgotado e o botão volta ao mapa com a seleção. Nada de finalizar um pedido vencido. Testado na Tarefa 20.
2. **Um lugar já escolhido é pego por outra pessoa.** Pode acontecer na atualização ao vivo ou ao voltar por "Alterar lugares". O lugar sai da seleção com aviso e o total é recalculado. Testado nas Tarefas 17 e 18.
3. **A pessoa abre a página do ingresso sem `acesso`, com token de outro pedido ou com token vencido.** Nenhum QR aparece. A tela oferece "Meus ingressos" com o número do pedido preenchido. Testado nas Tarefas 9 e 22.
4. **O Pix é pago no mesmo instante do clique em "Alterar lugares".** A liberação é recusada (`PAYMENT_ALREADY_COMPLETED`) sem mexer em nada, e a pessoa vai para os ingressos. Testado nas Tarefas 5 e 20.
5. **Ambientes e dados incompletos.**
   - Navegador que não compartilha arquivos (computador, iOS antigo): "Compartilhar" baixa o PDF.
   - Mapa sem `layout`: letras inferidas pelas pontas, sem palco e sem erro.
   - Assento sem `metadata.rotacao`: rotação 0.

   Testado nas Tarefas 3, 16 e 22.

**Regra de compilação entre tarefas:** cada tarefa termina com `pnpm turbo typecheck` passando. Por isso, os tipos e schemas que quebram consumidores mudam na tarefa que os implementa, e não antes. Código antigo que ainda compila, mas deixa de funcionar em tempo de execução, é aceitável na branch: por exemplo, o checkout antigo entre as Tarefas 7 e 20.

---

### Tarefa 1: contratos compartilhados e número do ingresso

**Arquivos:**
- Criar: `packages/shared/src/eventos/ingresso.ts`, `packages/shared/src/eventos/ingresso.test.ts`
- Criar: `packages/shared/src/schemas/eventos-publico.test.ts`
- Modificar: `packages/shared/package.json` (export `./eventos/ingresso` no mesmo formato de `./eventos/precos`)
- Modificar: `packages/shared/src/types/eventos.ts`
- Modificar: `packages/shared/src/schemas/eventos.ts`

**Interfaces:**
- Produz (`@essencia/shared/eventos/ingresso`):
  ```ts
  export const ALFABETO_NUMERO_INGRESSO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0, O, 1, I, L
  export function gerarNumeroIngresso(sortear?: (limite: number) => number): string; // 8 caracteres; padrão crypto.randomInt
  export function formatarNumeroIngresso(numero: string): string; // "K7Q482MX" -> "K7Q4-82MX"
  export function normalizarNumeroIngresso(entrada: string): string | null; // tira não alfanuméricos, maiúsculas, valida 8 do alfabeto
  ```
- Produz (`@essencia/shared/types`), **só acréscimos** (as mudanças em tipos existentes ficam nas Tarefas 3 e 4):
  ```ts
  interface PublicMapLayout { largura: number; altura: number; rotulos: Array<{ fileira: string; x: number; y: number }>; elementos: Array<{ tipo: "PALCO" | "ENTRADA" | "SAIDA"; texto: string; x: number; y: number }> }
  interface ItemPedidoPublico { seatId: string; ticketTypeId: string; unitPriceCents: number; totalPriceCents: number; rowLabel: string; seatNumber: string; ticketTypeName: string }
  interface IngressoPublico { numero: string; qrPayload: string; rowLabel: string; seatNumber: string; ticketTypeName: string; participantName: string; status: string }
  interface PagamentoEmbutidoResult { clientSecret: string; expiresAt: Date; orderNumber: string }
  interface MeusIngressosResult { pedidos: Array<{ orderNumber: string; eventTitle: string; sessionStartsAt: Date; acesso: string }> }
  ```
- Produz (`@essencia/shared/schemas`), **só acréscimos**:
  - `pagamentoEmbutidoSchema = z.object({ returnUrl: https url, idempotencyKey: 8–180 }).strict()`. O `checkoutPublicoSchema` continua existindo até a Tarefa 20.
  - `meusIngressosSchema = z.union([{ orderNumber: 6–32, email }.strict(), { email, phone: 8–30 }.strict()])`.
  - Tipos `PagamentoEmbutidoInput` e `MeusIngressosInput`.

- [ ] **Passo 1: escrever os testes que falham**
  - `ingresso.test.ts`:
    - `gera 1000 números de 8 caracteres só com o alfabeto permitido`: nenhum contém `0`, `O`, `1`, `I` ou `L`.
    - `gerarNumeroIngresso(() => 0) === "AAAAAAAA"`.
    - `formatarNumeroIngresso("K7Q482MX") === "K7Q4-82MX"`.
    - `normalizarNumeroIngresso(" k7q4-82mx ") === "K7Q482MX"`.
    - `normalizarNumeroIngresso("K7Q4-82M0") === null` e `normalizarNumeroIngresso("ABC") === null`.
  - `eventos-publico.test.ts`:
    - `meusIngressosSchema` aceita `{orderNumber, email}` e `{email, phone}` e recusa `{orderNumber}` sozinho;
    - `pagamentoEmbutidoSchema` recusa `http://` e campos extras.
- [ ] **Passo 2:** `pnpm --filter @essencia/shared test`. Esperado: FALHA (módulo e schemas inexistentes).
- [ ] **Passo 3:** implementar as funções, os tipos e os schemas acima.
- [ ] **Passo 4:** `pnpm --filter @essencia/shared test && pnpm turbo typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): contratos públicos e número do ingresso`.

### Tarefa 2: migration 0054 — comprador opcional na reserva e número do ingresso

**Arquivos:**
- Criar: `packages/db/drizzle/0054_eventos_site_publico.sql`
- Modificar: `packages/db/drizzle/meta/_journal.json` (entrada `idx: 54`, `tag: "0054_eventos_site_publico"`, `when: 1794160000000`, `breakpoints: true`)
- Modificar: `packages/db/src/schema/eventos.ts`
- Teste: `packages/db/src/schema/eventos.test.ts`

**Interfaces:**
- Produz:
  - em `eventoPedidos`, `buyerName`, `buyerEmail` e `buyerPhone` deixam de ter `.notNull()`;
  - `eventoIngressos.numero: varchar("numero", { length: 8 }).notNull()`;
  - índice `uq_evento_ingressos_numero`.

- [ ] **Passo 1: testes que falham** em `eventos.test.ts`:
  - `getTableConfig(eventoPedidos)` mostra `buyer_name`, `buyer_email` e `buyer_phone` com `notNull === false`;
  - `evento_ingressos.numero` tem `notNull === true` e existe o índice único `uq_evento_ingressos_numero`;
  - o SQL `0054` contém `DROP NOT NULL` para as três colunas e o backfill correlacionado abaixo.
- [ ] **Passo 2:** `pnpm --filter @essencia/db test`. Esperado: FALHA.
- [ ] **Passo 3:** escrever o SQL. O backfill precisa ser **correlacionado**, para que o `random()` rode por linha (subconsulta sem referência à linha externa repetiria o mesmo número e quebraria o índice único):
  ```sql
  ALTER TABLE "evento_pedidos" ALTER COLUMN "buyer_name" DROP NOT NULL;--> statement-breakpoint
  ALTER TABLE "evento_pedidos" ALTER COLUMN "buyer_email" DROP NOT NULL;--> statement-breakpoint
  ALTER TABLE "evento_pedidos" ALTER COLUMN "buyer_phone" DROP NOT NULL;--> statement-breakpoint
  ALTER TABLE "evento_ingressos" ADD COLUMN "numero" varchar(8);--> statement-breakpoint
  UPDATE "evento_ingressos" AS ingresso SET "numero" = (
    SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
    FROM generate_series(1, 8) WHERE ingresso."id" IS NOT NULL
  ) WHERE ingresso."numero" IS NULL;--> statement-breakpoint
  ALTER TABLE "evento_ingressos" ALTER COLUMN "numero" SET NOT NULL;--> statement-breakpoint
  CREATE UNIQUE INDEX "uq_evento_ingressos_numero" ON "evento_ingressos" USING btree ("numero");
  ```
  Depois, ajustar o schema TS.
- [ ] **Passo 4:** `pnpm --filter @essencia/db test && pnpm --filter @essencia/db build`. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(db): comprador opcional na reserva e número do ingresso`.

### Tarefa 3: mapa público com o desenho do teatro

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/eventos.service.ts` (`getPublicMap`)
- Teste: `services/api/src/modules/eventos/eventos.service.spec.ts`

- Modificar: `packages/shared/src/types/eventos.ts`

**Interfaces:**
- Consome: `PublicMapLayout` (Tarefa 1).
- Produz:
  - tipos: `PublicSeat.rotacao?: number` e `PublicMap.layout?: PublicMapLayout | null`. São opcionais de propósito: os fixtures atuais continuam compilando, e o app trata ausência como 0 e `null`.
  - `getPublicMap(sessionId): Promise<PublicMap>` com `layout` montado de `evento_mapas.layout` (`LayoutMapa`: `largura`, `altura`, `rotulos`, `elementos`) ou `null` quando ausente ou malformado;
  - `rotulos` filtrados às fileiras que têm assento na sessão;
  - `rotacao = Number(metadata?.rotacao)` quando for número finito, senão `0`.

- [ ] **Passo 1: testes que falham:**
  - `devolve palco, entradas e letras só das fileiras com assento`: fixture com rótulos `A` (2 posições) e `X` (sem assento). Esperado: só os dois `A`, e os elementos inalterados.
  - `devolve layout nulo quando o mapa não tem desenho`.
  - `usa a rotação gravada em metadata e zero quando falta`.
- [ ] **Passo 2:** `pnpm --filter @essencia/api test -- eventos.service.spec`. Esperado: FALHA.
- [ ] **Passo 3:** implementar. A consulta já seleciona `seat` e `map`; incluir `seat.metadata` e `map.layout`.
- [ ] **Passo 4:** rodar de novo. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): mapa público com palco, letras e rotação`.

### Tarefa 4: reserva sem comprador, finalização com comprador e link seguro

**Arquivos:**
- Criar: `services/api/src/modules/eventos/acesso-pedido.ts`, `services/api/src/modules/eventos/acesso-pedido.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- Modificar: `packages/shared/src/schemas/eventos.ts`, `packages/shared/src/schemas/eventos-publico.test.ts`, `packages/shared/src/types/eventos.ts`
- Modificar (ajuste mínimo para o app continuar compilando): `apps/eventos/lib/eventos-api.ts` e `apps/eventos/components/formulario-checkout.tsx`. `finalizarPedido` passa a devolver `FinalizacaoPublicaResult` e recebe `buyer`; o formulário antigo envia o `buyer` que já coleta e lê `.pedido`. Também os fixtures que montam `PedidoPublicoResult` em `apps/eventos/components/__tests__/`.
- Teste: `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`

**Interfaces:**
- Consome: `ItemPedidoPublico` (Tarefa 1) e as colunas da Tarefa 2.
- Produz nos contratos compartilhados:
  - `reservaPublicaSchema`: `buyer` passa a ser **opcional e ignorado** pela API. O app novo não envia; o antigo continua compilando.
  - `finalizarPedidoSchema`: `buyer` **obrigatório**, nas regras de hoje: `name` 2–200, `email` válido até 320, `phone` 8–30.
  - `PedidoPublicoResult`: ganha `eventSlug: string`, `sessionId: string` e `expiresAt: Date | null`; `items` passa a ser `ItemPedidoPublico[]`; sai `tickets?: unknown[]`.
  - Novos: `interface PedidoComIngressos extends PedidoPublicoResult { buyerName: string | null; event: { title: string; slug: string; imageUrl: string | null; locationName: string | null }; tickets: IngressoPublico[] }` e `interface FinalizacaoPublicaResult { pedido: PedidoPublicoResult; acesso: string }`.
- Produz no serviço:
  ```ts
  // acesso-pedido.ts
  export function gerarTokenAcesso(): { token: string; hash: string } // token = randomBytes(32).toString("base64url"); hash = sha256 hex
  export function hashTokenAcesso(token: string): string
  export function validadeAcesso(fimDaSessao: Date): Date // +30 dias
  ```
  - `reservarAssentos(raw): Promise<ReservaPublicaResult>`:
    - grava o pedido com `buyerName`, `buyerEmail` e `buyerPhone` = `null`;
    - a repetição idempotente só devolve o pedido existente quando `sessionId` e o conjunto de `seatId` são os mesmos (dentro da transação e no `catch` de `23505`); se não forem, dá `IDEMPOTENCY_CONFLICT`.
  - `finalizarPedidoConvidado(orderNumber, raw): Promise<FinalizacaoPublicaResult>`:
    - grava no pedido o comprador normalizado (e-mail minúsculo e aparado, telefone só com dígitos via `normalizePhone`);
    - usa esse comprador nos aceites;
    - insere em `eventoTokensConsulta` `{ orderId, email, tokenHash, expiresAt: validadeAcesso(session.endsAt ?? session.startsAt) }`;
    - devolve `{ pedido, acesso: token }`. Na repetição idempotente, emite um token **novo**, porque o original não é recuperável.
  - `consultarPedido(orderNumber): Promise<PedidoPublicoResult>` com `eventSlug`, `sessionId`, `expiresAt` e itens com `rowLabel`, `seatNumber` (join `eventoMapaAssentos` por `inventory.seatId`) e `ticketTypeName` (join `eventoTiposIngresso`). Nunca inclui QR.

- [ ] **Passo 1: testes que falham.**
  - Em `acesso-pedido.spec.ts`:
    - token de 43 caracteres base64url;
    - hash de 64 hex, igual a `hashTokenAcesso(token)`;
    - `validadeAcesso(new Date("2026-12-07T22:00:00Z"))` é `2027-01-06T22:00:00Z`.
  - No serviço, trocar os testes de idempotência baseados em e-mail por:
    - `repete a reserva idempotente quando sessão e assentos coincidem`;
    - `recusa a repetição com outros assentos com IDEMPOTENCY_CONFLICT`, nos dois caminhos.
  - Em `eventos-publico.test.ts`: `reserva sem buyer é aceita` e `finalização sem buyer é recusada`.
  - Novos testes no serviço:
    - `reserva sem dados do comprador grava comprador nulo`;
    - `reserva ignora buyer enviado e grava comprador nulo`;
    - `finalização grava comprador normalizado e usa o nome nos aceites`;
    - `finalização devolve acesso e guarda só o hash com validade de 30 dias após o fim da sessão`;
    - `consulta devolve rótulo do lugar, nome do tipo, slug, sessão e expiresAt`.
  - Ajustar os testes existentes que mandavam `buyer` na reserva.
- [ ] **Passo 2:** `pnpm --filter @essencia/api test -- eventos-public-sales acesso-pedido`. Esperado: FALHA.
- [ ] **Passo 3:** implementar, incluindo o ajuste mínimo do app.
- [ ] **Passo 4:** `pnpm --filter @essencia/api test -- eventos-public-sales acesso-pedido && pnpm --filter @essencia/shared test && pnpm --filter @essencia/eventos test && pnpm turbo typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): reserva antes dos dados do comprador e link seguro`.

### Tarefa 5: liberar pedido ("Alterar lugares")

**Arquivos:**
- Modificar: `services/api/src/modules/payments/payments.service.ts`
- Criar: `services/api/src/modules/payments/payments.service.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.ts` e o `.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public.controller.ts` e o `.spec.ts`

**Interfaces:**
- Produz:
  - `PaymentsService.encerrarCheckoutSessionSeAberta(id: string): Promise<"expirada" | "concluida" | "encerrada">`:
    - faz `retrieve`; se a sessão estiver `open`, faz `expire` e devolve `"expirada"`;
    - `complete` devolve `"concluida"`; `expired` devolve `"encerrada"`;
    - erros da Stripe **propagam**, ao contrário de `expireCheckoutSession`.
  - `EventosPublicSalesService.liberarPedido(orderNumber: string): Promise<{ liberado: true }>`:
    - **pedido já `CANCELADO` ou `EXPIRADO`:** devolve `{ liberado: true }` sem mudar nada;
    - **`CONFIRMADO` ou `USADO`:** `ConflictException({ code: "PAYMENT_ALREADY_COMPLETED" })`;
    - **havendo pagamento com `stripeCheckoutSessionId`:** encerra a sessão primeiro. Se ela voltar `"concluida"`, a resposta é `PAYMENT_ALREADY_COMPLETED`, sem mutação;
    - **senão, numa transação:**
      - inventário `RESERVADO` deste pedido → `DISPONIVEL`;
      - reservas `ATIVA` → `LIBERADA`;
      - pagamento `PENDENTE` → `EXPIRADO`;
      - pedido → `CANCELADO`, com `cancellationReason: "Lugares liberados pelo comprador"`.
  - Rota `POST /eventos/public/pedidos/:orderNumber/liberar`, com `@Throttle({ strict: { limit: 20, ttl: 60000 } })`.

- [ ] **Passo 1: testes que falham.**
  - Em `payments.service.spec.ts`, construir com `{ get: () => "sk_test_x" }` e sobrescrever `(service as any).stripe` com mocks. Cobrir os três resultados e a propagação de erro.
  - No serviço:
    - `libera assentos, reservas, pagamento e cancela o pedido`;
    - `recusa sem mutar quando a Stripe diz que o pagamento foi concluído`;
    - `recusa pedido confirmado`;
    - `repetir a liberação de pedido cancelado não muda nada`.
  - No controller: rota e throttle.
- [ ] **Passo 2:** `pnpm --filter @essencia/api test -- payments.service eventos-public`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar de novo. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): liberar lugares de um pedido`.

### Tarefa 6: sessão de pagamento embutida no `PaymentsService` (loja intocada)

**Arquivos:**
- Modificar: `services/api/src/modules/payments/payments.service.ts`
- Teste: `services/api/src/modules/payments/payments.service.spec.ts`

**Interfaces:**
- Produz:
  - `private montarParametrosCheckout(input): Stripe.Checkout.SessionCreateParams`. Reúne os parâmetros que hoje ficam dentro de `createCheckoutSession`: `mode`, `payment_method_types`, `client_reference_id`, `customer_email`, `line_items`, `metadata`, `payment_intent_data`, opções do Pix e `expires_at`.
  - `createCheckoutSession`: mesmo resultado de hoje (`success_url` e `cancel_url` acrescentados aos parâmetros comuns).
  - `createEmbeddedCheckoutSession(input: Omit<CreateCheckoutSessionInput, "successUrl" | "cancelUrl"> & { returnUrl: string }): Promise<{ checkoutSessionId: string; clientSecret: string; paymentIntentId?: string }>`:
    - parâmetros comuns mais `ui_mode: "embedded"` e `return_url`;
    - sem `success_url` e `cancel_url`;
    - lança `CHECKOUT_CLIENT_SECRET_MISSING` se a Stripe não devolver `client_secret`;
    - mesmo tratamento de erros do método hospedado.

- [ ] **Passo 1: testes que falham:**
  - `checkout hospedado envia exatamente os mesmos parâmetros de antes`: compara o objeto passado a `stripe.checkout.sessions.create` com o snapshot atual (com `success_url`/`cancel_url` e sem `ui_mode`);
  - `checkout embutido envia ui_mode embedded e return_url, sem success/cancel, e devolve clientSecret`;
  - `checkout embutido falha sem client_secret`.
- [ ] **Passo 2:** `pnpm --filter @essencia/api test -- payments.service`. Esperado: FALHA.
- [ ] **Passo 3:** implementar. O `typecheck` confere `ui_mode` contra os tipos do `stripe@20`.
- [ ] **Passo 4:** `pnpm --filter @essencia/api test -- payments shop`. Esperado: PASSA, incluindo os testes da loja.
- [ ] **Passo 5:** commit `feat(pagamentos): sessão embutida da Stripe sem mudar a loja`.

### Tarefa 7: iniciar o pagamento embutido nos eventos

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.ts` (`iniciarCheckout`)
- Modificar: `services/api/src/modules/eventos/dto/eventos-public.dto.ts` (`PagamentoEmbutidoDto`, no lugar de `CheckoutPublicoDto`)
- Modificar: `services/api/src/modules/payments/payments.service.ts`, com `obterClientSecretSeAberta(id: string): Promise<string | null>`: faz `retrieve` e devolve o `client_secret` se a sessão estiver `open`; senão, `null`.
- Teste: `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`, `services/api/src/modules/payments/payments.service.spec.ts`

**Interfaces:**
- Consome: `createEmbeddedCheckoutSession` (Tarefa 6) e `pagamentoEmbutidoSchema` (Tarefa 1).
- Produz: `iniciarCheckout(orderNumber, raw): Promise<PagamentoEmbutidoResult>`.
  - Valida `returnUrl` com `validarUrlCheckout`.
  - Exige pedido `RESERVADO` ou `AGUARDANDO_PAGAMENTO` com `buyerEmail` preenchido. Sem e-mail, o erro é `ORDER_NOT_FINALIZED`.
  - **Reaproveita** a sessão aberta: se já houver pagamento `PENDENTE` com sessão `open`, devolve o `client_secret` dela por um novo `PaymentsService.obterClientSecretSeAberta(id): Promise<string | null>`. Assim, recarregar a página não cria sessão duplicada.
  - Ao criar sessão nova, usa `idempotencyKey: \`evento-checkout:${order.id}:${input.idempotencyKey}\``.
  - Mantém a validação das linhas contra `totalCents`, a gravação do pagamento e a extensão de prazo de hoje.

- [ ] **Passo 1: testes que falham.** Adaptar `envia ao Stripe as linhas persistidas… R$ 382,50` para o método embutido. Novos testes:
  - `devolve clientSecret e repassa returnUrl`;
  - `recusa returnUrl de outra origem com CHECKOUT_URL_NOT_ALLOWED`;
  - `recusa pedido não finalizado`;
  - `reaproveita a sessão aberta sem criar outra`;
  - em `payments.service.spec.ts`: `obterClientSecretSeAberta devolve o segredo só de sessão aberta`.
- [ ] **Passo 2:** `pnpm --filter @essencia/api test -- eventos-public-sales payments.service`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar de novo. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): pagamento embutido no site de eventos`.

### Tarefa 8: número curto na emissão do ingresso

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/eventos-pagamentos.service.ts`
- Teste: `services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts`

**Interfaces:**
- Consome: `gerarNumeroIngresso` (Tarefa 1).
- Produz: o insert em `eventoIngressos` passa a levar `numero: gerarNumeroIngresso()`.

- [ ] **Passo 1:** teste que falha: `emite ingresso com número de 8 caracteres do alfabeto`. O payload inserido casa com `/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/`.
- [ ] **Passo 2:** rodar `-- eventos-pagamentos`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): número curto no ingresso`.

### Tarefa 9: ingressos protegidos e "Meus ingressos"

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/eventos-public-sales.service.ts` e o `.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos-public.controller.ts` e o `.spec.ts`

**Interfaces:**
- Consome: `hashTokenAcesso`, `gerarTokenAcesso` e `validadeAcesso` (Tarefa 4).
- Produz:
  - `obterIngressos(orderNumber: string, acesso: string): Promise<PedidoComIngressos>`:
    - **validação do token:** procura o hash em `eventoTokensConsulta` com o `orderId` do pedido e `expiresAt` nulo ou no futuro. Token ausente, inválido, de outro pedido ou vencido dá `NotFoundException({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" })`.
    - **conteúdo:** `buyerName`, os dados do evento (`title`, `slug`, `imageUrl`, `locationName`) e `tickets`.
    - **origem de cada ingresso:** `eventoIngressos` → item → tipo, participante e assento.
    - **quando há ingressos:** só com o pedido `CONFIRMADO` ou `USADO`. Nos demais estados, `tickets: []`.
  - `buscarMeusIngressos(raw): Promise<MeusIngressosResult>`:
    - **busca:** por `orderNumber` + e-mail (comparação sem diferenciar maiúsculas) ou por e-mail + celular (só dígitos);
    - **filtro:** só pedidos `CONFIRMADO` ou `USADO`;
    - **resultado:** um token novo por pedido encontrado;
    - **nenhum encontrado:** `NotFoundException({ code: "ORDER_NOT_FOUND", message: "Não encontramos um pedido com esses dados" })`, sem dizer se o e-mail existe.
  - Rota `GET /eventos/public/pedidos/:orderNumber/ingressos?acesso=…`, com throttle de 60 por minuto.
  - Rota `POST /eventos/public/meus-ingressos`, com throttle de 10 por minuto.

- [ ] **Passo 1: testes que falham:**
  - `token válido devolve QR, número, lugar, tipo e participante`;
  - `token de outro pedido, vencido ou vazio não revela nada`;
  - `pedido aguardando pagamento devolve tickets vazios`;
  - `meus ingressos por número e e-mail ignora maiúsculas`;
  - `meus ingressos por e-mail e celular compara só dígitos`;
  - `meus ingressos não encontrado usa a mensagem genérica`;
  - `consulta antiga por número continua sem qrPayload`: `JSON.stringify(result)` não contém `qrPayload` nem `numero`;
  - no controller: rotas e limites.
- [ ] **Passo 2:** rodar `-- eventos-public`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): ingressos por link seguro e meus ingressos`.

### Tarefa 10: limite de tentativas por pessoa nos eventos

**Arquivos:**
- Criar: `services/api/src/common/guards/throttler-ip-real.guard.ts` e o `.spec.ts`
- Modificar: `services/api/src/app.module.ts` (`APP_GUARD` com `useClass: ThrottlerIpRealGuard`)
- Modificar: `services/api/src/modules/eventos/eventos-public.controller.ts` (`@UsarIpRealDoProxy()` na classe) e o `.spec.ts`

**Interfaces:**
- Produz:
  ```ts
  export const IP_REAL_DO_PROXY = "ipRealDoProxy";
  export const UsarIpRealDoProxy = () => SetMetadata(IP_REAL_DO_PROXY, true);
  export function ipRealDaRequisicao(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string;
  export class ThrottlerIpRealGuard extends ThrottlerGuard {
    protected handleRequest(props: ThrottlerRequest): Promise<boolean>;
  }
  ```
- Regras de `ipRealDaRequisicao`:
  - usa o primeiro valor de `x-real-ip`, aparado e validado por `net.isIP`, **só** quando `req.ip` é privado ou loopback: `10/8`, `172.16/12`, `192.168/16`, `127/8`, `::1`, `fc00::/7` e as formas `::ffff:` dessas faixas;
  - nos demais casos, devolve `req.ip ?? "desconhecido"`.
- Regra do guard: quando a metadata `IP_REAL_DO_PROXY` existe no handler ou na classe, `handleRequest` troca `props.getTracker` por `ipRealDaRequisicao`. Sem a metadata, o comportamento é idêntico ao atual.

- [ ] **Passo 1: testes que falham:**
  - `usa x-real-ip vindo do nginx (172.18.0.5)`;
  - `ignora o cabeçalho quando a conexão vem de IP público`;
  - `ignora x-real-ip inválido`;
  - `o guard troca o tracker só com a metadata`: espionar `ThrottlerGuard.prototype.handleRequest` e conferir o `getTracker` recebido;
  - `EventosPublicController tem a metadata IP_REAL_DO_PROXY`.
- [ ] **Passo 2:** rodar `-- throttler-ip-real eventos-public.controller`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter @essencia/api test`. Esperado: a suíte inteira PASSA.
- [ ] **Passo 5:** commit `fix(api): limite de tentativas por pessoa nos eventos públicos`.

### Tarefa 11: fundação visual, cabeçalho e rodapé de confiança

**Arquivos:**
- Criar: `apps/eventos/lib/instituicao.ts`, `apps/eventos/components/base/botao-acao.ts`, `apps/eventos/components/base/cabecalho.tsx`, `apps/eventos/components/base/rodape-confianca.tsx`, `apps/eventos/components/__tests__/moldura.test.tsx`
- Modificar: `apps/eventos/app/globals.css`, `apps/eventos/app/layout.tsx`, `apps/eventos/app/publico.test.tsx`

**Interfaces:**
- Produz:
  ```ts
  export const INSTITUICAO = { nome, cnpj, endereco, telefone, telefoneHref } as const; // valores das Restrições globais
  export function classeBotaoAcao(variante?: "primaria" | "secundaria" | "fantasma"): string; // serve para <a>, <Link> e <button>
  export function Cabecalho(): React.JSX.Element;       // logo (h-10 no celular, h-12 no computador) e link "Meus ingressos" para /pedido/consulta
  export function RodapeConfianca(): React.JSX.Element; // três colunas e linha legal (nome · CNPJ · endereço)
  ```
- Tokens em `globals.css`: `--fundo`, `--cartao`, `--tinta`, `--tinta-2`, `--linha`, `--acao`, `--acao-hover`, `--verde-colegio`, `--aviso-fundo` e `--aviso-texto`, com as cores das Restrições globais. Manter `--ink`, `--line` etc. como apelidos até a Tarefa 23, para os componentes antigos não quebrarem no meio do caminho.

- [ ] **Passo 1: testes que falham** em `moldura.test.tsx`:
  - O rodapé contém o CNPJ e o endereço exatos, `href="tel:+553432927388"` e o texto `Pagamento processado pela Stripe`.
  - O rodapé contém `Cartão de crédito e Pix`.
  - O rodapé **não** contém `Termos`, `Privacidade` nem `WhatsApp`.
  - O cabeçalho tem um link `Meus ingressos` para `/pedido/consulta`.
  - `classeBotaoAcao()` contém `bg-[var(--acao)]`.
  - Em `publico.test.tsx`, o layout usa `<Cabecalho />` e `<RodapeConfianca />` e não contém `bg-blue`.
- [ ] **Passo 2:** `pnpm --filter @essencia/eventos test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): moldura visual e rodapé de confiança`.

### Tarefa 12: cliente da API no app e repasse do IP

**Arquivos:**
- Modificar: `apps/eventos/lib/eventos-api.ts`, `apps/eventos/lib/eventos-api.test.ts`, `apps/eventos/lib/checkout-utils.ts` e o teste dele
- Criar: `apps/eventos/lib/eventos-api-servidor.ts`

**Interfaces:**
- Produz (`eventos-api.ts`):
  ```ts
  // reservarAssentos: assinatura igual (o tipo vem do schema, com buyer opcional desde a Tarefa 4); chamada sem buyer não o envia
  // finalizarPedido: já ajustado na Tarefa 4 (recebe buyer e devolve FinalizacaoPublicaResult)
  iniciarPagamento(orderNumber: string, input: { returnUrl: string; idempotencyKey?: string }): Promise<PagamentoEmbutidoResult> // clientSecret vazio vira EventosApiError 502 "CHECKOUT_CLIENT_SECRET_INVALID"; iniciarCheckout fica até a Tarefa 20
  liberarPedido(orderNumber: string): Promise<void>
  obterIngressos(orderNumber: string, acesso: string, init?: RequestInit): Promise<PedidoComIngressos>
  buscarMeusIngressos(input: MeusIngressosInput): Promise<MeusIngressosResult>
  // as leituras (listarEventosPublicos, obterEventoPublico, listarSessoesPublicas, listarPoliticasPublicas, obterMapaSessao, consultarPedido) passam a aceitar init?: RequestInit e repassam init.headers
  ```
- Produz (`eventos-api-servidor.ts`, só para componentes de servidor; lê `(await headers()).get("x-real-ip")` de `next/headers` e repassa como cabeçalho `x-real-ip`):
  ```ts
  cabecalhosDoCliente(): Promise<Record<string, string>>
  listarEventosPublicosServidor(), obterEventoPublicoServidor(slug), listarSessoesPublicasServidor(slug), listarPoliticasPublicasServidor(slug), obterMapaSessaoServidor(sessionId), consultarPedidoServidor(orderNumber), obterIngressosServidor(orderNumber, acesso)
  ```
- Produz (`checkout-utils.ts`): `montarUrlRetornoPagamento(orderNumber: string, acesso: string): string`, que devolve `${origemPublicaEventos()}/pedido/${encodeURIComponent(orderNumber)}?acesso=${encodeURIComponent(acesso)}`.

- [ ] **Passo 1: testes que falham** (com `fetch` mockado):
  - `reservar sem buyer não envia o campo`;
  - `iniciarPagamento envia returnUrl e recusa clientSecret vazio`;
  - `liberar faz POST em /pedidos/{n}/liberar`;
  - `obterIngressos codifica o acesso na query`;
  - `buscarMeusIngressos faz POST no corpo`;
  - `leituras repassam x-real-ip do init`;
  - `montarUrlRetornoPagamento codifica número e acesso`.
- [ ] **Passo 2:** rodar os testes do app. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter @essencia/eventos test && pnpm turbo typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): cliente da API para o novo fluxo`.

### Tarefa 13: página inicial (catálogo)

**Arquivos:**
- Criar: `apps/eventos/components/catalogo/evento-destaque.tsx`, `apps/eventos/components/base/esqueleto.tsx`, `apps/eventos/app/loading.tsx`, `apps/eventos/app/not-found.tsx`
- Modificar: `apps/eventos/app/page.tsx` (usa `listarEventosPublicosServidor`), `components/catalogo-publico.tsx`, `components/catalogo-eventos.tsx`, `components/evento-card.tsx`, `components/catalogo-estados.tsx`, `components/imagem-publica-evento.tsx` (aceita `ajuste?: "cobrir" | "conter"`)
- Teste: `apps/eventos/components/__tests__/catalogo-eventos.test.tsx`, `app/publico.test.tsx`
- Modificar: `apps/eventos/lib/eventos-formatters.ts` e testes

**Interfaces:**
- Produz:
  ```ts
  formatarDataHoraExtenso(inicio: Date | string, fim?: Date | string | null): string // "Segunda, 7 de dezembro de 2026 · 16h às 19h" (America/Sao_Paulo; minutos só quando ≠ 00, ex. "16h30")
  formatarDataCurta(inicio: Date | string): string // "Seg, 7 dez · 16h"
  formatarMoeda(cents: number): string // "R$ 22,50"
  rotuloCurto(seat: { rowLabel: string; seatNumber: string }): string // "G21"; usado nas Tarefas 16 a 20
  Esqueleto({ className }: { className?: string }): React.JSX.Element // bloco cinza animado (animate-pulse, desligado com movimento reduzido)
  ```
- Estados de página: `app/loading.tsx` mostra esqueletos no formato do destaque. `app/not-found.tsx` mostra "Não encontramos esta página" e um botão para a página inicial, no novo visual.
- Comportamento:
  - **Um evento disponível:** destaque grande (`data-testid="evento-destaque"`) com:
    - a arte inteira, com `object-contain` e fundo da própria arte desfocada;
    - título, data por extenso e local;
    - "a partir de R$ 22,50";
    - botão de ação "Escolher assentos" para `/evento/{slug}`.
  - **Dois ou mais:** grade de cartões no novo estilo.
  - **Vazio e erro:** estados no novo visual (o erro mantém `role="alert"` e "Tentar novamente").
  - **Título da página:** `Eventos do Colégio Essência Feliz`.

- [ ] **Passo 1: testes que falham:**
  - `um evento vira destaque com arte sem corte, data por extenso, preço e link`;
  - `dois eventos viram grade de dois cartões`;
  - `evento esgotado não tem link de compra`;
  - `estados vazio e erro`;
  - `not-found oferece voltar à página inicial`;
  - testes dos formatadores com `2026-12-07T19:00:00Z`→`2026-12-07T22:00:00Z`, mais `rotuloCurto({ rowLabel: "G", seatNumber: "21" }) === "G21"`;
  - atualizar o teste da página que esperava "Eventos disponíveis".
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): página inicial com evento em destaque`.

### Tarefa 14: página do evento

**Arquivos:**
- Criar em `apps/eventos/components/evento/`: `topo-evento.tsx`, `caixa-compra.tsx`, `barra-compra-celular.tsx`, `bom-saber.tsx`, `politicas-resumidas.tsx`, `quem-organiza.tsx`
- Criar: `apps/eventos/lib/politicas.ts`
- Modificar: `apps/eventos/components/detalhe-evento.tsx`, `apps/eventos/components/sessoes-evento.tsx` (só os auxiliares `sessaoVendavel` e `hrefSessao` continuam exportados) e `apps/eventos/app/evento/[slug]/page.tsx` (busca evento, sessões e políticas pelos wrappers de servidor; `EventosApiError` 404 chama `notFound()`)
- Criar: `apps/eventos/app/evento/[slug]/loading.tsx` (esqueletos no formato do topo e da caixa de compra)
- Teste: `apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx`

**Interfaces:**
- Produz:
  ```ts
  ROTULO_POLITICA: Record<PoliticaPublica["type"], string> // ver Restrições globais
  ordenarPoliticas(politicas: PoliticaPublica[]): PoliticaPublica[] // ordem: CANCELAMENTO_REEMBOLSO, COMPRA, PRIVACIDADE, ACESSIBILIDADE, CONTATO
  DetalheEvento({ event, sessions, politicas }: { event: PublicEventDetail; sessions: PublicEventSession[]; politicas: PoliticaPublica[] }): React.ReactElement
  ```
- Comportamento (seguir a seção "Página do evento" da spec):
  - **Topo:**
    - fundo com a arte desfocada sob véu escuro, e a arte **inteira** (`object-contain`, `aspect-[16/9]`);
    - categoria, título, data por extenso com o horário da 1ª sessão vendável, local com endereço;
    - selos: "Assentos numerados" quando há `mapId`; "Meia-entrada" quando algum tipo casa com `/meia/i`; `{p}% off a partir de {min} lugares` quando há oferta;
    - "Realização: Colégio Essência Feliz".
  - **Caixa de compra** (fixa ao lado no computador):
    - seletor de sessão, que só aparece com 2 ou mais sessões vendáveis;
    - preços dos tipos da sessão escolhida e aviso da oferta de grupo;
    - botão "Escolher assentos" para `hrefSessao`;
    - as linhas "Pagamento seguro · cartão ou Pix" e "Confirmação na hora, com número do pedido".
  - **Barra fixa no celular:** "a partir de" com o menor preço e o botão "Escolher assentos".
  - **Sobre o espetáculo:** `event.description ?? event.summary`, preservando quebras de linha.
  - **Bom saber:** meia-entrada (pelo `eligibility` do tipo meia), lugares numerados, grupos (pela oferta) e acessibilidade (pela `location.accessibility`, senão "Assentos acessíveis marcados no mapa.").
  - **Políticas:** lista de títulos; cada um abre um `Dialog` de `@essencia/ui/components/dialog` com o texto completo. Sem políticas cadastradas, usa `event.cancellationPolicy` como "Cancelamento e reembolso".
  - **Quem organiza:** logo, nome, "Uberlândia, MG" e um link "Fale com o colégio" para o `tel:`.
  - Sem `contactEmail` do evento, sem bloco amarelo e sem azul.

- [ ] **Passo 1: testes que falham:**
  - `mostra a arte inteira sem corte`;
  - `data por extenso com horário`;
  - `selos de assentos numerados, meia e grupo`;
  - `caixa com preços e link para a sessão`;
  - `seletor aparece com duas sessões e troca o link`;
  - `sessão esgotada não oferece compra`;
  - `políticas com rótulos amigáveis e sem nomes internos`;
  - `quem organiza liga para o colégio`;
  - `mostra o texto sobre o espetáculo`;
  - `evento inexistente cai no not-found`;
  - `não usa classes azuis`.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): nova página do evento`.

### Tarefa 15: estender o `MapaEstiloB` para o uso público

**Arquivos:**
- Modificar: `packages/components/src/eventos/mapa-estilo-b.tsx`
- Teste: `packages/components/src/eventos/mapa-estilo-b.test.tsx`

**Interfaces:**
- Produz: props opcionais. Os padrões mantêm o comportamento atual do painel.
  ```ts
  coresDoLugar?: (lugar: LugarMapa, selecionado: boolean) => { preenchimento: string; contorno: string; numero: string };
  rotuloDoLugar?: (lugar: LugarMapa) => string;            // aria-label
  lugarDesabilitado?: (lugar: LugarMapa) => boolean;      // aria-disabled="true", tabIndex -1, sem clique nem Enter
  escalaMinimaNumeros?: number;                           // padrão 0; com k < valor, o <svg> recebe data-numeros="ocultos" e os números somem por CSS
  onTransformacao?: (t: TransformacaoZoom) => void;       // chamado a cada zoom e na montagem
  controleRef?: React.Ref<ControleMapa>;                  // useImperativeHandle
  export interface ControleMapa { aproximar(): void; afastar(): void; enquadrar(): void; focar(caixa: CaixaFoco): void }
  // reexportar deste arquivo: TransformacaoZoom, CaixaFoco e LugarMapa. O export "./*" do pacote só resolve .tsx,
  // então "@essencia/components/eventos/converter-ponto" não pode ser importado pelo app.
  ```
- Acrescentar `style={{ transition: "fill 150ms, stroke 150ms" }}` no retângulo da cadeirinha. Com `prefers-reduced-motion`, a transição fica de fora.

- [ ] **Passo 1: testes que falham:**
  - `aplica coresDoLugar quando informado`;
  - `lugar desabilitado não clica e fica fora do tab`;
  - `oculta números abaixo da escala mínima`;
  - `informa a transformação na montagem`;
  - `controle enquadra de volta em k=1`;
  - os testes existentes continuam passando sem mudança.
- [ ] **Passo 2:** `pnpm --filter @essencia/components test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter @essencia/components test && pnpm --filter @essencia/eventos-admin test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(components): mapa estilo B configurável para o site público`.

### Tarefa 16: mapa público (adaptação e componente)

**Arquivos:**
- Modificar: `apps/eventos/package.json` (`"@essencia/components": "workspace:*"`), `apps/eventos/next.config.js` (adicionar `"@essencia/components"` a `transpilePackages`)
- Criar em `apps/eventos/components/mapa/`: `adaptar-mapa.ts`, `mapa-publico.tsx`, `minimapa.tsx`, `letras-laterais.tsx`
- Testes: `apps/eventos/components/__tests__/adaptar-mapa.test.ts`, `apps/eventos/components/__tests__/mapa-publico.test.tsx`

**Interfaces:**
- Consome: `MapaEstiloB`, `ControleMapa`, `TransformacaoZoom` e `LugarMapa` de `@essencia/components/eventos/mapa-estilo-b` (Tarefa 15); `PublicMap.layout` e `rotacao` (Tarefa 3); `rotuloCurto` (Tarefa 13).
- Produz:
  ```ts
  export interface LugarPublico extends LugarMapa { livre: boolean; acessivel: boolean; rotuloCurto: string /* "G21" */ }
  export function paraLugaresPublicos(map: PublicMap, indisponiveis?: ReadonlySet<string>): LugarPublico[];
  // centro = x + width/2, y + height/2; rotacao do assento; categoria só se for CategoriaLugar válida;
  // livre = state === "available" && !indisponiveis.has(id); estado do MapaEstiloB sempre "livre"
  export function rotulosDoMapa(map: PublicMap): RotuloFileira[];
  // rótulos do layout de fileiras com assento + duas pontas por fileira: centro do assento mais à esquerda − 1,2 × largura e mais à direita + 1,2 × largura
  export function dimensoesDoMapa(map: PublicMap): { largura: number; altura: number };
  // layout ? (largura, altura) : caixa dos assentos + 5% de margem (as coordenadas são deslocadas para começar na margem)
  export function elementosDoMapa(map: PublicMap): ElementoPlanta[]; // layout?.elementos ?? []
  export function coresPublicas(lugar: LugarPublico, selecionado: boolean): { preenchimento: string; contorno: string; numero: string }; // tabela das Restrições globais
  export function rotuloAcessivelPublico(lugar: LugarPublico, selecionado: boolean): string;
  // "Fileira G, assento 21, livre" + ", acessível" + ", seu lugar"; ocupado: "Fileira G, assento 21, ocupado"
  export function MapaPublico(props: {
    map: PublicMap;
    selecionados: ReadonlySet<string>;
    indisponiveis?: ReadonlySet<string>;
    onAlternar: (seatId: string) => void;
    className?: string;
  }): React.JSX.Element;
  ```
- Comportamento de `MapaPublico`:
  - legenda (Livre, Seu lugar, Ocupado, Acessível);
  - botões +, − e "Ver tudo", que usam `controleRef`;
  - `escalaMinimaNumeros={3}`;
  - no computador, um balão ao passar o mouse: `Fileira G · Assento 18 · Livre`;
  - `Minimapa` com o retângulo da área visível quando `k > 1.5`;
  - `LetrasLaterais`: com `k ≥ 3`, pílulas das fileiras visíveis presas às bordas esquerda e direita. A posição y na tela vem de `onTransformacao` e do centro dos assentos de cada fileira.

- [ ] **Passo 1: testes que falham:**
  - `converte canto superior esquerdo em centro e mantém a rotação`;
  - `reservado, vendido, bloqueado e indisponível viram ocupado`;
  - `ignora rótulo de fileira sem assento e acrescenta as pontas`;
  - `sem layout usa a caixa dos assentos e não desenha palco`;
  - `cores da tabela para livre, seu lugar, ocupado e acessível`;
  - `clicar em lugar livre chama onAlternar; ocupado não`;
  - `legenda e rótulo acessível`.
- [ ] **Passo 2:** `pnpm install && pnpm --filter @essencia/eventos test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): mapa público com palco, letras e cadeirinhas`.

### Tarefa 17: tela de escolha de lugares

**Arquivos:**
- Criar: `apps/eventos/lib/selecao-lugares.ts`, com `reidratarSelecaoAssentos`, `serializarSelecaoAssentos` e `calcularPrecoSelecao` movidos de `mapa-assentos-utils.ts` e `resumo-assentos.tsx`
- Criar: `apps/eventos/components/base/etapas-compra.tsx`
- Criar em `apps/eventos/components/escolha/`: `escolha-lugares.tsx`, `resumo-lugares.tsx`, `faixa-evento.tsx`, `lista-lugares.tsx`
- Modificar: `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`:
  - busca evento, sessão e mapa pelos wrappers;
  - mantém a reidratação pela URL e `conflito=disponibilidade`;
  - **sessão sem venda:** em vez do aviso vermelho solto, mostra um cartão no novo visual com "Não há ingressos disponíveis para esta sessão" e um botão "Voltar ao evento".
- Criar: `apps/eventos/app/evento/[slug]/sessao/[sessionId]/loading.tsx` (esqueleto do mapa)
- Remover: `components/mapa-assentos.tsx`, `components/mapa-assentos-svg.tsx`, `components/resumo-assentos.tsx`, `components/mapa-assentos-utils.ts` e os testes deles (os casos que valem migram para os novos)
- Modificar: `apps/eventos/package.json` (`"framer-motion": "^12.23.26"`)
- Testes: `apps/eventos/components/__tests__/escolha-lugares.test.tsx`, `apps/eventos/lib/__tests__/selecao-lugares.test.ts`, `apps/eventos/app/sessao-page.test.tsx`

**Interfaces:**
- Consome: `MapaPublico` (Tarefa 16) e `reservarAssentos` (Tarefa 12).
- Produz:
  ```ts
  EtapasCompra({ atual }: { atual: 1 | 2 | 3 }): React.JSX.Element // 1 Lugares · 2 Seus dados · 3 Pagamento; as anteriores com ✓
  EscolhaLugares(props: {
    evento: PublicEventDetail;
    sessao: PublicEventSession;
    map: PublicMap;
    initialSelection?: AssentoSelecionado[];
    unavailableSeatIds?: string[];
    initialSelectionInvalid?: boolean;
  }): React.JSX.Element
  ```
- Comportamento:
  - **Layout:**
    - **computador:** faixa do evento (miniatura, título e `formatarDataHoraExtenso`) e `EtapasCompra atual={1}`. Abaixo, uma grade com o mapa (cerca de 640 px) e o `ResumoLugares` fixo à direita (340 px).
    - **celular:** o mapa ocupa a área entre o cabeçalho e uma barra fixa: "N lugares · G19, G20 · R$ total" mais "Continuar". Tocar na barra abre o `Sheet` (`@essencia/ui/components/sheet`) com o `ResumoLugares`.
  - **Resumo dos lugares:**
    - cada lugar mostra Inteira/Meia em botões de rádio acessíveis, com o mesmo comportamento de hoje: um tipo só é escolhido automaticamente; com dois ou mais, a escolha é obrigatória;
    - mostra a oferta com uma barrinha de progresso e o total.
  - **Continuar:**
    - desabilitado com a mensagem `Escolha Inteira ou Meia-entrada em cada lugar` enquanto faltar tipo;
    - chama `reservarAssentos` sem comprador e mostra "Guardando seus lugares…";
    - em caso de sucesso, faz `router.push(\`/checkout?pedido=${orderNumber}&slug=${slug}&sessionId=${sessionId}\`)`;
    - com `409 SEAT_UNAVAILABLE`, recarrega o mapa (`obterMapaSessao`) e remove da seleção os lugares que não estão mais livres. Para cada um, mostra numa região `aria-live="polite"` o aviso `O lugar {rotuloCurto} acabou de ser escolhido por outra pessoa`. A Tarefa 18 reaproveita esse mesmo mecanismo.
  - **Regras preservadas:** limite de 20 com mensagem, avisos de conflito vindos da URL, ocupados não clicáveis e `Prefere uma lista? Ver lugares em lista`, que alterna para `ListaLugares` em qualquer tamanho de tela.
  - **Acabamento:** `AnimatePresence`/`motion.li` nos itens do resumo e no total. `navigator.vibrate?.(10)` ao marcar um lugar, exceto quando `matchMedia("(prefers-reduced-motion: reduce)")` é verdadeiro.

- [ ] **Passo 1: testes que falham:**
  - `prévia de desconto com 9, 10 e 20 lugares` (oferta 15%, 10 inteiras, 382,50);
  - `o 21º lugar não entra e mostra o limite`;
  - `ocupado não seleciona`;
  - `reidrata a seleção da URL e avisa conflito`;
  - `com dois tipos, Continuar espera a escolha`;
  - `Continuar reserva sem comprador e navega para o checkout com o pedido`;
  - `409 remove o lugar perdido com aviso`;
  - `alterna para a lista`;
  - `vibra ao marcar e não vibra com movimento reduzido`;
  - em `sessao-page.test.tsx`: `sessão sem venda mostra cartão com volta ao evento, sem role=alert vermelho`;
  - em `selecao-lugares.test.ts`, os casos atuais de reidratação e serialização migrados.
- [ ] **Passo 2:** `pnpm install && pnpm --filter @essencia/eventos test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar e remover os arquivos antigos.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): nova escolha de lugares`.

### Tarefa 18: mapa ao vivo

**Arquivos:**
- Criar: `apps/eventos/components/escolha/use-disponibilidade-ao-vivo.ts`, `apps/eventos/components/__tests__/disponibilidade-ao-vivo.test.tsx`
- Modificar: `apps/eventos/components/escolha/escolha-lugares.tsx`

**Interfaces:**
- Produz:
  ```ts
  export function useDisponibilidadeAoVivo(sessionId: string, mapaInicial: PublicMap, opcoes?: { intervaloMs?: number; buscar?: (sessionId: string) => Promise<PublicMap> }): { mapa: PublicMap; atualizarAgora: () => Promise<PublicMap> }
  // padrão 20000 ms; pausa com document.visibilityState === "hidden"; ao voltar a ficar visível, atualiza na hora; erro mantém o último mapa
  export function lugaresPerdidos(selecao: AssentoSelecionado[], mapa: PublicMap): PublicSeat[]
  ```
- Integração: quando o mapa muda, os lugares perdidos saem da seleção pelo mesmo mecanismo de aviso da Tarefa 17. O 409 da Tarefa 17 passa a usar `atualizarAgora()`.

- [ ] **Passo 1: testes que falham** (com timers falsos):
  - `consulta de novo a cada 20 segundos`;
  - `não consulta com a aba escondida e atualiza ao voltar`;
  - `mantém o último mapa quando a consulta falha`;
  - `remove da seleção o lugar pego por outra pessoa, avisa e recalcula o total`.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): mapa de lugares atualizado ao vivo`.

### Tarefa 19: pagamento embutido (etapa 3)

**Arquivos:**
- Modificar: `apps/eventos/package.json` (`"@stripe/stripe-js": "^4.10.0"` e `"@stripe/react-stripe-js": "^3.1.0"`, as mesmas versões da loja)
- Criar: `apps/eventos/components/checkout/pagamento-embutido.tsx`
- Modificar: `docker-compose.prod.yml` (no serviço `eventos`, `STRIPE_PUBLISHABLE_KEY: ${STRIPE_PUBLISHABLE_KEY}`)
- Testes: `apps/eventos/components/__tests__/pagamento-embutido.test.tsx`, `apps/eventos/app/publico.test.tsx`

**Interfaces:**
- Produz:
  ```ts
  obterStripe(publishableKey: string): Promise<Stripe | null> // cache por chave no módulo; loadStripe uma vez
  PagamentoEmbutido({ publishableKey, clientSecret }: { publishableKey: string | null; clientSecret: string }): React.JSX.Element
  // EmbeddedCheckoutProvider + EmbeddedCheckout; acima, a linha de confiança exata;
  // sem chave: "Pagamento indisponível no momento. Tente novamente em instantes."
  ```
- Componente isolado: o fluxo do checkout (Tarefa 20) o usa na etapa 3. Ao terminar, a própria Stripe leva a página para o `returnUrl`.

- [ ] **Passo 1: testes que falham:**
  - com `vi.mock("@stripe/react-stripe-js")` e `vi.mock("@stripe/stripe-js")`: `monta o checkout embutido com o clientSecret`, `chama loadStripe uma vez por chave` e `sem chave mostra mensagem e não quebra`;
  - em `publico.test.tsx`: `docker-compose passa STRIPE_PUBLISHABLE_KEY ao serviço eventos`.
- [ ] **Passo 2:** `pnpm install && pnpm --filter @essencia/eventos test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): pagamento com cartão ou Pix dentro do site`.

### Tarefa 20: checkout — seus dados, relógio e alterar lugares

**Arquivos:**
- Criar em `apps/eventos/components/checkout/`: `fluxo-checkout.tsx`, `relogio-reserva.tsx`, `formulario-dados.tsx`, `resumo-pedido.tsx`, `politicas-aceite.tsx`, `tempo-esgotado.tsx`
- Modificar: `apps/eventos/app/checkout/page.tsx`:
  - `export const dynamic = "force-dynamic"`;
  - lê `pedido`, `slug` e `sessionId`;
  - carrega `consultarPedidoServidor`, o evento, a sessão e as políticas;
  - passa `process.env.STRIPE_PUBLISHABLE_KEY ?? null` como `publishableKey`.
- Remover: `components/formulario-checkout.tsx` e o teste dele; `iniciarCheckout` e `CheckoutPublicoInputApp` de `apps/eventos/lib/eventos-api.ts`; `checkoutPublicoSchema`, `CheckoutPublicoInput` e `CheckoutPublicoDto`, se ainda existir, de `packages/shared` e da API
- Testes: `apps/eventos/components/__tests__/checkout.test.tsx`, `apps/eventos/app/checkout-page.test.tsx`

**Interfaces:**
- Consome: `finalizarPedido` (Tarefa 4), `iniciarPagamento`, `liberarPedido` e `montarUrlRetornoPagamento` (Tarefa 12); `PagamentoEmbutido` (Tarefa 19); `montarHrefRetornoMapa` (existente).
- Produz:
  ```ts
  formatarTempoRestante(ms: number): string // "14:32"; negativo vira "00:00"
  RelogioReserva({ expiraEm, onEsgotar, agora }: { expiraEm: Date | string; onEsgotar: () => void; agora?: () => number }): React.JSX.Element // faixa fixa no topo; chama onEsgotar uma vez
  FluxoCheckout(props: { pedido: PedidoPublicoResult; evento: PublicEventDetail; sessao: PublicEventSession; politicas: PoliticaPublica[]; publishableKey: string | null }): React.JSX.Element
  // etapa 2 (dados) → etapa 3 (PagamentoEmbutido, Tarefa 19), com EtapasCompra atual={3} e o relógio e o resumo ainda visíveis
  ```
- Comportamento:
  - **Etapas:** `EtapasCompra atual={2}`.
  - **Formulário:**
    - "Nome completo" (`autocomplete="name"`), "E-mail" (`type="email"`) e "Celular (WhatsApp)" (`type="tel"`, `inputMode="tel"`), com o texto explicativo exato;
    - um campo por lugar, `Nome de quem vai sentar no lugar G21`, com o lembrete de meia quando o `ticketTypeName` casa com `/meia/i`;
    - **uma** caixa `Li e aceito as políticas do evento`, com botões que abrem cada política num `Dialog`.
  - **Ir para o pagamento:**
    - se faltar algo, lista abaixo do botão o que falta, por exemplo `Falta: celular, aceite das políticas`;
    - ao enviar, chama `finalizarPedido` com o `buyer`, os participantes (`type: "CONVIDADO"`, `participantIndex` pela ordem dos itens) e os 5 aceites (`{type, version}` de todas as políticas);
    - guarda o `acesso` em `sessionStorage` sob `eventos:acesso:{pedido}`;
    - chama `iniciarPagamento` com `returnUrl` e passa para a etapa 3.
  - **Resumo:** à direita no computador; no celular, recolhido no topo como `N lugares · G19, G20, G21 ▾ · R$ total`. Mostra arte, título, data, local, itens (`rotuloCurto · tipo · preço`), desconto, total e o link "Alterar lugares".
  - **Alterar lugares:** chama `liberarPedido` e vai para `montarHrefRetornoMapa({ slug, sessionId, seatIds, ticketTypeIds })`. Com `PAYMENT_ALREADY_COMPLETED`, vai para `/pedido/{n}?acesso=…` se houver acesso guardado; se não, para `/pedido/consulta?pedido={n}`.
  - **Tempo esgotado:** acontece quando o relógio zera ou quando a API responde `ORDER_NOT_AVAILABLE`. Aparece `TempoEsgotado` com o texto exato e o botão "Escolher lugares de novo", que leva a `montarHrefRetornoMapa({..., motivo: "disponibilidade"})`. O formulário não é mais enviado.
  - **Pedido fora dos estados `INICIADO`, `RESERVADO` ou `AGUARDANDO_PAGAMENTO`:** mensagem com link para "Meus ingressos".

- [ ] **Passo 1: testes que falham:**
  - `formatarTempoRestante`;
  - `o relógio chama onEsgotar uma vez ao chegar a zero`;
  - `enviar finaliza com comprador, participantes e os cinco aceites a partir de uma única caixa e inicia o pagamento com returnUrl contendo o acesso`;
  - `lista o que falta antes de enviar`;
  - `não mostra nomes internos de política nem promete e-mail`;
  - `alterar lugares libera e volta ao mapa com a seleção`;
  - `pagamento já concluído leva aos ingressos`;
  - `tempo esgotado troca a tela e não envia`.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): checkout com relógio e alterar lugares`.

### Tarefa 21: Meus ingressos

**Arquivos:**
- Criar: `apps/eventos/components/ingressos/meus-ingressos.tsx`
- Modificar: `apps/eventos/app/pedido/consulta/page.tsx` (lê `?pedido=` para preencher)
- Remover: `components/consulta-pedido.tsx` e os testes `consulta-pedido.test.tsx` e `pedido-consulta.test.tsx`
- Teste: `apps/eventos/components/__tests__/meus-ingressos.test.tsx`

**Interfaces:**
- Consome: `buscarMeusIngressos` (Tarefa 12).
- Produz: `MeusIngressos({ numeroInicial }: { numeroInicial?: string }): React.JSX.Element`.
  - Duas abas: "Tenho o número do pedido" (número + e-mail) e "Não tenho o número" (e-mail + celular).
  - **Um pedido encontrado:** `router.push(\`/pedido/${n}?acesso=${acesso}\`)`.
  - **Vários:** lista com título, data e link para cada um.
  - **404:** `Não encontramos um pedido com esses dados`.
  - **429:** `Muitas tentativas. Aguarde um instante e tente de novo.`

- [ ] **Passo 1: testes que falham:**
  - `busca por número e e-mail e abre o ingresso`;
  - `busca por e-mail e celular`;
  - `lista vários pedidos`;
  - `mensagem genérica quando não encontra`;
  - `mensagem de muitas tentativas`;
  - `preenche o número vindo da URL`.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar e remover os arquivos antigos.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): meus ingressos`.

### Tarefa 22: página do ingresso (confirmação)

**Arquivos:**
- Modificar: `apps/eventos/package.json` (`"qrcode": "^1.5.4"` e `"jspdf": "^3.0.1"`; dev `"@types/qrcode": "^1.5.5"`)
- Criar em `apps/eventos/components/ingressos/`: `pagina-ingressos.tsx`, `cartao-ingresso.tsx`, `qr-ingresso.tsx`, `acoes-ingresso.tsx`
- Criar: `apps/eventos/lib/pdf-ingresso.ts`
- Modificar: `apps/eventos/app/pedido/[orderNumber]/page.tsx`:
  - lê `acesso` da query; sem ele, mostra o formulário de "Meus ingressos" (Tarefa 21) com o número preenchido;
  - com ele, chama `obterIngressosServidor`.
- Modificar: `apps/eventos/app/globals.css` (`@media print`: esconde cabeçalho, rodapé e botões; um ingresso por página)
- Testes: `apps/eventos/components/__tests__/ingressos.test.tsx`, `apps/eventos/lib/__tests__/pdf-ingresso.test.ts`

**Interfaces:**
- Consome: `obterIngressos` e `obterIngressosServidor` (Tarefa 12), `formatarNumeroIngresso` (Tarefa 1) e `MeusIngressos` (Tarefa 21).
- Produz:
  ```ts
  QrIngresso({ conteudo, tamanho }: { conteudo: string; tamanho?: number }): React.JSX.Element // QRCode.toString(conteudo, { type: "svg", margin: 1 })
  CartaoIngresso({ pedido, ingresso, indice, total }: { pedido: PedidoComIngressos; ingresso: IngressoPublico; indice: number; total: number }): React.JSX.Element
  PaginaIngressos({ inicial, orderNumber, acesso }: { inicial: PedidoComIngressos | null; orderNumber: string; acesso: string }): React.JSX.Element
  gerarPdfIngressos(pedido: PedidoComIngressos, ingressos: IngressoPublico[], opcoes?: { carregarArte?: (url: string) => Promise<string | null> }): Promise<Blob> // jsPDF A5 retrato, um ingresso por página
  nomeArquivoIngresso(pedido: PedidoComIngressos, ingresso?: IngressoPublico): string // "ingresso-G21-K7Q4-82MX.pdf" | "ingressos-{orderNumber}.pdf"
  compartilharOuBaixar(arquivo: File, navegador?: Pick<Navigator, "canShare" | "share">): Promise<"compartilhado" | "baixado">
  ```
- Comportamento:
  - **Pedido pendente:** mostra `Confirmando seu pagamento…` e consulta de novo a cada 2 s, até 30 vezes.
  - **Pedido `CANCELADO` ou `EXPIRADO`:** mensagem e link de volta ao evento.
  - **Token inválido (404):** `Não conseguimos abrir seus ingressos por este link.` e o formulário de "Meus ingressos" com o número preenchido.
  - **Pedido confirmado:**
    - topo com "Pagamento confirmado" e `Pedido nº {n} · {buyerName}`;
    - um cartão por lugar: faixa com miniatura, título, data e local; Fileira, Assento e Ingresso em destaque; QR; "Número do ingresso" com o número formatado; participante;
    - navegação: no celular, carrossel com `scroll-snap` e "Ingresso N de M"; no computador, grade;
    - o texto exato da entrada.
  - **Compartilhar (por cartão):** gera o PDF daquele ingresso e chama `compartilharOuBaixar`. Usa `navigator.share({ files })` quando `canShare({ files })` é verdadeiro; senão, baixa por `<a download>`.
  - **"Baixar todos":** um PDF com todas as páginas.
  - **Arte no PDF:** buscada pela mesma origem, em `/_next/image?url={encodeURIComponent(imageUrl)}&w=640&q=75`. Se falhar, o PDF sai sem a arte.

- [ ] **Passo 1: testes que falham:**
  - `cartão mostra número formatado, fileira, assento, tipo e participante`;
  - `QR renderiza SVG do conteúdo`;
  - `pendente mostra confirmando e consulta de novo`;
  - `token inválido mostra o formulário com o número`;
  - `compartilha quando o navegador aceita arquivos e baixa quando não`;
  - `PDF de dois ingressos tem duas páginas e tipo application/pdf` (`jspdf` no jsdom);
  - `PDF sai sem arte quando a imagem falha`;
  - `nomeArquivoIngresso`.
- [ ] **Passo 2:** `pnpm install && pnpm --filter @essencia/eventos test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(eventos): confirmação com ingressos, QR e PDF para compartilhar`.

### Tarefa 23: CSP, smoke e verificação final

**Arquivos:**
- Modificar: `nginx.conf` (só o `Content-Security-Policy-Report-Only` do bloco `server_name eventos.portalcef.com.br` em HTTPS, por volta da linha 850)
- Modificar: `apps/eventos/scripts/smoke-publico.mjs`
- Modificar: `apps/eventos/app/globals.css` (remover os apelidos de token antigos que ficaram sem uso)
- Teste: `apps/eventos/app/publico.test.tsx`

**Interfaces:**
- CSP do eventos. Acrescentar aos valores atuais:
  - `script-src https://js.stripe.com`;
  - `frame-src 'self' https://js.stripe.com https://*.stripe.com https://hooks.stripe.com`;
  - `connect-src https://api.stripe.com https://*.stripe.com`;
  - `img-src https://www.portalcef.com.br https://*.stripe.com`.

  Continua `Report-Only`.
- Smoke (mock de API no próprio script, como hoje):
  - **Mock:** o mapa com `layout` (palco, letras e um rótulo `X` sem assento) e as rotas novas: reservas sem `buyer`, finalizar com `acesso`, pagamento com `clientSecret`, `ingressos` com dois ingressos, `meus-ingressos` e `liberar`.
  - **Viewports:** 390×844 e 1440×900.
  - **O que verificar:**
    - catálogo em destaque;
    - página do evento com a arte em `object-fit: contain`;
    - mapa com o texto `PALCO` e a letra `A` visíveis e sem `X`;
    - marcar dois lugares, depois Continuar;
    - checkout com o relógio;
    - página de ingressos com o SVG do QR e `K7Q4-82MX`;
    - Meus ingressos.
  - **Em todas as páginas:** sem erro de console, sem rolagem horizontal (`scrollWidth <= innerWidth`) e com o conteúdo principal a pelo menos 16 px da borda esquerda. A etapa 3 não carrega a Stripe no smoke (chave ausente) e deve mostrar a mensagem de indisponível.

- [ ] **Passo 1:** teste que falha em `publico.test.tsx`: `CSP do eventos libera o checkout embutido da Stripe`. Ele lê `../../../nginx.conf`, recorta o bloco HTTPS do eventos e confere `https://js.stripe.com` em `script-src` e `frame-src`.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar a CSP e atualizar o smoke.
- [ ] **Passo 4: verificação completa:**
  - `pnpm turbo lint && pnpm turbo typecheck`
  - `pnpm turbo test --concurrency=1`
  - `pnpm --filter @essencia/eventos build`
  - `node apps/eventos/scripts/smoke-publico.mjs`

  Esperado: tudo PASSA. Anotar os números de testes por pacote.
- [ ] **Passo 5:** commit `chore(eventos): CSP da Stripe e smoke do novo site público`.

## Depois do plano (com o Renato, fora das tarefas)

1. Revisão final da branch inteira.
2. Merge, push e deploy com `./scripts/deploy.sh --migrar`, que traz a migration 0054. Depois, reiniciar o nginx para aplicar a CSP: `docker compose -f docker-compose.prod.yml --env-file .env.docker restart nginx`.
3. Conferir na conta Stripe se o Pix está ativo. Se não estiver, trocar os textos "cartão ou Pix" por "cartão".
4. Fazer a compra de ponta a ponta num **evento de teste separado**, nunca no ballet.
5. Corrigir os conteúdos do painel apontados na spec: o e-mail de contato do evento e o texto que fala em R$ 380,00.
