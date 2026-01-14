# Módulo de Loja (CEF Shop)

Documentação completa do módulo de e-commerce do Portal Essência Feliz.

---

## Visão Geral

O **CEF Shop** é um sistema de loja online para venda de uniformes escolares e acessórios. O módulo permite que pais/responsáveis façam pedidos online e paguem presencialmente na escola, gerando um **voucher** para retirada.

### Características Principais

- **Catálogo Público**: Produtos organizados por categoria, tamanho e disponibilidade
- **Pedidos com Voucher**: Sistema de voucher presencial (sem pagamento online)
- **Gestão de Estoque**: Controle de estoque por unidade + variante (tamanho)
- **Multi-Tenant**: Isolamento de produtos, estoque e pedidos por escola/unidade
- **Lista de Interesse**: Registro de interesse em produtos sem estoque
- **Administração**: Dashboard completo para gerentes administrarem produtos, estoque e pedidos
- **Integração Stripe**: Preparado para futura implementação de pagamento online

---

## Arquitetura

### Estrutura de Apps

```
apps/
├── loja/               :3010  # Frontend público (catálogo + checkout)
│   ├── app/
│   │   ├── page.tsx                    # Landing page
│   │   ├── [schoolCode]/               # Escola selecionada
│   │   │   ├── [unitCode]/             # Unidade selecionada
│   │   │   │   ├── page.tsx            # Catálogo de produtos
│   │   │   │   ├── produto/[id]/       # Detalhe do produto
│   │   │   │   └── checkout/           # Finalização de pedido
│   │   │   └── pedido/[orderNumber]/   # Visualizar pedido
│   ├── components/
│   └── lib/
│
└── loja-admin/         :3011  # Frontend administrativo
    ├── app/
    │   ├── page.tsx                    # Dashboard
    │   ├── produtos/                   # CRUD de produtos
    │   ├── estoque/                    # Gestão de estoque
    │   ├── pedidos/                    # Gestão de pedidos
    │   ├── interesse/                  # Lista de interesse
    │   └── configuracoes/              # Configurações da loja
    └── components/
```

### Módulos da API

```
services/api/src/modules/shop/
├── shop.module.ts                   # Módulo principal
├── shop.controller.ts               # Endpoints públicos
├── shop-admin.controller.ts         # Endpoints administrativos
├── shop-products.service.ts         # Lógica de produtos
├── shop-inventory.service.ts        # Lógica de estoque
├── shop-orders.service.ts           # Lógica de pedidos
├── shop-interest.service.ts         # Lógica de lista de interesse
├── shop-settings.service.ts         # Configurações por unidade
└── dto/                             # DTOs de validação
```

---

## Modelo de Dados

### Diagrama ER

```
┌─────────────────┐
│  shop_products  │──┬──┐
│  (schoolId)     │  │  │
└─────────────────┘  │  │
         │           │  │
         │ 1:N       │  │
         │           │  │
         ▼           │  │
┌──────────────────────┐│
│ shop_product_variants││
│ (size, sku, price)   ││
└──────────────────────┘│
         │              │
         │ 1:N          │ 1:N
         │              │
         ▼              ▼
┌──────────────────┐  ┌────────────────────┐
│ shop_inventory   │  │ shop_product_images│
│ (unitId, qty)    │  │ (url, order)       │
└──────────────────┘  └────────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────┐
│ shop_inventory_ledger│
│ (audit trail)        │
└──────────────────────┘

┌─────────────────┐
│  shop_orders    │
│ (voucher)       │
└─────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐
│ shop_order_items │
│ (variantId, qty) │
└──────────────────┘

┌───────────────────────┐
│ shop_interest_requests│
└───────────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐
│shop_interest_items│
└──────────────────┘
```

### Tabelas Principais

#### shop_products

| Campo        | Tipo    | Descrição                                   |
| ------------ | ------- | ------------------------------------------- |
| `id`         | uuid    | PK                                          |
| `school_id`  | uuid    | FK → schools.id (multi-tenant)              |
| `name`       | text    | Nome do produto                             |
| `description`| text    | Descrição                                   |
| `image_url`  | text    | URL da imagem principal                     |
| `base_price` | integer | Preço base em centavos                      |
| `category`   | enum    | UNIFORME_DIARIO, UNIFORME_EDUCACAO_FISICA, ACESSORIO |
| `is_active`  | boolean | Produto ativo?                              |

