# Ingressos de cortesia com assento marcado — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a escola emita, pelo painel de eventos, lotes de ingressos de cortesia (valor zero) com assento escolhido no mapa, baixe o voucher em PDF e cancele uma cortesia liberando o assento.

**Architecture:** Cada cortesia é um pedido `CONFIRMADO` de R$ 0,00 com `origin = CORTESIA`, um item do tipo interno "Cortesia", um participante, um ingresso assinado e uma operação administrativa. Um serviço novo (`EventosCortesiasService`) concentra emissão, listagem, voucher, mapa administrativo e cancelamento. O gerador de PDF e o adaptador de mapa saem do site público para `@essencia/components`, e o painel ganha a aba "Cortesias".

**Tech Stack:** NestJS + Fastify, Drizzle (PostgreSQL), Zod em `@essencia/shared`, Next.js 15 (App Router), React 19, jsPDF + qrcode, Jest (API), Vitest (apps e pacotes).

**Spec:** `docs/superpowers/specs/2026-11-12-eventos-cortesias-design.md` — leia antes de qualquer tarefa.

## Global Constraints

- Comunicação, nomes de domínio, commits, comentários e mensagens em Português (BR).
- TDD obrigatório: teste primeiro, falha confirmada, depois o código. Teste que passa de primeira é inválido.
- Antes de cada commit: `pnpm turbo lint && pnpm turbo typecheck`.
- Apps nunca acessam o banco; só a API. O painel chama `/eventos-admin/api/eventos/admin/...`.
- Escola sempre vem do usuário da sessão (`assertSchoolScope(actor, event.schoolId)`), nunca do payload.
- Controllers administrativos de eventos: `@UseGuards(AuthGuard, RolesGuard)`, `@ExactRoles()`, `@Roles(...EVENTOS_ADMIN_ROLES)`.
- Lote: de 1 a 50 assentos, uma única sessão, sem repetição. `grupo`: 2 a 200 caracteres. `motivo`: 3 a 500 caracteres.
- Assento livre = inventário `DISPONIVEL` ou `LIBERADO` e `reservedByOrderId` nulo.
- Tipo interno: `name = "Cortesia"`, `priceCents = 0`, `internal = true`, `active = true`.
- Chave de idempotência do pedido: `cortesia:<chave>:<inventorySeatId>`.
- Códigos de erro e HTTP exatamente como na tabela "Erros" da spec.
- Migration só com colunas aditivas e com valor padrão.
- Trabalhar na branch `feat/eventos-cortesias`, criada a partir de `main` com a árvore limpa.

## Review Focus

Entradas que a spec não detalha e que um usuário real vai produzir. Cada uma tem teste na tarefa indicada.

1. **Nome de assento só com espaços** → vale como vazio: o participante recebe o nome do grupo. `grupo` e `motivo` são aparados antes de validar o tamanho. (Tarefas 2 e 5)
2. **Duas pessoas emitindo o mesmo assento ao mesmo tempo** → uma emite, a outra recebe `409 ASSENTOS_INDISPONIVEIS`, nunca erro 500. (Tarefa 5)
3. **Mesma `chave` reenviada com assentos diferentes** → devolve o resultado da emissão original e não grava nada. (Tarefa 5)
4. **Colisão de `orderNumber` ou de `numero` do ingresso (violação de índice único)** → o serviço sorteia de novo até 5 vezes em vez de derrubar o lote. (Tarefa 5)
5. **Evento sem nenhuma sessão apta (sem sessão ou sem mapa confirmado)** → a aba mostra "Este evento ainda não tem sessão com mapa confirmado." e não mostra mapa nem botão de emitir. (Tarefa 10)

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `packages/db/src/schema/eventos.ts` | modificar | Colunas `internal` e `origin`, enums. |
| `packages/db/drizzle/0055_eventos_cortesias.sql` | criar (gerado) | Migration. |
| `packages/shared/src/schemas/eventos.ts` | modificar | `emitirCortesiasSchema`, `cancelarCortesiaSchema`. |
| `packages/shared/src/types/eventos.ts` | modificar | Tipos da cortesia. |
| `packages/shared/src/eventos/datas.ts` | criar | `formatarDataHoraExtenso` compartilhado. |
| `services/api/src/modules/eventos/token-ingresso.ts` | criar | Assinatura do QR. |
| `services/api/src/modules/eventos/montar-mapa-sessao.ts` | criar | Assentos do mapa com estado. |
| `services/api/src/modules/eventos/montar-pedido-ingressos.ts` | criar | `PedidoComIngressos` a partir de um pedido. |
| `services/api/src/modules/eventos/eventos-cortesias.service.ts` | criar | Regras da cortesia. |
| `services/api/src/modules/eventos/eventos-cortesias.controller.ts` | criar | Rotas administrativas. |
| `packages/components/src/eventos/pdf-ingresso.ts` | criar (movido) | Gerador de PDF. |
| `packages/components/src/eventos/adaptar-mapa.ts` | criar (movido) | `PublicMap` → `LugarMapa`. |
| `apps/eventos-admin/features/eventos/cortesias/*` | criar | Tela (ver Tarefas 9 a 11). |
| `apps/eventos-admin/app/eventos/[id]/cortesias/page.tsx` | criar | Rota da aba. |

Nota: mover `adaptar-mapa.ts` não está escrito na spec, mas é consequência dela. O painel precisa converter o mapa para o `MapaEstiloB`, e essa conversão hoje só existe dentro do site público.

---

### Task 0: Preparar a branch

- [ ] **Step 1:** Rodar `git status --short`. Se houver qualquer arquivo modificado em `apps/eventos/`, **parar** e avisar o Renato: o trabalho de WhatsApp precisa estar commitado antes (pré-requisito da spec).
- [ ] **Step 2:** `git checkout -b feat/eventos-cortesias`

---

### Task 1: Banco — colunas e enums

**Files:**
- Modify: `packages/db/src/schema/eventos.ts`
- Test: `packages/db/src/schema/eventos.test.ts`
- Create (gerado): `packages/db/drizzle/0055_eventos_cortesias.sql`

