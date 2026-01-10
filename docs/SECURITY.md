# Security Documentation

Politicas e praticas de seguranca do Portal Digital Colegio Essencia Feliz.

---

## Autenticacao

### Sessoes

O sistema utiliza sessoes armazenadas em Redis com cookies HttpOnly.

| Configuracao | Valor                          |
| ------------ | ------------------------------ |
| Storage      | Redis                          |
| TTL          | 24 horas                       |
| Renovacao    | Sliding window (25%)           |
| Cookie       | HttpOnly, Secure, SameSite=Lax |

### Cookie de Sessao

```
Nome: cef_session
HttpOnly: true
Secure: true (producao)
SameSite: Lax
Path: /
Max-Age: 86400 (24 horas)
```

### Sliding Window

A sessao e renovada automaticamente quando o TTL restante e menor que 25%:

- TTL total: 24 horas
- Threshold: 25% = 6 horas
- Quando TTL < 6 horas, renova para 24 horas

### Senhas

| Configuracao | Valor        |
| ------------ | ------------ |
| Algoritmo    | bcrypt       |
| Salt Rounds  | 12           |
| Minimo       | 8 caracteres |

---

## RBAC (Role-Based Access Control)

### Hierarquia de Roles

O sistema implementa hierarquia de roles onde roles superiores herdam permissoes de roles inferiores.

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

### Guards

O sistema utiliza tres guards encadeados:

```
Request → AuthGuard → RolesGuard → TenantGuard → Controller
```

#### AuthGuard

- Valida cookie de sessao
- Busca sessao no Redis
- Anexa dados do usuario ao request
- Retorna 401 se nao autenticado

#### RolesGuard

- Verifica se usuario tem role permitida
- Aplica hierarquia (role superior acessa role inferior)
- Retorna 403 se sem permissao

#### TenantGuard

- Valida escopo de acesso
- master: acesso global
- diretora_geral: acesso escola
- roles de etapa: acesso unidade + etapa
- outros: acesso unidade
- Retorna 403 se fora do escopo

---

## Multi-Tenancy

### Estrutura

```
Escola (tenant raiz)
  └── Unidades (sub-tenants)
        └── Usuarios (stage_id opcional)
              └── Recursos (planejamentos, etc.)

Etapas (education_stages) = tabela de referencia global
```

### Isolamento

| Role             | Escopo de Acesso               |
| ---------------- | ------------------------------ |
| `master`         | Todas as escolas               |
| `diretora_geral` | Toda a escola (todas unidades) |
| Roles de etapa   | Unidade + sua etapa            |
| Demais roles     | Apenas sua unidade             |

### Implementacao

```typescript
// TenantGuard
if (user.role === "master") {
  return true; // Acesso global
}

if (resourceSchoolId !== user.schoolId) {
  throw new ForbiddenException("Escola diferente");
}

if (user.role === "diretora_geral") {
  return true; // Acesso escola
}

if (resourceUnitId !== user.unitId) {
  throw new ForbiddenException("Unidade diferente");
}

if (resourceStageId && user.stageId && resourceStageId !== user.stageId) {
  throw new ForbiddenException("Etapa diferente");
}
```

### Dados da Sessao

```typescript
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

## Validacao de Entrada

### Frontend

Validacao com Zod schemas em todos os formularios:

```typescript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

### Backend

Validacao com DTOs e class-validator/Zod:

```typescript
const result = createUserSchema.safeParse(body);
if (!result.success) {
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Dados invalidos",
      details: result.error.flatten(),
    },
  };
}
```

### Database

- Prepared statements via Drizzle ORM
- Nunca interpolar SQL manualmente

---

## Rate Limiting

| Endpoint           | Limite     | Janela      |
| ------------------ | ---------- | ----------- |
| `/stats/dashboard` | 5 requests | 15 segundos |

### Implementacao

```typescript
async rateLimit(key: string, windowSeconds: number, limit: number) {
  const count = await this.redis.incr(key);
  if (count === 1) {
    await this.redis.expire(key, windowSeconds);
  }
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
```

---

## Headers de Seguranca

Recomendados para producao (via Traefik ou Next.js):

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

---

## CORS

### Configuracao

```typescript
app.enableCors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3003",
    "http://localhost:3004",
  ],
  credentials: true,
});
```