#### shop_product_variants

| Campo           | Tipo    | Descrição                              |
| --------------- | ------- | -------------------------------------- |
| `id`            | uuid    | PK                                     |
| `product_id`    | uuid    | FK → shop_products.id                  |
| `size`          | text    | Tamanho (P, M, G, GG, 2, 4, 6, etc.)   |
| `sku`           | text    | Código SKU único                       |
| `price_override`| integer | Sobrescreve base_price (nullable)      |
| `is_active`     | boolean | Variante ativa?                        |

#### shop_inventory

| Campo               | Tipo    | Descrição                              |
| ------------------- | ------- | -------------------------------------- |
| `id`                | uuid    | PK                                     |
| `variant_id`        | uuid    | FK → shop_product_variants.id          |
| `unit_id`           | uuid    | FK → units.id (multi-tenant)           |
| `quantity`          | integer | Quantidade disponível                  |
| `reserved_quantity` | integer | Quantidade reservada (pedidos aguardando) |
| `low_stock_threshold`| integer| Alerta de estoque baixo                |

**Estoque Disponível:**

```typescript
const disponivel = inventory.quantity - inventory.reserved_quantity;
```

#### shop_orders

| Campo                      | Tipo    | Descrição                              |
| -------------------------- | ------- | -------------------------------------- |
| `id`                       | uuid    | PK                                     |
| `school_id`                | uuid    | FK → schools.id                        |
| `unit_id`                  | uuid    | FK → units.id                          |
| `order_number`             | text    | Número do pedido (6 dígitos)           |
| `status`                   | enum    | AGUARDANDO_PAGAMENTO, PAGO, RETIRADO, CANCELADO, EXPIRADO |
| `order_source`             | enum    | ONLINE, PRESENCIAL                     |
| `customer_name`            | text    | Nome do responsável                    |
| `customer_phone`           | text    | Telefone                               |
| `customer_email`           | text    | Email (opcional)                       |
| `total_amount`             | integer | Total em centavos                      |
| `installments`             | integer | Número de parcelas (presencial)        |
| `payment_method`           | enum    | PIX, CARTAO_CREDITO, CARTAO_DEBITO, DINHEIRO |
| `stripe_payment_intent_id` | text    | ID do PaymentIntent (futuro)           |
| `expires_at`               | timestamp | Expiração do voucher (7 dias)        |
| `paid_at`                  | timestamp | Data do pagamento                    |
| `picked_up_at`             | timestamp | Data da retirada                     |
| `cancelled_at`             | timestamp | Data do cancelamento                 |

#### shop_settings

| Campo               | Tipo    | Descrição                              |
| ------------------- | ------- | -------------------------------------- |
| `id`                | uuid    | PK                                     |
| `unit_id`           | uuid    | FK → units.id (unique)                 |
| `max_installments`  | integer | Máximo de parcelas permitidas (padrão: 6) |
| `is_shop_enabled`   | boolean | Loja habilitada para esta unidade?     |
| `pickup_instructions`| text   | Instruções de retirada                 |

---

## Fluxos de Operação

### 1. Fluxo de Pedido Online (Voucher)