**Interfaces:**
- Produces: `eventoTiposIngresso.internal` (boolean, not null, default `false`, coluna `internal`); `eventoPedidos.origin` (text, not null, default `"VENDA"`, coluna `origin`); `eventoPedidoOrigemEnum = ["VENDA", "CORTESIA"] as const` e `type EventoPedidoOrigem`; `eventoAuditoriaAcaoEnum` com `"CORTESIA_EMITIDA"` e `"CORTESIA_CANCELADA"` ao final.

- [ ] **Step 1: Teste que falha** em `eventos.test.ts`, no estilo `node:test` do arquivo:

```ts
test("cortesias: colunas e enums", () => {
  assert.deepEqual([...eventoPedidoOrigemEnum], ["VENDA", "CORTESIA"]);
  assert.equal(eventoPedidos.origin.notNull, true);
  assert.equal(eventoPedidos.origin.default, "VENDA");
  assert.equal(eventoTiposIngresso.internal.notNull, true);
  assert.equal(eventoTiposIngresso.internal.default, false);
  assert.ok(eventoAuditoriaAcaoEnum.includes("CORTESIA_EMITIDA"));
  assert.ok(eventoAuditoriaAcaoEnum.includes("CORTESIA_CANCELADA"));
});
```

- [ ] **Step 2:** `pnpm --filter @essencia/db test` → FALHA (`eventoPedidoOrigemEnum` não existe).
- [ ] **Step 3:** Implementar as colunas e enums. Adicionar em `evento_pedidos` o check `evento_pedidos_valid_origin` (`origin IN ('VENDA','CORTESIA')`).
- [ ] **Step 4:** `pnpm --filter @essencia/db test` → PASSA.
- [ ] **Step 5:** `pnpm db:generate`, renomear o arquivo gerado para `0055_eventos_cortesias.sql` (ajustando a `tag` em `drizzle/meta/_journal.json`). Conferir que o SQL contém apenas dois `ADD COLUMN` com `DEFAULT ... NOT NULL` e o `ADD CONSTRAINT` do check. Se trouxer qualquer outra alteração, parar e investigar.
- [ ] **Step 6:** `pnpm --filter @essencia/db build` (os outros pacotes leem o `dist`), depois lint + typecheck.
- [ ] **Step 7: Commit** — `feat(db): colunas de cortesia em pedidos e tipos de ingresso`

---

### Task 2: Shared — schemas e tipos

**Files:**
- Modify: `packages/shared/src/schemas/eventos.ts`, `packages/shared/src/schemas/index.ts`, `packages/shared/src/types/eventos.ts`
- Test: `packages/shared/src/schemas/eventos-cortesias.test.ts` (novo)

**Interfaces — Produces:**

```ts
// schemas
export const emitirCortesiasSchema: z.ZodType<EmitirCortesiasInput>;
export const cancelarCortesiaSchema: z.ZodType<CancelarCortesiaInput>;
export type EmitirCortesiasInput = {
  sessionId: string; chave: string; grupo: string; motivo: string;
  contatoEmail?: string; contatoTelefone?: string;
  assentos: Array<{ inventorySeatId: string; nome?: string }>;
};
export type CancelarCortesiaInput = { motivo: string };

// types
export type CortesiaSituacao = "ATIVA" | "USADA" | "CANCELADA";
export interface CortesiaResumo {
  orderId: string; orderNumber: string;
  session: { id: string; startsAt: Date };
  rowLabel: string; seatNumber: string;
  participantName: string; grupo: string; motivo: string;
  numero: string; situacao: CortesiaSituacao;
  emitidaPor: string; emitidaEm: Date; canceladaEm: Date | null;
}
export interface ConflitoAssentoCortesia {
  inventorySeatId: string; rowLabel: string; seatNumber: string;
  motivo: "VENDIDO" | "RESERVADO" | "BLOQUEADO" | "OUTRA_SESSAO" | "INEXISTENTE";
}
export interface MapaAdminSessao extends PublicMap { inventarioPorAssento: Record<string, string>; } // seat.id → inventorySeatId
```

Regras do schema: `sessionId` e `inventorySeatId` uuid; `chave` string de 8 a 100; `grupo` aparado, 2 a 200; `motivo` aparado, 3 a 500; `contatoEmail` e-mail válido, até 320; `contatoTelefone` até 30; campos opcionais vazios (`""`) viram `undefined`; `nome` aparado, até 200, e string vazia após aparar vira `undefined`; `assentos` de 1 a 50, com `superRefine` recusando `inventorySeatId` repetido (mensagem "Assento repetido no lote").

- [ ] **Step 1: Testes que falham** (`eventos-cortesias.test.ts`):

```ts
const base = { sessionId: UUID_A, chave: "chave-lote-1", grupo: "Professores", motivo: "Convidados da direção", assentos: [{ inventorySeatId: UUID_B }] };
it("aceita o lote mínimo", () => expect(emitirCortesiasSchema.parse(base).assentos).toHaveLength(1));
it("apara grupo e motivo", () => expect(emitirCortesiasSchema.parse({ ...base, grupo: "  Professores  " }).grupo).toBe("Professores"));
it("trata nome só com espaços como ausente", () => expect(emitirCortesiasSchema.parse({ ...base, assentos: [{ inventorySeatId: UUID_B, nome: "   " }] }).assentos[0].nome).toBeUndefined());
it("recusa lote vazio e lote com 51", () => { expect(emitirCortesiasSchema.safeParse({ ...base, assentos: [] }).success).toBe(false); expect(emitirCortesiasSchema.safeParse({ ...base, assentos: cinquentaEUm }).success).toBe(false); });
it("aceita lote com 50", () => expect(emitirCortesiasSchema.safeParse({ ...base, assentos: cinquenta }).success).toBe(true));
it("recusa assento repetido", () => expect(emitirCortesiasSchema.safeParse({ ...base, assentos: [{ inventorySeatId: UUID_B }, { inventorySeatId: UUID_B }] }).success).toBe(false));
it("recusa grupo com 1 caractere e motivo com 2", () => { /* safeParse false nos dois */ });
it("recusa e-mail inválido e aceita e-mail vazio como ausente", () => { /* "x" → false; "" → contatoEmail undefined */ });
it("cancelamento exige motivo de 3 a 500 após aparar", () => { expect(cancelarCortesiaSchema.safeParse({ motivo: "  a " }).success).toBe(false); expect(cancelarCortesiaSchema.parse({ motivo: " erro de digitação " }).motivo).toBe("erro de digitação"); });
```

