# Reserva de Pre-venda na Loja Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar reservas de pre-venda na loja publica, API e loja-admin, com vouchers separados e sem movimentar estoque fisico.

**Architecture:** A API centraliza a classificacao por variante usando `availableStock > 0` como `PRONTA_ENTREGA` e `availableStock = 0` como `PRE_VENDA`. Pedidos de pre-venda usam `orderSource = PRE_VENDA` e `status = AGUARDANDO_PAGAMENTO`, mantendo o fluxo de pagamento/retirada existente, mas pulando reserva, baixa e devolucao de estoque. A loja publica separa carrinho e finalizacao por `modoVenda`; a loja-admin filtra, rotula e resume pedidos de pre-venda.

**Tech Stack:** Turborepo, pnpm, Next.js App Router, NestJS, Fastify, Drizzle, PostgreSQL, Redis locks, Jest/Vitest, Tailwind, shadcn/ui.

---

## Contexto Obrigatorio

Leia antes de executar:

- `docs/plans/2026-05-19-reserva-pre-venda-loja-design.md`
- `docs/LOJA_INVARIANTES_TESTES.md`
- `services/api/src/modules/shop/shop-products.service.ts`
- `services/api/src/modules/shop/shop-orders.service.ts`
- `apps/loja/lib/useCart.ts`
- `apps/loja/app/checkout/page.tsx`
- `apps/loja-admin/app/pedidos/page.tsx`
- `apps/loja-admin/app/relatorios/page.tsx`

Classes da matriz impactadas:

- `LOJA-03`: catalogo publico e disponibilidade por variante.
- `LOJA-05`: estoque e concorrencia; pre-venda nao altera estoque.
- `LOJA-06`: pedido, pagamento, cancelamento e retirada.
- `LOJA-08`: contrato API/UI para `modoVenda`, `orderSource` e multiplos vouchers.
- `LOJA-09`: quantidade e preco recalculados no backend.

Regra de seguranca do workspace:

- Antes de editar, rode `git status --short`.
- Existem alteracoes locais em andamento neste repositorio. Nao reverta arquivos nao relacionados.
- Se executar em novo worktree, crie a partir do commit atual e aplique somente os patches necessarios.
- Se executar neste workspace, use commits pequenos e revise `git diff` antes de cada commit.

Use tambem:

- @superpowers:test-driven-development para cada mudanca de comportamento.
- @superpowers:verification-before-completion antes de declarar pronto.

## Task 0: Preparar Execucao

**Files:**
- Read: `docs/plans/2026-05-19-reserva-pre-venda-loja-design.md`
- Read: `docs/LOJA_INVARIANTES_TESTES.md`

**Step 1: Conferir estado local**

Run:

```bash
git status --short
```

Expected: lista de alteracoes locais conhecida. Se houver arquivos de loja/API ja alterados, trate como trabalho existente e nao reverta.

**Step 2: Conferir se esta em worktree isolado**

Run:

```bash
git branch --show-current
pwd
```

Expected: branch de trabalho da feature, preferencialmente com prefixo `codex/`.

**Step 3: Criar branch se necessario**

Run apenas se ainda estiver em branch compartilhada:

```bash
git switch -c codex/reserva-pre-venda-loja
```

Expected: nova branch criada.

**Step 4: Rodar baseline focado**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand
pnpm --filter @essencia/loja test -- loja use-cart carrinho-page checkout-page
pnpm --filter @essencia/loja-admin test -- pedidos-source
```

Expected: pode falhar se a implementacao parcial ainda estiver incompleta. Registre as falhas antes de editar.

**Step 5: Commit**

Nao commitar nesta task.

## Task 1: Contrato de Dados e DTOs

**Files:**
- Modify: `packages/db/src/schema/shop.ts`
- Modify: `services/api/src/modules/shop/dto/product.dto.ts`
- Modify: `services/api/src/modules/shop/dto/order.dto.ts`
- Test: `services/api/src/modules/shop/shop-regressions.spec.ts`
- Create: `packages/db/drizzle/0032_shop_pre_venda_order_source.sql`

**Step 1: Write the failing test**

Adicione ou ajuste testes em `services/api/src/modules/shop/shop-regressions.spec.ts`:

```ts
import { validate } from "class-validator";
import { CatalogFiltersDto } from "./dto/product.dto";
import { ListOrdersDto } from "./dto/order.dto";

it("valida modoVenda do catalogo publico", async () => {
  const dto = Object.assign(new CatalogFiltersDto(), {
    modoVenda: "PRE_VENDA",
  });

  await expect(validate(dto)).resolves.toHaveLength(0);

  const invalidDto = Object.assign(new CatalogFiltersDto(), {
    modoVenda: "RESERVADO_PRE_VENDA",
  });

  await expect(validate(invalidDto)).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ property: "modoVenda" }),
    ]),
  );
});

it("valida orderSource administrativo como enum conhecido", async () => {
  const dto = Object.assign(new ListOrdersDto(), {
    orderSource: "PRE_VENDA",
  });

  await expect(validate(dto)).resolves.toHaveLength(0);

  const invalidDto = Object.assign(new ListOrdersDto(), {
    orderSource: "RESERVADO_PRE_VENDA",
  });

  await expect(validate(invalidDto)).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ property: "orderSource" }),
    ]),
  );
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "valida"
```

Expected: FAIL porque `ListOrdersDto.orderSource` ainda aceita qualquer `string` ou porque `PRE_VENDA` ainda nao existe no enum/schema.

**Step 3: Write minimal implementation**

Garanta em `packages/db/src/schema/shop.ts`:

```ts
export const orderSourceEnum = ["ONLINE", "PRESENCIAL", "PRE_VENDA"] as const;
export type OrderSource = (typeof orderSourceEnum)[number];
```

Garanta em `services/api/src/modules/shop/dto/product.dto.ts`:

```ts
export class CatalogFiltersDto {
  @IsOptional()
  @IsEnum(["PRONTA_ENTREGA", "PRE_VENDA"])
  modoVenda?: "PRONTA_ENTREGA" | "PRE_VENDA";
}
```

Altere `services/api/src/modules/shop/dto/order.dto.ts`:

```ts
export class ListOrdersDto {
  @IsOptional()
  @IsEnum(["ONLINE", "PRESENCIAL", "PRE_VENDA"])
  orderSource?: "ONLINE" | "PRESENCIAL" | "PRE_VENDA";
}
```

Crie migration idempotente em `packages/db/drizzle/0032_shop_pre_venda_order_source.sql`:

```sql
ALTER TABLE "shop_orders"
DROP CONSTRAINT IF EXISTS "shop_orders_order_source_check";

