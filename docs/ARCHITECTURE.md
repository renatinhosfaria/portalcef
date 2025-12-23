# Arquitetura do Sistema

Este documento descreve a arquitetura técnica do Portal Digital Colégio Essência Feliz, incluindo decisões de design, padrões adotados e fluxos de dados.

---

## 📐 Visão Geral

O sistema segue uma arquitetura de **Monorepo Modular** utilizando Turborepo, com separação clara entre aplicações, serviços e pacotes compartilhados.

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TRAEFIK (Reverse Proxy)                        │
│              SSL Termination + Load Balancing                    │
└─────────────────────────────────────────────────────────────────┘
                    │                       │
         ┌──────────┴──────────┐           │
         ▼                     ▼           ▼
┌──────────────────────────────────────────┐  ┌─────────────────┐
│              Apps (Next.js)              │  │  API (NestJS)   │
│ Home:3000 | Login:3003 | Usuarios:3004   │  │   Port 3001     │
│ Escolas:3005                             │  └────────┬────────┘
└──────────┬───────────────────────────────┘           │
           │                                           │
           └───────────────────────────────┬───────────┘
                                           │
                                  Route Handler Proxy
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NestJS API (Backend)                          │
│                   Fastify + TypeScript                           │
└─────────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
         ┌──────────────────┐    ┌──────────────────┐
         │   PostgreSQL 16  │    │     Redis 7      │
         │   (Data Store)   │    │   (Sessions)     │
         └──────────────────┘    └──────────────────┘