```
┌───────────────┐
│   Cliente     │
└───────┬───────┘
        │
        │ 1. Acessa catálogo
        ▼
┌─────────────────────────────────────────┐
│ GET /shop/catalog/:schoolId/:unitId     │
│ Retorna produtos com estoque disponível │
└─────────────────────────────────────────┘
        │
        │ 2. Adiciona itens ao carrinho
        │    (frontend - localStorage)
        │
        ▼
┌─────────────────────────────────────────┐
│ POST /shop/orders                       │
│ Body:                                   │
│   - schoolId, unitId                    │
│   - customerName, customerPhone         │
│   - items: [{ variantId, studentName, quantity }] │
│                                         │
│ Validações:                             │
│   - Estoque disponível                  │
│   - Rate limit (5 pedidos/hora por IP) │
│                                         │
│ Operações:                              │
│   - Reserva estoque (reserved_quantity++)│
│   - Gera orderNumber (6 dígitos)        │
│   - Define expiresAt (now + 7 dias)     │
│   - Status: AGUARDANDO_PAGAMENTO        │
│   - Registra ledger (VENDA_ONLINE)      │
└─────────────────────────────────────────┘
        │
        │ 3. Retorna voucher
        ▼
┌─────────────────────────────────────────┐
│ Response:                               │
│ {                                       │
│   "orderId": "uuid",                    │
│   "orderNumber": "123456",              │
│   "totalAmount": 17000,                 │
│   "expiresAt": "2026-01-21T10:00:00Z"   │
│ }                                       │
└─────────────────────────────────────────┘
        │
        │ 4. Cliente anota orderNumber
        │    e vai à escola com telefone
        │
        ▼
┌─────────────────────────────────────────┐
│ Escola/Secretaria                       │
│ (App Admin - loja-admin)                │
│                                         │
│ 5. Busca pedido:                        │
│    GET /shop/admin/orders?search=123456 │
│                                         │
│ 6. Confirma pagamento presencial:       │
│    PATCH /shop/admin/orders/:id/confirm-payment │
│    Body: { paymentMethod, installments }│
│                                         │
│ Operações:                              │
│   - Converte reserva em venda           │
│   - Status: PAGO                        │
│   - paidAt = now()                      │
│   - Atualiza ledger                     │
└─────────────────────────────────────────┘
        │
        │ 7. Cliente retira uniformes
        ▼
┌─────────────────────────────────────────┐
│ PATCH /shop/admin/orders/:id/pickup     │
│                                         │
│ Operações:                              │
│   - Status: RETIRADO                    │
│   - pickedUpAt = now()                  │
└─────────────────────────────────────────┘
```

### 2. Fluxo de Pedido Presencial

```
┌─────────────────────────────────────────┐
│ Escola/Secretaria                       │
│ (App Admin - loja-admin)                │
│                                         │
│ 1. Cria pedido presencial:              │
│    POST /shop/admin/orders/presencial   │
│    Body:                                │
│      - unitId                           │
│      - customerName, customerPhone      │
│      - items: [{ variantId, studentName, quantity }] │
│      - paymentMethod                    │
│      - installments                     │
│                                         │
│ Operações:                              │
│   - Desconta estoque imediatamente      │
│   - Status: PAGO                        │
│   - orderSource: PRESENCIAL             │
│   - paidAt = now()                      │
│   - Registra ledger (VENDA_PRESENCIAL)  │
└─────────────────────────────────────────┘
        │
        │ 2. Cliente retira no mesmo momento
        ▼
┌─────────────────────────────────────────┐
│ PATCH /shop/admin/orders/:id/pickup     │
│                                         │
│ Operações:                              │
│   - Status: RETIRADO                    │
│   - pickedUpAt = now()                  │
└─────────────────────────────────────────┘
```

### 3. Expiração de Vouchers

```
┌─────────────────────────────────────────┐
│ Cron Job (Futuro)                       │
│ Executa a cada 1 hora                   │
│                                         │
│ SELECT * FROM shop_orders               │
│ WHERE status = 'AGUARDANDO_PAGAMENTO'   │
│   AND expires_at < NOW()                │
│                                         │
│ Para cada pedido expirado:              │
│   - Status: EXPIRADO                    │
│   - Libera estoque (reserved_quantity--)│
│   - Registra ledger (LIBERACAO)         │
└─────────────────────────────────────────┘
```

### 4. Gestão de Estoque

```
┌─────────────────────────────────────────┐
│ Entrada de Estoque                      │
│ POST /shop/admin/inventory/entry        │
│                                         │
│ Body:                                   │
│   - variantId                           │
│   - unitId                              │
│   - quantity (positivo)                 │
│   - notes (opcional)                    │
│                                         │
│ Operações:                              │
│   - inventory.quantity += quantity      │
│   - Registra ledger (ENTRADA)           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Ajuste de Estoque                       │
│ POST /shop/admin/inventory/adjust       │
│                                         │
│ Body:                                   │
│   - variantId                           │
│   - unitId                              │
│   - quantityChange (positivo ou negativo)│
│   - reason                              │
│                                         │
│ Operações:                              │
│   - inventory.quantity += quantityChange│
│   - Registra ledger (AJUSTE)            │
└─────────────────────────────────────────┘
```

### 5. Lista de Interesse

