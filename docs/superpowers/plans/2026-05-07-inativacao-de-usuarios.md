# Inativação de Usuários — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir desativação reversível de usuários via timestamp `inativado_em`, bloqueando login dos inativos e impedindo a inativação enquanto a usuária mantém vínculos pedagógicos ativos (titularidade de turma).

**Architecture:** Soft-delete temporal com 2 colunas novas em `users` (`inativado_em` + `inativado_por`). `AuthService.login` rejeita inativos com mensagem genérica; `UsersService` ganha métodos `inativar` (com 4 validações sequenciais) e `reativar`. Sessões ativas são revogadas no momento da inativação reaproveitando `SessionService.deleteAllUserSessions`. Listagens funcionais (ex: professoras disponíveis para turma) filtram inativos por padrão.

**Tech Stack:** NestJS 10, Drizzle 0.38, PostgreSQL 16, Jest 29, Next.js 15, TypeScript 5.

**Spec:** [docs/superpowers/specs/2026-05-07-inativacao-de-usuarios-design.md](/var/www/essencia/docs/superpowers/specs/2026-05-07-inativacao-de-usuarios-design.md)

---

## File Structure

**Modified:**
- `packages/db/src/schema/users.ts` — colunas `inativadoEm`, `inativadoPor`
- `packages/db/drizzle/meta/_journal.json` — entrada para nova migration
- `packages/shared/src/types/user.ts` (criar se não existir) ou tipo `User` correspondente — campos novos
- `services/api/src/modules/auth/auth.service.ts` — check de inativo em `login`
- `services/api/src/modules/users/users.service.ts` — métodos `inativar`, `reativar`, ajuste em `findAllByTenant`
- `services/api/src/modules/users/users.controller.ts` — endpoints e query param
- `services/api/src/modules/users/users.module.ts` — importar `AuthModule` se necessário (para `SessionService`)
- `services/api/src/modules/turmas/turmas.service.ts` — filtrar inativos em `findAvailableProfessoras`

**Created:**
- `packages/db/drizzle/0029_users_inativacao.sql` — migration
- `services/api/src/modules/users/users.service.spec.ts` — testes (não existe hoje)
- `services/api/src/modules/auth/auth.service.spec.ts` — testes (não existe hoje)

**UI (escopo opcional, last priority):**
- `apps/usuarios/app/page.tsx` — usar `inativadoEm` real ao invés de `status: "active"` hardcoded
- `packages/components/<users-page-content>.tsx` — botões inativar/reativar e badge

---

## Fase 1 — Schema e Migration

### Task 1: Adicionar colunas ao schema Drizzle

**Files:**
- Modify: `packages/db/src/schema/users.ts:25-46`

- [ ] **Step 1: Editar schema**

Atualizar imports no topo (linha 1):

```typescript
import { type AnyPgColumn, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
```