```

---

## 🏛 Princípios Arquiteturais

### 1. Separação de Responsabilidades

- **Apps**: Camada de apresentação (UI/UX)
- **Services**: Lógica de negócio e APIs
- **Packages**: Código compartilhado e utilitários

### 2. Data Access Governance

> **Regra Crítica**: `apps/*` **NUNCA** devem importar `packages/db` diretamente.

```
✅ CORRETO:  App → HTTP Proxy → API → DB
❌ PROIBIDO: App → packages/db (Direct Import)
```

**Enforcement**: ESLint `no-restricted-imports` falha o build se violado.

### 3. Type Safety End-to-End

Tipos TypeScript compartilhados via `packages/shared` garantem consistência entre frontend e backend.

---

## 📦 Estrutura de Pacotes

### `/apps` - Aplicações

| Package    | Descrição                  | Porta |
| ---------- | -------------------------- | ----- |
| `home`     | Portal público Next.js     | 3000  |
| `login`    | App de login Next.js       | 3003  |
| `escolas`  | Módulo de escolas Next.js  | 3005  |
| `usuarios` | Módulo de usuários Next.js | 3004  |

### `/services` - Serviços Backend

| Package | Descrição                 | Porta |
| ------- | ------------------------- | ----- |
| `api`   | API REST NestJS + Fastify | 3001  |

### `/packages` - Bibliotecas Compartilhadas

| Package                     | Descrição                            |
| --------------------------- | ------------------------------------ |
| `@essencia/ui`              | Design System (shadcn/ui + Tailwind) |
| `@essencia/db`              | Drizzle ORM, Schemas, Migrações      |
| `@essencia/shared`          | Tipos, Zod Schemas, Fetchers         |
| `@essencia/config`          | ESLint, TSConfig, Env Validation     |
| `@essencia/tailwind-config` | Preset Tailwind compartilhado        |

---

## 🔄 Fluxos de Dados

### Fluxo de Autenticação

```
┌──────────┐     POST /auth/login      ┌─────────┐
│  Client  │ ─────────────────────────▶│   API   │
└──────────┘                           └────┬────┘
     ▲                                      │
     │                                      ▼
     │                              ┌───────────────┐
     │                              │  Validate     │
     │                              │  Credentials  │
     │                              └───────┬───────┘
     │                                      │
     │                                      ▼
     │                              ┌───────────────┐
     │                              │ Create Session│
     │       Set-Cookie             │    (Redis)    │
     │◀─────────────────────────────└───────────────┘
     │     cef_session=xxx
```

### Fluxo de Requisição Autenticada

```
┌──────────┐                              ┌─────────┐
│  Client  │  Cookie: cef_session=xxx     │   API   │
│  (App)   │ ────────────────────────────▶│(NestJS) │
└──────────┘                              └────┬────┘
                                               │
                                               ▼
                                      ┌────────────────┐
                                      │  AuthGuard     │
                                      │  (Validate     │
                                      │   Session)     │
                                      └───────┬────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
            ┌───────────┐           ┌──────────────────┐       ┌───────────────┐
            │  Session  │           │ Sliding Window   │       │   Proceed     │
            │  Invalid  │           │    Renewal       │       │   to Route    │
            │    401    │           │   (if < 25%)     │       │               │
            └───────────┘           └──────────────────┘       └───────────────┘
```

---

## 🔐 Sistema de Autenticação

### Especificações

| Configuração  | Valor                          |
| ------------- | ------------------------------ |
| **Mecanismo** | Sliding Window Session         |
| **Storage**   | Redis                          |
| **TTL**       | 24 horas                       |
| **Threshold** | 25% (renova se < 6h restantes) |
| **Cookie**    | `cef_session`                  |

### Atributos do Cookie

```
HttpOnly: true      # Previne acesso via JavaScript
Secure: true        # Somente HTTPS (produção)
SameSite: Lax       # CSRF protection
Path: /             # Disponível em todas as rotas
```

### Semântica de Respostas

| Código | Significado     | Ação no Cliente         |
| ------ | --------------- | ----------------------- |
| `401`  | Não autenticado | Redirect → Login        |
| `403`  | Sem permissão   | Mostrar "Acesso Negado" |

---

## 🌐 Proxy e CORS

### Estratégia de Proxy

**Primary**: Route Handler Proxy no Next.js

```typescript
// apps/home/app/api/[...path]/route.ts
export async function GET(request: NextRequest) {
  const response = await fetch(`${API_URL}/${path}`, {
    headers: {
      "x-request-id": request.headers.get("x-request-id"),
      cookie: request.headers.get("cookie"),
    },
  });
  return response;
}
```

**Vantagens**:

- Controle total sobre headers
- Observabilidade de cookies em logs
- Forwarding de `x-request-id`

**Fallback**: Rewrites no `next.config.js`

---

## 📊 Padrões de Código

### Fetchers Compartilhados

#### Client Fetcher (`packages/shared/client`)

```typescript
export const clientFetcher = async (url: string) => {
  const response = await fetch(url, {
    credentials: "include", // Envia cookies
  });

  if (response.status === 401) {
    queryClient.clear();
    window.location.href = "/login";
  }

  return response.json();
};
```

#### Server Fetcher (`packages/shared/server`)

```typescript
export const serverFetcher = async (url: string) => {
  const response = await fetch(url, {
    cache: "no-store", // Dados privados
  });

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  return response.json();
};
```

---

## 🏗 Padrões de Design

### Backend (NestJS)

- **Modular Architecture**: Um módulo por domínio
- **Dependency Injection**: IoC container nativo
- **Guards**: AuthGuard, RolesGuard, TenantGuard
- **Decorators**: @Public, @Roles, @CurrentUser
- **DTOs**: Validação com class-validator

---

## 🏢 Arquitetura Multi-Tenant

O sistema implementa isolamento de dados por escola e unidade.

### Hierarquia de Entidades

```
┌─────────────────────────────────────────────────────────────────┐
│                         ESCOLA                                   │
│               (Ex: Colégio Espaço Feliz)                        │
│                                                                  │
│    ┌─────────────────┐   ┌─────────────────┐   ┌────────────┐   │
│    │   Unidade A     │   │   Unidade B     │   │ Unidade C  │   │
│    │ (Santa Mônica)  │   │   (Centro)      │   │  (Norte)   │   │
│    └────────┬────────┘   └────────┬────────┘   └─────┬──────┘   │
│             │                     │                   │          │
│        ┌────┴────┐          ┌────┴────┐         ┌────┴────┐     │
│        │ Usuários│          │ Usuários│         │ Usuários│     │
│        └─────────┘          └─────────┘         └─────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Autorização Multi-Tenant

```
Request → AuthGuard → RolesGuard → TenantGuard → Controller
              │            │             │
              ▼            ▼             ▼
      Valida sessão   Verifica role  Verifica tenant
      (Redis)         hierarquia     scope (escola/unidade)
              │            │             │
              ▼            ▼             ▼
      Extrai:         Permite se     Master: global
      - userId        role >= min    Diretora Geral: escola
      - schoolId      required       Outros: unidade
      - unitId
      - role
```

### Pipeline de Guards

| Guard         | Responsabilidade                           | Falha |
| ------------- | ------------------------------------------ | ----- |
| `AuthGuard`   | Valida sessão e extrai tenant context      | 401   |
| `RolesGuard`  | Verifica se role tem permissão mínima      | 403   |
| `TenantGuard` | Garante acesso apenas a recursos do tenant | 403   |

### Escopo de Acesso por Role

| Role                       | Escopo  | Acesso                      |
| -------------------------- | ------- | --------------------------- |
| `master`                   | Global  | Todas as escolas            |
| `diretora_geral`           | Escola  | Todas as unidades da escola |
| `gerente_unidade`          | Unidade | Apenas sua unidade          |
| `gerente_financeiro`       | Unidade | Apenas sua unidade          |
| `coordenadora_geral`       | Unidade | Apenas sua unidade          |
| `coordenadora_infantil`    | Unidade | Apenas sua unidade          |
| `coordenadora_fundamental` | Unidade | Apenas sua unidade          |
| `analista_pedagogico`      | Unidade | Apenas sua unidade          |
| `professora`               | Unidade | Apenas sua unidade          |
| `auxiliar_administrativo`  | Unidade | Apenas sua unidade          |
| `auxiliar_sala`            | Unidade | Apenas sua unidade          |

### Dados da Sessão

```typescript
interface SessionData {
  userId: string;
  role: UserRole;
  schoolId: string; // Tenant - Escola
  unitId: string; // Tenant - Unidade
  createdAt: number;
}
```

### Frontend (Next.js)

- **App Router**: File-based routing
- **Server Components**: Default para performance
- **Client Components**: Interatividade quando necessário
- **Composição**: Design system com shadcn/ui

---

## 📁 Convenções de Arquivos

### Nomenclatura de Migrações

```
YYYYMMDDHHMM_module_action.ts

# Exemplos:
202412181500_users_create_table.ts
202412181530_auth_add_refresh_token.ts
```

### Estrutura de Módulos NestJS

```
src/
└── modules/
    └── users/
        ├── users.module.ts
        ├── users.controller.ts
        ├── users.service.ts
        ├── dto/
        │   ├── create-user.dto.ts
        │   └── update-user.dto.ts
        └── entities/
            └── user.entity.ts
```

---

## 🔍 Observabilidade

### Logging

- **Request ID**: Propagado via header `x-request-id`
- **Session Hash**: `sha256(sessionId).slice(0,10)` (seguro)
- **Structured Logging**: JSON format em produção

### Health Checks

- **API**: `/health` endpoint
- **Docker**: Healthchecks para PostgreSQL e Redis
- **Traefik**: Health monitoring automático

---

## 📈 Performance

### Caching Strategy

| Camada      | Estratégia                 |
| ----------- | -------------------------- |
| **CDN**     | Assets estáticos           |
| **Redis**   | Sessions, cache de queries |
| **Next.js** | ISR para páginas públicas  |

### Build Optimization

- **Turborepo**: Cache de builds
- **Docker**: Multi-stage builds
- **Tree Shaking**: Bundles otimizados

---

## 🔗 Referências

- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Turborepo](https://turbo.build/repo)
- [Traefik](https://doc.traefik.io/traefik/)