```
┌─────────────────────────────────────────┐
│ Cliente                                 │
│                                         │
│ 1. Produto sem estoque                  │
│    POST /shop/interest                  │
│    Body:                                │
│      - schoolId, unitId                 │
│      - customerName, customerPhone      │
│      - studentName, studentGrade        │
│      - items: [{ variantId, quantity }] │
│                                         │
│ Operações:                              │
│   - Cria shop_interest_requests         │
│   - Cria shop_interest_items            │
└─────────────────────────────────────────┘
        │
        │ 2. Escola recebe notificação
        │    (lista no admin)
        ▼
┌─────────────────────────────────────────┐
│ Escola                                  │
│ GET /shop/admin/interest                │
│                                         │
│ Visualiza lista de interessados         │
│ Ordena por variante para compra         │
│                                         │
│ 3. Marca como contatado:                │
│    PATCH /shop/admin/interest/:id/contacted │
└─────────────────────────────────────────┘
```

---

## Endpoints da API

### Públicos (sem autenticação)

| Método | Endpoint                               | Descrição                              |
| ------ | -------------------------------------- | -------------------------------------- |
| GET    | `/shop/locations`                      | Lista escolas e unidades               |
| GET    | `/shop/catalog/:schoolId/:unitId`      | Catálogo de produtos com estoque       |
| GET    | `/shop/products/:id`                   | Detalhe de um produto                  |
| POST   | `/shop/orders`                         | Criar pedido (voucher) - Rate limited  |
| GET    | `/shop/orders/:orderNumber?phone=XXX`  | Visualizar pedido (requer telefone)    |
| POST   | `/shop/interest`                       | Registrar interesse                    |
| POST   | `/shop/checkout/init` (futuro)         | Iniciar checkout Stripe                |

### Administrativos (requer Auth + RBAC + Tenant)

**Roles permitidas:** `master`, `diretora_geral`, `gerente_unidade`, `gerente_financeiro`

#### Dashboard & Produtos

| Método | Endpoint                        | Descrição                              |
| ------ | ------------------------------- | -------------------------------------- |
| GET    | `/shop/admin/dashboard`         | Métricas e estatísticas                |
| GET    | `/shop/admin/products`          | Lista produtos                         |
| GET    | `/shop/admin/products/:id`      | Detalhe de produto                     |
| POST   | `/shop/admin/products`          | Criar produto                          |
| PATCH  | `/shop/admin/products/:id`      | Atualizar produto                      |
| DELETE | `/shop/admin/products/:id`      | Remover produto (204 No Content)       |

#### Variantes

| Método | Endpoint                        | Descrição                              |
| ------ | ------------------------------- | -------------------------------------- |
| POST   | `/shop/admin/variants`          | Criar variante (tamanho)               |
| PATCH  | `/shop/admin/variants/:id`      | Atualizar variante                     |
| DELETE | `/shop/admin/variants/:id`      | Remover variante (204 No Content)      |

#### Estoque

| Método | Endpoint                                      | Descrição                              |
| ------ | --------------------------------------------- | -------------------------------------- |
| GET    | `/shop/admin/inventory`                       | Lista estoque (todas variantes)        |
| GET    | `/shop/admin/inventory/:variantId/:unitId`    | Estoque de variante específica         |
| POST   | `/shop/admin/inventory/entry`                 | Entrada de estoque                     |
| POST   | `/shop/admin/inventory/adjust`                | Ajuste de estoque (+ ou -)             |
| GET    | `/shop/admin/inventory/ledger/:variantId/:unitId` | Histórico de movimentações (audit trail) |

#### Pedidos

| Método | Endpoint                                      | Descrição                              |
| ------ | --------------------------------------------- | -------------------------------------- |
| GET    | `/shop/admin/orders`                          | Lista pedidos (com filtros)            |
| GET    | `/shop/admin/orders/:id`                      | Detalhe de pedido                      |
| POST   | `/shop/admin/orders/presencial`               | Criar pedido presencial                |
| PATCH  | `/shop/admin/orders/:id/cancel`               | Cancelar pedido                        |
| PATCH  | `/shop/admin/orders/:id/confirm-payment`      | Confirmar pagamento presencial         |
| PATCH  | `/shop/admin/orders/:id/pickup`               | Marcar como retirado                   |

**Query params para `GET /shop/admin/orders`:**

- `status`: AGUARDANDO_PAGAMENTO, PAGO, RETIRADO, CANCELADO, EXPIRADO
- `orderSource`: ONLINE, PRESENCIAL
- `search`: busca por orderNumber ou customerName
- `page`, `limit`: paginação

#### Lista de Interesse

