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

### Segredos e fixtures de teste

- `.env`, `.env.docker`, backups, dumps e logs de produção nunca entram no Git.
- Testes que precisam validar configuração usam fixtures sanitizadas com apenas
  a chave necessária, sem copiar valores de produção.
- Mensagens de falha não devem incluir o conteúdo integral de arquivos de
  ambiente, cookies, tokens ou credenciais.

---

## Rate Limiting

### ThrottlerModule (Global)

| Configuracao | Limite | Janela |
| ------------ | ------ | ------ |
| **Default** | 10.000 requests | 1 minuto |
| **Strict** | 1.000 requests | 1 hora |

### Endpoints Especificos

| Endpoint           | Limite       | Janela |
| ------------------ | ------------ | ------ |
| `/stats/dashboard` | 5 requests/IP | 15s    |
| `/shop/orders`     | 5 pedidos/IP | 1h     |

---

## CORS

Configuracao em `services/api/src/config/cors.ts`:

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
  "http://localhost:3011",  // loja-admin
]
```

> **⚠️ PENDENCIA**: O app `tarefas` (porta 3012) ainda nao esta incluido nas origens CORS.

**Producao**: Em producao, o CORS e desnecessario pois todos os apps estao atras do mesmo reverse proxy Nginx em `www.portalcef.com.br`.

---

## Content Security Policy (CSP)

O modulo `SecurityModule` processa CSP violation reports:

- **Endpoint**: `POST /api/security/csp-report`
- Recebe e loga violacoes de Content Security Policy
- Uso futuro para monitoramento de seguranca

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

- Endpoint: `POST /api/payments/webhook` em produção (`https://www.portalcef.com.br/api/payments/webhook`).
- Validacao obrigatoria da assinatura (`stripe-signature`).
- Usa `STRIPE_WEBHOOK_SECRET`.
- Eventos são registrados por `eventId` para idempotência antes de aceitar reenvios do Stripe sem duplicar baixa de estoque.

---

## Logs e Auditoria

- Nunca logar cookies/tokens/senhas.
- Usar hash truncado para identificar sessoes.

```ts
const safeHash = createHash("sha256").update(token).digest("hex").slice(0, 10);
```

---

## Checklist de Seguranca (Producao)

- [ ] `COOKIE_SECRET` forte configurado (256-bit)
- [ ] `DATABASE_URL` com senha forte e URL-encoded
- [ ] HTTPS via reverse proxy (Nginx + Let's Encrypt)
- [ ] CORS ajustado (incluir tarefas :3012)
- [ ] `COOKIE_SECURE=true` em producao
- [ ] `COOKIE_DOMAIN=.portalcef.com.br`
- [ ] Backups automatizados diariamente
- [ ] Health checks configurados em todos os containers
- [ ] Rate limiting ativo (ThrottlerModule)
- [ ] Log rotation configurado
- [ ] Firewall: apenas portas 80, 443, 22 abertas

## Baseline de dependencias — 2026-09-19

Nesta rodada, todas as aplicações Next.js foram alinhadas em `15.5.25`, o
React permaneceu na linha compatível `19.0.x`, o Drizzle ORM foi atualizado
para `0.45.2` e o Axios para `1.18.0`. O typecheck, lint e os testes dos 21
workspaces passaram após a atualização.

O `pnpm audit --prod` ainda reporta advisories altos ou críticos transitivos.
Eles ficam registrados aqui para não serem tratados como aceitos sem prazo:

| Pacote | Decisão | Prazo |
| --- | --- | --- |
| `fastify` 4.x, `@nestjs/platform-fastify` 10.x e `@fastify/middie` 8.x | Atualizar em uma mudança coordenada para Nest 11/Fastify 5; forçar a major agora quebraria o adaptador HTTP em produção. | 2026-10-31 |
| `tar` usado pelo `bcrypt`/`node-pre-gyp` | Manter isolado no toolchain de instalação e revisar a substituição do binário nativo antes do próximo rebuild de imagem. | 2026-10-15 |
| `socket.io-parser`, `engine.io`, `ws` e `fast-uri` | Atualizar junto com a próxima revisão do stack Socket.IO, validando compatibilidade do cliente de tarefas e dos gateways. | 2026-10-31 |
| `minimatch`, `brace-expansion`, `picomatch`, `lodash`, `shell-quote`, `tmp`, `nanoid` e `browserslist` | Dependências transitivas de ferramentas; atualizar por overrides isolados após reproduzir a árvore em CI, sem alterar runtime sem teste. | 2026-10-15 |

Uma nova execução de `pnpm audit --prod` deve ser anexada ao registro de release
e não pode ultrapassar esses prazos sem uma nova decisão de risco.