- [ ] **Step 2:** `pnpm --filter @essencia/shared test -- eventos-cortesias` → FALHA.
- [ ] **Step 3:** Implementar schemas, tipos e exports em `schemas/index.ts`.
- [ ] **Step 4:** Mesmo comando → PASSA. `pnpm --filter @essencia/shared build`.
- [ ] **Step 5: Commit** — `feat(shared): schemas e tipos de cortesia`

---

### Task 3: API — tipo de ingresso interno fora da venda e da configuração

**Files:**
- Modify: `eventos.service.ts` (consultas de tipos nas linhas ~273, ~302, ~481, ~489, ~510), `eventos-public-sales.service.ts` (~68), `eventos-rules.service.ts` (~27), `eventos-readiness.service.ts` (~22) — todos em `services/api/src/modules/eventos/`
- Test: os `.spec.ts` correspondentes

**Interfaces — Produces:** toda consulta de tipos para venda ou configuração passa a exigir `eq(eventoTiposIngresso.internal, false)` junto de `active = true`.

- [ ] **Step 1: Testes que falham**, um por arquivo, usando o fake de banco já existente em cada spec com um tipo `{ id: "ticket-cortesia", name: "Cortesia", priceCents: 0, internal: true, active: true }` acrescentado ao estado:
  - `eventos.service.spec.ts`: `listarPublicados` e `getPublicBySlug` não devolvem "Cortesia"; `listarIngressos` não devolve "Cortesia"; `salvarIngressos` com payload sem o tipo interno o mantém `active: true`; `removerIngresso("ticket-cortesia")` responde não encontrado.
  - `eventos-public-sales.service.spec.ts`: `reservarAssentos` com `ticketTypeId: "ticket-cortesia"` é recusado com o mesmo código que hoje recusa tipo inexistente.
  - `eventos-readiness.service.spec.ts` e `eventos-rules.service.spec.ts`: evento cujo único tipo ativo é o interno continua com o item de ingressos como `BLOQUEADOR`.

  Se o fake de um spec não avaliar o predicado `internal`, estender o `matches` do fake para a coluna nova; não trocar o fake por mock genérico.
- [ ] **Step 2:** `pnpm --filter @essencia/api test -- modules/eventos` → os testes novos FALHAM.
- [ ] **Step 3:** Acrescentar o filtro nas consultas listadas.
- [ ] **Step 4:** Mesmo comando → tudo PASSA, incluindo os testes antigos.
- [ ] **Step 5: Commit** — `feat(eventos): isola tipo de ingresso interno da venda pública`

---

### Task 4: API — extrações (token, mapa, voucher)

Refatoração sem mudança de comportamento. A prova são os testes existentes mais três testes unitários novos.

**Files:**
- Create: `token-ingresso.ts`, `montar-mapa-sessao.ts`, `montar-pedido-ingressos.ts` e seus `.spec.ts`
- Modify: `eventos-pagamentos.service.ts` (remove `token()` privado), `eventos.service.ts` (`getPublicMap`), `eventos-public-sales.service.ts` (`obterIngressos`)

**Interfaces — Produces:**

```ts
// token-ingresso.ts
export function gerarTokenIngresso(orderNumber: string, itemId: string): { signedToken: string; qrPayload: string };
// lança InternalServerErrorException { code: "EVENTOS_QR_SECRET_MISSING" } sem EVENTOS_QR_SECRET

// montar-mapa-sessao.ts
export async function montarAssentosDaSessao(db: any, sessionId: string, mapId: string): Promise<Array<PublicSeat & { inventorySeatId: string; inventoryStatus: string }>>;

// montar-pedido-ingressos.ts
export async function montarIngressosDoPedido(db: any, orderId: string): Promise<IngressoPublico[]>;
```

`gerarTokenIngresso` mantém o formato atual: payload `${orderNumber}:${itemId}:${nonce}`, `signedToken = payload.assinatura`, `qrPayload = "evento:" + signedToken`. `getPublicMap` e `obterIngressos` passam a chamar as funções novas e continuam devolvendo exatamente o mesmo formato.

- [ ] **Step 1: Testes que falham**
  - `token-ingresso.spec.ts`: com segredo definido, `qrPayload === "evento:" + signedToken`, o token começa com `"PED1:item-1:"` e duas chamadas dão tokens diferentes; sem segredo, lança `EVENTOS_QR_SECRET_MISSING`.
  - `montar-mapa-sessao.spec.ts`: inventários `VENDIDO`, `RESERVADO`, `BLOQUEADO`, `DISPONIVEL` e `LIBERADO` viram `state` `sold`, `reserved`, `blocked`, `available`, `available`; cada item traz `inventorySeatId` e `inventoryStatus`; `metadata.rotacao` inválido vira `0`.
  - `montar-pedido-ingressos.spec.ts`: devolve `numero`, `qrPayload`, `rowLabel`, `seatNumber`, `ticketTypeName`, `participantName`, `status` de um ingresso do pedido.
- [ ] **Step 2:** `pnpm --filter @essencia/api test -- token-ingresso montar-` → FALHA (módulos não existem).
- [ ] **Step 3:** Criar os três arquivos movendo o código existente e trocar os chamadores.
- [ ] **Step 4:** `pnpm --filter @essencia/api test -- modules/eventos` → tudo PASSA.
- [ ] **Step 5: Commit** — `refactor(eventos): extrai token, mapa da sessão e ingressos do pedido`

---

### Task 5: API — emitir e listar cortesias

**Files:**
- Create: `services/api/src/modules/eventos/eventos-cortesias.service.ts`
- Test: `services/api/src/modules/eventos/eventos-cortesias.service.spec.ts`

**Interfaces:**
- Consumes: `gerarTokenIngresso` (Tarefa 4); `gerarNumeroIngresso` de `@essencia/shared/eventos/ingresso`; `assertSchoolScope` e `EventoActor` de `eventos.service.ts`; `EmitirCortesiasInput`, `CortesiaResumo`, `ConflitoAssentoCortesia` (Tarefa 2).
- Produces:

```ts
@Injectable()
export class EventosCortesiasService {
  constructor(databaseService: DatabaseService);
  emitir(eventId: string, input: EmitirCortesiasInput, actor: EventoActor): Promise<CortesiaResumo[]>;
  listar(eventId: string, actor: EventoActor): Promise<CortesiaResumo[]>;
}
```