### Producao

Restringir origins para dominios especificos:

```typescript
origin: [
  "https://essencia.edu.br",
  "https://login.essencia.edu.br",
  "https://app.essencia.edu.br",
],
```

---

## Logs e Auditoria

### Boas Praticas

- Nunca logar senhas, tokens ou cookies
- Usar hash truncado para identificar sessoes

```typescript
const safeHash = createHash("sha256").update(token).digest("hex").slice(0, 10);
console.log(`Session renewed: ${safeHash}`);
```

### Logs Estruturados

Em producao, usar logs JSON:

```json
{
  "level": "info",
  "message": "User logged in",
  "userId": "uuid",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

## Infraestrutura

### Firewall (Producao)

```bash
# Portas permitidas
22  - SSH (restrito a IPs especificos)
80  - HTTP (redirect para HTTPS)
443 - HTTPS
```

### SSH

- Autenticacao por chave (obrigatorio)
- Desabilitar autenticacao por senha
- Fail2Ban ativo

### Docker

- Nao executar containers como root
- Usar images oficiais
- Atualizar regularmente

---

## Checklist de Seguranca

### Desenvolvimento

- [ ] Validacao de inputs em todos os formularios
- [ ] Guards aplicados em todas as rotas protegidas
- [ ] Testes de autenticacao (401) e autorizacao (403)
- [ ] Sem dados sensiveis em logs

### Pre-Deploy

- [ ] Variaveis de ambiente configuradas
- [ ] COOKIE_SECRET forte (32+ chars)
- [ ] DATABASE_URL sem credenciais default
- [ ] HTTPS configurado
- [ ] Headers de seguranca ativos

### Producao

- [ ] Firewall configurado
- [ ] Fail2Ban ativo
- [ ] Backups automaticos
- [ ] Monitoramento de logs
- [ ] Alertas de erro

---

## Vulnerabilidades

### Reportar

Email: admin@essencia.edu.br

### Informacoes Necessarias

1. Descricao da vulnerabilidade
2. Passos para reproduzir
3. Impacto potencial
4. Sugestao de correcao (opcional)

### Tempo de Resposta

- Critico: 24 horas
- Alto: 72 horas
- Medio: 1 semana
- Baixo: 2 semanas

---

## Dependencias

### Verificar Vulnerabilidades

```bash
pnpm audit
```

### Atualizar

```bash
pnpm update
```

### Politica

- Atualizar dependencias mensalmente
- Patches de seguranca: imediato
- Major updates: avaliar impacto

---

## Backup

### Banco de Dados

```bash
# Backup manual
pg_dump -U essencia essencia_db > backup.sql

# Restore
psql -U essencia essencia_db < backup.sql
```

### Retencao

| Frequencia | Retencao  |
| ---------- | --------- |
| Diario     | 7 dias    |
| Semanal    | 4 semanas |
| Mensal     | 12 meses  |

---

## Tratamento de Erros

### Respostas de Erro

Nunca expor stack traces em producao:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Ocorreu um erro interno"
  }
}
```

### Exception Filter

```typescript
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Log completo para debug
    console.error(exception);

    // Resposta segura para cliente
    response.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Ocorreu um erro interno",
      },
    });
  }
}
```

---

## Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Security](https://docs.nestjs.com/security)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)

---

## Shop (Loja de Uniformes)

### Endpoints Públicos

Os endpoints públicos da loja (`/shop/*`) não requerem autenticação, mas possuem proteções específicas:

| Endpoint | Proteção | Descrição |
|----------|----------|-----------|
| `GET /shop/catalog/:schoolId/:unitId` | Nenhuma | Catálogo público |
| `POST /shop/orders` | Rate limiting | 5 pedidos/hora por IP |
| `GET /shop/orders/:orderNumber` | Validação phone | Requer telefone do cliente |
| `POST /shop/interest` | Nenhuma | Formulário de interesse |

### Endpoints Administrativos

Todos endpoints `/shop/admin/*` usam a cadeia completa de guards:

```typescript
@Controller('shop/admin')
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class ShopAdminController {
  // ...
}
```

