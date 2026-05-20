# Pre-venda Manual por Produto Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Trocar a classificacao automatica de pre-venda por estoque por um checkbox manual no cadastro do produto.

**Architecture:** O produto ganha `isPreSale` persistido em `shop_products`. A API publica passa a derivar `modoVenda` desse campo: produto de pre-venda sempre retorna `PRE_VENDA`, produto normal sempre retorna `PRONTA_ENTREGA` e usa `availableStock` para habilitar ou bloquear compra. Loja-admin controla o campo; loja publica, carrinho e checkout apenas consomem a regra centralizada pela API.

**Tech Stack:** Turborepo, pnpm, Next.js App Router, NestJS, Drizzle, PostgreSQL, Vitest/Jest, Tailwind, shadcn/ui.

---

## Contexto Obrigatorio

Leia antes de executar:

- `docs/plans/2026-05-20-pre-venda-manual-produto-design.md`
- `docs/LOJA_INVARIANTES_TESTES.md`
- `packages/db/src/schema/shop.ts`
- `services/api/src/modules/shop/shop-products.service.ts`
- `services/api/src/modules/shop/shop-orders.service.ts`
- `apps/loja/app/[schoolId]/[unitId]/catalog-page-content.tsx`
- `apps/loja/app/[schoolId]/[unitId]/produto/[id]/page.tsx`
- `apps/loja/app/checkout/page.tsx`
- `apps/loja-admin/app/produtos/page.tsx`
- `apps/loja-admin/app/venda-presencial/page.tsx`

Regras de execucao:

- O usuario pediu execucao nesta sessao, sem worktree.
- Rode `git status --short` antes de editar.
- Existem alteracoes locais nao relacionadas. Nao reverta nada que nao fizer parte desta feature.
- Use @superpowers:test-driven-development em cada mudanca de comportamento.
- Use @superpowers:verification-before-completion antes de declarar pronto.
- Faca commits pequenos e stage apenas os arquivos da tarefa atual.

## Task 0: Baseline e Escopo

**Files:**
- Read: `docs/plans/2026-05-20-pre-venda-manual-produto-design.md`
- Read: `docs/LOJA_INVARIANTES_TESTES.md`

**Step 1: Conferir estado local**

Run:

```bash
git status --short
```

Expected: lista alteracoes locais existentes. Anote arquivos sujos relacionados a loja/API e nao reverta.

**Step 2: Rodar baseline focado**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand
pnpm --filter @essencia/loja test -- __tests__/loja.test.ts __tests__/checkout-page.test.tsx __tests__/use-cart.test.tsx
pnpm --filter @essencia/loja-admin test -- admin pedidos-source venda-presencial
```

Expected: registrar resultado atual. Se houver falha por alteracao local preexistente, documente antes de seguir.

**Step 3: Commit**

Nao commitar nesta task.

## Task 1: Campo `isPreSale` no Contrato de Produto

**Files:**
- Modify: `packages/db/src/schema/shop.ts`
- Modify: `packages/db/schema.sql`
- Create: `packages/db/drizzle/0032_shop_products_is_pre_sale.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`
- Modify: `services/api/src/modules/shop/dto/product.dto.ts`
- Test: `services/api/src/modules/shop/shop-regressions.spec.ts`

**Step 1: Write the failing tests**

Adicione testes em `services/api/src/modules/shop/shop-regressions.spec.ts`:

```ts
it("contrato de produto possui flag manual de pre-venda", () => {
  const schemaSource = readFileSync(
    join(process.cwd(), "../../packages/db/src/schema/shop.ts"),
    "utf8",
  );
  const dtoSource = readFileSync(
    join(process.cwd(), "src/modules/shop/dto/product.dto.ts"),
    "utf8",
  );

  expect(schemaSource).toContain('isPreSale: boolean("is_pre_sale").default(false).notNull()');
  expect(schemaSource).toContain('isPreSaleIdx: index("shop_products_is_pre_sale_idx").on(table.isPreSale)');
  expect(dtoSource).toContain("isPreSale?: boolean");
});