Decisões que o teste e a assinatura não fixam:
- Ordem dentro da transação: idempotência → trava do inventário em ordem crescente de `id` com `.for("update")` → validação de todos os assentos (acumula **todos** os conflitos antes de lançar) → tipo "Cortesia" → gravação por assento → uma auditoria.
- Conflito: `ConflictException({ code: "ASSENTOS_INDISPONIVEIS", message: "Um ou mais assentos não estão mais livres.", details: { conflitos } })`.
- A atualização do inventário é condicional (`status IN ('DISPONIVEL','LIBERADO') AND reserved_by_order_id IS NULL`); zero linhas afetadas lança o mesmo 409.
- `orderNumber`: mesmo alfabeto e tamanho de `EventosPublicSalesService.orderNumber()` (12 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), sorteado com `crypto.randomInt`.
- Violação de único (`error.code === "23505"`) em `uq_evento_pedidos_order_number` ou `uq_evento_ingressos_numero`: repetir a emissão inteira, até 5 tentativas. Violação em `uq_evento_pedidos_idempotency_key`: outra requisição com a mesma chave venceu; reler e devolver o resultado dela.
- `situacao`: `CANCELADA` se o pedido está `CANCELADO`; `USADA` se o ingresso está `USADO`; senão `ATIVA`.
- `listar` parte de `evento_operacoes_administrativas` com `type = CORTESIA`, ordenado por `createdAt` decrescente; `emitidaPor` vem de `users.name` do `createdBy`.

- [ ] **Step 1: Testes que falham.** Criar no spec um `FakeCortesiasDb` no padrão do `FakeEventosDb` de `eventos-pagamentos.service.spec.ts` (estado em memória, `transaction` que restaura o estado em caso de erro, `select/insert/update` por tabela, registro de `lockSequence`). Estado inicial: evento `event-1` (`schoolId: "escola-1"`, `status: "RASCUNHO"`), sessão `session-1` (`mapId: "map-1"`), mapa `map-1` `CONFIRMADO`, inventários `inv-1..inv-3` `DISPONIVEL`. `beforeAll` define `EVENTOS_QR_SECRET`. Ator padrão: `{ id: "user-1", role: "gerente_unidade", schoolId: "escola-1" }`.

```ts
it("emite uma cortesia por assento, tudo de valor zero", async () => {
  const r = await service.emitir("event-1", lote(["inv-1", "inv-2"]), ator);
  expect(r).toHaveLength(2);
  expect(db.state.pedidos).toHaveLength(2);
  expect(db.state.pedidos.every((p) => p.status === "CONFIRMADO" && p.origin === "CORTESIA" && p.totalCents === 0 && p.subtotalCents === 0 && p.expiresAt === null)).toBe(true);
  expect(db.state.pedidos[0].idempotencyKey).toBe("cortesia:chave-1:inv-1");
  expect(db.state.itens.every((i) => i.unitPriceCents === 0 && i.totalPriceCents === 0)).toBe(true);
  expect(db.state.ingressos.map((i) => i.status)).toEqual(["EMITIDO", "EMITIDO"]);
  expect(db.state.operacoes.every((o) => o.type === "CORTESIA" && o.status === "ATIVA" && o.createdBy === "user-1" && o.reason === "Convidados da direção")).toBe(true);
  expect(db.inventario("inv-1").status).toBe("VENDIDO");
  expect(db.state.auditorias).toEqual([expect.objectContaining({ action: "CORTESIA_EMITIDA", resourceType: "cortesia", actorId: "user-1", metadata: expect.objectContaining({ grupo: "Professores", quantidade: 2 }) })]);
  expect(db.state.pagamentos ?? []).toHaveLength(0);
});
it("usa o nome do assento e, na falta, o nome do grupo", ...);          // participantes: ["Maria Souza", "Professores"]
it("cria o tipo Cortesia uma vez e reutiliza", ...);                     // 2 emissões → 1 tipo { name: "Cortesia", priceCents: 0, internal: true, active: true }
it("recusa o lote inteiro e lista todos os conflitos", ...);            // inv-2 VENDIDO, inv-3 RESERVADO → 409, details.conflitos com os dois motivos; nenhum pedido; inv-1 segue DISPONIVEL
it("recusa assento de outra sessão e assento inexistente", ...);        // motivos OUTRA_SESSAO e INEXISTENTE
it("trata assento LIBERADO como livre", ...);
it("recusa assento DISPONIVEL com reservedByOrderId preenchido", ...);  // motivo RESERVADO
it("trava o inventário em ordem crescente de id", ...);                 // lote ["inv-3","inv-1"] → lockSequence ["inv-1","inv-3"]
it("repetir a mesma chave não duplica", ...);                           // 2 chamadas → 1 pedido; mesmos orderNumbers
it("mesma chave com assentos diferentes devolve a emissão original", ...); // 2ª chamada com inv-2 → devolve inv-1; inv-2 segue DISPONIVEL
it("responde 409 quando o inventário muda entre a leitura e a gravação", ...); // fake faz o update condicional afetar 0 linhas → ASSENTOS_INDISPONIVEIS, não 500
it("sorteia de novo quando o número do pedido colide", ...);            // fake lança { code: "23505", constraint: "uq_evento_pedidos_order_number" } na 1ª inserção → emite na 2ª tentativa
it("emite com evento em rascunho e pausado; recusa cancelado", ...);    // EVENTO_CANCELADO
it("recusa sessão de outro evento e mapa não confirmado", ...);         // SESSION_NOT_FOUND, MAP_NOT_CONFIRMED
it("recusa evento de outra escola", ...);                               // ator schoolId "escola-2" → code FORBIDDEN
it("não grava nada quando falta EVENTOS_QR_SECRET", ...);               // EVENTOS_QR_SECRET_MISSING, 0 pedidos
it("lista da mais recente para a mais antiga com a situação", ...);     // ATIVA, USADA, CANCELADA
```

- [ ] **Step 2:** `pnpm --filter @essencia/api test -- eventos-cortesias.service` → FALHA (serviço não existe).
- [ ] **Step 3:** Implementar `emitir` e `listar`.
- [ ] **Step 4:** Mesmo comando → PASSA.
- [ ] **Step 5: Commit** — `feat(eventos): emissão e listagem de cortesias`