**Roles com Acesso:**
- `master`  Acesso global (todas escolas)
- `diretora_geral`  Todas unidades da escola
- `gerente_unidade`  Apenas sua unidade
- `gerente_financeiro`  Apenas sua unidade
- `auxiliar_administrativo`  Apenas sua unidade

### Multi-Tenant Isolation

#### Regra Crítica de Isolamento

**Estoque é isolado por `(variant_id, unit_id)`**

```typescript
//  CORRETO: Verifica unitId na sessão
const unitId = req.user.unitId;
const inventory = await this.inventoryService.getInventory(variantId, unitId);

//  ERRADO: Aceita unitId do payload
const unitId = req.body.unitId; // Cliente pode manipular!
```

#### Validação de Acesso

```typescript
// Em shop-inventory.service.ts
async reserveStock(variantId: string, quantity: number, unitId: string) {
  const inventory = await this.findOne({
    where: { variant_id: variantId, unit_id: unitId } // Isola por unidade
  });
  
  if (!inventory || inventory.quantity_available < quantity) {
    throw new BadRequestException('Estoque insuficiente');
  }
  
  // Atualização atômica com lock
  const updated = await db.update(shopInventory)
    .set({
      quantity_available: sql`quantity_available - ${quantity}`,
      quantity_reserved: sql`quantity_reserved + ${quantity}`
    })
    .where(and(
      eq(shopInventory.variantId, variantId),
      eq(shopInventory.unitId, unitId),
      gte(shopInventory.quantityAvailable, quantity) // Race condition protection
    ))
    .returning();
    
  return updated[0];
}
```

### Rate Limiting

#### Criação de Pedidos

Para prevenir abuse:

```typescript
@Post('orders')
@Throttle(5, 3600) // 5 pedidos por hora
async createOrder(@Body() dto: CreateOrderDto) {
  // ...
}
```

**Configuração:**
- Limite: 5 pedidos
- Janela: 1 hora (3600 segundos)
- Identificação: IP do cliente
- Resposta ao exceder: `429 Too Many Requests`

### Validação de Dados

#### Sanitização de Inputs

Todos endpoints validam inputs com `class-validator`:

```typescript
export class CreateOrderDto {
  @IsString()
  @MinLength(3)
  customerName: string;

  @IsString()
  @MinLength(10)
  @MaxLength(20)
  customerPhone: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  items: OrderItemDto[];
}
```

#### Prevenção de SQL Injection

Drizzle ORM usa prepared statements automaticamente:

```typescript
//  Seguro
const order = await db.select()
  .from(shopOrders)
  .where(eq(shopOrders.orderNumber, orderNumber));

//  Nunca fazer (raw SQL sem sanitização)
const order = await db.execute(
  `SELECT * FROM shop_orders WHERE order_number = '${orderNumber}'`
);
```

### Auditoria

#### Ledger de Estoque

Todas movimentações são registradas:

```typescript
await db.insert(shopInventoryMovements).values({
  variantId,
  unitId,
  movementType: 'RESERVA',
  quantity: -quantity,
  balanceAfter: inventory.quantity_available - quantity,
  reason: `Pedido ${orderNumber}`,
  reference: orderId,
  userId: userId || null,
  createdAt: new Date()
});
```

**Tipos de Movimentação:**
- `ENTRADA`  Compra de fornecedor
- `SAIDA`  Venda/retirada
- `RESERVA`  Pedido criado
- `LIBERACAO`  Pedido cancelado/expirado
- `AJUSTE`  Inventário físico

#### Cancelamento de Pedidos

Apenas admin pode cancelar, com motivo obrigatório:

```typescript
async cancelOrder(orderId: string, userId: string, reason: string) {
  // Valida permissão (admin only)
  // Registra motivo do cancelamento
  // Libera estoque
  // Se já pago, inicia refund no Stripe
  
  this.logger.warn(`Order ${orderId} cancelled by ${userId}: ${reason}`);
}
```

### Stripe Integration

#### Secrets Management

Chaves Stripe **nunca** são commitadas:

```bash
# .env (não versionado)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

#### Webhook Signature

Validação obrigatória de webhooks:

```typescript
@Post('webhook')
async handleWebhook(@Req() req: Request) {
  const signature = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    // Processa evento
  } catch (err) {
    this.logger.error('Webhook signature verification failed');
    throw new BadRequestException('Invalid signature');
  }
}
```