it("valida isPreSale como booleano no cadastro de produto", async () => {
  const validDto = Object.assign(new CreateProductDto(), {
    schoolId: "11111111-1111-1111-1111-111111111111",
    name: "Produto de pre-venda",
    category: "UNIFORME_UNISSEX",
    basePrice: 1000,
    isPreSale: true,
  });

  await expect(validate(validDto)).resolves.toHaveLength(0);

  const invalidDto = Object.assign(new CreateProductDto(), {
    schoolId: "11111111-1111-1111-1111-111111111111",
    name: "Produto invalido",
    category: "UNIFORME_UNISSEX",
    basePrice: 1000,
    isPreSale: "sim",
  });

  await expect(validate(invalidDto)).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ property: "isPreSale" }),
    ]),
  );
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "isPreSale|flag manual"
```

Expected: FAIL porque schema/DTO ainda nao possuem `isPreSale`.

**Step 3: Write minimal implementation**

Em `packages/db/src/schema/shop.ts`, adicione em `shopProducts`:

```ts
isPreSale: boolean("is_pre_sale").default(false).notNull(),
```

No bloco de indices:

```ts
isPreSaleIdx: index("shop_products_is_pre_sale_idx").on(table.isPreSale),
```

Em `services/api/src/modules/shop/dto/product.dto.ts`, adicione em `CreateProductDto` e `UpdateProductDto`:

```ts
@IsOptional()
@IsBoolean()
isPreSale?: boolean;
```

Crie `packages/db/drizzle/0032_shop_products_is_pre_sale.sql`:

```sql
ALTER TABLE "shop_products"
ADD COLUMN IF NOT EXISTS "is_pre_sale" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "shop_products_is_pre_sale_idx"
ON "shop_products" ("is_pre_sale");
```

Atualize `packages/db/schema.sql` com a mesma coluna e o indice, se esse arquivo ainda espelhar o schema completo.

Atualize `packages/db/drizzle/meta/_journal.json` adicionando entrada `idx: 32` para `0032_shop_products_is_pre_sale`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "isPreSale|flag manual"
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db/src/schema/shop.ts packages/db/schema.sql packages/db/drizzle/0032_shop_products_is_pre_sale.sql packages/db/drizzle/meta/_journal.json services/api/src/modules/shop/dto/product.dto.ts services/api/src/modules/shop/shop-regressions.spec.ts
git commit -m "feat(loja): adicionar flag manual de pre-venda"
```

## Task 2: Persistencia e Listagem Administrativa

**Files:**
- Modify: `services/api/src/modules/shop/shop-products.service.ts`
- Modify: `services/api/src/modules/shop/shop-admin.controller.ts`
- Test: `services/api/src/modules/shop/shop-regressions.spec.ts`

**Step 1: Write the failing tests**

Adicione testes no arquivo de regressao:

```ts
it("persiste isPreSale ao criar produto", async () => {
  mockProductInsert.returning.mockResolvedValueOnce([{ id: "product-1", isPreSale: true }]);

  const service = new ShopProductsService({} as never);
  await service.createProduct(
    {
      schoolId: "school-1",
      name: "Produto de pre-venda",
      category: "UNIFORME_UNISSEX",
      basePrice: 1000,
      isPreSale: true,
    } as CreateProductDto,
    "admin-1",
    { role: "master" } as never,
  );

  expect(mockProductInsert.values).toHaveBeenCalledWith(
    expect.objectContaining({ isPreSale: true }),
  );
});

it("permite atualizar isPreSale do produto", async () => {
  mockDb.query.shopProducts.findFirst.mockResolvedValueOnce({ id: "product-1" });
  mockDb.returning.mockResolvedValueOnce([{ id: "product-1", isPreSale: true }]);

  const service = new ShopProductsService({} as never);
  await service.updateProduct(
    "product-1",
    { isPreSale: true },
    "admin-1",
    { role: "master" } as never,
  );

  expect(mockDb.set).toHaveBeenCalledWith(
    expect.objectContaining({ isPreSale: true }),
  );
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "isPreSale"
```

Expected: FAIL porque o service ainda nao grava/atualiza o campo.

**Step 3: Write minimal implementation**

Em `createProduct`, inclua:

```ts
isPreSale: dto.isPreSale ?? false,
```

Em `updateProduct`, inclua:

```ts
if (dto.isPreSale !== undefined) updateData.isPreSale = dto.isPreSale;
```

Em `shop-admin.controller.ts`, a listagem ja usa `...p`; confirme que `isPreSale` chega no retorno. Se o mock de `@essencia/db` em teste define `shopProducts`, adicione `isPreSale: "is_pre_sale"` nele.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "isPreSale"
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/shop/shop-products.service.ts services/api/src/modules/shop/shop-admin.controller.ts services/api/src/modules/shop/shop-regressions.spec.ts
git commit -m "feat(loja): persistir pre-venda manual do produto"
```

## Task 3: Catalogo Publico com Nova Classificacao

**Files:**
- Modify: `services/api/src/modules/shop/shop-products.service.ts`
- Test: `services/api/src/modules/shop/shop-regressions.spec.ts`

**Step 1: Write the failing tests**

Substitua/ajuste testes antigos que esperam `availableStock = 0 -> PRE_VENDA`.
Adicione:

```ts
it("classifica todas as variantes como pre-venda quando o produto esta marcado", async () => {
  mockDb.query.units.findFirst.mockResolvedValueOnce({ id: "unit-1" });
  mockDb.query.shopSettings.findFirst.mockResolvedValueOnce({ shopEnabled: true });
  mockDb.query.shopProducts.findMany.mockResolvedValueOnce([
    {
      id: "product-pre",
      name: "Moletom lancamento",
      category: "UNIFORME_UNISSEX",
      basePrice: 10000,
      imageUrl: null,
      images: [],
      isPreSale: true,
      variants: [
        { id: "v1", size: "8", sku: "SKU-8", priceOverride: null, inventory: [{ quantity: 3, reservedQuantity: 0 }] },
        { id: "v2", size: "10", sku: "SKU-10", priceOverride: null, inventory: [{ quantity: 0, reservedQuantity: 0 }] },
      ],
    },
  ]);

  const service = new ShopProductsService({} as never);
  const result = await service.getProducts("school-1", "unit-1", { modoVenda: "PRE_VENDA" } as never);

  expect(result[0].variants).toEqual([
    expect.objectContaining({ id: "v1", modoVenda: "PRE_VENDA" }),
    expect.objectContaining({ id: "v2", modoVenda: "PRE_VENDA" }),
  ]);
});