---

### Task 6: API — cancelar, voucher e mapa administrativo

**Files:**
- Modify: `eventos-cortesias.service.ts`, `eventos-cortesias.service.spec.ts`

**Interfaces:**
- Consumes: `montarAssentosDaSessao`, `montarIngressosDoPedido` (Tarefa 4).
- Produces:

```ts
cancelar(eventId: string, orderId: string, input: CancelarCortesiaInput, actor: EventoActor): Promise<CortesiaResumo>;
obterVoucher(eventId: string, orderId: string, actor: EventoActor): Promise<PedidoComIngressos>;
obterMapaAdmin(eventId: string, sessionId: string, actor: EventoActor): Promise<MapaAdminSessao>;
```

Decisões:
- `cancelar` trava o pedido (`for update`), depois o inventário, depois o ingresso — a mesma ordem pedido → inventário usada na confirmação de pagamento.
- O inventário só volta a `DISPONIVEL` se ainda estiver `VENDIDO`; se não estiver, o cancelamento segue e o inventário não é tocado.
- `obterVoucher` não depende de `pedidoResult` (que exige evento publicado): monta o `PedidoPublicoResult` com evento, sessão e local lidos diretamente, e `tickets` com `montarIngressosDoPedido`. Pedido cancelado responde `CORTESIA_NOT_FOUND`.
- `obterMapaAdmin` exige só mapa `CONFIRMADO` e escopo da escola; devolve `layout` igual ao da rota pública e `inventarioPorAssento` (`seat.id → inventorySeatId`).

- [ ] **Step 1: Testes que falham**

```ts
it("cancela: invalida o ingresso, cancela o pedido e libera o assento", async () => {
  const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
  const r = await service.cancelar("event-1", c.orderId, { motivo: "Convidado desistiu" }, ator);
  expect(r.situacao).toBe("CANCELADA");
  expect(db.state.ingressos[0]).toMatchObject({ status: "CANCELADO", revokedAt: expect.any(Date) });
  expect(db.state.pedidos[0]).toMatchObject({ status: "CANCELADO", cancellationReason: "Convidado desistiu", cancelledAt: expect.any(Date) });
  expect(db.state.operacoes[0]).toMatchObject({ status: "CANCELADA", cancelledAt: expect.any(Date) });
  expect(db.inventario("inv-1")).toMatchObject({ status: "DISPONIVEL", soldAt: null });
  expect(db.state.auditorias.at(-1)).toMatchObject({ action: "CORTESIA_CANCELADA", actorId: "user-1", reason: "Convidado desistiu" });
});
it("o assento cancelado pode receber nova cortesia", ...);
it("cancelar duas vezes não altera nada na segunda", ...);              // 1 auditoria de cancelamento
it("recusa cancelar ingresso já usado", ...);                           // CORTESIA_JA_UTILIZADA; inventário segue VENDIDO
it("responde não encontrado para pedido de venda e para pedido de outro evento", ...); // CORTESIA_NOT_FOUND
it("recusa cancelar cortesia de outra escola", ...);                    // FORBIDDEN
it("voucher devolve PedidoComIngressos com evento em rascunho", ...);   // tickets[0].ticketTypeName === "Cortesia", participantName, qrPayload; event.title
it("voucher de cortesia cancelada responde não encontrado", ...);
it("mapa admin funciona com evento em rascunho e marca a cortesia como vendida", ...); // seat de inv-1 com state "sold"; inventarioPorAssento preenchido
it("mapa admin recusa mapa não confirmado e sessão de outro evento", ...);
```

- [ ] **Step 2:** `pnpm --filter @essencia/api test -- eventos-cortesias.service` → os novos FALHAM.
- [ ] **Step 3:** Implementar os três métodos.
- [ ] **Step 4:** Mesmo comando → PASSA.
- [ ] **Step 5: Commit** — `feat(eventos): cancelamento, voucher e mapa administrativo de cortesias`

---

### Task 7: API — controller e módulo

**Files:**
- Create: `eventos-cortesias.controller.ts`, `eventos-cortesias.controller.spec.ts`
- Modify: `eventos.module.ts`, `docs/API.md`

**Interfaces — Produces** (prefixo `eventos/admin/:id`):

| Método e rota | Chama |
|---|---|
| `GET cortesias` | `listar(id, actor)` |
| `GET sessoes/:sessionId/mapa-admin` | `obterMapaAdmin(id, sessionId, actor)` |
| `POST cortesias` | `emitir(id, emitirCortesiasSchema.parse(body), actor)` |
| `GET cortesias/:orderId/voucher` | `obterVoucher(id, orderId, actor)` |
| `POST cortesias/:orderId/cancelar` | `cancelar(id, orderId, cancelarCortesiaSchema.parse(body), actor)` |

Falha do Zod vira `BadRequestException`, com o mesmo tratamento que `MapasController` já dá a `operacoesPropostaSchema` (ler o arquivo e copiar o formato do corpo do erro).

- [ ] **Step 1: Testes que falham** (padrão de `eventos.controller.spec.ts`, lendo metadados com `Reflect.getMetadata`):
  - a classe tem os guards `AuthGuard, RolesGuard` nessa ordem e os papéis de `EVENTOS_ADMIN_ROLES`;
  - cada rota repassa `id`, parâmetros e o ator ao serviço;
  - `POST cortesias` com `assentos: []` lança `BadRequestException` e não chama o serviço;
  - `POST cortesias/:orderId/cancelar` com `motivo: ""` lança `BadRequestException`.
- [ ] **Step 2:** `pnpm --filter @essencia/api test -- eventos-cortesias.controller` → FALHA.
- [ ] **Step 3:** Implementar o controller; registrar controller e serviço em `eventos.module.ts`; documentar as cinco rotas em `docs/API.md`, na seção de eventos.
- [ ] **Step 4:** `pnpm --filter @essencia/api test -- modules/eventos` → PASSA. Lint + typecheck.
- [ ] **Step 5: Commit** — `feat(eventos): rotas administrativas de cortesias`

---

### Task 8: PDF e adaptador de mapa compartilhados

Movimentação sem mudança de comportamento no site público.