ALTER TABLE "shop_orders"
ADD CONSTRAINT "shop_orders_order_source_check"
CHECK ("order_source" IN ('ONLINE', 'PRESENCIAL', 'PRE_VENDA'));
```

Se o banco atual nao usa check constraint nomeada por Drizzle, ajuste a migration apos inspecionar migrations anteriores de `shop_orders`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "valida"
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db/src/schema/shop.ts packages/db/drizzle/0032_shop_pre_venda_order_source.sql services/api/src/modules/shop/dto/product.dto.ts services/api/src/modules/shop/dto/order.dto.ts services/api/src/modules/shop/shop-regressions.spec.ts
git commit -m "feat(loja): definir contrato de pre-venda"
```

## Task 2: Catalogo Publico com `modoVenda`

**Files:**
- Modify: `services/api/src/modules/shop/shop-products.service.ts`
- Test: `services/api/src/modules/shop/shop-regressions.spec.ts`
- Test: `services/api/src/modules/shop/shop-products.service.spec.ts`

**Step 1: Write the failing test**

Adicione regressao em `services/api/src/modules/shop/shop-regressions.spec.ts` para `LOJA-03`:

```ts
it("classifica variantes por modo de venda e filtra catalogo publico", async () => {
  const service = new ShopProductsService();

  mockDb.query.shopProducts.findMany.mockResolvedValue([
    {
      id: "produto-1",
      schoolId: "school-1",
      name: "Casaco Moletom",
      description: null,
      category: "UNIFORME_UNISSEX",
      basePrice: 12000,
      imageUrl: null,
      isActive: true,
      images: [],
      variants: [
        {
          id: "variant-pronta",
          size: "2",
          sku: null,
          priceOverride: null,
          isActive: true,
          inventory: [{ unitId: "unit-1", quantity: 3, reservedQuantity: 0 }],
        },
        {
          id: "variant-pre-venda",
          size: "4",
          sku: null,
          priceOverride: null,
          isActive: true,
          inventory: [{ unitId: "unit-1", quantity: 0, reservedQuantity: 0 }],
        },
      ],
    },
  ]);

  const pronta = await service.getProducts("school-1", "unit-1", {
    modoVenda: "PRONTA_ENTREGA",
  } as never);
  const preVenda = await service.getProducts("school-1", "unit-1", {
    modoVenda: "PRE_VENDA",
  } as never);

  expect(pronta[0].variants).toEqual([
    expect.objectContaining({
      id: "variant-pronta",
      availableStock: 3,
      modoVenda: "PRONTA_ENTREGA",
    }),
  ]);
  expect(preVenda[0].variants).toEqual([
    expect.objectContaining({
      id: "variant-pre-venda",
      availableStock: 0,
      modoVenda: "PRE_VENDA",
    }),
  ]);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "classifica variantes"
```

Expected: FAIL se o catalogo ainda remove variantes sem estoque ou nao retorna `modoVenda`.

**Step 3: Write minimal implementation**

Em `services/api/src/modules/shop/shop-products.service.ts`, use helper unico:

```ts
type ModoVenda = "PRONTA_ENTREGA" | "PRE_VENDA";

private getModoVenda(available: number): ModoVenda {
  return available > 0 ? "PRONTA_ENTREGA" : "PRE_VENDA";
}
```

No `getProducts`, mantenha produtos ativos, variantes ativas e aplique filtro por `modoVenda` na variante, nao no produto:

```ts
const variants = product.variants
  .filter((variant) => {
    const inv = variant.inventory?.[0];
    const available = inv ? inv.quantity - inv.reservedQuantity : 0;
    const modoVenda = this.getModoVenda(available);

    if (filters.size && variant.size !== filters.size) return false;
    if (filters.inStock && available <= 0) return false;
    if (filters.modoVenda && filters.modoVenda !== modoVenda) return false;

    return true;
  })
  .map((variant) => {
    const inv = variant.inventory?.[0];
    const available = inv ? inv.quantity - inv.reservedQuantity : 0;
    const modoVenda = this.getModoVenda(available);

    return {
      id: variant.id,
      size: variant.size,
      sku: variant.sku,
      price: variant.priceOverride || product.basePrice,
      availableStock: Math.max(0, available),
      isAvailable: available > 0,
      modoVenda,
    };
  });
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "classifica variantes"
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/shop/shop-products.service.ts services/api/src/modules/shop/shop-regressions.spec.ts services/api/src/modules/shop/shop-products.service.spec.ts
git commit -m "feat(loja): classificar catalogo por modo de venda"
```

## Task 3: Detalhe Publico do Produto

**Files:**
- Modify: `services/api/src/modules/shop/shop-products.service.ts`
- Test: `services/api/src/modules/shop/shop-regressions.spec.ts`
- Test: `apps/loja/components/__tests__/ProductDetailCarousel.test.tsx`
- Test: `apps/loja/__tests__/loja.test.ts`

**Step 1: Write the failing test**

Adicione teste de contrato em `services/api/src/modules/shop/shop-regressions.spec.ts`:

```ts
it("detalhe publico retorna todas as variantes ativas com modoVenda sem campos internos", async () => {
  const service = new ShopProductsService();

  mockDb.query.shopProducts.findFirst.mockResolvedValue({
    id: "produto-1",
    schoolId: "school-1",
    name: "Casaco Moletom",
    description: null,
    category: "UNIFORME_UNISSEX",
    basePrice: 12000,
    imageUrl: null,
    isActive: true,
    images: [],
    variants: [
      {
        id: "variant-pronta",
        size: "2",
        sku: null,
        priceOverride: null,
        isActive: true,
        inventory: [{ unitId: "unit-1", quantity: 3, reservedQuantity: 0 }],
      },
      {
        id: "variant-pre-venda",
        size: "4",
        sku: null,
        priceOverride: null,
        isActive: true,
        inventory: [{ unitId: "unit-1", quantity: 0, reservedQuantity: 0 }],
      },
    ],
  });

  const result = await service.getPublicProductById(
    "produto-1",
    "school-1",
    "unit-1",
  );

  expect(result.variants).toEqual([
    expect.objectContaining({ id: "variant-pronta", modoVenda: "PRONTA_ENTREGA" }),
    expect.objectContaining({ id: "variant-pre-venda", modoVenda: "PRE_VENDA" }),
  ]);
  expect(JSON.stringify(result)).not.toContain("reservedQuantity");
  expect(JSON.stringify(result)).not.toContain("\"quantity\"");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "detalhe publico"
```

