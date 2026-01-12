# Modulo CEF Shop

Modulo de e-commerce para uniformes escolares. Inclui loja publica (`apps/loja`) e painel administrativo (`apps/loja-admin`).

---

## Visao Geral

- **Loja Publica**: catalogo, pedido com voucher e consulta de pedido.
- **Admin**: produtos, variantes, estoque, pedidos, interesse de clientes e configuracoes por unidade.

Arquitetura (resumo):

```
Loja Publica (Next.js) -> /api (proxy) -> API NestJS (/shop)
Admin (Next.js)        -> /api (proxy) -> API NestJS (/shop/admin)

API NestJS
  - ShopModule (produtos, estoque, pedidos, interesse)
  - PaymentsModule (webhook Stripe)

DB (PostgreSQL)
  - shop_* tables
Redis
  - locks de estoque e rate limiting
```

---

## Fluxos Principais

### Pedido (Voucher Presencial)

1. Catalogo publico: `GET /shop/catalog/:schoolId/:unitId`
2. Pedido online: `POST /shop/orders`
3. Estoque reservado (`reservedQuantity`)
4. Voucher gerado com validade de **7 dias** (`expiresAt`)
5. Pagamento presencial confirmado via admin: `PATCH /shop/admin/orders/:id/confirm-payment`
6. Retirada: `PATCH /shop/admin/orders/:id/pickup`

### Lista de Interesse

- Cliente registra interesse em produto sem estoque: `POST /shop/interest`
- Admin acompanha e marca contato: `GET /shop/admin/interest` + `PATCH /shop/admin/interest/:id/contacted`

---

## Endpoints (Resumo)

### Publicos

- `GET /shop/locations`
- `GET /shop/catalog/:schoolId/:unitId`
- `GET /shop/products/:id`
- `POST /shop/orders` (rate limit 5/h por IP)
- `GET /shop/orders/:orderNumber?phone=...`
- `POST /shop/interest`
- `POST /shop/checkout/init` (PaymentIntent, uso futuro)

### Administrativos

- `GET /shop/admin/dashboard`
- `GET /shop/admin/products`
- `GET /shop/admin/products/:id`
- `POST /shop/admin/products`
- `PATCH /shop/admin/products/:id`
- `DELETE /shop/admin/products/:id`
- `POST /shop/admin/variants`
- `PATCH /shop/admin/variants/:id`
- `DELETE /shop/admin/variants/:id`
- `GET /shop/admin/inventory`
- `GET /shop/admin/inventory/:variantId/:unitId`
- `POST /shop/admin/inventory/entry`
- `POST /shop/admin/inventory/adjust`
- `GET /shop/admin/inventory/ledger/:variantId/:unitId`
- `GET /shop/admin/orders`
- `GET /shop/admin/orders/:id`
- `POST /shop/admin/orders/presencial`
- `PATCH /shop/admin/orders/:id/cancel`
- `PATCH /shop/admin/orders/:id/confirm-payment`
- `PATCH /shop/admin/orders/:id/pickup`
- `GET /shop/admin/interest`
- `GET /shop/admin/interest/summary`
- `PATCH /shop/admin/interest/:id/contacted`
- `GET /shop/admin/settings/:unitId`
- `PATCH /shop/admin/settings/:unitId`

Para detalhes de payloads e respostas: `docs/API.md`.

---

## Modelo de Dados (Resumo)

Tabelas principais:

- `shop_products` (produtos por escola)
- `shop_product_images` (carrossel de imagens)
- `shop_product_variants` (tamanhos/variantes)
- `shop_inventory` (estoque por unidade, com reserva)
- `shop_inventory_ledger` (auditoria de estoque)
- `shop_orders` e `shop_order_items`
- `shop_interest_requests` e `shop_interest_items`
- `shop_settings` (configuracoes por unidade)

Relacoes:
- Produto -> Variantes -> Inventario por unidade
- Pedido -> Itens -> Variantes
- Interesse -> Itens -> Variantes

---

## Estoque e Reservas

- Estoque disponivel = `quantity - reservedQuantity`.
- Reservas usam lock Redis para evitar race conditions.
- Venda presencial reduz `quantity` direto (sem reserva).

---

## Pagamentos (Status Atual)

- O fluxo principal esta em **voucher presencial**.
- A criacao de `PaymentIntent` em `POST /shop/orders` esta **desabilitada** no backend.
- Existe endpoint `POST /shop/checkout/init` e webhook `POST /payments/webhook` para futura reintegracao com Stripe.

---

## Configuracao

Variaveis relevantes:

```bash
# API proxy
API_INTERNAL_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# Storage (imagens)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=essencia-uploads

# Stripe (opcional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Nota:** o endpoint `/storage/upload` so existe se `MINIO_*` estiver configurado.

---

## Apps

- `apps/loja`: storefront publico.
- `apps/loja-admin`: painel administrativo.
- Ambos usam route handlers (`/app/api/...`) como proxy para a API.

---

## Limitacoes Conhecidas

- `POST /shop/checkout/init` esta desabilitado no proxy do frontend (retorna 503).
- A confirmacao de pagamento e feita manualmente via admin (voucher).