**Files:**
- Create: `packages/shared/src/eventos/datas.ts` (+ teste), `packages/components/src/eventos/pdf-ingresso.ts`, `packages/components/src/eventos/adaptar-mapa.ts` (+ testes movidos)
- Modify: `packages/shared/package.json` (export `./eventos/datas`, no mesmo formato de `./eventos/ingresso`), `packages/components/package.json` (exports `./eventos/pdf-ingresso` e `./eventos/adaptar-mapa`; dependências `jspdf ^3.0.1`, `qrcode ^1.5.4`, dev `@types/qrcode ^1.5.5`), `apps/eventos/lib/eventos-formatters.ts`, `apps/eventos/lib/pdf-ingresso.ts`, `apps/eventos/components/mapa/adaptar-mapa.ts`, `apps/eventos/components/ingressos/acoes-ingresso.tsx`
- Delete: os testes antigos de `apps/eventos` que foram movidos

**Interfaces — Produces:**

```ts
// @essencia/shared/eventos/datas
export function formatarDataHoraExtenso(inicio: Date | string, fim?: Date | string | null): string;

// @essencia/components/eventos/pdf-ingresso
export type CarregarArte = (imageUrl: string) => Promise<string | null>;
export function gerarPdfIngressos(pedido: PedidoComIngressos, ingressos: IngressoPublico[], opcoes: { carregarArte: CarregarArte }): Promise<Blob>;
export function nomeArquivoIngresso(pedido: PedidoComIngressos, ingresso?: IngressoPublico): string;
export function compartilharOuBaixar(arquivo: File, navegador?: Pick<Navigator, "canShare" | "share">): Promise<"compartilhado" | "baixado">;

// @essencia/components/eventos/adaptar-mapa — mesmas exportações de hoje:
// LugarPublico, paraLugaresPublicos, rotulosDoMapa, dimensoesDoMapa, elementosDoMapa
```

`carregarArte` passa a ser obrigatório. Em `apps/eventos/lib/pdf-ingresso.ts` fica só `carregarArtePublica` (o `carregarArtePadrao` atual, com `/_next/image`) e reexportações do pacote; `apps/eventos/components/mapa/adaptar-mapa.ts` e `formatarDataHoraExtenso` em `eventos-formatters.ts` viram reexportações. Assim nenhum outro import do site público muda.

- [ ] **Step 1:** Mover os testes existentes (`apps/eventos/lib/__tests__/pdf-ingresso.test.ts` e o teste de `adaptar-mapa`, se houver) para `packages/components/src/eventos/`, ajustando imports e passando `carregarArte` explicitamente. Criar `packages/shared/src/eventos/datas.test.ts`:

```ts
it("formata no fuso de São Paulo", () => expect(formatarDataHoraExtenso("2026-12-12T22:00:00Z", "2026-12-13T00:30:00Z")).toBe("Sábado, 12 de dezembro de 2026 · 19h às 21h30"));
it("devolve aviso para data inválida", () => expect(formatarDataHoraExtenso("x")).toBe("Data a confirmar"));
```

- [ ] **Step 2:** `pnpm --filter @essencia/components test -- eventos` e `pnpm --filter @essencia/shared test -- datas` → FALHAM (módulos não existem).
- [ ] **Step 3:** Mover o código, ajustar `package.json` dos dois pacotes, rodar `pnpm install`, trocar os arquivos do site público por reexportações e atualizar `acoes-ingresso.tsx` para passar `carregarArte: carregarArtePublica`.
- [ ] **Step 4:** `pnpm --filter @essencia/components test`, `pnpm --filter @essencia/shared test`, `pnpm --filter @essencia/eventos test` → tudo PASSA. `pnpm --filter @essencia/shared build`. Lint + typecheck.
- [ ] **Step 5: Commit** — `refactor(eventos): compartilha gerador de PDF e adaptador de mapa`

---

### Task 9: Painel — cliente da API e estado da emissão

**Files:**
- Create: `apps/eventos-admin/features/eventos/cortesias/api-cortesias.ts`, `use-emissao-cortesias.ts` e os dois `.test.ts`

**Interfaces:**
- Consumes: `respostaApi` e `ErroApiMapa` de `../conferencia/api-mapas`; tipos da Tarefa 2.
- Produces:

```ts
// api-cortesias.ts — base: `/eventos-admin/api/eventos/admin/${eventId}`, credentials "include"
export function listarCortesias(eventId: string): Promise<CortesiaResumo[]>;
export function obterMapaAdmin(eventId: string, sessionId: string): Promise<MapaAdminSessao>;
export function emitirCortesias(eventId: string, input: EmitirCortesiasInput): Promise<CortesiaResumo[]>;
export function obterVoucher(eventId: string, orderId: string): Promise<PedidoComIngressos>;
export function cancelarCortesia(eventId: string, orderId: string, motivo: string): Promise<CortesiaResumo>;
export function conflitosDoErro(erro: unknown): ConflitoAssentoCortesia[]; // [] se não for ASSENTOS_INDISPONIVEIS

// use-emissao-cortesias.ts
export const LIMITE_LOTE = 50;
export interface EstadoEmissao {
  selecionados: string[];                 // seat.id, na ordem do clique
  nomes: Record<string, string>;
  grupo: string; motivo: string; contatoEmail: string; contatoTelefone: string;
  conflitos: Set<string>;                 // seat.id
  enviando: boolean; erro: string | null; limiteAtingido: boolean;
  podeEmitir: boolean;                    // ≥1 assento, grupo ≥2 e motivo ≥3 após aparar, não enviando
}
export function useEmissaoCortesias(args: { eventId: string; sessionId: string | null; mapa: MapaAdminSessao | null; aoEmitir: (emitidas: CortesiaResumo[]) => void; gerarChave?: () => string }): EstadoEmissao & {
  alternar(seatId: string): void; remover(seatId: string): void; definirNome(seatId: string, nome: string): void;
  definirCampo(campo: "grupo" | "motivo" | "contatoEmail" | "contatoTelefone", valor: string): void;
  emitir(): Promise<void>;
};
```

Decisões: `gerarChave` padrão é `crypto.randomUUID()`; a chave nasce na primeira seleção e é renovada só depois de sucesso (falha mantém a chave, para o reenvio ser idempotente). `emitir` converte `seat.id` em `inventorySeatId` por `mapa.inventarioPorAssento`. Trocar de sessão limpa seleção, nomes e conflitos, mas mantém grupo, motivo e contato.

