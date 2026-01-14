# Security Documentation

Politicas e praticas de seguranca do Portal Digital Colegio Essencia Feliz.

---

## Autenticacao e Sessao

### Sessoes

- Armazenadas em Redis.
- Sliding window com renovacao automatica.

### Cookie de Sessao

```
Nome: cef_session
HttpOnly: true
Secure: true (producao) | false (dev)
SameSite: Lax
Path: /
Domain: COOKIE_DOMAIN
Max-Age: 86400 (24h)
```

### Assinatura de Cookies

O Fastify cookie plugin usa `COOKIE_SECRET` para assinar cookies.

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

---

## RBAC (Role-Based Access Control)

### Hierarquia

| Role                       | Nivel | Escopo  |
| -------------------------- | ----- | ------- |
| `master`                   | 0     | Global  |
| `diretora_geral`           | 1     | Escola  |
| `gerente_unidade`          | 2     | Unidade |
| `gerente_financeiro`       | 3     | Unidade |
| `coordenadora_geral`       | 4     | Unidade |
| `coordenadora_bercario`    | 5     | Unidade |
| `coordenadora_infantil`    | 6     | Unidade |
| `coordenadora_fundamental_i` | 7   | Unidade |
| `coordenadora_fundamental_ii` | 8  | Unidade |
| `coordenadora_medio`       | 9     | Unidade |
| `analista_pedagogico`      | 10    | Unidade |
| `professora`               | 11    | Unidade |
| `auxiliar_administrativo`  | 12    | Unidade |
| `auxiliar_sala`            | 13    | Unidade |

### Cadeia de Guards

```
Request -> AuthGuard -> RolesGuard -> TenantGuard -> Controller
```

### TenantGuard (escopo)

- `master`: acesso global.
- `diretora_geral`: toda a escola.
- **Acesso total na unidade**: `gerente_unidade`, `gerente_financeiro`, `coordenadora_geral`, `analista_pedagogico`.
- **Roles por etapa**: `coordenadora_*`, `professora`, `auxiliar_sala` restringidas por `stageId`.

**Regra de ouro:** identidade do tenant vem sempre da sessao (nunca do payload).

---

## Multi-Tenancy

```
Escola -> Unidade -> Usuarios -> Recursos
```

- `schoolId`, `unitId`, `stageId` sempre obtidos da sessao.
- Payload pode filtrar, mas nao define identidade.

---

## Validacao de Entrada

### Frontend

- Zod schemas nos formularios.

### Backend

- DTO + class-validator.
- Alguns endpoints usam Zod `safeParse` e retornam `success: false` sem lançar excecao.

### Database

- Drizzle ORM usa prepared statements.
- Nunca interpolar SQL manualmente.

---

## Rate Limiting

| Endpoint           | Limite       | Janela |
| ------------------ | ------------ | ------ |
| `/stats/dashboard` | 5 requests/IP | 15s    |
| `/shop/orders`     | 5 pedidos/IP | 1h     |

---

## CORS

Config atual em `services/api/src/main.ts`:

```ts
origin: [
  "http://localhost:3000", // home
  "http://localhost:3003", // login
  "http://localhost:3004", // usuarios
  "http://localhost:3005", // escolas
  "http://localhost:3006", // turmas
  "http://localhost:3007"  // planejamento
]
```

> **⚠️ PENDÊNCIA CONHECIDA**: O código atual **não inclui** as origens dos apps:
> - `calendario` (porta 3008)
> - `loja` (porta 3010)
> - `loja-admin` (porta 3011)
>
> Esses apps terão erros de CORS até que `services/api/src/main.ts` seja atualizado para incluir essas origens.

**CORS completo recomendado:**

```ts
origin: [
  "http://localhost:3000",  // home
  "http://localhost:3003",  // login
  "http://localhost:3004",  // usuarios
  "http://localhost:3005",  // escolas
  "http://localhost:3006",  // turmas
  "http://localhost:3007",  // planejamento
  "http://localhost:3008",  // calendario
  "http://localhost:3010",  // loja
  "http://localhost:3011"   // loja-admin
]
```

---

## Storage Upload

- Endpoint: `POST /storage/upload`.
- Requer autenticacao.
- So fica ativo se `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` estiverem configurados.

---

## Shop (Loja)

### Endpoints publicos

- `GET /shop/catalog/:schoolId/:unitId`
- `GET /shop/orders/:orderNumber` (requer `phone` para validacao)
- `POST /shop/orders` (rate limit)
- `POST /shop/interest`

### Endpoints administrativos

Todos usam `AuthGuard -> RolesGuard -> TenantGuard`.

### Isolamento de Estoque

- Estoque e isolado por `(variant_id, unit_id)`.
- Reservas e vendas ajustam `quantity` e `reservedQuantity`.

Exemplo (conceitual):

```ts
const available = inventory.quantity - inventory.reservedQuantity;
if (available < quantity) throw new BadRequestException('Estoque insuficiente');
```

---

## Stripe Webhooks

- Endpoint: `POST /payments/webhook`.
- Validacao obrigatoria da assinatura (`stripe-signature`).
- Usa `STRIPE_WEBHOOK_SECRET`.

---

## Logs e Auditoria

- Nunca logar cookies/tokens/senhas.
- Usar hash truncado para identificar sessoes.

```ts
const safeHash = createHash("sha256").update(token).digest("hex").slice(0, 10);
```

---

## Checklist de Seguranca (Producao)

- [ ] `COOKIE_SECRET` forte configurado.
- [ ] `DATABASE_URL` seguro.
- [ ] HTTPS via reverse proxy.
- [ ] CORS ajustado para todas as origens usadas.
- [ ] Backups e monitoramento habilitados.