it("mantem produto normal sem estoque como pronta entrega esgotada", async () => {
  mockDb.query.units.findFirst.mockResolvedValueOnce({ id: "unit-1" });
  mockDb.query.shopSettings.findFirst.mockResolvedValueOnce({ shopEnabled: true });
  mockDb.query.shopProducts.findMany.mockResolvedValueOnce([
    {
      id: "product-ready",
      name: "Camiseta",
      category: "UNIFORME_UNISSEX",
      basePrice: 5000,
      imageUrl: null,
      images: [],
      isPreSale: false,
      variants: [
        { id: "v1", size: "8", sku: "SKU-8", priceOverride: null, inventory: [{ quantity: 0, reservedQuantity: 0 }] },
      ],
    },
  ]);

  const service = new ShopProductsService({} as never);
  const ready = await service.getProducts("school-1", "unit-1", { modoVenda: "PRONTA_ENTREGA" } as never);
  const preSale = await service.getProducts("school-1", "unit-1", { modoVenda: "PRE_VENDA" } as never);

  expect(ready[0].variants[0]).toEqual(
    expect.objectContaining({ modoVenda: "PRONTA_ENTREGA", availableStock: 0, isAvailable: false }),
  );
  expect(preSale).toEqual([]);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "classifica|pronta entrega esgotada"
```

Expected: FAIL porque o service ainda usa estoque para pre-venda.

**Step 3: Write minimal implementation**

Troque a regra central por helpers:

```ts
private getModoVenda(product: { isPreSale?: boolean }): ModoVenda {
  return product.isPreSale ? "PRE_VENDA" : "PRONTA_ENTREGA";
}

private productMatchesModoVenda(product: { isPreSale?: boolean }, modoVenda?: ModoVenda) {
  if (!modoVenda) return true;
  return modoVenda === this.getModoVenda(product);
}
```

Em `getProducts`, filtre por `filters.modoVenda` no nivel do produto, nao pelo
estoque da variante. Variantes continuam filtrando por tamanho e `inStock`.

Ao mapear variantes:

```ts
const modoVenda = this.getModoVenda(product);
return {
  ...
  availableStock: Math.max(0, available),
  isAvailable: modoVenda === "PRE_VENDA" ? true : available > 0,
  modoVenda,
};
```

Em `getPublicProductById`, use a mesma regra para todas as variantes.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "classifica|pronta entrega esgotada"
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/shop/shop-products.service.ts services/api/src/modules/shop/shop-regressions.spec.ts
git commit -m "feat(loja): classificar pre-venda por produto"
```

## Task 4: Checkout sem Conversao Automatica por Estoque

**Files:**
- Modify: `services/api/src/modules/shop/shop-orders.service.ts`
- Modify: `apps/loja/app/checkout/page.tsx`
- Test: `services/api/src/modules/shop/shop-regressions.spec.ts`
- Test: `apps/loja/__tests__/checkout-page.test.tsx`

**Step 1: Write the failing tests**

No backend, ajuste testes de pre-venda para exigir produto marcado:

```ts
it("rejeita pedido de pre-venda para produto nao marcado como pre-venda", async () => {
  mockDb.query.shopInventory.findFirst.mockResolvedValue({ quantity: 0, reservedQuantity: 0 });
  mockDb.query.shopProductVariants.findFirst.mockResolvedValueOnce({
    id: "variant-1",
    priceOverride: null,
    size: "8",
    product: { id: "product-1", name: "Camiseta", basePrice: 5000, isPreSale: false },
  });

  const service = new ShopOrdersService({} as never, inventoryService as never);

  await expect(service.createPreSaleOrder({
    schoolId: "school-1",
    unitId: "unit-1",
    customerName: "Maria",
    customerPhone: "11999999999",
    items: [{ variantId: "variant-1", quantity: 1, studentName: "Ana" }],
  } as never)).rejects.toMatchObject({
    response: expect.objectContaining({ code: "PRODUCT_NOT_PRE_SALE" }),
  });
});
```

No frontend, remova a expectativa de conversao automatica:

```ts
it("nao converte pronta entrega sem estoque para pre-venda automaticamente", async () => {
  const source = readFileSync(join(process.cwd(), "app/checkout/page.tsx"), "utf8");

  expect(source).not.toContain("Deseja transformar esse item em pré-venda");
  expect(source).not.toContain("PRE_SALE_STOCK_AVAILABLE");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "produto nao marcado"
pnpm --filter @essencia/loja test -- __tests__/checkout-page.test.tsx -t "converte"
```

Expected: FAIL porque o backend ainda usa estoque e o checkout ainda tem fallback.

**Step 3: Write minimal implementation**

Em `createPreSaleOrder`, substitua a rejeicao `available > 0` por validacao:

```ts
if (!variant.product.isPreSale) {
  throw new BadRequestException({
    code: "PRODUCT_NOT_PRE_SALE",
    message: "Este produto nao esta marcado como pre-venda.",
    details: { variantId: item.variantId },
  });
}
```

Mantenha o fluxo sem reservar nem baixar estoque.

Em `apps/loja/app/checkout/page.tsx`:

- Remova `createProntaEntregaWithFallback`.
- Remova `createPreVendaWithFallback`.
- Chame `createOrder(prontaEntregaItems, "PRONTA_ENTREGA", orderUrl)`.
- Chame `createOrder(preVendaItems, "PRE_VENDA", preVendaUrl)`.
- Para erro de estoque, mostre mensagem pedindo revisar o carrinho.
- Para `PRODUCT_NOT_PRE_SALE`, mostre mensagem informando que o produto nao esta mais em pre-venda.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand -t "pre-venda"
pnpm --filter @essencia/loja test -- __tests__/checkout-page.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/shop/shop-orders.service.ts services/api/src/modules/shop/shop-regressions.spec.ts apps/loja/app/checkout/page.tsx apps/loja/__tests__/checkout-page.test.tsx
git commit -m "fix(loja): revalidar pre-venda manual no checkout"
```

## Task 5: Loja Publica e Cards

**Files:**
- Modify: `apps/loja/components/ProductCard.tsx`
- Modify: `apps/loja/app/[schoolId]/[unitId]/produto/[id]/page.tsx`
- Modify: `apps/loja/app/[schoolId]/[unitId]/catalog-page-content.tsx`
- Test: `apps/loja/__tests__/loja.test.ts`
- Test: `apps/loja/components/__tests__/ProductCardCarousel.test.tsx` or create focused card test if needed

**Step 1: Write the failing tests**

Em `apps/loja/__tests__/loja.test.ts`, atualize a regra antiga:

```ts
it("nao usa estoque zero como criterio automatico de pre-venda", () => {
  const catalogSource = readFileSync(join(process.cwd(), "app/[schoolId]/[unitId]/catalog-page-content.tsx"), "utf8");
  const detailSource = readFileSync(join(process.cwd(), "app/[schoolId]/[unitId]/produto/[id]/page.tsx"), "utf8");
  const cardSource = readFileSync(join(process.cwd(), "components/ProductCard.tsx"), "utf8");

  expect(detailSource).not.toContain("((v.availableStock || 0) > 0 ? 'PRONTA_ENTREGA' : 'PRE_VENDA')");
  expect(detailSource).not.toContain("variant.modoVenda === 'PRE_VENDA' || isOutOfStock");
  expect(cardSource).toContain("!isPreSale && availableStock > 10");
  expect(cardSource).toContain("!isPreSale && availableStock > 0 && availableStock < 5");
  expect(catalogSource).toContain("fetch(buildCatalogUrl('PRE_VENDA'))");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/loja test -- __tests__/loja.test.ts -t "estoque zero"
```

Expected: FAIL porque detalhe/card ainda tratam sem estoque como pre-venda em fallback visual.

**Step 3: Write minimal implementation**

No detalhe do produto, fallback de `modoVenda` deve ser sempre `PRONTA_ENTREGA`
quando a API nao enviar o campo:

```ts
modoVenda: v.modoVenda || "PRONTA_ENTREGA",
```

No seletor de tamanho:

```ts
const isPreSale = variant.modoVenda === "PRE_VENDA";
const isOutOfStock = !isPreSale && variant.available_stock === 0;
```

O botao ja fica desabilitado quando `maxAllowedForStudent === 0`.

No `ProductCard`, esconda alertas de estoque em pre-venda:

```ts
const isLowStock = !isPreSale && availableStock > 0 && availableStock < 5;
...
{!isPreSale && availableStock > 10 && (...)}
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/loja test -- __tests__/loja.test.ts
pnpm --filter @essencia/loja test -- components/__tests__/ProductCardCarousel.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/loja/components/ProductCard.tsx apps/loja/app/[schoolId]/[unitId]/produto/[id]/page.tsx apps/loja/app/[schoolId]/[unitId]/catalog-page-content.tsx apps/loja/__tests__/loja.test.ts apps/loja/components/__tests__/ProductCardCarousel.test.tsx
git commit -m "fix(loja): exibir pre-venda somente por produto marcado"
```

## Task 6: Checkbox no Loja-admin

**Files:**
- Modify: `apps/loja-admin/app/produtos/page.tsx`
- Modify: `apps/loja-admin/app/venda-presencial/page.tsx`
- Modify: `apps/loja-admin/lib/venda-presencial.ts`
- Test: `apps/loja-admin/__tests__/admin.test.ts`
- Test: `apps/loja-admin/__tests__/venda-presencial.test.ts`

**Step 1: Write the failing tests**

Adicione teste source-based para produtos:

```ts
it("formulario de produto controla checkbox de pre-venda", () => {
  const source = readFileSync(join(process.cwd(), "app/produtos/page.tsx"), "utf8");

  expect(source).toContain("isPreSale: false");
  expect(source).toContain("Produto de pré-venda");
  expect(source).toContain("checked={formData.isPreSale}");
  expect(source).toContain("isPreSale: formData.isPreSale");
  expect(source).toContain("product.isPreSale");
});
```

Em `venda-presencial.test.ts`, cubra a exclusao:

```ts
it("nao lista produto de pre-venda na venda presencial", () => {
  const products = [
    { id: "p1", isPreSale: true, variants: [{ id: "v1", availableStock: 10 }] },
    { id: "p2", isPreSale: false, variants: [{ id: "v2", availableStock: 10 }] },
  ] as never;

  expect(getProductsForPresentialSale(products)).toHaveLength(1);
});
```

Se nao existir helper, crie um helper pequeno em `apps/loja-admin/lib/venda-presencial.ts` para evitar regra duplicada na pagina.

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @essencia/loja-admin test -- admin venda-presencial
```

Expected: FAIL porque o checkbox e filtro ainda nao existem.

**Step 3: Write minimal implementation**

Em `Product`, adicione:

```ts
isPreSale: boolean;
```

No `formData`, crie/reset/edite:

```ts
isPreSale: false,
...
isPreSale: product.isPreSale,
```

No payload:

```ts
isPreSale: formData.isPreSale,
```

No formulario, perto de categoria/preco:

```tsx
<label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
  <input
    type="checkbox"
    checked={formData.isPreSale}
    onChange={(event) => setFormData({ ...formData, isPreSale: event.target.checked })}
    className="mt-1 h-4 w-4"
  />
  <span>
    <span className="block text-sm font-semibold text-slate-800">Produto de pré-venda</span>
    <span className="block text-xs text-slate-500">Aparece na categoria Pré-venda e gera reserva sem baixar estoque.</span>
  </span>
</label>
```

Na tabela, mostre badge quando `product.isPreSale`.

Em venda presencial, filtre produtos de pre-venda antes de listar produtos ou
variantes disponiveis.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @essencia/loja-admin test -- admin venda-presencial
pnpm --filter @essencia/loja-admin lint
pnpm --filter @essencia/loja-admin typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/loja-admin/app/produtos/page.tsx apps/loja-admin/app/venda-presencial/page.tsx apps/loja-admin/lib/venda-presencial.ts apps/loja-admin/__tests__/admin.test.ts apps/loja-admin/__tests__/venda-presencial.test.ts
git commit -m "feat(loja-admin): controlar produto de pre-venda"
```

## Task 7: Verificacao Integrada e Deploy

**Files:**
- No code edits unless verification finds a bug.

**Step 1: Run focused tests**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand
pnpm --filter @essencia/loja test -- __tests__/loja.test.ts __tests__/checkout-page.test.tsx __tests__/use-cart.test.tsx
pnpm --filter @essencia/loja-admin test -- admin pedidos-source venda-presencial
```

Expected: PASS.

**Step 2: Run mandatory pipeline**

Run:

```bash
pnpm turbo lint
pnpm turbo typecheck
```

Expected: PASS. Warnings preexistentes sao aceitaveis se os comandos retornarem exit 0.

**Step 3: Build affected apps**

Run:

```bash
pnpm --filter @essencia/api build
pnpm --filter @essencia/loja build
pnpm --filter @essencia/loja-admin build
```

Expected: PASS.

**Step 4: Build Docker images**

Run:

```bash
docker buildx bake -f docker-bake.hcl api loja loja-admin
```

Expected: build das imagens afetadas sem erro.

**Step 5: Apply migration and restart services**

Antes de aplicar em producao, faca backup conforme `AGENTS.md`.

Run:

```bash
docker exec essencia-postgres pg_dump -U essencia -d essencia_db > backup_pre_pre_venda_manual_$(date +%Y%m%d_%H%M%S).sql
./scripts/migrate.sh
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d api loja loja-admin
```

Expected: API, loja e loja-admin sobem healthy.

**Step 6: Smoke tests**

Run:

```bash
curl -fsS https://www.portalcef.com.br/health
curl -I -fsS https://loja.portalcef.com.br/colegio-essencia-feliz/santa-monica/pre-venda
```

Use Playwright para confirmar:

- Produto sem estoque e sem `isPreSale` aparece como Esgotado.
- Produto marcado no admin aparece em Pre-venda.
- Produto marcado no admin gera reserva de pre-venda.

**Step 7: Final commit/push**

Se houver ajustes de verificacao:

```bash
git add <arquivos-da-feature>
git commit -m "fix(loja): ajustar pre-venda manual"
git push origin main
```

Expected: branch `main` atualizada no GitHub.