| Método | Endpoint                                  | Descrição                              |
| ------ | ----------------------------------------- | -------------------------------------- |
| GET    | `/shop/admin/interest`                    | Lista de interessados                  |
| GET    | `/shop/admin/interest/summary`            | Resumo por variante                    |
| PATCH  | `/shop/admin/interest/:id/contacted`      | Marcar como contatado                  |

#### Configurações

| Método | Endpoint                                  | Descrição                              |
| ------ | ----------------------------------------- | -------------------------------------- |
| GET    | `/shop/admin/settings/:unitId`            | Configurações da unidade               |
| PATCH  | `/shop/admin/settings/:unitId`            | Atualizar configurações                |

---

## Isolamento Multi-Tenant

### Produtos

- `shop_products.school_id` → Um produto pertence a uma escola
- Admin pode criar produtos apenas para sua escola (ou global se `master`)

### Estoque

- `shop_inventory.unit_id` → Estoque é isolado por unidade
- Cada unidade tem seu próprio estoque independente

### Pedidos

- `shop_orders.school_id` + `shop_orders.unit_id` → Pedidos isolados por unidade
- Admin vê apenas pedidos de sua unidade (ou escola inteira se `diretora_geral`)

### TenantGuard

```typescript
// Exemplo de validação
if (order.unitId !== session.unitId && session.role !== 'diretora_geral') {
  throw new ForbiddenException('Acesso negado: pedido de outra unidade');
}
```

---

## Integração Stripe (Futuro)

### Preparação no Código

O sistema já possui:

- Campo `stripe_payment_intent_id` em `shop_orders`
- Endpoint `/shop/checkout/init` (retorna 503 no frontend atual)
- Webhook `/payments/webhook` para eventos Stripe

### Fluxo Proposto

```
1. Cliente preenche carrinho
   ↓
2. POST /shop/checkout/init
   → Cria PaymentIntent no Stripe
   → Retorna clientSecret
   ↓
3. Frontend renderiza Stripe Elements
   → Cliente paga com cartão
   ↓
4. Webhook Stripe: payment_intent.succeeded
   → PATCH /shop/admin/orders/:id/confirm-payment
   → Status: PAGO
   ↓
5. Cliente retira na escola
```

### Variáveis de Ambiente

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## Dashboard Admin

### Métricas Disponíveis

```
GET /shop/admin/dashboard

Response:
{
  "totalOrders": 150,
  "totalRevenue": 255000,  // em centavos
  "pendingOrders": 12,
  "lowStockProducts": [
    { "name": "Camisa G", "quantity": 3, "threshold": 10 }
  ],
  "topProducts": [
    { "name": "Camisa M", "sales": 45 }
  ]
}
```

---

## Segurança

### Rate Limiting

- `POST /shop/orders`: 5 pedidos por hora por IP
- Previne spam e abuso

### Validação de Telefone

- `GET /shop/orders/:orderNumber?phone=XXX` requer telefone correto
- Previne acesso não autorizado ao voucher

### RBAC

- Endpoints admin requerem roles específicas
- TenantGuard garante isolamento de dados

### Input Validation

- DTOs com class-validator
- Zod schemas no frontend

---

## Monitoramento

### Alertas Recomendados

- **Estoque Baixo**: `quantity - reserved_quantity < low_stock_threshold`
- **Pedidos Expirando**: `expires_at - NOW() < 24 horas`
- **Pedidos Aguardando**: `status = AGUARDANDO_PAGAMENTO` por mais de 3 dias

### Métricas de Negócio

- Taxa de conversão (pedidos criados vs. pagos)
- Tempo médio de pagamento (created_at → paid_at)
- Tempo médio de retirada (paid_at → picked_up_at)
- Produtos mais vendidos

---

## Próximos Passos

### Implementação Futura

- [ ] Integração completa com Stripe (pagamento online)
- [ ] Notificações automáticas (SMS/Email) para vouchers
- [ ] Cron job para expiração automática de vouchers
- [ ] Sistema de cupons/descontos
- [ ] Relatórios avançados (Excel/PDF)
- [ ] App mobile para cliente
- [ ] Integração com sistema de nota fiscal
- [ ] Chat para suporte ao cliente

---

## Referências

- [Stripe Documentation](https://stripe.com/docs)
- [Drizzle ORM Relations](https://orm.drizzle.team/docs/relations)
- [NestJS Guards](https://docs.nestjs.com/guards)
- [Next.js E-commerce Example](https://vercel.com/templates/next.js/nextjs-commerce)
