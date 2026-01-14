# API Documentation

Documentacao da API REST do Portal Digital Colegio Essencia Feliz.

---

## Informacoes Gerais

### Base URL

| Ambiente        | URL                           |
| --------------- | ----------------------------- |
| Desenvolvimento | http://localhost:3001         |
| Producao        | https://www.portalcef.com.br  |

### Formato de Respostas

**Sucesso:**

```json
{
  "success": true,
  "data": { "...": "..." },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Erro:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descricao do erro",
    "details": { "...": "..." }
  }
}
```

**Observacao importante:** alguns controllers usam Zod `safeParse` e retornam `success: false` sem lancar excecao, o que resulta em **status 200** mesmo para erro de validacao. Os endpoints que lancam `HttpException` seguem status 4xx/5xx normal.

### Headers Padrao

```http
Content-Type: application/json
Accept: application/json
```

### Codigos de Resposta

| Codigo | Significado       | Quando                |
| ------ | ----------------- | --------------------- |
| 200    | OK                | Operacao bem sucedida |
| 201    | Created           | Recurso criado        |
| 204    | No Content        | Delete sem body       |
| 400    | Bad Request       | Validacao falhou      |
| 401    | Unauthorized      | Nao autenticado       |
| 403    | Forbidden         | Sem permissao         |
| 404    | Not Found         | Recurso nao existe    |
| 429    | Too Many Requests | Rate limit excedido   |

---

## Autenticacao

A API usa cookies de sessao com Redis.

### Cookie de Sessao

| Atributo | Valor |
| -------- | ----- |
| Nome     | `cef_session` |
| HttpOnly | `true` |
| Secure   | `true` (producao), `false` (dev) |
| SameSite | `Lax` |
| Path     | `/` |
| Domain   | `COOKIE_DOMAIN` |
| Max-Age  | 86400 (24h) |

### Dados da Sessao

```ts
interface SessionData {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
  createdAt: number;
}
```

### Sliding Window

A sessao e renovada quando o TTL restante fica abaixo de `SESSION_RENEWAL_THRESHOLD` (padrao 0.25).

---

## Rate Limiting

| Endpoint            | Limite           | Janela |
| ------------------- | ---------------- | ------ |
| `/stats/dashboard`  | 5 requests/IP    | 15s    |
| `/shop/orders`      | 5 requests/IP    | 1h     |

---

## Endpoints

### Health

#### GET `/health`

Retorna status da API.

---

### Setup (publico)

#### GET `/setup/status`

Verifica se o sistema foi inicializado.

#### POST `/setup/init`

Bootstrap inicial (escola, unidade, usuario master).

#### POST `/setup/reset`

Reset do sistema (uso em dev).

---

### Auth

#### POST `/auth/login`

Body:

```json
{
  "email": "usuario@essencia.edu.br",
  "password": "senha123"
}
```

#### POST `/auth/logout`

Encerra a sessao atual.

#### GET `/auth/me`

Retorna o usuario autenticado.

---

### Schools

#### GET `/schools`

Acesso: `master`.

#### GET `/schools/:id`

Acesso: `gerente_financeiro`+ (restrito a propria escola).

#### POST `/schools`

Acesso: `master`.

#### PUT `/schools/:id`

Acesso: `master`.

#### DELETE `/schools/:id`

Acesso: `master`.

---

### Units

#### GET `/schools/:schoolId/units`

Acesso: `coordenadora_geral`+ (scope por tenant).

#### GET `/schools/:schoolId/units/:id`

Acesso: `coordenadora_geral`+ (scope por tenant).

#### POST `/schools/:schoolId/units`

Acesso: `diretora_geral`+.

#### PUT `/schools/:schoolId/units/:id`

Acesso: `diretora_geral`+.

#### DELETE `/schools/:schoolId/units/:id`

Acesso: `diretora_geral`+.

---

### Stages (Etapas)

#### GET `/stages`

Lista etapas globais (autenticado).

#### GET `/units/:unitId/stages`

Lista etapas da unidade (TenantGuard).

#### POST `/units/:unitId/stages`

Acesso: `master`.

#### PUT `/units/:unitId/stages`

Acesso: `master`.

#### DELETE `/units/:unitId/stages/:stageId`

Acesso: `master`.

---

### Users

#### GET `/users`

Acesso: `diretora_geral`, `gerente_unidade`, `gerente_financeiro`.

#### GET `/users/:id`

Acesso: `diretora_geral`, `gerente_unidade`, `gerente_financeiro` (com validacoes de tenant/etapa).

#### POST `/users`

Acesso: `diretora_geral`, `gerente_unidade`, `gerente_financeiro`.

#### PUT `/users/:id`

Acesso: `diretora_geral`, `gerente_unidade`, `gerente_financeiro`.

#### DELETE `/users/:id`

Acesso: `diretora_geral`, `gerente_unidade`, `gerente_financeiro`.

---

### Turmas

#### GET `/turmas`

Query: `unitId`, `stageId`, `year`.

#### GET `/turmas/:id`

#### GET `/units/:unitId/turmas`

Query: `year`.

#### POST `/turmas`