Substituir o bloco `pgTable("users", {...})` por:

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: userRoleEnum })
    .notNull()
    .default("auxiliar_administrativo"),
  schoolId: uuid("school_id").references(() => schools.id, {
    onDelete: "cascade",
  }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }),
  stageId: uuid("stage_id").references(() => educationStages.id, {
    onDelete: "set null",
  }),
  inativadoEm: timestamp("inativado_em", { withTimezone: true }),
  inativadoPor: uuid("inativado_por").references(
    (): AnyPgColumn => users.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

NOTA: o tipo `AnyPgColumn` é necessário para self-reference porque o TypeScript precisa de uma forma de fechar o loop de tipo. Esse é o padrão oficial do Drizzle para FKs auto-referentes — não é hack.

- [ ] **Step 2: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=@essencia/db
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /var/www/essencia && git add packages/db/src/schema/users.ts
git commit -m "feat(db): adicionar colunas inativado_em e inativado_por em users"
```

---

### Task 2: Criar migration SQL manual e registrar no journal

**Files:**
- Create: `packages/db/drizzle/0029_users_inativacao.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`

- [ ] **Step 1: Criar migration**

Conteúdo de `packages/db/drizzle/0029_users_inativacao.sql`:

```sql
-- Migration: 0029_users_inativacao.sql
-- Adiciona suporte a inativação reversível de usuários
-- (soft-delete temporal com auditoria de quem fez)

ALTER TABLE "users" ADD COLUMN "inativado_em" TIMESTAMPTZ;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "inativado_por" UUID;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_inativado_por_users_id_fk"
  FOREIGN KEY ("inativado_por") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX "users_inativado_em_idx" ON "users" ("inativado_em")
  WHERE "inativado_em" IS NOT NULL;
```

- [ ] **Step 2: Registrar no _journal.json**

Em `packages/db/drizzle/meta/_journal.json`, adicionar entrada após a entrada de idx 28:

```json
    {
      "idx": 29,
      "version": "7",
      "when": 1778500800000,
      "tag": "0029_users_inativacao",
      "breakpoints": true
    }
```

(NOTA: `1778500800000` é approximate epoch ms para data atual. Ajustar se necessário.)

A entrada deve vir DEPOIS de `0028_historico_acao_transferido` (idx 28) e fechar o array.

- [ ] **Step 3: Validar JSON**

```bash
cd /var/www/essencia && python3 -c "import json; j=json.load(open('packages/db/drizzle/meta/_journal.json')); print('idx max:', max(e['idx'] for e in j['entries']))"
```

Expected: `idx max: 29`.

- [ ] **Step 4: Commit**

```bash
cd /var/www/essencia && git add packages/db/drizzle/0029_users_inativacao.sql packages/db/drizzle/meta/_journal.json
git commit -m "feat(db): migration 0029 — colunas de inativação em users + índice parcial"
```

---

### Task 3: Atualizar tipo `User` compartilhado

**Files:**
- Investigar e modificar: `packages/shared/src/types/user.ts` (criar) ou `packages/shared/src/types/index.ts` (verificar exports atuais)

- [ ] **Step 1: Verificar onde User está tipado em @essencia/shared**

```bash
cd /var/www/essencia && grep -rn "interface User\|type User =" packages/shared/src/ | head -5
```

- [ ] **Step 2: Adicionar campos novos**

Se houver `interface User` em `packages/shared/src/types/`, adicionar:

```typescript
inativadoEm: string | null; // ISO 8601 quando serializado, null = ativo
inativadoPor: string | null; // UUID de quem inativou
```

Se não existir um tipo User em `@essencia/shared`, **pular esta task** — o tipo é derivado automaticamente do schema Drizzle (`User = typeof users.$inferSelect`) e os novos campos virão de graça. Apenas verificar que o uso em frontend (apps/usuarios) compila.

- [ ] **Step 3: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=@essencia/shared
```

Expected: PASS.

- [ ] **Step 4: Commit (apenas se houve mudança)**

```bash
cd /var/www/essencia && git add packages/shared/src/types/
git commit -m "feat(shared): adicionar campos de inativação ao tipo User"
```

---

### Task 4: Aplicar migration em produção

**Files:** nenhum

NOTA: este passo **NÃO deve ser executado por subagent automaticamente** — requer autorização explícita do usuário e backup. O subagent deve **PARAR** e reportar BLOCKED se chegar a esta task. O usuário aplicará manualmente.

- [ ] **Step 1: Reportar BLOCKED para que o usuário aplique**

Mensagem para o usuário:

> Migration 0029 pronta. Aplicar em produção via:
> ```bash
> # 1. Backup
> docker exec essencia-postgres pg_dump -U essencia_prod -d essencia_db > backup/pre_0029_$(date +%Y%m%d_%H%M%S).sql
> # 2. Aplicar SQL
> docker exec -i essencia-postgres psql -U essencia_prod -d essencia_db < packages/db/drizzle/0029_users_inativacao.sql
> # 3. Registrar em __drizzle_migrations
> HASH_0029=$(sha256sum packages/db/drizzle/0029_users_inativacao.sql | cut -d' ' -f1)
> docker exec essencia-postgres psql -U essencia_prod -d essencia_db -c \
>   "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('$HASH_0029', 1778500800000);"
> # 4. Verificar
> docker exec essencia-postgres psql -U essencia_prod -d essencia_db -c \
>   "\d users" | grep -i inativado
> ```

---

## Fase 2 — AuthService bloqueia inativos

### Task 5: Criar spec de AuthService com teste falho de login inativo

**Files:**
- Create: `services/api/src/modules/auth/auth.service.spec.ts`

- [ ] **Step 1: Verificar que não existe**

```bash
cd /var/www/essencia && ls services/api/src/modules/auth/auth.service.spec.ts 2>&1 || echo "não existe — criar"
```

- [ ] **Step 2: Criar arquivo de teste**

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";

const mockDb = {
  query: {
    users: {
      findFirst: jest.fn(),
    },
  },
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  eq: jest.fn(),
}));

jest.mock("@essencia/db/schema", () => ({
  users: {},
}));