Expected: FAIL se detalhe publico nao retorna `modoVenda` ou vaza estoque interno.

**Step 3: Write minimal implementation**

No `getPublicProductById`, retorne somente dados publicos:

```ts
const variants = product.variants
  .filter((variant) => variant.isActive)
  .map((variant) => {
    const inv = variant.inventory?.[0];
    const available = inv ? inv.quantity - inv.reservedQuantity : 0;

    return {
      id: variant.id,
      size: variant.size,
      sku: variant.sku,
      priceOverride: variant.priceOverride,
      price: variant.priceOverride || product.basePrice,
      availableStock: Math.max(0, available),
      isAvailable: available > 0,
      modoVenda: this.getModoVenda(available),
    };
  });
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "detalhe publico"
pnpm --filter @essencia/loja test -- loja ProductDetailCarousel
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/shop/shop-products.service.ts services/api/src/modules/shop/shop-regressions.spec.ts apps/loja/__tests__/loja.test.ts apps/loja/components/__tests__/ProductDetailCarousel.test.tsx
git commit -m "feat(loja): expor modo de venda no detalhe publico"
```

## Task 4: Criacao de Voucher de Pre-venda na API

**Files:**
- Modify: `services/api/src/modules/shop/shop-orders.service.ts`
- Modify: `services/api/src/modules/shop/shop-public.controller.ts`
- Test: `services/api/src/modules/shop/shop-regressions.spec.ts`

**Step 1: Write the failing test**

Adicione regressao `LOJA-05`, `LOJA-06` e `LOJA-09`:

```ts
it("cria pedido de pre-venda sem reservar estoque e recalcula preco no backend", async () => {
  const inventoryService = new ShopInventoryService();
  const service = new ShopOrdersService(inventoryService, {} as never);

  jest.spyOn(inventoryService, "withInventoryLocks").mockImplementation(
    async (_targets, callback) => callback(),
  );
  jest.spyOn(inventoryService, "reserveStockInTransaction");

  mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
    id: "variant-pre-venda",
    isActive: true,
    priceOverride: 9900,
    size: "4",
    product: {
      id: "produto-1",
      schoolId: "school-1",
      name: "Casaco Moletom",
      basePrice: 12000,
      isActive: true,
    },
  });
  mockDb.query.shopInventory.findFirst.mockResolvedValue({
    quantity: 0,
    reservedQuantity: 0,
  });
  mockOrderInsert.returning.mockResolvedValue([
    {
      id: "order-pre-venda-1",
      orderNumber: "654321",
      totalAmount: 19800,
      expiresAt: null,
    },
  ]);

  const result = await service.createPreSaleOrder({
    schoolId: "school-1",
    unitId: "unit-1",
    customerName: "Maria Silva",
    customerPhone: "11987654321",
    items: [
      { variantId: "variant-pre-venda", studentName: "Joao", quantity: 2 },
    ],
  });

  expect(mockOrderInsert.values).toHaveBeenCalledWith(
    expect.objectContaining({
      orderSource: "PRE_VENDA",
      status: "AGUARDANDO_PAGAMENTO",
      totalAmount: 19800,
      expiresAt: null,
    }),
  );
  expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
  expect(result).toEqual(
    expect.objectContaining({
      orderNumber: "654321",
      expiresAt: null,
    }),
  );
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "cria pedido de pre-venda"
```

Expected: FAIL se nao existir `createPreSaleOrder`, se reservar estoque, ou se usar preco do frontend.

**Step 3: Write minimal implementation**

Em `ShopOrdersService`, implemente `createPreSaleOrder(dto: CreateOrderDto)`:

```ts
async createPreSaleOrder(dto: CreateOrderDto) {
  const db = getDb();
  await this.assertUnitBelongsToSchool(dto.schoolId, dto.unitId);
  await this.assertShopEnabled(dto.unitId);

  const variantsById = new Map();
  for (const item of dto.items) {
    variantsById.set(
      item.variantId,
      await this.getActiveVariantForOrder(item.variantId, dto.schoolId),
    );
  }

  const orderNumber = await this.generateOrderNumber();
  const lockTargets = dto.items.map((item) => ({
    variantId: item.variantId,
    unitId: dto.unitId,
  }));

  const order = await this.inventoryService.withInventoryLocks(
    lockTargets,
    async () => {
      let totalAmount = 0;
      const itemsWithPrice = [];

      for (const item of dto.items) {
        const variant = variantsById.get(item.variantId)!;
        const available = await this.getAvailableStock(item.variantId, dto.unitId);

        if (available > 0) {
          throw new BadRequestException({
            code: "PRE_SALE_STOCK_AVAILABLE",
            message: "Este tamanho ja esta disponivel para pronta entrega. Atualize o carrinho antes de finalizar.",
            details: { variantId: item.variantId, availableStock: available },
          });
        }

        const itemPrice = variant.priceOverride ?? variant.product.basePrice;
        totalAmount += itemPrice * item.quantity;
        itemsWithPrice.push({
          variantId: item.variantId,
          studentName: item.studentName,
          quantity: item.quantity,
          unitPrice: itemPrice,
        });
      }

      return db.transaction(async (tx) => {
        const [createdOrder] = await tx.insert(shopOrders).values({
          orderNumber,
          schoolId: dto.schoolId,
          unitId: dto.unitId,
          orderSource: "PRE_VENDA",
          status: "AGUARDANDO_PAGAMENTO",
          totalAmount,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          customerEmail: dto.customerEmail || null,
          expiresAt: null,
        }).returning();

        await tx.insert(shopOrderItems).values(
          itemsWithPrice.map((item) => ({
            orderId: createdOrder.id,
            variantId: item.variantId,
            studentName: item.studentName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        );

        return createdOrder;
      });
    },
  );

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    expiresAt: order.expiresAt ?? null,
  };
}
```

Em `ShopPublicController`:

```ts
@Post("orders/pre-venda")
@Throttle({ strict: { limit: 50, ttl: 3600000 } })
@HttpCode(HttpStatus.CREATED)
async createPreSaleOrder(@Body() dto: CreateOrderDto) {
  const result = await this.ordersService.createPreSaleOrder(dto);

  return {
    success: true,
    data: result,
  };
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "cria pedido de pre-venda"
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/shop/shop-orders.service.ts services/api/src/modules/shop/shop-public.controller.ts services/api/src/modules/shop/shop-regressions.spec.ts
git commit -m "feat(loja): criar voucher de pre-venda"
```

## Task 5: Pagamento, Cancelamento, Exclusao e Retirada de Pre-venda

**Files:**
- Modify: `services/api/src/modules/shop/shop-orders.service.ts`
- Test: `services/api/src/modules/shop/shop-regressions.spec.ts`
- Test: `services/api/src/modules/shop/shop-orders.service.spec.ts`

**Step 1: Write the failing tests**

Adicione testes:

```ts
it("confirmar pagamento de pre-venda nao baixa estoque", async () => {
  const inventoryService = new ShopInventoryService();
  const service = new ShopOrdersService(inventoryService, {} as never);

  jest.spyOn(inventoryService, "withOrderLock").mockImplementation(
    async (_orderId, callback) => callback(),
  );
  jest.spyOn(inventoryService, "withInventoryLocks");
  jest.spyOn(inventoryService, "confirmSaleInTransaction");

  mockDb.query.shopOrders.findFirst.mockResolvedValue({
    id: "order-pre-venda-1",
    orderNumber: "654321",
    orderSource: "PRE_VENDA",
    status: "AGUARDANDO_PAGAMENTO",
    totalAmount: 9900,
    expiresAt: null,
    items: [{ variantId: "variant-1", quantity: 1 }],
  });

  await service.confirmPayment(
    "order-pre-venda-1",
    { payments: [{ method: "PIX", amount: 9900 }] },
    "admin-1",
    { userId: "admin-1", role: "gerente_unidade", schoolId: "school-1", unitId: "unit-1" },
  );

  expect(inventoryService.withInventoryLocks).not.toHaveBeenCalled();
  expect(inventoryService.confirmSaleInTransaction).not.toHaveBeenCalled();
  expect(mockOrderPaymentsInsert.values).toHaveBeenCalledWith([
    expect.objectContaining({ paymentMethod: "PIX", amount: 9900 }),
  ]);
});

it("cancelar pre-venda nao libera reserva de estoque", async () => {
  const inventoryService = new ShopInventoryService();
  const service = new ShopOrdersService(inventoryService, {} as never);

  jest.spyOn(inventoryService, "withOrderLock").mockImplementation(
    async (_orderId, callback) => callback(),
  );
  jest.spyOn(inventoryService, "releaseReservationInTransaction");

  mockDb.query.shopOrders.findFirst.mockResolvedValue({
    id: "order-pre-venda-1",
    orderSource: "PRE_VENDA",
    status: "AGUARDANDO_PAGAMENTO",
    items: [{ variantId: "variant-1", quantity: 1 }],
  });

  await service.cancelOrder(
    "order-pre-venda-1",
    "admin-1",
    "Cliente solicitou",
    { userId: "admin-1", role: "gerente_unidade", schoolId: "school-1", unitId: "unit-1" },
  );

  expect(inventoryService.releaseReservationInTransaction).not.toHaveBeenCalled();
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "pre-venda nao"
```

Expected: FAIL se o fluxo ainda mexer em estoque para `PRE_VENDA`.

**Step 3: Write minimal implementation**

Em `confirmPayment`, pule locks de inventario e `confirmSaleInTransaction` quando `orderSource === "PRE_VENDA"`:

```ts
if (currentOrder.orderSource !== "PRE_VENDA") {
  for (const item of currentOrder.items) {
    await this.inventoryService.confirmSaleInTransaction(
      item.variantId,
      currentOrder.unitId,
      item.quantity,
      currentOrder.id,
      tx,
    );
  }
}
```

Antes de chamar `withInventoryLocks`:

```ts
if (order.orderSource === "PRE_VENDA") {
  return db.transaction(confirmPaymentInTransaction);
}
```

Em `cancelOrder`:

```ts
if (order.orderSource === "PRE_VENDA") {
  await db.transaction(cancelOrderInTransaction);
  return order;
}
```

Em `deleteOrder`:

```ts
if (order.orderSource === "PRE_VENDA") {
  await db.transaction(async (tx) => {
    await tx.delete(shopOrders).where(this.orderWhere(orderId, scope));
  });
  return;
}
```

Em `markAsPickedUp`, mantenha apenas mudanca de status para todos os pedidos pagos. Nao adicione estoque ali.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts src/modules/shop/shop-orders.service.spec.ts --runInBand
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/shop/shop-orders.service.ts services/api/src/modules/shop/shop-regressions.spec.ts services/api/src/modules/shop/shop-orders.service.spec.ts
git commit -m "feat(loja): preservar estoque no ciclo de pre-venda"
```

## Task 6: Proxy Publico e Contrato de Voucher

**Files:**
- Create: `apps/loja/app/api/shop/orders/pre-venda/[schoolId]/route.ts`
- Modify: `apps/loja/lib/order.ts`
- Modify: `apps/loja/app/pedido/[orderNumber]/page.tsx`
- Modify: `apps/loja/app/pedido/[orderNumber]/VoucherPDF.tsx`
- Test: `apps/loja/__tests__/loja.test.ts`

**Step 1: Write the failing tests**

Em `apps/loja/__tests__/loja.test.ts`, adicione testes de fonte:

```ts
it("possui proxy publico para pedidos de pre-venda", () => {
  const source = readFileSync(
    join(process.cwd(), "app/api/shop/orders/pre-venda/[schoolId]/route.ts"),
    "utf8",
  );

  expect(source).toContain("/api/shop/orders/pre-venda");
  expect(source).toContain("schoolId");
  expect(source).toContain("RATE_LIMIT");
});