Cria turma (retorna 200 com `success: false` em validacao Zod).

#### PUT `/turmas/:id`

Atualiza turma.

#### DELETE `/turmas/:id`

Remove turma.

#### PUT `/turmas/:id/professora`

Atribui professora titular.

#### DELETE `/turmas/:id/professora`

Remove professora titular.

#### GET `/turmas/:id/professoras-disponiveis`

Lista professoras disponiveis para a turma.

---

### Calendar

#### GET `/calendar/events`

Query: `unitId`, `year`, `month`, `eventType`.

#### GET `/calendar/events/:id`

#### POST `/calendar/events`

#### PUT `/calendar/events/:id`

#### DELETE `/calendar/events/:id`

#### GET `/calendar/stats`

Query: `unitId`, `year` (default 2026).

---

### Plannings

#### POST `/plannings/draft`

#### POST `/plannings/submit`

#### GET `/plannings/dashboard`

Query: `stage` ou `segment`.

#### GET `/plannings/segment/:segment`

#### GET `/plannings/turmas`

#### GET `/plannings/quinzenas`

#### GET `/plannings/me`

Query: `quinzena` (opcional).

#### GET `/plannings/me/current`

#### GET `/plannings/me/feedback`

#### GET `/plannings/:id`

#### GET `/plannings/:id/reviews`

#### POST `/plannings/:id/approve`

#### POST `/plannings/:id/request-changes`

Body:

```json
{ "comment": "Solicitar ajustes" }
```

---

### Stats

#### GET `/stats/dashboard`

Rate limit: 5 req/15s por IP.

#### GET `/stats/master-overview`

Acesso: `master`.

---

### Storage

#### POST `/storage/upload`

Upload multipart (requer autenticacao). Endpoint so fica ativo se `MINIO_*` estiver configurado.

---

### Shop (publico)

#### GET `/shop/locations`

#### GET `/shop/catalog/:schoolId/:unitId`

Query: `category`, `size`, `inStock`.

#### GET `/shop/products/:id`

#### POST `/shop/orders`

Rate limit: 5 pedidos/hora por IP.

**Resposta (voucher ativo):**

```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "orderNumber": "123456",
    "totalAmount": 17000,
    "expiresAt": "2026-01-09T15:30:00Z"
  }
}
```

#### GET `/shop/orders/:orderNumber`

Query: `phone` (obrigatorio).

#### POST `/shop/interest`

Registra interesse em produtos sem estoque.

#### POST `/shop/checkout/init`

Cria PaymentIntent (uso futuro). Frontend atual retorna 503 no proxy.

---

### Shop (admin)

Todos os endpoints exigem `AuthGuard -> RolesGuard -> TenantGuard`.

**Roles:** `master`, `diretora_geral`, `gerente_unidade`, `gerente_financeiro`.

#### GET `/shop/admin/dashboard`

#### GET `/shop/admin/products`

#### GET `/shop/admin/products/:id`

#### POST `/shop/admin/products`

#### PATCH `/shop/admin/products/:id`

#### DELETE `/shop/admin/products/:id`

Retorna 204 (sem body).

#### POST `/shop/admin/variants`

#### PATCH `/shop/admin/variants/:id`

#### DELETE `/shop/admin/variants/:id`

Retorna 204 (sem body).

#### GET `/shop/admin/inventory`

#### GET `/shop/admin/inventory/:variantId/:unitId`

#### POST `/shop/admin/inventory/entry`

#### POST `/shop/admin/inventory/adjust`

#### GET `/shop/admin/inventory/ledger/:variantId/:unitId`

#### GET `/shop/admin/orders`

Query: `status`, `orderSource`, `search`, `page`, `limit`.

#### GET `/shop/admin/orders/:id`

#### POST `/shop/admin/orders/presencial`

#### PATCH `/shop/admin/orders/:id/cancel`

#### PATCH `/shop/admin/orders/:id/confirm-payment`

#### PATCH `/shop/admin/orders/:id/pickup`

#### GET `/shop/admin/interest`

Query: `status`, `search`, `page`, `limit`.

#### GET `/shop/admin/interest/summary`

#### PATCH `/shop/admin/interest/:id/contacted`

#### GET `/shop/admin/settings/:unitId`

#### PATCH `/shop/admin/settings/:unitId`

Body:

```json
{
  "maxInstallments": 6,
  "isShopEnabled": true,
  "pickupInstructions": "Retirada na secretaria..."
}
```

---

### Payments

#### POST `/payments/webhook`

Webhook Stripe. Retorna `{ received: true, eventId }` mesmo em erros internos para evitar retry infinito.

---

## Exemplos cURL

### Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@essencia.edu.br","password":"senha123"}' \
  -c cookies.txt
```

### Criar Pedido (voucher)

```bash
curl -X POST http://localhost:3001/shop/orders \
  -H "Content-Type: application/json" \
  -d '{
    "schoolId": "uuid-escola",
    "unitId": "uuid-unidade",
    "customerName": "Joao Silva",
    "customerPhone": "11987654321",
    "items": [{ "variantId": "uuid-variante", "studentName": "Maria", "quantity": 2 }]
  }'
```