describe("AuthService — login bloqueia inativos", () => {
  let service: AuthService;
  const sessionServiceMock = {
    createSession: jest.fn().mockResolvedValue("token-123"),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SessionService, useValue: sessionServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it("rejeita login de usuário inativo com mesma mensagem genérica de senha errada", async () => {
    const passwordHash = await bcrypt.hash("senha-correta", 12);
    mockDb.query.users.findFirst.mockResolvedValue({
      id: "u-1",
      email: "inativa@example.com",
      passwordHash,
      name: "Inativa",
      role: "professora",
      schoolId: "s-1",
      unitId: "u-1",
      stageId: "st-1",
      inativadoEm: new Date("2026-04-15T10:00:00Z"),
      inativadoPor: "coord-1",
    });

    await expect(
      service.login("inativa@example.com", "senha-correta"),
    ).rejects.toMatchObject({
      message: "Credenciais invalidas",
    });

    expect(sessionServiceMock.createSession).not.toHaveBeenCalled();
  });

  it("permite login de usuário ativo (inativadoEm = null)", async () => {
    const passwordHash = await bcrypt.hash("senha-correta", 12);
    mockDb.query.users.findFirst.mockResolvedValue({
      id: "u-2",
      email: "ativa@example.com",
      passwordHash,
      name: "Ativa",
      role: "professora",
      schoolId: "s-1",
      unitId: "u-1",
      stageId: "st-1",
      inativadoEm: null,
      inativadoPor: null,
    });

    const result = await service.login("ativa@example.com", "senha-correta");

    expect(result.token).toBe("token-123");
    expect(sessionServiceMock.createSession).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Rodar e verificar que o primeiro teste falha**

```bash
cd /var/www/essencia/services/api && pnpm jest auth.service.spec --testNamePattern="rejeita login de usuário inativo" 2>&1 | tail -15
```

Expected: FAIL — login atual ignora `inativadoEm` e cria sessão normalmente, retornando objeto em vez de lançar exception.

---

### Task 6: Implementar check de inativo em AuthService.login

**Files:**
- Modify: `services/api/src/modules/auth/auth.service.ts:25-63`

- [ ] **Step 1: Adicionar check após validação de senha**

No método `login`, entre a linha 40 (`if (!isValidPassword) throw...`) e linha 42 (`// Create session`), adicionar:

```typescript
    if (user.inativadoEm !== null) {
      throw new UnauthorizedException("Credenciais invalidas");
    }
```

O método completo fica:

```typescript
  async login(email: string, password: string): Promise<LoginResult> {
    const db = getDb();

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw new UnauthorizedException("Credenciais invalidas");
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException("Credenciais invalidas");
    }

    // Block inactive users with same generic message (defense against enumeration)
    if (user.inativadoEm !== null) {
      throw new UnauthorizedException("Credenciais invalidas");
    }

    // Create session with tenant context
    const token = await this.sessionService.createSession(
      user.id,
      user.role,
      user.schoolId,
      user.unitId,
      user.stageId,
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: user.schoolId,
        unitId: user.unitId,
        stageId: user.stageId,
      },
    };
  }
```

- [ ] **Step 2: Rodar testes**

```bash
cd /var/www/essencia/services/api && pnpm jest auth.service.spec 2>&1 | tail -15
```

Expected: 2/2 PASS.

- [ ] **Step 3: Commit**

```bash
cd /var/www/essencia && git add services/api/src/modules/auth/auth.service.ts services/api/src/modules/auth/auth.service.spec.ts
git commit -m "feat(auth): bloquear login de usuários inativos com mensagem genérica"
```

---

## Fase 3 — UsersService.inativar

### Task 7: Criar spec de UsersService com teste de inativação caso feliz

**Files:**
- Create: `services/api/src/modules/users/users.service.spec.ts`

- [ ] **Step 1: Criar arquivo**

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { SessionService } from "../auth/session.service";
import { UsersService } from "./users.service";

const mockDb = {
  query: {
    users: {
      findFirst: jest.fn(),
    },
    turmas: {
      findMany: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  and: jest.fn(),
  asc: jest.fn(),
  eq: jest.fn(),
  isNull: jest.fn(),
  sql: jest.fn(),
}));

jest.mock("@essencia/db/schema", () => ({
  users: {},
  turmas: {},
}));

jest.mock("@essencia/shared/roles", () => ({
  ROLE_HIERARCHY: {
    master: 0,
    diretora_geral: 1,
    gerente_unidade: 2,
    coordenadora_geral: 4,
    professora: 11,
  },
  canManageRole: jest.fn((atorRole: string, alvoRole: string) => {
    const ranks: Record<string, number> = {
      master: 0,
      diretora_geral: 1,
      gerente_unidade: 2,
      coordenadora_geral: 4,
      professora: 11,
    };
    return (ranks[atorRole] ?? 999) < (ranks[alvoRole] ?? 999);
  }),
}));

jest.mock("@essencia/shared/types", () => ({
  stageRequiredRoles: [],
}));

describe("UsersService — inativar", () => {
  let service: UsersService;
  const sessionServiceMock = {
    deleteAllUserSessions: jest.fn().mockResolvedValue(undefined),
  };

  const ator = {
    userId: "coord-1",
    role: "diretora_geral",
    schoolId: "s-1",
    unitId: "u-1",
    stageId: null,
  };

  const alvoAtivo = {
    id: "prof-1",
    email: "prof@example.com",
    name: "Professora Maria",
    role: "professora",
    schoolId: "s-1",
    unitId: "u-1",
    stageId: "st-1",
    inativadoEm: null,
    inativadoPor: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SessionService, useValue: sessionServiceMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it("inativa professora sem turmas vinculadas — seta timestamp e revoga sessões", async () => {
    mockDb.query.users.findFirst.mockResolvedValue(alvoAtivo);
    mockDb.query.turmas.findMany.mockResolvedValue([]); // sem turmas
    mockDb.returning.mockResolvedValue([
      { ...alvoAtivo, inativadoEm: new Date(), inativadoPor: ator.userId },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (service as any).inativar("prof-1", ator);

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        inativadoEm: expect.any(Date),
        inativadoPor: ator.userId,
      }),
    );
    expect(sessionServiceMock.deleteAllUserSessions).toHaveBeenCalledWith("prof-1");
    expect(result.inativadoEm).toBeInstanceOf(Date);
    expect(result.inativadoPor).toBe(ator.userId);
  });

  it("rejeita auto-inativação", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((service as any).inativar(ator.userId, ator)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e verificar que falham**

```bash
cd /var/www/essencia/services/api && pnpm jest users.service.spec 2>&1 | tail -15
```

Expected: FAIL — método `inativar` não existe.

---

### Task 8: Implementar UsersService.inativar (caso feliz + auto-inativação)

**Files:**
- Modify: `services/api/src/modules/users/users.service.ts`

- [ ] **Step 1: Atualizar imports**

Substituir o bloco de imports de `@essencia/db` (linha 1) por:

```typescript
import { and, asc, eq, getDb, isNull, sql } from "@essencia/db";
```

E o bloco de imports de schema (linhas 2-7):

```typescript
import {
  turmas as turmasTable,
  users as usersTable,
  type NewUser,
  type User,
  type UserRole,
} from "@essencia/db/schema";
```

- [ ] **Step 2: Adicionar import de SessionService e injetar**

Adicionar após os imports existentes:

```typescript
import { SessionService } from "../auth/session.service";
```

E mudar a classe para incluir constructor (atualmente não tem):

```typescript
@Injectable()
export class UsersService {
  constructor(private readonly sessionService: SessionService) {}
```

- [ ] **Step 3: Adicionar método `inativar` ao final da classe (antes do `}` final)**

```typescript
  /**
   * Inativa um usuário (soft-delete temporal).
   *
   * Validações na ordem:
   * 1. Não pode inativar a si mesmo
   * 2. Hierarquia (canManageRole)
   * 3. Não pode inativar quem já está inativo
   * 4. Se professora: não pode inativar enquanto for titular de alguma turma
   *
   * Após inativar, revoga todas as sessões ativas do usuário no Redis.
   *
   * @returns Usuário atualizado (sem passwordHash)
   */
  async inativar(
    targetId: string,
    currentUser: CurrentUser,
  ): Promise<Omit<User, "passwordHash">> {
    const db = getDb();

    // 1. Auto-inativação
    if (targetId === currentUser.userId) {
      throw new ForbiddenException({
        code: "AUTO_INATIVACAO",
        message: "Você não pode inativar a si mesmo",
      });
    }

    // Buscar alvo (campos completos para checks)
    const target = await db.query.users.findFirst({
      where: eq(usersTable.id, targetId),
    });

    if (!target) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    // 2. Hierarquia
    if (!canManageRole(currentUser.role, target.role)) {
      throw new ForbiddenException({
        code: "ROLE_HIERARCHY_VIOLATION",
        message: `Você não pode inativar usuário com role ${target.role}`,
      });
    }

    // 3. Idempotência
    if (target.inativadoEm !== null) {
      throw new ConflictException({
        code: "JA_INATIVO",
        message: `Usuário já está inativo desde ${target.inativadoEm.toISOString()}`,
      });
    }

    // 4. Vínculos ativos (apenas se professora)
    if (target.role === "professora") {
      const turmasVinculadas = await db.query.turmas.findMany({
        where: eq(turmasTable.professoraId, targetId),
        columns: { id: true, name: true, code: true },
      });

      if (turmasVinculadas.length > 0) {
        throw new UnprocessableEntityException({
          code: "USUARIO_TEM_VINCULOS_ATIVOS",
          message:
            "Não é possível inativar: a professora é titular das turmas listadas. Atribua outra professora ou remova a titularidade antes.",
          turmas: turmasVinculadas,
        });
      }
    }

    // Aplicar inativação
    const [updated] = await db
      .update(usersTable)
      .set({
        inativadoEm: new Date(),
        inativadoPor: currentUser.userId,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, targetId))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        schoolId: usersTable.schoolId,
        unitId: usersTable.unitId,
        stageId: usersTable.stageId,
        inativadoEm: usersTable.inativadoEm,
        inativadoPor: usersTable.inativadoPor,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      });

    // Revogar todas as sessões ativas
    await this.sessionService.deleteAllUserSessions(targetId);

    return updated;
  }
```

- [ ] **Step 4: Adicionar imports faltantes no topo**

Garantir que o import de `@nestjs/common` inclui `UnprocessableEntityException`:

```typescript
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
```

- [ ] **Step 5: Atualizar UsersModule para importar AuthModule**

```bash
cd /var/www/essencia && cat services/api/src/modules/users/users.module.ts
```

Se `AuthModule` não estiver em `imports`, adicionar:

```typescript
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, /* ... outros existentes */],
  // ...
})
```

E garantir que `AuthModule` exporta `SessionService` (verificar `services/api/src/modules/auth/auth.module.ts`).

- [ ] **Step 6: Rodar testes**

```bash
cd /var/www/essencia/services/api && pnpm jest users.service.spec --testNamePattern="inativar" 2>&1 | tail -15
```

Expected: 2/2 PASS (caso feliz + auto-inativação).

---

### Task 9: Testes adicionais de inativar (idempotência, hierarquia, vínculos)

**Files:**
- Modify: `services/api/src/modules/users/users.service.spec.ts`

- [ ] **Step 1: Adicionar dentro do `describe("UsersService — inativar", ...)`:**

```typescript
  it("rejeita inativação por hierarquia inválida (alvo de role superior)", async () => {
    const atorBaixo = { ...ator, role: "professora", userId: "prof-2" };
    const alvoAlto = { ...alvoAtivo, id: "diretora-1", role: "diretora_geral" };

    mockDb.query.users.findFirst.mockResolvedValue(alvoAlto);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((service as any).inativar("diretora-1", atorBaixo)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("rejeita inativação de usuário já inativo", async () => {
    mockDb.query.users.findFirst.mockResolvedValue({
      ...alvoAtivo,
      inativadoEm: new Date("2026-04-15T10:00:00Z"),
      inativadoPor: "coord-1",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((service as any).inativar("prof-1", ator)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("rejeita inativação de professora com turmas vinculadas e retorna lista", async () => {
    mockDb.query.users.findFirst.mockResolvedValue(alvoAtivo);
    mockDb.query.turmas.findMany.mockResolvedValue([
      { id: "t-1", name: "1° Ano A", code: "1A" },
      { id: "t-2", name: "2° Ano B", code: "2B" },
    ]);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (service as any).inativar("prof-1", ator);
      fail("deveria ter lançado UnprocessableEntityException");
    } catch (err) {
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      const response = err.getResponse();
      expect(response.code).toBe("USUARIO_TEM_VINCULOS_ATIVOS");
      expect(response.turmas).toEqual([
        { id: "t-1", name: "1° Ano A", code: "1A" },
        { id: "t-2", name: "2° Ano B", code: "2B" },
      ]);
    }
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("não consulta turmas quando alvo é coordenadora (não-professora)", async () => {
    const alvoCoord = { ...alvoAtivo, role: "coordenadora_geral" };
    mockDb.query.users.findFirst.mockResolvedValue(alvoCoord);
    mockDb.returning.mockResolvedValue([{ ...alvoCoord, inativadoEm: new Date() }]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).inativar("prof-1", ator);

    expect(mockDb.query.turmas.findMany).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Rodar testes**

```bash
cd /var/www/essencia/services/api && pnpm jest users.service.spec --testNamePattern="inativar" 2>&1 | tail -15
```

Expected: 6/6 PASS (2 da Task 7-8 + 4 desta).

- [ ] **Step 3: Commit**

```bash
cd /var/www/essencia && git add services/api/src/modules/users/users.service.ts services/api/src/modules/users/users.service.spec.ts services/api/src/modules/users/users.module.ts
git commit -m "feat(users): método inativar com validações de auto/hierarquia/idempotência/vínculos"
```

---

## Fase 4 — UsersService.reativar

### Task 10: Implementar reativar com testes

**Files:**
- Modify: `services/api/src/modules/users/users.service.ts` (adicionar método)
- Modify: `services/api/src/modules/users/users.service.spec.ts` (adicionar describe)

- [ ] **Step 1: Adicionar método `reativar` ao service**

Após o método `inativar`:

```typescript
  /**
   * Reativa um usuário previamente inativado.
   * Limpa inativadoEm e inativadoPor.
   * NÃO restaura sessões antigas — usuária precisa fazer login novo.
   *
   * Validações: não-auto, hierarquia, idempotência (não pode reativar quem já está ativo).
   */
  async reativar(
    targetId: string,
    currentUser: CurrentUser,
  ): Promise<Omit<User, "passwordHash">> {
    const db = getDb();

    if (targetId === currentUser.userId) {
      throw new ForbiddenException({
        code: "AUTO_REATIVACAO",
        message: "Você não pode reativar a si mesmo",
      });
    }

    const target = await db.query.users.findFirst({
      where: eq(usersTable.id, targetId),
    });

    if (!target) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    if (!canManageRole(currentUser.role, target.role)) {
      throw new ForbiddenException({
        code: "ROLE_HIERARCHY_VIOLATION",
        message: `Você não pode reativar usuário com role ${target.role}`,
      });
    }

    if (target.inativadoEm === null) {
      throw new ConflictException({
        code: "JA_ATIVO",
        message: "Usuário já está ativo",
      });
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        inativadoEm: null,
        inativadoPor: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, targetId))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        schoolId: usersTable.schoolId,
        unitId: usersTable.unitId,
        stageId: usersTable.stageId,
        inativadoEm: usersTable.inativadoEm,
        inativadoPor: usersTable.inativadoPor,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      });

    return updated;
  }
```

- [ ] **Step 2: Adicionar testes em users.service.spec.ts**

Após o describe de inativar, adicionar:

```typescript
describe("UsersService — reativar", () => {
  let service: UsersService;
  const sessionServiceMock = {
    deleteAllUserSessions: jest.fn(),
  };

  const ator = {
    userId: "coord-1",
    role: "diretora_geral",
    schoolId: "s-1",
    unitId: "u-1",
    stageId: null,
  };

  const alvoInativo = {
    id: "prof-1",
    email: "prof@example.com",
    name: "Maria",
    role: "professora",
    schoolId: "s-1",
    unitId: "u-1",
    stageId: "st-1",
    inativadoEm: new Date("2026-04-15T10:00:00Z"),
    inativadoPor: "outra-coord",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SessionService, useValue: sessionServiceMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it("reativa usuário inativo — limpa timestamp e ator", async () => {
    mockDb.query.users.findFirst.mockResolvedValue(alvoInativo);
    mockDb.returning.mockResolvedValue([
      { ...alvoInativo, inativadoEm: null, inativadoPor: null },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (service as any).reativar("prof-1", ator);

    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        inativadoEm: null,
        inativadoPor: null,
      }),
    );
    expect(result.inativadoEm).toBeNull();
    expect(sessionServiceMock.deleteAllUserSessions).not.toHaveBeenCalled();
  });

  it("rejeita auto-reativação", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((service as any).reativar(ator.userId, ator)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("rejeita reativação de usuário já ativo", async () => {
    mockDb.query.users.findFirst.mockResolvedValue({
      ...alvoInativo,
      inativadoEm: null,
      inativadoPor: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((service as any).reativar("prof-1", ator)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
```

- [ ] **Step 3: Rodar todos os testes do arquivo**

```bash
cd /var/www/essencia/services/api && pnpm jest users.service.spec 2>&1 | tail -15
```

Expected: 9/9 PASS (6 inativar + 3 reativar).

- [ ] **Step 4: Commit**

```bash
cd /var/www/essencia && git add services/api/src/modules/users/users.service.ts services/api/src/modules/users/users.service.spec.ts
git commit -m "feat(users): método reativar simétrico ao inativar"
```

---

## Fase 5 — Endpoints e listagem

### Task 11: Endpoints PUT /users/:id/inativar e /reativar

**Files:**
- Modify: `services/api/src/modules/users/users.controller.ts`

- [ ] **Step 1: Adicionar endpoints após o método `delete`**

```typescript
  @Put(":id/inativar")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  @HttpCode(HttpStatus.OK)
  async inativar(
    @Param("id") id: string,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
  ) {
    const user = await this.usersService.inativar(id, currentUser);
    return {
      success: true,
      data: user,
    };
  }

  @Put(":id/reativar")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  @HttpCode(HttpStatus.OK)
  async reativar(
    @Param("id") id: string,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
  ) {
    const user = await this.usersService.reativar(id, currentUser);
    return {
      success: true,
      data: user,
    };
  }
```

NOTA: as exceções (`ForbiddenException`, `ConflictException`, `UnprocessableEntityException`) são propagadas automaticamente pelo NestJS e viram HTTP 403/409/422 respectivamente. Nenhum tratamento adicional necessário.

- [ ] **Step 2: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=@essencia/api
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /var/www/essencia && git add services/api/src/modules/users/users.controller.ts
git commit -m "feat(users): endpoints PUT /users/:id/inativar e /reativar"
```

---

### Task 12: Filtrar inativos em GET /api/users + query ?inativos=true

**Files:**
- Modify: `services/api/src/modules/users/users.service.ts` — `findAllByTenant` aceita filtro
- Modify: `services/api/src/modules/users/users.controller.ts` — passar query

- [ ] **Step 1: Atualizar findAllByTenant**

Modificar a assinatura para aceitar `incluirInativos`:

```typescript
  async findAllByTenant(
    currentUser: CurrentUser,
    incluirInativos: boolean = false,
  ): Promise<Omit<User, "passwordHash">[]> {
    const db = getDb();

    const columns = {
      id: true,
      email: true,
      name: true,
      role: true,
      schoolId: true,
      unitId: true,
      stageId: true,
      inativadoEm: true,
      inativadoPor: true,
      createdAt: true,
      updatedAt: true,
    } as const;
    // ... resto do método
```

E em CADA bloco de query (`if master`, `else if diretora_geral`, `else if other`), adicionar a condição `inativadoEm IS NULL` quando `!incluirInativos`. Exemplo para o branch master:

```typescript
    if (currentUser.role === "master") {
      users = await db.query.users.findMany({
        columns,
        where: incluirInativos ? undefined : isNull(usersTable.inativadoEm),
        orderBy: [asc(usersTable.name)],
      });
    }
```

E para os outros branches, ajustar para combinar com `and(...)`:

```typescript
    else if (currentUser.role === "diretora_geral" && currentUser.schoolId) {
      const conds = [eq(usersTable.schoolId, currentUser.schoolId!)];
      if (!incluirInativos) conds.push(isNull(usersTable.inativadoEm));
      users = await db.query.users.findMany({
        where: and(...conds),
        columns,
        orderBy: [asc(usersTable.name)],
      });
    }
```

E similar no terceiro branch.

- [ ] **Step 2: Atualizar findById para incluir campos novos**

No método `findById`, adicionar `inativadoEm` e `inativadoPor` ao bloco `columns`:

```typescript
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        unitId: true,
        stageId: true,
        inativadoEm: true,
        inativadoPor: true,
        createdAt: true,
        updatedAt: true,
      },
```

E ajustar o `update` para incluir os campos novos no `returning`:

(em `services/api/src/modules/users/users.service.ts`, no método `update`, atualizar a lista do `.returning({...})` para incluir os mesmos campos)

- [ ] **Step 3: Atualizar controller para receber query param**

No método `findAll` do controller:

```typescript
  @Get()
  @Roles(/* ... */)
  async findAll(
    @CurrentUser()
    currentUser: { /* ... */ },
    @Query("inativos") inativos?: string,
  ) {
    const incluirInativos = inativos === "true";
    const users = await this.usersService.findAllByTenant(currentUser, incluirInativos);
    // ... resto igual
```

Importar `Query` no topo do controller (ajustar a linha de import de `@nestjs/common`).

- [ ] **Step 4: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=@essencia/api
```

Expected: PASS.

- [ ] **Step 5: Adicionar teste**

Em `users.service.spec.ts`, adicionar describe:

```typescript
describe("UsersService — findAllByTenant filtro de inativos", () => {
  let service: UsersService;
  const sessionServiceMock = { deleteAllUserSessions: jest.fn() };

  const ator = {
    userId: "master-1",
    role: "master",
    schoolId: null,
    unitId: null,
    stageId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SessionService, useValue: sessionServiceMock },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    mockDb.query.users.findMany = jest.fn().mockResolvedValue([]);
    jest.clearAllMocks();
  });

  it("default exclui inativos (where inativadoEm IS NULL)", async () => {
    await service.findAllByTenant(ator);

    expect(mockDb.query.users.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
      }),
    );
  });

  it("incluirInativos=true não filtra", async () => {
    await service.findAllByTenant(ator, true);

    const call = mockDb.query.users.findMany.mock.calls[0][0];
    expect(call.where).toBeUndefined();
  });
});
```

- [ ] **Step 6: Rodar testes**

```bash
cd /var/www/essencia/services/api && pnpm jest users.service.spec 2>&1 | tail -15
```

Expected: 11/11 PASS.

- [ ] **Step 7: Commit**

```bash
cd /var/www/essencia && git add services/api/src/modules/users/users.service.ts services/api/src/modules/users/users.service.spec.ts services/api/src/modules/users/users.controller.ts
git commit -m "feat(users): listagem default oculta inativos, query ?inativos=true para incluir"
```

---

## Fase 6 — Filtros em outras listagens

### Task 13: Filtrar inativos em TurmasService.findAvailableProfessoras

**Files:**
- Modify: `services/api/src/modules/turmas/turmas.service.ts:336-365`

- [ ] **Step 1: Atualizar query**

Localizar `findAvailableProfessoras` e adicionar filtro:

```typescript
  async findAvailableProfessoras(
    turmaId: string,
  ): Promise<Omit<User, "passwordHash">[]> {
    const db = getDb();

    const turma = await db.query.turmas.findFirst({
      where: eq(turmas.id, turmaId),
    });

    if (!turma) {
      throw new NotFoundException("Turma não encontrada");
    }

    const professoras = await db.query.users.findMany({
      where: and(
        eq(users.role, "professora"),
        eq(users.unitId, turma.unitId),
        eq(users.stageId, turma.stageId),
        isNull(users.inativadoEm),
      ),
      orderBy: [asc(users.name)],
    });

    return professoras.map((prof: User) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...professoraSemSenha } = prof;
      return professoraSemSenha;
    });
  }
```

- [ ] **Step 2: Adicionar `isNull` ao import**

Garantir que o topo do arquivo importa `isNull`:

```typescript
import { and, asc, eq, getDb, inArray, isNull } from "@essencia/db";
```

- [ ] **Step 3: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=@essencia/api
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /var/www/essencia && git add services/api/src/modules/turmas/turmas.service.ts
git commit -m "feat(turmas): findAvailableProfessoras oculta professoras inativas"
```

---

## Fase 7 — UI (escopo opcional)

### Task 14: Atualizar página de listagem para refletir status real

**Files:**
- Modify: `apps/usuarios/app/page.tsx`

- [ ] **Step 1: Atualizar tipo ApiUser e mapeamento**

Substituir o conteúdo de `apps/usuarios/app/page.tsx`:

```typescript
import { UsersPageContent } from "@essencia/components/users-page-content";
import type { UserSummary } from "@essencia/lib/types";
import { serverApi } from "@essencia/shared/fetchers/server";
import type { UserRole } from "@essencia/shared/schemas";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolName?: string | null;
  unitName?: string | null;
  schoolId?: string | null;
  unitId?: string | null;
  stageId?: string | null;
  inativadoEm?: string | null;
  inativadoPor?: string | null;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ inativos?: string }>;
}) {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();
  const params = await searchParams;
  const incluirInativos = params.inativos === "true";

  let users: UserSummary[] = [];

  try {
    const url = incluirInativos ? "/api/users?inativos=true" : "/api/users";
    const fetchedUsers = await serverApi.get<ApiUser[]>(url, {
      cookies: cookieString,
    });

    users = fetchedUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      school: user.schoolName ?? "N/A",
      unit: user.unitName ?? "N/A",
      schoolId: user.schoolId ?? null,
      unitId: user.unitId ?? null,
      stageId: user.stageId ?? null,
      status: user.inativadoEm ? "inactive" : "active",
      lastActive: user.inativadoEm ?? "N/A",
    }));
  } catch (error) {
    console.error("Failed to fetch users:", error);
  }

  return <UsersPageContent users={users} incluirInativos={incluirInativos} />;
}
```

- [ ] **Step 2: Verificar tipo `UserSummary` aceita `status: "inactive"`**

```bash
cd /var/www/essencia && grep -A 15 "UserSummary" packages/lib/src/types.ts 2>/dev/null || find packages -name "types.ts" -exec grep -l "UserSummary" {} \;
```

Se não aceita, ajustar o tipo. Se já aceita, ok.

- [ ] **Step 3: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=usuarios
```

Expected: PASS (pode falhar se UsersPageContent não aceitar prop `incluirInativos` — Task 15 trata isso).

- [ ] **Step 4: Commit (mesmo se UsersPageContent ainda não aceita prop)**

```bash
cd /var/www/essencia && git add apps/usuarios/app/page.tsx
git commit -m "feat(usuarios): página de listagem reflete status real e suporta query ?inativos=true"
```

---

### Task 15: Adicionar botões inativar/reativar e badge no UsersPageContent

**Files:**
- Modify: `packages/components/src/.../users-page-content.tsx` (descobrir caminho exato)

- [ ] **Step 1: Localizar arquivo**

```bash
cd /var/www/essencia && find packages/components -name "users-page-content*" 2>/dev/null
```

- [ ] **Step 2: Ler arquivo e identificar onde renderiza linha de usuário**

```bash
cd /var/www/essencia && wc -l <caminho> && head -40 <caminho>
```

- [ ] **Step 3: Adicionar prop `incluirInativos` na interface e renderização condicional**

Adicionar à interface props:

```typescript
interface UsersPageContentProps {
  users: UserSummary[];
  incluirInativos?: boolean;
}
```

Adicionar toggle no header (próximo a outros filtros):

```tsx
<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={incluirInativos}
    onChange={(e) => {
      const url = new URL(window.location.href);
      if (e.target.checked) url.searchParams.set("inativos", "true");
      else url.searchParams.delete("inativos");
      window.location.href = url.toString();
    }}
  />
  Mostrar inativos
</label>
```

Para cada linha de usuário, badge condicional:

```tsx
{user.status === "inactive" && (
  <span className="ml-2 inline-block rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
    Inativo
  </span>
)}
```

E botão de ação na coluna correspondente:

```tsx
{user.status === "active" ? (
  <button onClick={() => handleInativar(user.id)} className="text-red-600">
    Inativar
  </button>
) : (
  <button onClick={() => handleReativar(user.id)} className="text-green-600">
    Reativar
  </button>
)}
```

Onde `handleInativar` e `handleReativar` chamam:

```typescript
async function handleInativar(id: string) {
  if (!confirm("Tem certeza? O usuário não conseguirá mais fazer login até ser reativado.")) return;
  const res = await fetch(`/api/users/${id}/inativar`, { method: "PUT", credentials: "include" });
  if (!res.ok) {
    const error = await res.json();
    if (error?.error?.code === "USUARIO_TEM_VINCULOS_ATIVOS") {
      alert(`Não é possível inativar. Turmas vinculadas: ${error.error.turmas.map((t: any) => t.code).join(", ")}`);
    } else {
      alert("Erro ao inativar usuário");
    }
    return;
  }
  window.location.reload();
}

async function handleReativar(id: string) {
  if (!confirm("Tem certeza? O usuário poderá fazer login novamente.")) return;
  const res = await fetch(`/api/users/${id}/reativar`, { method: "PUT", credentials: "include" });
  if (!res.ok) { alert("Erro ao reativar usuário"); return; }
  window.location.reload();
}
```

NOTA: por ser um componente em `packages/components`, pode estar em estilo server-component. Se for server-side, esses handlers precisam ser em um child Client Component ("use client"). Verificar primeiro.

- [ ] **Step 4: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=@essencia/components --filter=usuarios
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /var/www/essencia && git add packages/components
git commit -m "feat(components): UsersPageContent suporta toggle de inativos e ações inativar/reativar"
```

---

## Fase 8 — Verificação Final

### Task 16: Pipeline completo

**Files:** nenhum

- [ ] **Step 1: Lint global**

```bash
cd /var/www/essencia && pnpm turbo lint 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 2: Typecheck global**

```bash
cd /var/www/essencia && pnpm turbo typecheck 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 3: Jest dos arquivos novos/afetados**

```bash
cd /var/www/essencia/services/api && pnpm jest users.service.spec auth.service.spec turmas.service.spec 2>&1 | tail -15
```

Expected: todos PASS.

- [ ] **Step 4: Smoke test em produção (após Task 4 ter sido aplicada manualmente)**

```bash
# Login como master
curl -X POST -H "Content-Type: application/json" -d '{"email":"renato@famanegociosimobiliarios.com.br","password":"<senha>"}' http://localhost:3001/api/auth/login

# Tentar inativar uma professora SEM turma vinculada (esperado: 200)
curl -X PUT -H "Cookie: <session>" http://localhost:3001/api/users/<prof-sem-turma>/inativar

# Tentar inativar Karla (que deve estar sem turma agora) — esperado: 200
curl -X PUT -H "Cookie: <session>" http://localhost:3001/api/users/1ceeaac4-368c-4465-8ac5-0c728bffd45a/inativar

# Tentar logar como Karla — esperado: 401 "Credenciais invalidas"
curl -X POST -H "Content-Type: application/json" -d '{"email":"karlinhapedagogia@gmail.com","password":"<qualquer>"}' http://localhost:3001/api/auth/login

# Reativar Karla
curl -X PUT -H "Cookie: <session>" http://localhost:3001/api/users/1ceeaac4-368c-4465-8ac5-0c728bffd45a/reativar
```

---

## Resumo dos Pontos de Atenção

1. **Task 4 (aplicar migration em produção) requer autorização explícita do usuário.** Não executar via subagent.
2. **Self-reference `inativado_por` em users**: usa `AnyPgColumn` do Drizzle (padrão oficial para FKs auto-referentes). É a primeira self-reference do projeto, então não há precedente local — Task 1 segue exatamente o padrão da documentação Drizzle.
3. **`UsersModule` provavelmente precisa importar `AuthModule`** para receber `SessionService` via DI. Verificar antes de Task 8.
4. **UI (Tasks 14-15) é opcional** e pode ser entregue em PR separado. As tarefas da API (1-13, 16) entregam funcionalidade completa via curl.
5. **Hash de migration**: ao aplicar Task 4, calcular SHA256 do arquivo `0029_users_inativacao.sql` e inserir em `__drizzle_migrations` (mesmo padrão do plano anterior).