it("voucher rotula pre-venda aguardando pagamento como reserva", () => {
  const pageSource = readFileSync(
    join(process.cwd(), "app/pedido/[orderNumber]/page.tsx"),
    "utf8",
  );
  const pdfSource = readFileSync(
    join(process.cwd(), "app/pedido/[orderNumber]/VoucherPDF.tsx"),
    "utf8",
  );

  expect(pageSource).toContain("order.orderSource === 'PRE_VENDA'");
  expect(pageSource).toContain("Reservado em pré-venda");
  expect(pdfSource).toContain("Reservado em pré-venda");
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @essencia/loja test -- loja
```

Expected: FAIL se rota/proxy ou rotulos ainda nao existem.

**Step 3: Write minimal implementation**

Crie `apps/loja/app/api/shop/orders/pre-venda/[schoolId]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const { schoolId } = await params;
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/shop/orders/pre-venda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, schoolId }),
    });

    const data = await response.json();

    if (response.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT",
            message: "Muitos pedidos. Aguarde alguns minutos e tente novamente.",
          },
        },
        { status: 429 },
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Erro ao criar pedido de pre-venda:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "FETCH_ERROR", message: "Erro ao criar pedido de pre-venda" },
      },
      { status: 500 },
    );
  }
}
```

Em voucher web e PDF:

```ts
const getStatusLabel = (status: Order["status"], orderSource?: Order["orderSource"]) => {
  if (orderSource === "PRE_VENDA" && status === "AGUARDANDO_PAGAMENTO") {
    return "Reservado em pré-venda";
  }

  // manter labels existentes
};
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/loja test -- loja
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/loja/app/api/shop/orders/pre-venda/[schoolId]/route.ts apps/loja/lib/order.ts apps/loja/app/pedido/[orderNumber]/page.tsx apps/loja/app/pedido/[orderNumber]/VoucherPDF.tsx apps/loja/__tests__/loja.test.ts
git commit -m "feat(loja): exibir voucher de pre-venda"
```

## Task 7: Carrinho Separado por Modo de Venda

**Files:**
- Modify: `apps/loja/lib/useCart.ts`
- Modify: `apps/loja/app/carrinho/page.tsx`
- Modify: `apps/loja/components/OrderItemCard.tsx`
- Test: `apps/loja/__tests__/use-cart.test.tsx`
- Test: `apps/loja/__tests__/carrinho-page.test.tsx`

**Step 1: Write the failing tests**

Em `apps/loja/__tests__/use-cart.test.tsx`:

```tsx
it("mantem carrinhos separados por modoVenda para mesma variante e aluno", () => {
  const { result } = renderHook(() => useCart());

  act(() => {
    result.current.addItem({
      schoolId: "school-1",
      unitId: "unit-1",
      productId: "produto-1",
      variantId: "variant-1",
      productName: "Casaco",
      variantSize: "4",
      quantity: 1,
      unitPrice: 100,
      studentName: "Joao",
      availableStock: 1,
      modoVenda: "PRONTA_ENTREGA",
    });
    result.current.addItem({
      schoolId: "school-1",
      unitId: "unit-1",
      productId: "produto-1",
      variantId: "variant-1",
      productName: "Casaco",
      variantSize: "4",
      quantity: 1,
      unitPrice: 100,
      studentName: "Joao",
      availableStock: 0,
      modoVenda: "PRE_VENDA",
    });
  });

  expect(result.current.getProntaEntregaItems()).toHaveLength(1);
  expect(result.current.getPreVendaItems()).toHaveLength(1);
  expect(result.current.getTotalAmount("PRE_VENDA")).toBe(100);
});
```

Em `apps/loja/__tests__/carrinho-page.test.tsx`, valide textos:

```tsx
expect(screen.getByText("Pronta entrega")).toBeInTheDocument();
expect(screen.getByText("Pré-venda")).toBeInTheDocument();
```

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @essencia/loja test -- use-cart carrinho-page
```

Expected: FAIL se carrinho ainda agrupar somente por variante/aluno.

**Step 3: Write minimal implementation**

Em `apps/loja/lib/useCart.ts`:

```ts
export type ModoVenda = "PRONTA_ENTREGA" | "PRE_VENDA";
const MODO_VENDA_PADRAO: ModoVenda = "PRONTA_ENTREGA";

function normalizarItem(item: CartItem): CartItem {
  return { ...item, modoVenda: item.modoVenda ?? MODO_VENDA_PADRAO };
}

const getItemsByModoVenda = (modoVenda: ModoVenda) => {
  return items.filter(
    (item) => (item.modoVenda ?? MODO_VENDA_PADRAO) === modoVenda,
  );
};

const getProntaEntregaItems = () => getItemsByModoVenda("PRONTA_ENTREGA");
const getPreVendaItems = () => getItemsByModoVenda("PRE_VENDA");
```

Ao buscar item existente, inclua `modoVenda` na chave:

```ts
const existingIndex = current.findIndex(
  (i) =>
    i.variantId === normalizedItem.variantId &&
    i.studentName.toLowerCase() === normalizedItem.studentName.toLowerCase() &&
    (i.modoVenda ?? MODO_VENDA_PADRAO) === normalizedItem.modoVenda,
);
```

Em pre-venda, nao limite por `availableStock`, mas mantenha limite por produto/aluno:

```ts
if (
  normalizedItem.modoVenda !== "PRE_VENDA" &&
  existingVariantQty + normalizedItem.quantity > normalizedItem.availableStock
) {
  return { success: false, message: `Estoque disponível insuficiente para ${normalizedItem.productName}` };
}
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/loja test -- use-cart carrinho-page
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/loja/lib/useCart.ts apps/loja/app/carrinho/page.tsx apps/loja/components/OrderItemCard.tsx apps/loja/__tests__/use-cart.test.tsx apps/loja/__tests__/carrinho-page.test.tsx
git commit -m "feat(loja): separar carrinho de pre-venda"
```

## Task 8: Vitrine e Detalhe do Produto

**Files:**
- Modify: `apps/loja/app/[schoolId]/[unitId]/page.tsx`
- Modify: `apps/loja/app/[schoolId]/[unitId]/produto/[id]/page.tsx`
- Modify: `apps/loja/components/ProductCard.tsx`
- Test: `apps/loja/__tests__/loja.test.ts`
- Test: `apps/loja/components/__tests__/ProductCardCarousel.test.tsx`
- Test: `apps/loja/components/__tests__/ProductDetailCarousel.test.tsx`

**Step 1: Write the failing tests**

Em `apps/loja/__tests__/loja.test.ts`:

```ts
it("catalogo busca pronta entrega e pre-venda separadamente", () => {
  const source = readFileSync(
    join(process.cwd(), "app/[schoolId]/[unitId]/page.tsx"),
    "utf8",
  );

  expect(source).toContain("fetch(buildCatalogUrl('PRONTA_ENTREGA'))");
  expect(source).toContain("fetch(buildCatalogUrl('PRE_VENDA'))");
  expect(source).toContain("setPreSaleProducts");
});

it("detalhe envia modoVenda selecionado para o carrinho", () => {
  const source = readFileSync(
    join(process.cwd(), "app/[schoolId]/[unitId]/produto/[id]/page.tsx"),
    "utf8",
  );

  expect(source).toContain("modoVenda: selectedModoVenda");
  expect(source).toContain("selectedModoVenda === 'PRE_VENDA'");
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @essencia/loja test -- loja ProductCardCarousel ProductDetailCarousel
```

Expected: FAIL se a vitrine ainda so buscar produtos com estoque ou detalhe ainda inferir por texto.

**Step 3: Write minimal implementation**

Em `page.tsx`, buscar duas listas:

```ts
const buildCatalogUrl = (modoVenda: "PRONTA_ENTREGA" | "PRE_VENDA") => {
  const params = new URLSearchParams();
  if (categoryFilter) params.append("category", categoryFilter);
  if (sizeFilter) params.append("size", sizeFilter);
  params.append("modoVenda", modoVenda);
  return `/api/shop/catalog/${schoolId}/${unitId}?${params.toString()}`;
};

const [readyResponse, preSaleResponse] = await Promise.all([
  fetch(buildCatalogUrl("PRONTA_ENTREGA")),
  fetch(buildCatalogUrl("PRE_VENDA")),
]);
```

Renderize duas secoes sem duplicar tela de detalhe:

```tsx
{products.length > 0 && (
  <section>
    <h3>Pronta entrega</h3>
    {/* cards */}
  </section>
)}

{preSaleProducts.length > 0 && (
  <section>
    <h3>Pré-venda</h3>
    {/* cards */}
  </section>
)}
```

Em detalhe, use `variant.modoVenda` da API:

```ts
const selectedModoVenda =
  selectedVariantData?.modoVenda ||
  ((selectedVariantData?.availableStock || 0) > 0
    ? "PRONTA_ENTREGA"
    : "PRE_VENDA");

addItem({
  // campos existentes
  availableStock,
  modoVenda: selectedModoVenda,
});
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/loja test -- loja ProductCardCarousel ProductDetailCarousel
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/loja/app/[schoolId]/[unitId]/page.tsx apps/loja/app/[schoolId]/[unitId]/produto/[id]/page.tsx apps/loja/components/ProductCard.tsx apps/loja/__tests__/loja.test.ts apps/loja/components/__tests__/ProductCardCarousel.test.tsx apps/loja/components/__tests__/ProductDetailCarousel.test.tsx
git commit -m "feat(loja): mostrar produtos de pre-venda"
```

## Task 9: Checkout com Dois Vouchers e Revalidacao

**Files:**
- Modify: `apps/loja/app/checkout/page.tsx`
- Test: `apps/loja/__tests__/checkout-page.test.tsx`

**Step 1: Write the failing tests**

Em `apps/loja/__tests__/checkout-page.test.tsx`:

```tsx
it("gera vouchers separados para pronta entrega e pre-venda", async () => {
  mocks.cartItems = [
    itemFactory({ variantId: "variant-pronta", modoVenda: "PRONTA_ENTREGA" }),
    itemFactory({ variantId: "variant-pre-venda", modoVenda: "PRE_VENDA" }),
  ];

  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { orderNumber: "111111" } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { orderNumber: "222222" } }),
    });

  render(<CheckoutPage />);
  await userEvent.type(screen.getByLabelText(/Nome Completo/i), "Maria Silva");
  await userEvent.type(screen.getByLabelText(/Telefone/i), "11987654321");
  await userEvent.click(screen.getByRole("button", { name: /Gerar Voucher/i }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/shop/orders/school-1",
    expect.any(Object),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/shop/orders/pre-venda/school-1",
    expect.any(Object),
  );
  expect(await screen.findByText("#111111")).toBeInTheDocument();
  expect(await screen.findByText("#222222")).toBeInTheDocument();
});
```

Adicione outro teste:

```tsx
it("bloqueia pagamento online quando ha item de pre-venda", async () => {
  mocks.cartItems = [
    itemFactory({ variantId: "variant-pre-venda", modoVenda: "PRE_VENDA" }),
  ];

  render(<CheckoutPage />);
  await userEvent.click(screen.getByRole("button", { name: /Pagar Online/i }));

  expect(fetchMock).not.toHaveBeenCalledWith(
    "/api/shop/checkout/init",
    expect.any(Object),
  );
  expect(screen.getByText(/Itens de pré-venda geram voucher/i)).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @essencia/loja test -- checkout-page
```

Expected: FAIL se checkout ainda cria um unico pedido ou permite Stripe com pre-venda.

**Step 3: Write minimal implementation**

Separe itens:

```ts
const prontaEntregaItems = getProntaEntregaItems();
const preVendaItems = getPreVendaItems();
const hasPreVenda = preVendaItems.length > 0;
```

Bloqueie pagamento online com pre-venda:

```ts
if (hasPreVenda) {
  showToast({
    message: "Itens de pré-venda geram voucher para pagamento na retirada.",
    type: "error",
  });
  return;
}
```

No voucher, crie pedidos por grupo:

```ts
await createProntaEntregaWithFallback(prontaEntregaItems);
await createOrder(preVendaItems, "PRE_VENDA", preVendaUrl);
```

Para item de pronta entrega que perdeu estoque, permita converter em pre-venda:

```ts
const confirmed = window.confirm(
  "O estoque acabou para um dos itens de pronta entrega. Deseja transformar esse item em pré-venda para pagamento na retirada?",
);

if (confirmed) {
  await createOrder(affectedItems, "PRE_VENDA", preVendaUrl);
}
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/loja test -- checkout-page
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/loja/app/checkout/page.tsx apps/loja/__tests__/checkout-page.test.tsx
git commit -m "feat(loja): gerar vouchers separados no checkout"
```

## Task 10: Loja-admin Lista e Detalhe de Pedidos

**Files:**
- Modify: `apps/loja-admin/app/pedidos/page.tsx`
- Modify: `apps/loja-admin/app/pedidos/[id]/page.tsx`
- Test: `apps/loja-admin/__tests__/pedidos-source.test.ts`

**Step 1: Write the failing tests**

Em `apps/loja-admin/__tests__/pedidos-source.test.ts`:

```ts
it("pedidos admin exibem e filtram pre-venda por orderSource", () => {
  const listSource = readFileSync(
    join(process.cwd(), "app/pedidos/page.tsx"),
    "utf8",
  );
  const detailSource = readFileSync(
    join(process.cwd(), "app/pedidos/[id]/page.tsx"),
    "utf8",
  );

  expect(listSource).toContain("orderSource");
  expect(listSource).toContain("PRE_VENDA");
  expect(listSource).toContain("Pré-venda");
  expect(detailSource).toContain("order.orderSource === 'PRE_VENDA'");
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @essencia/loja-admin test -- pedidos-source
```

Expected: FAIL se admin ainda nao reconhece `PRE_VENDA`.

**Step 3: Write minimal implementation**

Em `apps/loja-admin/app/pedidos/page.tsx`, adicione filtro de origem:

```tsx
const [orderSourceFilter, setOrderSourceFilter] = useState("");

if (orderSourceFilter) params.set("orderSource", orderSourceFilter);
```

Opcoes:

```tsx
<select value={orderSourceFilter} onChange={(e) => setOrderSourceFilter(e.target.value)}>
  <option value="">Todas as origens</option>
  <option value="ONLINE">Online</option>
  <option value="PRESENCIAL">Presencial</option>
  <option value="PRE_VENDA">Pré-venda</option>
</select>
```

Badge:

```tsx
const getOrderSourceBadge = (order: Order) => {
  if (order.orderSource === "PRE_VENDA") {
    return <span className="badge badge-warning">Pré-venda</span>;
  }
  // manter ONLINE/PRESENCIAL
};
```

Em detalhe, rotule `orderSource === "PRE_VENDA"` e mantenha acoes:

- `AGUARDANDO_PAGAMENTO`: confirmar pagamento, cancelar, excluir.
- `PAGO`: confirmar retirada.
- `RETIRADO`: somente consulta.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/loja-admin test -- pedidos-source
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/loja-admin/app/pedidos/page.tsx apps/loja-admin/app/pedidos/[id]/page.tsx apps/loja-admin/__tests__/pedidos-source.test.ts
git commit -m "feat(loja-admin): identificar pedidos de pre-venda"
```

## Task 11: Resumo Administrativo de Demanda da Pre-venda

**Files:**
- Modify: `services/api/src/modules/shop/shop-orders.service.ts`
- Modify: `services/api/src/modules/shop/shop-admin.controller.ts`
- Create: `apps/loja-admin/app/api/shop/admin/orders/pre-venda/summary/route.ts`
- Modify: `apps/loja-admin/app/relatorios/page.tsx`
- Test: `services/api/src/modules/shop/shop-regressions.spec.ts`
- Test: `apps/loja-admin/__tests__/pedidos-source.test.ts`

**Step 1: Write the failing tests**

Em `services/api/src/modules/shop/shop-regressions.spec.ts`:

```ts
it("resume demanda de pre-venda por produto e tamanho", async () => {
  const service = new ShopOrdersService({} as never, {} as never);

  const rowsBuilder = {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue([
      {
        productId: "produto-1",
        productName: "Casaco Moletom",
        variantId: "variant-1",
        size: "4",
        reservedQuantity: 4,
        paidQuantity: 2,
        pickedUpQuantity: 1,
        customers: "Maria Silva|11987654321",
      },
    ]),
  };

  mockDb.select.mockReturnValue(rowsBuilder);

  const result = await service.getPreSaleSummary({
    userId: "admin-1",
    role: "gerente_unidade",
    schoolId: "school-1",
    unitId: "unit-1",
  });

  expect(result).toEqual([
    expect.objectContaining({
      productName: "Casaco Moletom",
      size: "4",
      reservedQuantity: 4,
      paidQuantity: 2,
      pickedUpQuantity: 1,
    }),
  ]);
});
```

Em `apps/loja-admin/__tests__/pedidos-source.test.ts`:

```ts
it("relatorios carregam resumo de pre-venda da API", () => {
  const source = readFileSync(join(process.cwd(), "app/relatorios/page.tsx"), "utf8");

  expect(source).toContain("pre-venda/summary");
  expect(source).toContain("Pré-venda");
  expect(source).not.toContain("Mock data para demonstração");
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "resume demanda"
pnpm --filter @essencia/loja-admin test -- pedidos-source
```

Expected: FAIL porque o endpoint/resumo ainda nao existe ou relatorios ainda usam mock.

**Step 3: Write minimal implementation**

Em `ShopOrdersService`, adicione metodo:

```ts
async getPreSaleSummary(scope?: ShopTenantScope) {
  const db = getDb();
  assertShopTenantScope(scope);

  const conditions = [
    eq(shopOrders.orderSource, "PRE_VENDA"),
    eq(shopOrders.schoolId, scope!.schoolId!),
  ];

  if (scope!.unitId) {
    conditions.push(eq(shopOrders.unitId, scope!.unitId));
  }

  const rows = await db
    .select({
      productId: shopProducts.id,
      productName: shopProducts.name,
      variantId: shopProductVariants.id,
      size: shopProductVariants.size,
      reservedQuantity: sql<number>`sum(case when ${shopOrders.status} = 'AGUARDANDO_PAGAMENTO' then ${shopOrderItems.quantity} else 0 end)`,
      paidQuantity: sql<number>`sum(case when ${shopOrders.status} = 'PAGO' then ${shopOrderItems.quantity} else 0 end)`,
      pickedUpQuantity: sql<number>`sum(case when ${shopOrders.status} = 'RETIRADO' then ${shopOrderItems.quantity} else 0 end)`,
      customers: sql<string>`string_agg(distinct ${shopOrders.customerName} || '|' || ${shopOrders.customerPhone}, ',')`,
    })
    .from(shopOrderItems)
    .innerJoin(shopOrders, eq(shopOrderItems.orderId, shopOrders.id))
    .innerJoin(shopProductVariants, eq(shopOrderItems.variantId, shopProductVariants.id))
    .innerJoin(shopProducts, eq(shopProductVariants.productId, shopProducts.id))
    .where(and(...conditions))
    .groupBy(shopProducts.id, shopProducts.name, shopProductVariants.id, shopProductVariants.size)
    .orderBy(shopProducts.name, shopProductVariants.size);

  return rows.map((row) => ({
    ...row,
    customers: String(row.customers ?? "")
      .split(",")
      .filter(Boolean)
      .map((entry) => {
        const [name, phone] = entry.split("|");
        return { name, phone };
      }),
  }));
}
```

Em `ShopAdminController`, coloque a rota antes de `orders/:id`:

```ts
@Get("orders/pre-venda/summary")
async getPreSaleSummary(@CurrentUser() user: AuthenticatedUser) {
  const scope = getShopTenantScopeFromUser(user);
  const data = await this.ordersService.getPreSaleSummary(scope);

  return { success: true, data };
}
```

Crie proxy `apps/loja-admin/app/api/shop/admin/orders/pre-venda/summary/route.ts` seguindo o padrao de outros proxies admin:

```ts
import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  const response = await fetch(`${API_URL}/api/shop/admin/orders/pre-venda/summary`, {
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
```

Em `relatorios/page.tsx`, adicione tab `pre-venda`, carregue via `apiFetch` e remova mock para essa tab:

```ts
const response = await apiFetch("/api/shop/admin/orders/pre-venda/summary");
const result = await response.json();
setPreSaleReport(result.success ? result.data : []);
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "resume demanda"
pnpm --filter @essencia/loja-admin test -- pedidos-source
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/shop/shop-orders.service.ts services/api/src/modules/shop/shop-admin.controller.ts services/api/src/modules/shop/shop-regressions.spec.ts apps/loja-admin/app/api/shop/admin/orders/pre-venda/summary/route.ts apps/loja-admin/app/relatorios/page.tsx apps/loja-admin/__tests__/pedidos-source.test.ts
git commit -m "feat(loja-admin): resumir demanda de pre-venda"
```

## Task 12: Documentacao e Matriz de Invariantes

**Files:**
- Modify: `docs/LOJA_INVARIANTES_TESTES.md`
- Modify: `docs/API.md`
- Modify: `docs/plans/2026-05-19-reserva-pre-venda-loja-design.md`

**Step 1: Write the failing check**

Use busca como teste de documentacao:

```bash
rg -n "PRE_VENDA|modoVenda|pre-venda|orders/pre-venda" docs/API.md docs/LOJA_INVARIANTES_TESTES.md docs/plans/2026-05-19-reserva-pre-venda-loja-design.md
```

Expected: FAIL manual se algum contrato implementado nao estiver documentado.

**Step 2: Run check to verify it fails**

Run:

```bash
rg -n "orders/pre-venda|modoVenda|PRE_VENDA" docs/API.md docs/LOJA_INVARIANTES_TESTES.md
```

Expected: deve mostrar lacunas se docs ainda nao cobrem endpoint, filtro e invariantes.

**Step 3: Write minimal documentation**

Atualize `docs/API.md` com:

```md
### POST /api/shop/orders/pre-venda

Cria voucher de pre-venda para variantes sem estoque disponivel.

- `orderSource`: `PRE_VENDA`
- `status` inicial: `AGUARDANDO_PAGAMENTO`
- Nao altera `quantity`
- Nao altera `reservedQuantity`
- Rejeita variante que voltou a ter estoque com `PRE_SALE_STOCK_AVAILABLE`
```

Atualize `docs/LOJA_INVARIANTES_TESTES.md` incluindo pre-venda:

```md
| `LOJA-06` | Pedido e pagamento | Pre-venda usa `orderSource = PRE_VENDA`, inicia em `AGUARDANDO_PAGAMENTO` e nao movimenta estoque em criacao, pagamento, retirada, cancelamento ou exclusao. | API + loja-admin |
```

**Step 4: Run check to verify it passes**

Run:

```bash
rg -n "orders/pre-venda|modoVenda|PRE_VENDA|PRE_SALE_STOCK_AVAILABLE" docs/API.md docs/LOJA_INVARIANTES_TESTES.md docs/plans/2026-05-19-reserva-pre-venda-loja-design.md
```

Expected: todas as referencias principais aparecem.

**Step 5: Commit**

```bash
git add docs/API.md docs/LOJA_INVARIANTES_TESTES.md docs/plans/2026-05-19-reserva-pre-venda-loja-design.md
git commit -m "docs(loja): documentar contrato de pre-venda"
```

## Task 13: Verificacao Final

**Files:**
- Verify: `services/api/src/modules/shop`
- Verify: `apps/loja`
- Verify: `apps/loja-admin`
- Verify: `packages/db`

**Step 1: Run API shop tests**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-products.service.spec.ts src/modules/shop/shop-orders.service.spec.ts src/modules/shop/shop-inventory.service.spec.ts src/modules/shop/shop-regressions.spec.ts --runInBand
```

Expected: PASS.

**Step 2: Run loja tests**

Run:

```bash
pnpm --filter @essencia/loja test -- loja use-cart carrinho-page checkout-page ProductDetailCarousel ProductCardCarousel
```

Expected: PASS.

**Step 3: Run loja-admin tests**

Run:

```bash
pnpm --filter @essencia/loja-admin test -- pedidos-source dashboard-source permissions
```

Expected: PASS.

**Step 4: Run required global quality gate**

Run:

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected: PASS.

**Step 5: Manual smoke test**

Run dev servers if needed:

```bash
pnpm turbo dev --filter=loja --filter=loja-admin --filter=@essencia/api
```

Expected manual behavior:

- Produto com tamanho em estoque aparece na categoria normal.
- Produto com tamanho sem estoque aparece na secao `Pre-venda`.
- Produto misto aparece nas duas secoes.
- Detalhe unico mostra todos os tamanhos.
- Tamanho sem estoque entra no carrinho de pre-venda.
- Checkout com itens mistos gera dois vouchers.
- Voucher de pre-venda mostra `Reservado em pré-venda`.
- Admin filtra `Pré-venda`, confirma pagamento e retirada.
- Resumo de pre-venda mostra produto, tamanho, reservado, pago, retirado e responsaveis.

**Step 6: Commit final if needed**

Se a verificacao exigiu ajustes:

```bash
git add <arquivos-ajustados>
git commit -m "fix(loja): ajustar verificacao de pre-venda"
```

Expected: nenhum ajuste pendente alem dos commits das tasks.

## Ordem de Execucao Recomendada

1. Task 0
2. Task 1
3. Task 2
4. Task 3
5. Task 4
6. Task 5
7. Task 6
8. Task 7
9. Task 8
10. Task 9
11. Task 10
12. Task 11
13. Task 12
14. Task 13

Nao pule a verificacao de falha antes da implementacao. Se um teste passar antes da mudanca, ajuste o teste para provar o comportamento novo ou registre que o comportamento ja existe e avance para o proximo teste que ainda falha.