- [ ] **Step 1: Testes que falham**
  - `api-cortesias.test.ts` (mock de `fetch`): cada função usa a URL e o método corretos, com `credentials: "include"`; `emitirCortesias` envia JSON; `conflitosDoErro` extrai `details.conflitos` de um erro `ASSENTOS_INDISPONIVEIS` e devolve `[]` para outros erros.
  - `use-emissao-cortesias.test.ts` (`// @vitest-environment jsdom`, `renderHook`):

```ts
it("alterna a seleção e remove o nome junto com o assento", ...);
it("ignora o 51º assento e sinaliza o limite", ...);                     // 50 alternar → 51º não entra; limiteAtingido true
it("só permite emitir com assento, grupo e motivo válidos", ...);       // grupo " A " → false; "Pais" + motivo "abc" → true
it("envia inventorySeatId e omite nome vazio", ...);                     // payload: { inventorySeatId: "inv-1", nome: "Maria" }, { inventorySeatId: "inv-2" }
it("no sucesso limpa a seleção, renova a chave e avisa", ...);          // gerarChave chamado 2x; aoEmitir chamado com a lista
it("no conflito mantém seleção e chave e marca os assentos", ...);      // conflitos contém o seat.id correspondente; erro cita "Fileira B · Assento 4"
it("trocar de sessão limpa a seleção e mantém o grupo", ...);
```

- [ ] **Step 2:** `pnpm --filter @essencia/eventos-admin test -- cortesias` → FALHA.
- [ ] **Step 3:** Implementar os dois arquivos.
- [ ] **Step 4:** Mesmo comando → PASSA.
- [ ] **Step 5: Commit** — `feat(eventos-admin): cliente e estado da emissão de cortesias`

---

### Task 10: Painel — tela de emissão

**Files:**
- Create: `apps/eventos-admin/features/eventos/cortesias/emitir-cortesias.tsx`, `painel-lote.tsx` e os dois `.test.tsx`

**Interfaces:**
- Consumes: `useEmissaoCortesias`, `obterMapaAdmin` (Tarefa 9); `MapaEstiloB` de `@essencia/components/eventos/mapa-estilo-b`; `paraLugaresPublicos`, `rotulosDoMapa`, `dimensoesDoMapa`, `elementosDoMapa` de `@essencia/components/eventos/adaptar-mapa` (Tarefa 8).
- Produces:

```ts
export interface SessaoCortesia { id: string; startsAt: string; apta: boolean } // apta = tem mapa confirmado
export function EmitirCortesias(props: { eventId: string; sessoes: SessaoCortesia[]; aoEmitir: (emitidas: CortesiaResumo[]) => void }): React.JSX.Element;
export function PainelLote(props: { assentos: Array<{ seatId: string; rotulo: string; nome: string; conflito: boolean }>; estado: EstadoEmissao; aoRemover(seatId: string): void; aoDefinirNome(seatId: string, nome: string): void; aoDefinirCampo(campo: "grupo" | "motivo" | "contatoEmail" | "contatoTelefone", valor: string): void; aoEmitir(): void }): React.JSX.Element;
```

Textos fixos:
- Sessão não apta, no seletor: "Confirme o mapa desta sessão para emitir cortesias".
- Sem sessão apta: "Este evento ainda não tem sessão com mapa confirmado."
- Limite: "Limite de 50 assentos por emissão."
- Rótulo do assento: `Fileira ${rowLabel} · Assento ${seatNumber}`.
- Botão: `Emitir ${n} cortesia` / `Emitir ${n} cortesias`; sem seleção, "Emitir cortesias".
- Confirmação: título "Emitir cortesias?", corpo `${n} assento(s) para ${grupo}. Os lugares ficam indisponíveis para venda.`, botões "Emitir" e "Voltar".
- Sucesso: `${n} cortesia(s) emitida(s).`
- Conflito: `Estes lugares não estão mais livres: ${lista}. Troque-os e tente de novo.`

Decisões: assentos com `state !== "available"` entram no conjunto `indisponiveis` (cinza, não clicáveis); os de `conflitos` vão em `destacados`. Depois de sucesso ou de conflito, o mapa é recarregado. O layout é mapa à esquerda e painel à direita a partir de `lg`, empilhado abaixo disso. A sessão inicial é a primeira apta.

- [ ] **Step 1: Testes que falham** (`// @vitest-environment jsdom`, API mockada com `vi.mock("./api-cortesias")`):
  - `painel-lote.test.tsx`: lista os rótulos; botão desabilitado sem grupo ou motivo; texto do botão no singular e no plural; digitar no campo de nome chama `aoDefinirNome`; assento em conflito tem `aria-invalid="true"`; aviso de limite aparece com `limiteAtingido`.
  - `emitir-cortesias.test.tsx`: com `sessoes: []` ou nenhuma apta mostra "Este evento ainda não tem sessão com mapa confirmado." e não renderiza botão de emitir; sessão não apta aparece desabilitada no seletor; carrega o mapa da primeira sessão apta; emitir abre a confirmação e só chama a API depois de "Emitir"; em sucesso mostra a mensagem e chama `aoEmitir`; em conflito mostra a mensagem com os rótulos e recarrega o mapa (`obterMapaAdmin` chamado 2 vezes).
- [ ] **Step 2:** `pnpm --filter @essencia/eventos-admin test -- cortesias` → os novos FALHAM.
- [ ] **Step 3:** Implementar os dois componentes.
- [ ] **Step 4:** Mesmo comando → PASSA.
- [ ] **Step 5: Commit** — `feat(eventos-admin): tela de emissão de cortesias`

---

### Task 11: Painel — lista, cancelamento, PDF, aba e limpeza do Inventário

**Files:**
- Create: `apps/eventos-admin/features/eventos/cortesias/lista-cortesias.tsx`, `dialogo-cancelar.tsx`, `baixar-voucher.ts`, seus testes, e `apps/eventos-admin/app/eventos/[id]/cortesias/page.tsx` (+ `page.test.ts`)
- Modify: `apps/eventos-admin/features/eventos/workspace-shell.tsx` (+ teste), `apps/eventos-admin/features/eventos/inventory-grid.tsx` (+ teste existente, se cobrir os botões)

**Interfaces:**
- Consumes: Tarefas 8, 9 e 10.
- Produces:

```ts
export function ListaCortesias(props: { cortesias: CortesiaResumo[]; sessoes: SessaoCortesia[]; aoBaixar(c: CortesiaResumo): Promise<void>; aoCancelar(c: CortesiaResumo, motivo: string): Promise<void> }): React.JSX.Element;
export function DialogoCancelar(props: { cortesia: CortesiaResumo | null; aoConfirmar(motivo: string): Promise<void>; aoFechar(): void }): React.JSX.Element | null;
export async function baixarVoucher(eventId: string, cortesia: CortesiaResumo): Promise<void>;
export function carregarArteAdmin(imageUrl: string): Promise<string | null>; // usa `/eventos-admin/_next/image?url=…&w=640&q=75`
```

Decisões:
- `baixarVoucher`: `obterVoucher` → `gerarPdfIngressos(pedido, pedido.tickets, { carregarArte: carregarArteAdmin })` → `new File([blob], nomeArquivoIngresso(pedido, pedido.tickets[0]))` → baixa por link temporário (`<a download>`). Não usa `navigator.share`: no painel o objetivo é salvar o arquivo.
- `carregarArteAdmin`: antes de implementar, conferir em `apps/eventos-admin/next.config.*` se o otimizador de imagens aceita a origem das artes de evento (comparar com `apps/eventos/next.config.*`). Se não aceitar, copiar a configuração de `images` do site público. Falha ao carregar a arte devolve `null` e o PDF sai sem ela.
- Busca: compara sem diferenciar maiúsculas nem acentos, em `grupo` e `participantName`.
- Situações exibidas: "Ativa", "Usada", "Cancelada". "Baixar PDF" desabilitado em cancelada; "Cancelar" desabilitado em usada e cancelada.
- Diálogo: título "Cancelar cortesia?", corpo `${rótulo do assento} · ${participantName}. O ingresso deixa de valer e o lugar volta a ficar livre.`, campo "Motivo" obrigatório (mínimo 3 após aparar), botões "Cancelar cortesia" e "Voltar". Erro `CORTESIA_JA_UTILIZADA` mostra "Este ingresso já foi usado na entrada e não pode ser cancelado."
- Lista vazia: "Nenhuma cortesia emitida neste evento". Filtro sem resultado: "Nenhuma cortesia encontrada."
- `page.tsx` é client component: carrega sessões por `GET /eventos-admin/api/eventos/admin/${id}/sessoes` (`apta = Boolean(session.mapId)`; a rota do mapa confirma o status ao carregar) e cortesias por `listarCortesias`; renderiza `EmitirCortesias` e `ListaCortesias`; recarrega a lista depois de emitir e de cancelar.
- Navegação: em `workspace-shell.tsx`, inserir `{ key: "cortesias", label: "Cortesias", href: `/eventos/${eventId}/cortesias`, state: "NAO_INICIADO" }` logo depois do item `inventario`. O item não entra no cálculo de bloqueadores nem de progresso. Como o rótulo de estado "Não iniciado" seria enganoso, `WorkspaceNavigationItem` ganha `semEstado?: boolean` e a navegação não exibe o rótulo quando ele é `true`.
- `InventoryGrid`: remover a prop `onAction`, o campo "Motivo obrigatório" e os três botões. O componente fica só de leitura.

- [ ] **Step 1: Testes que falham**
  - `lista-cortesias.test.tsx`: mostra as colunas; filtro por sessão; busca "jose" encontra "José"; ações desabilitadas conforme a situação; mensagens de vazio.
  - `dialogo-cancelar.test.tsx`: não confirma com motivo de 2 caracteres; confirma com motivo aparado; mostra a mensagem de ingresso usado quando `aoConfirmar` rejeita com esse código.
  - `baixar-voucher.test.ts`: chama `obterVoucher`, gera o PDF com `carregarArteAdmin` e dispara o download com o nome `ingresso-<orderNumber>-<numero formatado>.pdf`.
  - `workspace-shell.test.tsx`: a navegação contém "Cortesias" logo depois de "Inventário", sem rótulo de estado, e o progresso não muda.
  - `page.test.ts`: no padrão dos testes de página vizinhos (`ingressos/page.test.ts`).
  - Teste do `InventoryGrid`: não há botões "bloquear", "cortesia" nem "reservar".
- [ ] **Step 2:** `pnpm --filter @essencia/eventos-admin test` → os novos FALHAM.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mesmo comando → PASSA.
- [ ] **Step 5: Commit** — `feat(eventos-admin): aba de cortesias com lista, PDF e cancelamento`

---

### Task 12: Verificação final

- [ ] **Step 1:** `pnpm turbo lint && pnpm turbo typecheck` → sem erros.
- [ ] **Step 2:** `pnpm --filter @essencia/api test -- modules/eventos`, `pnpm --filter @essencia/eventos-admin test`, `pnpm --filter @essencia/eventos test`, `pnpm --filter @essencia/components test`, `pnpm --filter @essencia/shared test`, `pnpm --filter @essencia/db test` → tudo PASSA.
- [ ] **Step 3: Teste manual em desenvolvimento** (`pnpm db:migrate`, `pnpm turbo dev --filter=eventos-admin --filter=eventos --filter=api`), com um evento em rascunho que tenha mapa confirmado:
  1. Emitir 3 cortesias, uma com nome e duas sem. Conferir a lista.
  2. Baixar o PDF de uma e conferir evento, data, fileira, assento, "Ingresso Cortesia", nome e QR code.
  3. Publicar o evento e conferir, no site público, que os 3 assentos aparecem ocupados e que "Cortesia" não aparece entre os tipos de ingresso.
  4. Cancelar uma cortesia e conferir que o assento volta a ficar livre no site.
  5. Tentar trocar o mapa do evento e conferir que a trava cita operação administrativa ativa.
- [ ] **Step 4:** Atualizar o campo **Status** da spec para "implementado" e commitar — `docs: marca spec de cortesias como implementada`.
- [ ] **Step 5:** Avisar o Renato de que o deploy exige `./scripts/deploy.sh --migrar`. **Não fazer deploy sem pedido explícito.**
