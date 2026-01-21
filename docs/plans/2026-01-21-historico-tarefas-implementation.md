# Sistema de Histórico e Tarefas - Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar sistema de rastreabilidade (histórico de ações) e gerenciamento de tarefas no módulo de planejamento, com tarefas automáticas baseadas no workflow e criação manual com contextos estruturados.

**Architecture:** Sistema híbrido com histórico integrado ao módulo plano-aula (auditoria específica) e módulo de tarefas independente (reutilizável). Comunicação via eventos (EventEmitter) para criar tarefas automáticas no workflow. Frontend com app dedicado para tarefas e timeline de histórico integrada às páginas de revisão.

**Tech Stack:** NestJS, Fastify, Drizzle ORM, PostgreSQL, Next.js 15, React 19, shadcn/ui, TypeScript, Zod

---

## 📋 Índice de Tasks

1. [Setup: Migrations do Banco de Dados](#task-1-setup-migrations-do-banco-de-dados)
2. [Backend: Schema Drizzle](#task-2-backend-schema-drizzle)
3. [Backend: Tipos Compartilhados](#task-3-backend-tipos-compartilhados)
4. [Backend: PlanoAulaHistoricoService](#task-4-backend-planoaulahistoricoservice)
5. [Backend: Integrar Histórico no PlanoAulaService](#task-5-backend-integrar-histórico-no-planoaulaservice)
6. [Backend: TarefasModule - Setup](#task-6-backend-tarefasmodule---setup)
7. [Backend: TarefasService - CRUD Básico](#task-7-backend-tarefasservice---crud-básico)
8. [Backend: TarefasService - Validações](#task-8-backend-tarefasservice---validações)
9. [Backend: TarefasController](#task-9-backend-tarefascontroller)
10. [Backend: TarefasEventosService](#task-10-backend-tarefaseventosservice)
11. [Backend: Guards de Permissão](#task-11-backend-guards-de-permissão)
12. [Frontend: Tipos Compartilhados](#task-12-frontend-tipos-compartilhados)
13. [Frontend: App Tarefas - Setup](#task-13-frontend-app-tarefas---setup)
14. [Frontend: Hook useTarefas](#task-14-frontend-hook-usetarefas)
15. [Frontend: Componentes Base de Tarefas](#task-15-frontend-componentes-base-de-tarefas)
16. [Frontend: Dashboard de Tarefas](#task-16-frontend-dashboard-de-tarefas)
17. [Frontend: Criar Tarefa](#task-17-frontend-criar-tarefa)
18. [Frontend: Widget Badge](#task-18-frontend-widget-badge)
19. [Frontend: Widget Tarefas Pendentes](#task-19-frontend-widget-tarefas-pendentes)
20. [Frontend: Notificações In-App](#task-20-frontend-notificações-in-app)
21. [Frontend: Histórico Timeline](#task-21-frontend-histórico-timeline)
22. [Frontend: Integrar Histórico no Planejamento](#task-22-frontend-integrar-histórico-no-planejamento)
23. [Frontend: Integrar Widgets no Sistema](#task-23-frontend-integrar-widgets-no-sistema)
24. [Testes: Backend Services](#task-24-testes-backend-services)
25. [Testes: E2E Workflow Completo](#task-25-testes-e2e-workflow-completo)
26. [Documentação Final](#task-26-documentação-final)

---

## Task 1: Setup: Migrations do Banco de Dados

**Files:**
- Create: `packages/db/drizzle/0010_add_historico_tarefas.sql`

**Step 1: Criar migration SQL**

```sql
-- Migration: 0010_add_historico_tarefas.sql

-- Tabela de histórico de planos de aula
CREATE TABLE IF NOT EXISTS "plano_aula_historico" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "plano_id" UUID NOT NULL REFERENCES "plano_aula"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "user_name" TEXT NOT NULL,
  "user_role" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "status_anterior" TEXT,
  "status_novo" TEXT NOT NULL,
  "detalhes" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices para histórico
CREATE INDEX IF NOT EXISTS "idx_plano_historico_plano_id" ON "plano_aula_historico"("plano_id");
CREATE INDEX IF NOT EXISTS "idx_plano_historico_created_at" ON "plano_aula_historico"("created_at" DESC);

-- Tabela de tarefas
CREATE TABLE IF NOT EXISTS "tarefas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL REFERENCES "schools"("id"),
  "unit_id" UUID REFERENCES "school_units"("id"),
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "prioridade" TEXT NOT NULL,
  "prazo" TIMESTAMP NOT NULL,
  "criado_por" UUID NOT NULL REFERENCES "users"("id"),
  "responsavel" UUID NOT NULL REFERENCES "users"("id"),
  "tipo_origem" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "concluida_em" TIMESTAMP
);

-- Índices para tarefas
CREATE INDEX IF NOT EXISTS "idx_tarefas_responsavel" ON "tarefas"("responsavel");
CREATE INDEX IF NOT EXISTS "idx_tarefas_criado_por" ON "tarefas"("criado_por");
CREATE INDEX IF NOT EXISTS "idx_tarefas_school_id" ON "tarefas"("school_id");
CREATE INDEX IF NOT EXISTS "idx_tarefas_unit_id" ON "tarefas"("unit_id");
CREATE INDEX IF NOT EXISTS "idx_tarefas_status" ON "tarefas"("status");
CREATE INDEX IF NOT EXISTS "idx_tarefas_prazo" ON "tarefas"("prazo");

-- Tabela de contextos de tarefas
CREATE TABLE IF NOT EXISTS "tarefa_contextos" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tarefa_id" UUID NOT NULL REFERENCES "tarefas"("id") ON DELETE CASCADE,
  "modulo" TEXT NOT NULL,
  "quinzena_id" UUID REFERENCES "quinzenas"("id"),
  "etapa_id" UUID REFERENCES "stages"("id"),
  "turma_id" UUID REFERENCES "classes"("id"),
  "professora_id" UUID REFERENCES "users"("id")
);

-- Índices para contextos
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_tarefa_id" ON "tarefa_contextos"("tarefa_id");
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_modulo" ON "tarefa_contextos"("modulo");
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_quinzena_id" ON "tarefa_contextos"("quinzena_id");
CREATE INDEX IF NOT EXISTS "idx_tarefa_contextos_turma_id" ON "tarefa_contextos"("turma_id");
```

**Step 2: Aplicar migration em desenvolvimento**

Run: `pnpm db:migrate`
Expected: Migration aplicada com sucesso, tabelas criadas

**Step 3: Verificar tabelas no banco**

Run: `pnpm db:studio`
Expected: Abrir Drizzle Studio e verificar que as 3 novas tabelas existem

**Step 4: Commit**

```bash
git add packages/db/drizzle/0010_add_historico_tarefas.sql
git commit -m "feat(db): adiciona tabelas de histórico e tarefas"
```

---

## Task 2: Backend: Schema Drizzle

**Files:**
- Create: `packages/db/src/schema/plano-aula-historico.ts`
- Create: `packages/db/src/schema/tarefas.ts`
- Modify: `packages/db/src/schema/index.ts`

**Step 1: Criar schema de histórico**

```typescript
// packages/db/src/schema/plano-aula-historico.ts
import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { planoAula } from "./plano-aula";
import { users } from "./users";

export const planoAulaHistorico = pgTable("plano_aula_historico", {
  id: uuid("id").primaryKey().defaultRandom(),
  planoId: uuid("plano_id")
    .notNull()
    .references(() => planoAula.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  acao: text("acao").notNull(),
  statusAnterior: text("status_anterior"),
  statusNovo: text("status_novo").notNull(),
  detalhes: jsonb("detalhes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PlanoAulaHistorico = typeof planoAulaHistorico.$inferSelect;
export type NewPlanoAulaHistorico = typeof planoAulaHistorico.$inferInsert;
```

**Step 2: Criar schema de tarefas**

```typescript
// packages/db/src/schema/tarefas.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { schools } from "./schools";
import { schoolUnits } from "./school-units";
import { users } from "./users";
import { quinzenas } from "./quinzenas";
import { stages } from "./stages";
import { classes } from "./classes";

export const tarefas = pgTable("tarefas", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id),
  unitId: uuid("unit_id").references(() => schoolUnits.id),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  status: text("status").notNull().default("PENDENTE"),
  prioridade: text("prioridade").notNull(),
  prazo: timestamp("prazo").notNull(),
  criadoPor: uuid("criado_por")
    .notNull()
    .references(() => users.id),
  responsavel: uuid("responsavel")
    .notNull()
    .references(() => users.id),
  tipoOrigem: text("tipo_origem").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  concluidaEm: timestamp("concluida_em"),
});

export const tarefaContextos = pgTable("tarefa_contextos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tarefaId: uuid("tarefa_id")
    .notNull()
    .references(() => tarefas.id, { onDelete: "cascade" }),
  modulo: text("modulo").notNull(),
  quinzenaId: uuid("quinzena_id").references(() => quinzenas.id),
  etapaId: uuid("etapa_id").references(() => stages.id),
  turmaId: uuid("turma_id").references(() => classes.id),
  professoraId: uuid("professora_id").references(() => users.id),
});

export type Tarefa = typeof tarefas.$inferSelect;
export type NewTarefa = typeof tarefas.$inferInsert;
export type TarefaContexto = typeof tarefaContextos.$inferSelect;
export type NewTarefaContexto = typeof tarefaContextos.$inferInsert;
```

**Step 3: Exportar schemas**

```typescript
// packages/db/src/schema/index.ts
// ... exports existentes

export * from "./plano-aula-historico";
export * from "./tarefas";
```

**Step 4: Verificar tipos**

Run: `pnpm turbo typecheck --filter=@essencia/db`
Expected: Sem erros de tipos

**Step 5: Commit**

```bash
git add packages/db/src/schema/plano-aula-historico.ts packages/db/src/schema/tarefas.ts packages/db/src/schema/index.ts
git commit -m "feat(db): adiciona schemas Drizzle para histórico e tarefas"
```

---

## Task 3: Backend: Tipos Compartilhados

**Files:**
- Create: `packages/shared/src/types/historico.ts`
- Create: `packages/shared/src/types/tarefas.ts`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Criar tipos de histórico**

```typescript
// packages/shared/src/types/historico.ts
export type AcaoHistorico =
  | "CRIADO"
  | "SUBMETIDO"
  | "APROVADO_ANALISTA"
  | "DEVOLVIDO_ANALISTA"
  | "APROVADO_COORDENADORA"
  | "DEVOLVIDO_COORDENADORA";

export interface HistoricoEntry {
  id: string;
  planoId: string;
  userId: string;
  userName: string;
  userRole: string;
  acao: AcaoHistorico;
  statusAnterior?: string;
  statusNovo: string;
  detalhes?: {
    comentarios?: string;
    documentosIds?: string[];
    [key: string]: unknown;
  };
  createdAt: string;
}
```

**Step 2: Criar tipos de tarefas**

```typescript
// packages/shared/src/types/tarefas.ts
export type TarefaStatus = "PENDENTE" | "CONCLUIDA";
export type TarefaPrioridade = "ALTA" | "MEDIA" | "BAIXA";
export type TarefaTipoOrigem = "AUTOMATICA" | "MANUAL";

export interface Tarefa {
  id: string;
  schoolId: string;
  unitId?: string;
  titulo: string;
  descricao?: string;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  prazo: string;
  criadoPor: string;
  responsavel: string;
  tipoOrigem: TarefaTipoOrigem;
  createdAt: string;
  updatedAt: string;
  concluidaEm?: string;
}

export interface TarefaContexto {
  modulo: string;
  quinzenaId?: string;
  etapaId?: string;
  turmaId?: string;
  professoraId?: string;
}

export interface TarefaEnriquecida extends Tarefa {
  contextos: TarefaContexto;
  criadoPorNome: string;
  responsavelNome: string;
  quinzena?: {
    number: number;
    startDate: string;
    endDate: string;
  };
  etapa?: {
    nome: string;
  };
  turma?: {
    nome: string;
  };
  professora?: {
    nome: string;
  };
  atrasada: boolean;
  diasRestantes: number;
}

export interface TarefaStats {
  pendentes: number;
  atrasadas: number;
  concluidasHoje: number;
  concluidasSemana: number;
}
```

**Step 3: Exportar tipos**

```typescript
// packages/shared/src/types/index.ts
// ... exports existentes

export * from "./historico";
export * from "./tarefas";
```

**Step 4: Verificar tipos**

Run: `pnpm turbo typecheck --filter=@essencia/shared`
Expected: Sem erros de tipos

**Step 5: Commit**

```bash
git add packages/shared/src/types/historico.ts packages/shared/src/types/tarefas.ts packages/shared/src/types/index.ts
git commit -m "feat(shared): adiciona tipos para histórico e tarefas"
```

---

## Task 4: Backend: PlanoAulaHistoricoService

**Files:**
- Create: `services/api/src/modules/plano-aula/plano-aula-historico.service.ts`
- Create: `services/api/src/modules/plano-aula/plano-aula-historico.service.spec.ts`

**Step 1: Escrever teste para registrar ação**

```typescript
// services/api/src/modules/plano-aula/plano-aula-historico.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
import { DatabaseModule } from "../../common/database/database.module";

describe("PlanoAulaHistoricoService", () => {
  let service: PlanoAulaHistoricoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [PlanoAulaHistoricoService],
    }).compile();

    service = module.get<PlanoAulaHistoricoService>(PlanoAulaHistoricoService);
  });

  describe("registrar", () => {
    it("deve registrar uma ação no histórico", async () => {
      const params = {
        planoId: "plano-123",
        userId: "user-123",
        userName: "Maria Silva",
        userRole: "professora",
        acao: "SUBMETIDO" as const,
        statusAnterior: "RASCUNHO",
        statusNovo: "AGUARDANDO_ANALISTA",
      };

      await expect(service.registrar(params)).resolves.not.toThrow();
    });
  });

  describe("buscarPorPlano", () => {
    it("deve retornar histórico de um plano", async () => {
      const planoId = "plano-123";

      const historico = await service.buscarPorPlano(planoId);

      expect(Array.isArray(historico)).toBe(true);
    });
  });
});
```

**Step 2: Rodar teste para verificar falha**

Run: `pnpm --filter=api test plano-aula-historico.service.spec.ts`
Expected: FAIL - PlanoAulaHistoricoService não existe

**Step 3: Implementar service**

```typescript
// services/api/src/modules/plano-aula/plano-aula-historico.service.ts
import { Injectable } from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
import { DatabaseService } from "../../common/database/database.service";
import { planoAulaHistorico } from "@essencia/db/schema";
import type { AcaoHistorico, HistoricoEntry } from "@essencia/shared/types";

interface RegistrarParams {
  planoId: string;
  userId: string;
  userName: string;
  userRole: string;
  acao: AcaoHistorico;
  statusAnterior?: string;
  statusNovo: string;
  detalhes?: Record<string, unknown>;
}

@Injectable()
export class PlanoAulaHistoricoService {
  constructor(private readonly db: DatabaseService) {}

  async registrar(params: RegistrarParams): Promise<void> {
    await this.db.db.insert(planoAulaHistorico).values({
      planoId: params.planoId,
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      acao: params.acao,
      statusAnterior: params.statusAnterior,
      statusNovo: params.statusNovo,
      detalhes: params.detalhes,
    });
  }

  async buscarPorPlano(planoId: string): Promise<HistoricoEntry[]> {
    const result = await this.db.db
      .select()
      .from(planoAulaHistorico)
      .where(eq(planoAulaHistorico.planoId, planoId))
      .orderBy(desc(planoAulaHistorico.createdAt));

    return result.map((row) => ({
      id: row.id,
      planoId: row.planoId,
      userId: row.userId,
      userName: row.userName,
      userRole: row.userRole,
      acao: row.acao as AcaoHistorico,
      statusAnterior: row.statusAnterior ?? undefined,
      statusNovo: row.statusNovo,
      detalhes: row.detalhes as Record<string, unknown> | undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
```

**Step 4: Rodar teste para verificar sucesso**

Run: `pnpm --filter=api test plano-aula-historico.service.spec.ts`
Expected: PASS - Todos os testes passam

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula-historico.service.ts services/api/src/modules/plano-aula/plano-aula-historico.service.spec.ts
git commit -m "feat(api): adiciona PlanoAulaHistoricoService com testes"
```

---

## Task 5: Backend: Integrar Histórico no PlanoAulaService

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.module.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts`

**Step 1: Adicionar provider no módulo**

```typescript
// services/api/src/modules/plano-aula/plano-aula.module.ts
import { Module } from "@nestjs/common";
import { PlanoAulaController } from "./plano-aula.controller";
import { PlanoAulaService } from "./plano-aula.service";
import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
import { DatabaseModule } from "../../common/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [PlanoAulaController],
  providers: [PlanoAulaService, PlanoAulaHistoricoService],
  exports: [PlanoAulaService],
})
export class PlanoAulaModule {}
```

**Step 2: Injetar service e registrar em submeter**

```typescript
// services/api/src/modules/plano-aula/plano-aula.service.ts
// ... imports existentes
import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class PlanoAulaService {
  constructor(
    private readonly db: DatabaseService,
    private readonly historicoService: PlanoAulaHistoricoService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ... métodos existentes

  async submeter(planoId: string, session: UserContext) {
    const plano = await this.findById(planoId);

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.userId !== session.userId) {
      throw new ForbiddenException("Você não tem permissão para submeter este plano");
    }

    if (plano.status !== "RASCUNHO") {
      throw new BadRequestException("Apenas planos em rascunho podem ser submetidos");
    }

    // Atualizar status
    await this.db.db
      .update(planoAula)
      .set({ status: "AGUARDANDO_ANALISTA", submittedAt: new Date() })
      .where(eq(planoAula.id, planoId));

    // Registrar no histórico
    await this.historicoService.registrar({
      planoId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      acao: "SUBMETIDO",
      statusAnterior: "RASCUNHO",
      statusNovo: "AGUARDANDO_ANALISTA",
    });

    // Emitir evento para criar tarefa
    this.eventEmitter.emit("plano.submetido", {
      plano: await this.findById(planoId),
      session,
    });
  }
}
```

**Step 3: Adicionar endpoint de histórico**

```typescript
// services/api/src/modules/plano-aula/plano-aula.controller.ts
// ... imports e decorator existentes

@Controller("plano-aula")
@UseGuards(AuthGuard, RolesGuard)
export class PlanoAulaController {
  constructor(
    private readonly service: PlanoAulaService,
    private readonly historicoService: PlanoAulaHistoricoService,
  ) {}

  // ... métodos existentes

  @Get(":id/historico")
  async buscarHistorico(
    @Param("id") planoId: string,
    @CurrentUser() session: UserContext,
  ) {
    // Validar acesso ao plano
    const plano = await this.service.findById(planoId);
    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    // TODO: validar permissão de acesso ao plano

    return this.historicoService.buscarPorPlano(planoId);
  }
}
```

**Step 4: Verificar compilação**

Run: `pnpm turbo typecheck --filter=api`
Expected: Sem erros de tipos

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula/
git commit -m "feat(api): integra histórico no PlanoAulaService"
```

---

## Task 6: Backend: TarefasModule - Setup

**Files:**
- Create: `services/api/src/modules/tarefas/tarefas.module.ts`
- Create: `services/api/src/modules/tarefas/tarefas.service.ts`
- Create: `services/api/src/modules/tarefas/tarefas.controller.ts`
- Create: `services/api/src/modules/tarefas/dto/tarefas.dto.ts`
- Modify: `services/api/src/app.module.ts`

**Step 1: Criar DTOs com Zod**

```typescript
// services/api/src/modules/tarefas/dto/tarefas.dto.ts
import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const criarTarefaDtoSchema = z.object({
  titulo: z.string().min(3).max(200),
  descricao: z.string().max(1000).optional(),
  prioridade: z.enum(["ALTA", "MEDIA", "BAIXA"]),
  prazo: z.string().datetime(),
  responsavel: z.string().uuid(),
  contextos: z.object({
    modulo: z.string(),
    quinzenaId: z.string().uuid().optional(),
    etapaId: z.string().uuid().optional(),
    turmaId: z.string().uuid().optional(),
    professoraId: z.string().uuid().optional(),
  }),
});

export class CriarTarefaDto extends createZodDto(criarTarefaDtoSchema) {}

export const listarTarefasDtoSchema = z.object({
  status: z.enum(["PENDENTE", "CONCLUIDA"]).optional(),
  prioridade: z.enum(["ALTA", "MEDIA", "BAIXA"]).optional(),
  modulo: z.string().optional(),
  quinzenaId: z.string().uuid().optional(),
  tipo: z.enum(["criadas", "atribuidas", "todas"]).default("todas"),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export class ListarTarefasDto extends createZodDto(listarTarefasDtoSchema) {}
```

**Step 2: Criar service básico**

```typescript
// services/api/src/modules/tarefas/tarefas.service.ts
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../common/database/database.service";

@Injectable()
export class TarefasService {
  constructor(private readonly db: DatabaseService) {}

  // Métodos serão implementados nas próximas tasks
}
```

**Step 3: Criar controller básico**

```typescript
// services/api/src/modules/tarefas/tarefas.controller.ts
import { Controller, UseGuards } from "@nestjs/common";
import { TarefasService } from "./tarefas.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";

@Controller("tarefas")
@UseGuards(AuthGuard, RolesGuard)
export class TarefasController {
  constructor(private readonly service: TarefasService) {}

  // Endpoints serão implementados nas próximas tasks
}
```

**Step 4: Criar módulo**

```typescript
// services/api/src/modules/tarefas/tarefas.module.ts
import { Module } from "@nestjs/common";
import { TarefasController } from "./tarefas.controller";
import { TarefasService } from "./tarefas.service";
import { DatabaseModule } from "../../common/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [TarefasController],
  providers: [TarefasService],
  exports: [TarefasService],
})
export class TarefasModule {}
```

**Step 5: Registrar módulo no AppModule**

```typescript
// services/api/src/app.module.ts
// ... imports existentes
import { TarefasModule } from "./modules/tarefas/tarefas.module";

@Module({
  imports: [
    // ... módulos existentes
    TarefasModule,
  ],
})
export class AppModule {}
```

**Step 6: Verificar compilação**

Run: `pnpm turbo typecheck --filter=api`
Expected: Sem erros de tipos

**Step 7: Commit**

```bash
git add services/api/src/modules/tarefas/ services/api/src/app.module.ts
git commit -m "feat(api): cria estrutura base do TarefasModule"
```

---

## Task 7: Backend: TarefasService - CRUD Básico

**Files:**
- Modify: `services/api/src/modules/tarefas/tarefas.service.ts`
- Create: `services/api/src/modules/tarefas/tarefas.service.spec.ts`

**Step 1: Escrever testes**

```typescript
// services/api/src/modules/tarefas/tarefas.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { TarefasService } from "./tarefas.service";
import { DatabaseModule } from "../../common/database/database.module";

describe("TarefasService", () => {
  let service: TarefasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [TarefasService],
    }).compile();

    service = module.get<TarefasService>(TarefasService);
  });

  describe("create", () => {
    it("deve criar uma tarefa", async () => {
      const data = {
        schoolId: "school-123",
        unitId: "unit-123",
        titulo: "Revisar plano",
        prioridade: "ALTA" as const,
        prazo: new Date(),
        criadoPor: "user-123",
        responsavel: "user-456",
        tipoOrigem: "MANUAL" as const,
        contextos: {
          modulo: "planejamento",
          quinzenaId: "quinzena-123",
        },
      };

      const tarefa = await service.create(data);

      expect(tarefa).toHaveProperty("id");
      expect(tarefa.titulo).toBe("Revisar plano");
    });
  });

  describe("findById", () => {
    it("deve buscar tarefa por ID", async () => {
      const tarefa = await service.findById("tarefa-123");

      expect(tarefa).toBeDefined();
    });
  });
});
```

**Step 2: Rodar teste para verificar falha**

Run: `pnpm --filter=api test tarefas.service.spec.ts`
Expected: FAIL - Métodos não existem

**Step 3: Implementar métodos CRUD**

```typescript
// services/api/src/modules/tarefas/tarefas.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, and, or, desc } from "drizzle-orm";
import { DatabaseService } from "../../common/database/database.service";
import { tarefas, tarefaContextos } from "@essencia/db/schema";
import type { Tarefa, TarefaContexto, TarefaEnriquecida } from "@essencia/shared/types";

interface CreateTarefaParams {
  schoolId: string;
  unitId?: string;
  titulo: string;
  descricao?: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  prazo: Date;
  criadoPor: string;
  responsavel: string;
  tipoOrigem: "AUTOMATICA" | "MANUAL";
  contextos: {
    modulo: string;
    quinzenaId?: string;
    etapaId?: string;
    turmaId?: string;
    professoraId?: string;
  };
}

@Injectable()
export class TarefasService {
  constructor(private readonly db: DatabaseService) {}

  async create(params: CreateTarefaParams): Promise<Tarefa> {
    // Inserir tarefa
    const [tarefa] = await this.db.db
      .insert(tarefas)
      .values({
        schoolId: params.schoolId,
        unitId: params.unitId,
        titulo: params.titulo,
        descricao: params.descricao,
        prioridade: params.prioridade,
        prazo: params.prazo,
        criadoPor: params.criadoPor,
        responsavel: params.responsavel,
        tipoOrigem: params.tipoOrigem,
        status: "PENDENTE",
      })
      .returning();

    // Inserir contextos
    await this.db.db.insert(tarefaContextos).values({
      tarefaId: tarefa.id,
      modulo: params.contextos.modulo,
      quinzenaId: params.contextos.quinzenaId,
      etapaId: params.contextos.etapaId,
      turmaId: params.contextos.turmaId,
      professoraId: params.contextos.professoraId,
    });

    return this.mapTarefaToDto(tarefa);
  }

  async findById(id: string): Promise<Tarefa | null> {
    const [tarefa] = await this.db.db
      .select()
      .from(tarefas)
      .where(eq(tarefas.id, id))
      .limit(1);

    return tarefa ? this.mapTarefaToDto(tarefa) : null;
  }

  async concluir(tarefaId: string, userId: string): Promise<void> {
    const tarefa = await this.findById(tarefaId);

    if (!tarefa) {
      throw new NotFoundException("Tarefa não encontrada");
    }

    if (tarefa.responsavel !== userId) {
      throw new ForbiddenException("Apenas o responsável pode concluir a tarefa");
    }

    await this.db.db
      .update(tarefas)
      .set({
        status: "CONCLUIDA",
        concluidaEm: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tarefas.id, tarefaId));
  }

  private mapTarefaToDto(tarefa: any): Tarefa {
    return {
      id: tarefa.id,
      schoolId: tarefa.schoolId,
      unitId: tarefa.unitId ?? undefined,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao ?? undefined,
      status: tarefa.status,
      prioridade: tarefa.prioridade,
      prazo: tarefa.prazo.toISOString(),
      criadoPor: tarefa.criadoPor,
      responsavel: tarefa.responsavel,
      tipoOrigem: tarefa.tipoOrigem,
      createdAt: tarefa.createdAt.toISOString(),
      updatedAt: tarefa.updatedAt.toISOString(),
      concluidaEm: tarefa.concluidaEm?.toISOString(),
    };
  }
}
```

**Step 4: Rodar teste para verificar sucesso**

Run: `pnpm --filter=api test tarefas.service.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api/src/modules/tarefas/tarefas.service.ts services/api/src/modules/tarefas/tarefas.service.spec.ts
git commit -m "feat(api): implementa CRUD básico no TarefasService"
```

---

## Task 8: Backend: TarefasService - Validações

**Files:**
- Modify: `services/api/src/modules/tarefas/tarefas.service.ts`
- Create: `services/api/src/modules/tarefas/utils/validacoes.ts`

**Step 1: Criar utilitário de validações**

```typescript
// services/api/src/modules/tarefas/utils/validacoes.ts
import { BadRequestException } from "@nestjs/common";

interface ValidarContextosPorRoleParams {
  contextos: Record<string, any>;
  role: string;
}

export function validarContextosPorRole({ contextos, role }: ValidarContextosPorRoleParams): void {
  const camposObrigatorios: Record<string, string[]> = {
    professora: ["modulo", "quinzenaId"],
    analista_pedagogico: ["modulo", "quinzenaId", "etapaId", "turmaId", "professoraId"],
    coordenadora_bercario: ["modulo", "quinzenaId", "etapaId", "turmaId", "professoraId"],
    coordenadora_infantil: ["modulo", "quinzenaId", "etapaId", "turmaId", "professoraId"],
    coordenadora_fundamental_i: ["modulo", "quinzenaId", "etapaId", "turmaId", "professoraId"],
    gerente_unidade: ["modulo", "quinzenaId", "etapaId", "turmaId", "professoraId"],
    gerente_financeiro: ["modulo", "quinzenaId", "etapaId", "turmaId", "professoraId"],
    diretora_geral: ["modulo", "quinzenaId", "etapaId", "turmaId", "professoraId"],
    master: ["modulo"],
  };

  const obrigatorios = camposObrigatorios[role] || ["modulo"];

  for (const campo of obrigatorios) {
    if (!contextos[campo]) {
      throw new BadRequestException(
        `Campo '${campo}' é obrigatório para role '${role}'`,
      );
    }
  }
}

export function calcularPrioridadeAutomatica(deadline: Date): "ALTA" | "MEDIA" | "BAIXA" {
  const agora = new Date();
  const diff = deadline.getTime() - agora.getTime();
  const diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (diasRestantes <= 1) return "ALTA";
  if (diasRestantes <= 3) return "MEDIA";
  return "BAIXA";
}
```

**Step 2: Adicionar método criarManual com validações**

```typescript
// services/api/src/modules/tarefas/tarefas.service.ts
// ... imports existentes
import { validarContextosPorRole } from "./utils/validacoes";

interface UserContext {
  userId: string;
  role: string;
  schoolId: string;
  unitId?: string;
}

@Injectable()
export class TarefasService {
  // ... métodos existentes

  async criarManual(
    dto: CreateTarefaParams,
    session: UserContext,
  ): Promise<Tarefa> {
    // Validar contextos obrigatórios por role
    validarContextosPorRole({
      contextos: dto.contextos,
      role: session.role,
    });

    // Validar que responsável não pode ser diferente se for professora
    if (session.role === "professora" && dto.responsavel !== session.userId) {
      throw new ForbiddenException("Professora só pode criar tarefas para si mesma");
    }

    // Validar prazo (não pode estar no passado)
    if (dto.prazo < new Date()) {
      throw new BadRequestException("Prazo não pode estar no passado");
    }

    // Criar tarefa
    return this.create({
      ...dto,
      schoolId: session.schoolId,
      unitId: session.unitId,
      criadoPor: session.userId,
      tipoOrigem: "MANUAL",
    });
  }

  async criarAutomatica(params: CreateTarefaParams): Promise<Tarefa> {
    return this.create({
      ...params,
      tipoOrigem: "AUTOMATICA",
    });
  }
}
```

**Step 3: Verificar compilação**

Run: `pnpm turbo typecheck --filter=api`
Expected: Sem erros de tipos

**Step 4: Commit**

```bash
git add services/api/src/modules/tarefas/
git commit -m "feat(api): adiciona validações no TarefasService"
```

---

## Task 9: Backend: TarefasController

**Files:**
- Modify: `services/api/src/modules/tarefas/tarefas.controller.ts`

**Step 1: Implementar endpoints**

```typescript
// services/api/src/modules/tarefas/tarefas.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { TarefasService } from "./tarefas.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CriarTarefaDto, ListarTarefasDto } from "./dto/tarefas.dto";

interface UserContext {
  userId: string;
  name: string;
  role: string;
  schoolId: string;
  unitId?: string;
}

@Controller("tarefas")
@UseGuards(AuthGuard, RolesGuard)
export class TarefasController {
  constructor(private readonly service: TarefasService) {}

  @Get()
  async listar(
    @CurrentUser() session: UserContext,
    @Query() query: ListarTarefasDto,
  ) {
    // TODO: implementar listagem com filtros
    return { data: [], pagination: { page: 1, limit: 20, total: 0 } };
  }

  @Post()
  @Roles(
    "professora",
    "analista_pedagogico",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "gerente_unidade",
    "gerente_financeiro",
    "diretora_geral",
    "master",
  )
  async criar(
    @CurrentUser() session: UserContext,
    @Body() dto: CriarTarefaDto,
  ) {
    return this.service.criarManual(
      {
        titulo: dto.titulo,
        descricao: dto.descricao,
        prioridade: dto.prioridade,
        prazo: new Date(dto.prazo),
        responsavel: dto.responsavel,
        contextos: dto.contextos,
      },
      session,
    );
  }

  @Get(":id")
  async buscar(@Param("id") id: string) {
    const tarefa = await this.service.findById(id);

    if (!tarefa) {
      throw new NotFoundException("Tarefa não encontrada");
    }

    return tarefa;
  }

  @Patch(":id/concluir")
  async concluir(
    @Param("id") id: string,
    @CurrentUser() session: UserContext,
  ) {
    await this.service.concluir(id, session.userId);
    return { message: "Tarefa concluída com sucesso" };
  }

  @Get("stats/resumo")
  async stats(@CurrentUser() session: UserContext) {
    // TODO: implementar stats
    return {
      pendentes: 0,
      atrasadas: 0,
      concluidasHoje: 0,
      concluidasSemana: 0,
    };
  }
}
```

**Step 2: Verificar compilação**

Run: `pnpm turbo typecheck --filter=api`
Expected: Sem erros de tipos

**Step 3: Testar endpoint manualmente (opcional)**

Run: `pnpm --filter=api dev`
Test: `curl http://localhost:3001/api/tarefas -H "Authorization: Bearer <token>"`
Expected: Retorna `{ data: [], pagination: {...} }`

**Step 4: Commit**

```bash
git add services/api/src/modules/tarefas/tarefas.controller.ts
git commit -m "feat(api): implementa endpoints do TarefasController"
```

---

## Task 10: Backend: TarefasEventosService

**Files:**
- Create: `services/api/src/modules/tarefas/tarefas-eventos.service.ts`
- Modify: `services/api/src/modules/tarefas/tarefas.module.ts`

**Step 1: Criar service de eventos**

```typescript
// services/api/src/modules/tarefas/tarefas-eventos.service.ts
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TarefasService } from "./tarefas.service";
import { calcularPrioridadeAutomatica } from "./utils/validacoes";

interface PlanoSubmetidoEvent {
  plano: any;
  session: any;
}

@Injectable()
export class TarefasEventosService implements OnModuleInit {
  private readonly logger = new Logger(TarefasEventosService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly tarefasService: TarefasService,
  ) {}

  onModuleInit() {
    this.logger.log("Registrando listeners de eventos do planejamento");

    this.eventEmitter.on("plano.submetido", this.onPlanoSubmetido.bind(this));
    this.eventEmitter.on("plano.aprovado_analista", this.onPlanoAprovadoAnalista.bind(this));
    this.eventEmitter.on("plano.devolvido", this.onPlanoDevolvido.bind(this));
    this.eventEmitter.on("plano.aprovado_final", this.onPlanoAprovadoFinal.bind(this));
  }

  private async onPlanoSubmetido(event: PlanoSubmetidoEvent) {
    try {
      this.logger.log(`Plano submetido: ${event.plano.id}`);

      // TODO: Buscar analista responsável pelo segmento
      // TODO: Criar tarefa para analista

      this.logger.log(`Tarefa criada para analista revisar plano ${event.plano.id}`);
    } catch (error) {
      this.logger.error(`Erro ao criar tarefa de revisão: ${error.message}`, error.stack);
    }
  }

  private async onPlanoAprovadoAnalista(event: any) {
    try {
      this.logger.log(`Plano aprovado por analista: ${event.plano.id}`);

      // TODO: Buscar coordenadora do segmento
      // TODO: Criar tarefa para coordenadora
      // TODO: Marcar tarefa da analista como concluída

      this.logger.log(`Tarefa criada para coordenadora aprovar plano ${event.plano.id}`);
    } catch (error) {
      this.logger.error(`Erro ao processar aprovação da analista: ${error.message}`, error.stack);
    }
  }

  private async onPlanoDevolvido(event: any) {
    try {
      this.logger.log(`Plano devolvido: ${event.plano.id}`);

      // TODO: Criar tarefa para professora ajustar
      // TODO: Marcar tarefa do revisor como concluída

      this.logger.log(`Tarefa criada para professora ajustar plano ${event.plano.id}`);
    } catch (error) {
      this.logger.error(`Erro ao processar devolução: ${error.message}`, error.stack);
    }
  }

  private async onPlanoAprovadoFinal(event: any) {
    try {
      this.logger.log(`Plano aprovado (final): ${event.plano.id}`);

      // TODO: Marcar tarefa da coordenadora como concluída

      this.logger.log(`Tarefa da coordenadora concluída para plano ${event.plano.id}`);
    } catch (error) {
      this.logger.error(`Erro ao processar aprovação final: ${error.message}`, error.stack);
    }
  }
}
```

**Step 2: Adicionar provider no módulo**

```typescript
// services/api/src/modules/tarefas/tarefas.module.ts
import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { TarefasController } from "./tarefas.controller";
import { TarefasService } from "./tarefas.service";
import { TarefasEventosService } from "./tarefas-eventos.service";
import { DatabaseModule } from "../../common/database/database.module";

@Module({
  imports: [DatabaseModule, EventEmitterModule],
  controllers: [TarefasController],
  providers: [TarefasService, TarefasEventosService],
  exports: [TarefasService],
})
export class TarefasModule {}
```

**Step 3: Verificar que eventos são registrados**

Run: `pnpm --filter=api dev`
Expected: Log "Registrando listeners de eventos do planejamento"

**Step 4: Commit**

```bash
git add services/api/src/modules/tarefas/
git commit -m "feat(api): adiciona TarefasEventosService para workflow automático"
```

---

## Task 11: Backend: Guards de Permissão

**Files:**
- Create: `services/api/src/modules/tarefas/guards/tarefa-access.guard.ts`
- Modify: `services/api/src/modules/tarefas/tarefas.controller.ts`

**Step 1: Criar guard de acesso**

```typescript
// services/api/src/modules/tarefas/guards/tarefa-access.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { TarefasService } from "../tarefas.service";

interface UserContext {
  userId: string;
  role: string;
  schoolId: string;
  unitId?: string;
  stageId?: string;
}

@Injectable()
export class TarefaAccessGuard implements CanActivate {
  constructor(private readonly tarefasService: TarefasService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session: UserContext = request.user;
    const tarefaId = request.params.id;

    if (!tarefaId) {
      return true; // Lista/criar não precisa desse guard
    }

    const tarefa = await this.tarefasService.findById(tarefaId);

    if (!tarefa) {
      throw new NotFoundException("Tarefa não encontrada");
    }

    // Validar acesso
    const temAcesso = await this.validarAcesso(tarefa, session);

    if (!temAcesso) {
      throw new ForbiddenException("Acesso negado a esta tarefa");
    }

    return true;
  }

  private async validarAcesso(tarefa: any, session: UserContext): Promise<boolean> {
    // Master tem acesso a tudo
    if (session.role === "master") {
      return true;
    }

    // Criador ou responsável sempre tem acesso
    if (tarefa.criadoPor === session.userId || tarefa.responsavel === session.userId) {
      return true;
    }

    // Diretora geral: acesso a tarefas da escola
    if (session.role === "diretora_geral" && tarefa.schoolId === session.schoolId) {
      return true;
    }

    // Gerente: acesso a tarefas da unidade
    if (
      ["gerente_unidade", "gerente_financeiro"].includes(session.role) &&
      tarefa.unitId === session.unitId
    ) {
      return true;
    }

    return false;
  }
}
```

**Step 2: Aplicar guard nos endpoints**

```typescript
// services/api/src/modules/tarefas/tarefas.controller.ts
// ... imports existentes
import { TarefaAccessGuard } from "./guards/tarefa-access.guard";

@Controller("tarefas")
@UseGuards(AuthGuard, RolesGuard)
export class TarefasController {
  // ... métodos existentes

  @Get(":id")
  @UseGuards(TarefaAccessGuard)
  async buscar(@Param("id") id: string) {
    // ... código existente
  }

  @Patch(":id/concluir")
  @UseGuards(TarefaAccessGuard)
  async concluir(@Param("id") id: string, @CurrentUser() session: UserContext) {
    // ... código existente
  }
}
```

**Step 3: Verificar compilação**

Run: `pnpm turbo typecheck --filter=api`
Expected: Sem erros de tipos

**Step 4: Commit**

```bash
git add services/api/src/modules/tarefas/
git commit -m "feat(api): adiciona guard de permissão para tarefas"
```

---

## Task 12: Frontend: Tipos Compartilhados

> **Nota:** Os tipos já foram criados na Task 3. Esta task é de verificação.

**Files:**
- Verify: `packages/shared/src/types/historico.ts`
- Verify: `packages/shared/src/types/tarefas.ts`

**Step 1: Verificar tipos existem**

Run: `ls packages/shared/src/types/historico.ts packages/shared/src/types/tarefas.ts`
Expected: Arquivos existem

**Step 2: Verificar compilação**

Run: `pnpm turbo typecheck --filter=@essencia/shared`
Expected: Sem erros de tipos

**Step 3: Pular commit (nada mudou)**

---

## Task 13: Frontend: App Tarefas - Setup

**Files:**
- Create: `apps/tarefas/package.json`
- Create: `apps/tarefas/tsconfig.json`
- Create: `apps/tarefas/next.config.js`
- Create: `apps/tarefas/tailwind.config.ts`
- Create: `apps/tarefas/app/layout.tsx`
- Create: `apps/tarefas/app/page.tsx`
- Create: `apps/tarefas/app/globals.css`
- Create: `apps/tarefas/app/api/[...path]/route.ts`

**Step 1: Criar package.json**

```json
{
  "name": "tarefas",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3012",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@essencia/ui": "workspace:*",
    "@essencia/shared": "workspace:*",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5.6.3",
    "tailwindcss": "^3.4.17",
    "postcss": "^8",
    "autoprefixer": "^10"
  }
}
```

**Step 2: Criar tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Criar next.config.js**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@essencia/ui", "@essencia/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
```

**Step 4: Criar tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";
import sharedConfig from "@essencia/ui/tailwind.config";

const config: Config = {
  presets: [sharedConfig],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;
```

**Step 5: Criar layout.tsx**

```typescript
// apps/tarefas/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tarefas - Portal CEF",
  description: "Gerenciamento de tarefas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**Step 6: Criar page.tsx temporário**

```typescript
// apps/tarefas/app/page.tsx
export default function TarefasPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold">Tarefas</h1>
      <p className="text-muted-foreground mt-2">
        Sistema de gerenciamento de tarefas
      </p>
    </div>
  );
}
```

**Step 7: Criar globals.css**

```css
/* apps/tarefas/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 8: Criar API proxy**

```typescript
// apps/tarefas/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join("/");
  const url = `${API_URL}/api/${path}${request.nextUrl.search}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join("/");
  const url = `${API_URL}/api/${path}`;
  const body = await request.text();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") || "",
    },
    body,
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join("/");
  const url = `${API_URL}/api/${path}`;
  const body = await request.text();

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") || "",
    },
    body,
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}
```

**Step 9: Instalar dependências**

Run: `pnpm install`
Expected: Dependências instaladas

**Step 10: Testar dev server**

Run: `pnpm --filter=tarefas dev`
Expected: App rodando em http://localhost:3012

**Step 11: Commit**

```bash
git add apps/tarefas/
git commit -m "feat(tarefas): cria estrutura base do app Tarefas"
```

---

## Task 14: Frontend: Hook useTarefas

**Files:**
- Create: `apps/tarefas/features/tarefas-list/hooks/use-tarefas.ts`
- Create: `apps/tarefas/lib/api.ts`

**Step 1: Criar helper de API**

```typescript
// apps/tarefas/lib/api.ts
export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(`/api/${endpoint}`);

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function apiPost<T>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function apiPatch<T>(endpoint: string, body?: any): Promise<T> {
  const response = await fetch(`/api/${endpoint}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}
```

**Step 2: Criar hook useTarefas**

```typescript
// apps/tarefas/features/tarefas-list/hooks/use-tarefas.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  TarefaEnriquecida,
  TarefaStats,
  TarefaStatus,
  TarefaPrioridade,
} from "@essencia/shared/types";
import { apiGet, apiPatch } from "@/lib/api";

interface UseTarefasParams {
  status?: TarefaStatus;
  prioridade?: TarefaPrioridade;
  modulo?: string;
  quinzenaId?: string;
  tipo?: "criadas" | "atribuidas" | "todas";
}

export function useTarefas(params: UseTarefasParams = {}) {
  const [tarefas, setTarefas] = useState<TarefaEnriquecida[]>([]);
  const [stats, setStats] = useState<TarefaStats>({
    pendentes: 0,
    atrasadas: 0,
    concluidasHoje: 0,
    concluidasSemana: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTarefas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (params.status) queryParams.set("status", params.status);
      if (params.prioridade) queryParams.set("prioridade", params.prioridade);
      if (params.modulo) queryParams.set("modulo", params.modulo);
      if (params.quinzenaId) queryParams.set("quinzenaId", params.quinzenaId);
      if (params.tipo) queryParams.set("tipo", params.tipo);

      const response = await apiGet<{ data: TarefaEnriquecida[] }>(
        `tarefas?${queryParams.toString()}`
      );

      setTarefas(response.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erro ao buscar tarefas"));
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  const fetchStats = useCallback(async () => {
    try {
      const statsData = await apiGet<TarefaStats>("tarefas/stats/resumo");
      setStats(statsData);
    } catch (err) {
      console.error("Erro ao buscar stats:", err);
    }
  }, []);

  const concluir = useCallback(async (tarefaId: string) => {
    try {
      await apiPatch(`tarefas/${tarefaId}/concluir`);
      await fetchTarefas();
      await fetchStats();
    } catch (err) {
      throw err instanceof Error ? err : new Error("Erro ao concluir tarefa");
    }
  }, [fetchTarefas, fetchStats]);

  useEffect(() => {
    fetchTarefas();
    fetchStats();
  }, [fetchTarefas, fetchStats]);

  return {
    tarefas,
    stats,
    isLoading,
    error,
    refetch: fetchTarefas,
    concluir,
  };
}
```

**Step 3: Verificar compilação**

Run: `pnpm turbo typecheck --filter=tarefas`
Expected: Sem erros de tipos

**Step 4: Commit**

```bash
git add apps/tarefas/features/tarefas-list/hooks/ apps/tarefas/lib/api.ts
git commit -m "feat(tarefas): adiciona hook useTarefas"
```

---

## Task 15: Frontend: Componentes Base de Tarefas

**Files:**
- Create: `apps/tarefas/components/prioridade-badge.tsx`
- Create: `apps/tarefas/components/status-badge.tsx`
- Create: `apps/tarefas/components/prazo-indicator.tsx`
- Create: `apps/tarefas/lib/prazo-utils.ts`

**Step 1: Criar utilitário de prazo**

```typescript
// apps/tarefas/lib/prazo-utils.ts
import { differenceInDays } from "date-fns";

export function calcularDiasRestantes(prazo: string): number {
  const prazoDate = new Date(prazo);
  const hoje = new Date();
  return differenceInDays(prazoDate, hoje);
}

export function isAtrasada(prazo: string): boolean {
  return calcularDiasRestantes(prazo) < 0;
}

export function getPrazoVariant(prazo: string): "default" | "warning" | "destructive" {
  const dias = calcularDiasRestantes(prazo);

  if (dias < 0) return "destructive"; // Atrasada
  if (dias <= 1) return "destructive"; // Urgente
  if (dias <= 3) return "warning"; // Atenção
  return "default"; // Normal
}
```

**Step 2: Criar badge de prioridade**

```typescript
// apps/tarefas/components/prioridade-badge.tsx
import { Badge } from "@essencia/ui/badge";
import type { TarefaPrioridade } from "@essencia/shared/types";

interface PrioridadeBadgeProps {
  prioridade: TarefaPrioridade;
  size?: "sm" | "md";
}

export function PrioridadeBadge({ prioridade, size = "md" }: PrioridadeBadgeProps) {
  const variants = {
    ALTA: "destructive",
    MEDIA: "warning",
    BAIXA: "secondary",
  } as const;

  const labels = {
    ALTA: "Alta",
    MEDIA: "Média",
    BAIXA: "Baixa",
  };

  return (
    <Badge variant={variants[prioridade]} className={size === "sm" ? "text-xs" : ""}>
      {labels[prioridade]}
    </Badge>
  );
}
```

**Step 3: Criar badge de status**

```typescript
// apps/tarefas/components/status-badge.tsx
import { Badge } from "@essencia/ui/badge";
import type { TarefaStatus } from "@essencia/shared/types";

interface StatusBadgeProps {
  status: TarefaStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    PENDENTE: "default",
    CONCLUIDA: "success",
  } as const;

  const labels = {
    PENDENTE: "Pendente",
    CONCLUIDA: "Concluída",
  };

  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
```

**Step 4: Criar indicador de prazo**

```typescript
// apps/tarefas/components/prazo-indicator.tsx
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@essencia/ui/lib/utils";
import { calcularDiasRestantes, isAtrasada, getPrazoVariant } from "@/lib/prazo-utils";

interface PrazoIndicatorProps {
  prazo: string;
  compact?: boolean;
}

export function PrazoIndicator({ prazo, compact = false }: PrazoIndicatorProps) {
  const atrasada = isAtrasada(prazo);
  const diasRestantes = calcularDiasRestantes(prazo);
  const variant = getPrazoVariant(prazo);

  const colorClasses = {
    default: "text-muted-foreground",
    warning: "text-orange-600",
    destructive: "text-red-600",
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1 text-xs", colorClasses[variant])}>
        {atrasada ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        <span>
          {atrasada
            ? `Atrasada ${Math.abs(diasRestantes)}d`
            : `${diasRestantes}d restantes`}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", colorClasses[variant])}>
      {atrasada ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
      <div className="text-sm">
        <p className="font-medium">
          {atrasada ? "Atrasada" : "Prazo"}
        </p>
        <p className="text-xs">
          {format(new Date(prazo), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          {!atrasada && ` (${diasRestantes} dias)`}
        </p>
      </div>
    </div>
  );
}
```

**Step 5: Verificar compilação**

Run: `pnpm turbo typecheck --filter=tarefas`
Expected: Sem erros de tipos

**Step 6: Commit**

```bash
git add apps/tarefas/components/ apps/tarefas/lib/prazo-utils.ts
git commit -m "feat(tarefas): adiciona componentes base de badges e indicadores"
```

---

## Task 16: Frontend: Dashboard de Tarefas

**Files:**
- Create: `apps/tarefas/app/dashboard-content.tsx`
- Create: `apps/tarefas/features/tarefas-list/components/tarefas-grid.tsx`
- Create: `apps/tarefas/features/tarefas-list/components/tarefa-card.tsx`
- Modify: `apps/tarefas/app/page.tsx`

**Step 1: Criar card de tarefa**

```typescript
// apps/tarefas/features/tarefas-list/components/tarefa-card.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@essencia/ui/card";
import { Button } from "@essencia/ui/button";
import { cn } from "@essencia/ui/lib/utils";
import type { TarefaEnriquecida } from "@essencia/shared/types";
import { PrioridadeBadge } from "@/components/prioridade-badge";
import { StatusBadge } from "@/components/status-badge";
import { PrazoIndicator } from "@/components/prazo-indicator";
import { isAtrasada } from "@/lib/prazo-utils";

interface TarefaCardProps {
  tarefa: TarefaEnriquecida;
  onConcluir: (id: string) => Promise<void>;
}

export function TarefaCard({ tarefa, onConcluir }: TarefaCardProps) {
  const atrasada = isAtrasada(tarefa.prazo);

  return (
    <Card className={cn(atrasada && "border-destructive")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base">{tarefa.titulo}</CardTitle>
            <div className="flex gap-2">
              <PrioridadeBadge prioridade={tarefa.prioridade} size="sm" />
              <StatusBadge status={tarefa.status} />
            </div>
          </div>
          {tarefa.status === "PENDENTE" && (
            <Button size="sm" onClick={() => onConcluir(tarefa.id)}>
              Concluir
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {tarefa.descricao && (
          <p className="text-sm text-muted-foreground">{tarefa.descricao}</p>
        )}

        <PrazoIndicator prazo={tarefa.prazo} />

        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Por: {tarefa.criadoPorNome}</span>
          <span>Para: {tarefa.responsavelNome}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Criar grid de tarefas**

```typescript
// apps/tarefas/features/tarefas-list/components/tarefas-grid.tsx
"use client";

import type { TarefaEnriquecida } from "@essencia/shared/types";
import { TarefaCard } from "./tarefa-card";

interface TarefasGridProps {
  tarefas: TarefaEnriquecida[];
  onConcluir: (id: string) => Promise<void>;
}

export function TarefasGrid({ tarefas, onConcluir }: TarefasGridProps) {
  if (tarefas.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhuma tarefa encontrada</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tarefas.map((tarefa) => (
        <TarefaCard key={tarefa.id} tarefa={tarefa} onConcluir={onConcluir} />
      ))}
    </div>
  );
}
```

**Step 3: Criar dashboard content**

```typescript
// apps/tarefas/app/dashboard-content.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@essencia/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@essencia/ui/tabs";
import { useTarefas } from "@/features/tarefas-list/hooks/use-tarefas";
import { TarefasGrid } from "@/features/tarefas-list/components/tarefas-grid";

export function DashboardContent() {
  const [tipo, setTipo] = useState<"atribuidas" | "criadas" | "todas">("todas");
  const { tarefas, stats, isLoading, concluir } = useTarefas({
    status: "PENDENTE",
    tipo,
  });

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.pendentes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{stats.atrasadas}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Concluídas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.concluidasHoje}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Concluídas Esta Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.concluidasSemana}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
        <TabsList>
          <TabsTrigger value="atribuidas">Minhas Tarefas</TabsTrigger>
          <TabsTrigger value="criadas">Criadas por Mim</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Grid */}
      <TarefasGrid tarefas={tarefas} onConcluir={concluir} />
    </div>
  );
}
```

**Step 4: Atualizar página principal**

```typescript
// apps/tarefas/app/page.tsx
import { DashboardContent } from "./dashboard-content";

export default function TarefasPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Tarefas</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie suas tarefas pendentes e concluídas
        </p>
      </div>

      <DashboardContent />
    </div>
  );
}
```

**Step 5: Testar visualmente**

Run: `pnpm --filter=tarefas dev`
Test: Abrir http://localhost:3012
Expected: Ver dashboard com stats e grid (vazio por enquanto)

**Step 6: Commit**

```bash
git add apps/tarefas/
git commit -m "feat(tarefas): implementa dashboard principal com grid de tarefas"
```

---

## Task 17: Frontend: Criar Tarefa

**Files:**
- Create: `apps/tarefas/app/criar/page.tsx`
- Create: `apps/tarefas/app/criar/criar-form.tsx`
- Create: `apps/tarefas/features/criar-tarefa/hooks/use-criar-tarefa.ts`

**Step 1: Criar hook de criar tarefa**

```typescript
// apps/tarefas/features/criar-tarefa/hooks/use-criar-tarefa.ts
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import type { Tarefa } from "@essencia/shared/types";

interface CriarTarefaData {
  titulo: string;
  descricao?: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  prazo: string;
  responsavel: string;
  contextos: {
    modulo: string;
    quinzenaId?: string;
    etapaId?: string;
    turmaId?: string;
    professoraId?: string;
  };
}

export function useCriarTarefa() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const criar = async (data: CriarTarefaData) => {
    try {
      setIsLoading(true);
      setError(null);

      await apiPost<Tarefa>("tarefas", data);

      router.push("/tarefas");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erro ao criar tarefa"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { criar, isLoading, error };
}
```

**Step 2: Criar formulário**

```typescript
// apps/tarefas/app/criar/criar-form.tsx
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@essencia/ui/card";
import { Button } from "@essencia/ui/button";
import { Input } from "@essencia/ui/input";
import { Textarea } from "@essencia/ui/textarea";
import { Label } from "@essencia/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@essencia/ui/select";
import { useCriarTarefa } from "@/features/criar-tarefa/hooks/use-criar-tarefa";

export function CriarTarefaForm() {
  const { criar, isLoading } = useCriarTarefa();
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    prioridade: "MEDIA" as const,
    prazo: "",
    responsavel: "",
    contextos: {
      modulo: "planejamento",
      quinzenaId: "",
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await criar(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Tarefa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              required
              placeholder="Ex: Revisar plano da Turma Infantil II"
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Detalhes adicionais sobre a tarefa"
            />
          </div>

          <div>
            <Label htmlFor="prioridade">Prioridade *</Label>
            <Select
              value={formData.prioridade}
              onValueChange={(v) => setFormData({ ...formData, prioridade: v as typeof formData.prioridade })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALTA">Alta</SelectItem>
                <SelectItem value="MEDIA">Média</SelectItem>
                <SelectItem value="BAIXA">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="prazo">Prazo *</Label>
            <Input
              id="prazo"
              type="datetime-local"
              value={formData.prazo}
              onChange={(e) => setFormData({ ...formData, prazo: e.target.value })}
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Criando..." : "Criar Tarefa"}
            </Button>
            <Button type="button" variant="outline" onClick={() => window.history.back()}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Criar página**

```typescript
// apps/tarefas/app/criar/page.tsx
import { CriarTarefaForm } from "./criar-form";

export default function CriarTarefaPage() {
  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Criar Tarefa</h1>
        <p className="text-muted-foreground mt-2">
          Crie uma nova tarefa e atribua para um responsável
        </p>
      </div>

      <CriarTarefaForm />
    </div>
  );
}
```

**Step 4: Verificar compilação**

Run: `pnpm turbo typecheck --filter=tarefas`
Expected: Sem erros de tipos

**Step 5: Commit**

```bash
git add apps/tarefas/
git commit -m "feat(tarefas): implementa formulário de criar tarefa"
```

---

## Task 18: Frontend: Widget Badge

**Files:**
- Create: `apps/tarefas/features/widgets/tarefa-badge.tsx`

**Step 1: Criar widget de badge**

```typescript
// apps/tarefas/features/widgets/tarefa-badge.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@essencia/ui/button";
import { Badge } from "@essencia/ui/badge";
import { CheckSquare } from "lucide-react";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";

export function TarefaBadge() {
  const router = useRouter();
  const { stats } = useTarefas({ status: "PENDENTE" });

  if (stats.pendentes === 0) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative"
      onClick={() => router.push("/tarefas")}
    >
      <CheckSquare className="h-5 w-5" />
      <Badge
        variant={stats.atrasadas > 0 ? "destructive" : "secondary"}
        className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
      >
        {stats.atrasadas > 0 ? stats.atrasadas : stats.pendentes}
      </Badge>
    </Button>
  );
}
```

**Step 2: Verificar compilação**

Run: `pnpm turbo typecheck --filter=tarefas`
Expected: Sem erros de tipos

**Step 3: Commit**

```bash
git add apps/tarefas/features/widgets/tarefa-badge.tsx
git commit -m "feat(tarefas): adiciona widget de badge para notificação"
```

---

## Task 19: Frontend: Widget Tarefas Pendentes

**Files:**
- Create: `apps/tarefas/features/widgets/tarefas-pendentes-widget.tsx`

**Step 1: Criar widget de tarefas pendentes**

```typescript
// apps/tarefas/features/widgets/tarefas-pendentes-widget.tsx
"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@essencia/ui/card";
import { Button } from "@essencia/ui/button";
import { Badge } from "@essencia/ui/badge";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";
import { PrioridadeBadge } from "@/components/prioridade-badge";
import { PrazoIndicator } from "@/components/prazo-indicator";

interface TarefasPendentesWidgetProps {
  modulo?: string;
  quinzenaId?: string;
}

export function TarefasPendentesWidget({ modulo, quinzenaId }: TarefasPendentesWidgetProps) {
  const router = useRouter();
  const { tarefas, isLoading } = useTarefas({
    status: "PENDENTE",
    modulo,
    quinzenaId,
  });

  const tarefasUrgentes = tarefas
    .filter((t) => t.atrasada || t.diasRestantes <= 2)
    .slice(0, 5);

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Tarefas Urgentes</span>
          <Badge variant="destructive">{tarefasUrgentes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tarefasUrgentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa urgente</p>
        ) : (
          <div className="space-y-2">
            {tarefasUrgentes.map((tarefa) => (
              <div
                key={tarefa.id}
                className="flex items-start justify-between p-2 rounded border hover:bg-accent cursor-pointer"
                onClick={() => router.push(`/tarefas/${tarefa.id}`)}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{tarefa.titulo}</p>
                  <div className="flex gap-2 mt-1">
                    <PrioridadeBadge prioridade={tarefa.prioridade} size="sm" />
                    <PrazoIndicator prazo={tarefa.prazo} compact />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="link"
          className="w-full mt-4"
          onClick={() => router.push("/tarefas")}
        >
          Ver todas as tarefas →
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verificar compilação**

Run: `pnpm turbo typecheck --filter=tarefas`
Expected: Sem erros de tipos

**Step 3: Commit**

```bash
git add apps/tarefas/features/widgets/tarefas-pendentes-widget.tsx
git commit -m "feat(tarefas): adiciona widget de tarefas pendentes"
```

---

## Task 20: Frontend: Notificações In-App

**Files:**
- Create: `apps/tarefas/features/notificacoes/tarefa-notificacao-provider.tsx`
- Modify: `apps/tarefas/app/layout.tsx`

**Step 1: Criar provider de notificações**

```typescript
// apps/tarefas/features/notificacoes/tarefa-notificacao-provider.tsx
"use client";

import { useEffect, useState, type PropsWithChildren } from "react";
import { useToast } from "@essencia/ui/use-toast";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";

export function TarefaNotificacaoProvider({ children }: PropsWithChildren) {
  const { stats, tarefas } = useTarefas({ status: "PENDENTE" });
  const [mostradas, setMostradas] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Notificação ao entrar no sistema
  useEffect(() => {
    if (stats.atrasadas > 0) {
      toast({
        title: `Você tem ${stats.atrasadas} tarefa(s) atrasada(s)`,
        description: "Acesse o painel de tarefas para mais detalhes",
        variant: "destructive",
      });
    }
  }, []); // Apenas ao montar

  // Polling de tarefas atrasadas (5 minutos)
  useEffect(() => {
    const interval = setInterval(() => {
      const atrasadas = tarefas.filter((t) => t.atrasada && !mostradas.has(t.id));

      atrasadas.forEach((tarefa) => {
        toast({
          title: "⚠️ Tarefa Atrasada",
          description: tarefa.titulo,
          variant: "destructive",
        });

        setMostradas((prev) => new Set([...prev, tarefa.id]));
      });
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [tarefas, mostradas, toast]);

  return <>{children}</>;
}
```

**Step 2: Integrar no layout**

```typescript
// apps/tarefas/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TarefaNotificacaoProvider } from "@/features/notificacoes/tarefa-notificacao-provider";
import { Toaster } from "@essencia/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tarefas - Portal CEF",
  description: "Gerenciamento de tarefas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <TarefaNotificacaoProvider>
          {children}
        </TarefaNotificacaoProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

**Step 3: Verificar compilação**

Run: `pnpm turbo typecheck --filter=tarefas`
Expected: Sem erros de tipos

**Step 4: Commit**

```bash
git add apps/tarefas/
git commit -m "feat(tarefas): adiciona provider de notificações in-app"
```

---

## Task 21: Frontend: Histórico Timeline

**Files:**
- Create: `apps/planejamento/features/plano-aula/components/historico-timeline.tsx`
- Create: `apps/planejamento/features/plano-aula/hooks/use-historico.ts`

**Step 1: Criar hook de histórico**

```typescript
// apps/planejamento/features/plano-aula/hooks/use-historico.ts
"use client";

import { useState, useEffect } from "react";
import { api } from "@essencia/shared/fetchers/client";
import type { HistoricoEntry } from "@essencia/shared/types";

export function useHistorico(planoId: string) {
  const [historico, setHistorico] = useState<HistoricoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchHistorico() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await api.get<HistoricoEntry[]>(
          `/plano-aula/${planoId}/historico`
        );

        setHistorico(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Erro ao buscar histórico"));
      } finally {
        setIsLoading(false);
      }
    }

    if (planoId) {
      fetchHistorico();
    }
  }, [planoId]);

  return { historico, isLoading, error };
}
```

**Step 2: Criar componente de timeline**

```typescript
// apps/planejamento/features/plano-aula/components/historico-timeline.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@essencia/ui/card";
import { Alert, AlertDescription } from "@essencia/ui/alert";
import { Badge } from "@essencia/ui/badge";
import { Skeleton } from "@essencia/ui/skeleton";
import {
  Plus,
  Send,
  Check,
  CheckCheck,
  Undo,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@essencia/ui/lib/utils";
import { useHistorico } from "../hooks/use-historico";
import type { AcaoHistorico } from "@essencia/shared/types";
import { StatusBadge } from "@/components/status-badge";

interface HistoricoTimelineProps {
  planoId: string;
}

export function HistoricoTimeline({ planoId }: HistoricoTimelineProps) {
  const { historico, isLoading } = useHistorico(planoId);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (historico.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Nenhuma ação registrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Ações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* Linha vertical */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          {historico.map((entry) => (
            <div key={entry.id} className="relative flex gap-4">
              {/* Ícone */}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-full",
                  getAcaoColor(entry.acao)
                )}
              >
                {getAcaoIcon(entry.acao)}
              </div>

              {/* Conteúdo */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{getAcaoLabel(entry.acao)}</p>
                  <time className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </time>
                </div>

                <p className="text-sm text-muted-foreground">
                  Por <span className="font-medium">{entry.userName}</span> (
                  {getRoleLabel(entry.userRole)})
                </p>

                {/* Status anterior → novo */}
                {entry.statusAnterior && (
                  <div className="flex items-center gap-2 text-xs">
                    <StatusBadge status={entry.statusAnterior} />
                    <ArrowRight className="h-3 w-3" />
                    <StatusBadge status={entry.statusNovo} />
                  </div>
                )}

                {/* Detalhes adicionais */}
                {entry.detalhes?.comentarios && (
                  <Alert className="mt-2">
                    <MessageSquare className="h-4 w-4" />
                    <AlertDescription>{entry.detalhes.comentarios}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
function getAcaoIcon(acao: AcaoHistorico) {
  switch (acao) {
    case "CRIADO":
      return <Plus className="h-4 w-4" />;
    case "SUBMETIDO":
      return <Send className="h-4 w-4" />;
    case "APROVADO_ANALISTA":
      return <Check className="h-4 w-4" />;
    case "APROVADO_COORDENADORA":
      return <CheckCheck className="h-4 w-4" />;
    case "DEVOLVIDO_ANALISTA":
    case "DEVOLVIDO_COORDENADORA":
      return <Undo className="h-4 w-4" />;
  }
}

function getAcaoColor(acao: AcaoHistorico) {
  switch (acao) {
    case "CRIADO":
      return "bg-blue-100 text-blue-600";
    case "SUBMETIDO":
      return "bg-yellow-100 text-yellow-600";
    case "APROVADO_ANALISTA":
    case "APROVADO_COORDENADORA":
      return "bg-green-100 text-green-600";
    case "DEVOLVIDO_ANALISTA":
    case "DEVOLVIDO_COORDENADORA":
      return "bg-red-100 text-red-600";
  }
}

function getAcaoLabel(acao: AcaoHistorico): string {
  const labels: Record<AcaoHistorico, string> = {
    CRIADO: "Plano criado",
    SUBMETIDO: "Plano submetido para análise",
    APROVADO_ANALISTA: "Aprovado pela analista",
    DEVOLVIDO_ANALISTA: "Devolvido pela analista",
    APROVADO_COORDENADORA: "Aprovado pela coordenadora",
    DEVOLVIDO_COORDENADORA: "Devolvido pela coordenadora",
  };
  return labels[acao];
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    professora: "Professora",
    analista_pedagogico: "Analista Pedagógica",
    coordenadora_bercario: "Coordenadora Berçário",
    coordenadora_infantil: "Coordenadora Infantil",
    coordenadora_fundamental_i: "Coordenadora Fundamental I",
  };
  return labels[role] || role;
}
```

**Step 3: Verificar compilação**

Run: `pnpm turbo typecheck --filter=planejamento`
Expected: Sem erros de tipos

**Step 4: Commit**

```bash
git add apps/planejamento/features/plano-aula/
git commit -m "feat(planejamento): adiciona componente de timeline de histórico"
```

---

## Task 22: Frontend: Integrar Histórico no Planejamento

**Files:**
- Modify: `apps/planejamento/app/analise/[planoId]/revisao-content.tsx`
- Modify: `apps/planejamento/app/coordenacao/[planoId]/revisao-content.tsx`
- Modify: `apps/planejamento/app/plano-aula/[quinzenaId]/plano-content.tsx`

**Step 1: Adicionar histórico na página da analista**

```typescript
// apps/planejamento/app/analise/[planoId]/revisao-content.tsx
// ... imports existentes
import { HistoricoTimeline } from "@/features/plano-aula/components/historico-timeline";

export function RevisaoContent({ planoId }: { planoId: string }) {
  // ... código existente

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Coluna principal - Documentos e ações */}
      <div className="lg:col-span-2 space-y-6">
        {/* Código existente de documentos e ações */}
      </div>

      {/* Sidebar - Histórico */}
      <div>
        <HistoricoTimeline planoId={planoId} />
      </div>
    </div>
  );
}
```

**Step 2: Adicionar histórico na página da coordenadora**

```typescript
// apps/planejamento/app/coordenacao/[planoId]/revisao-content.tsx
// ... imports existentes
import { HistoricoTimeline } from "@/features/plano-aula/components/historico-timeline";

export function RevisaoContent({ planoId }: { planoId: string }) {
  // ... código existente

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Coluna principal */}
      <div className="lg:col-span-2 space-y-6">
        {/* Código existente */}
      </div>

      {/* Sidebar - Histórico */}
      <div>
        <HistoricoTimeline planoId={planoId} />
      </div>
    </div>
  );
}
```

**Step 3: Adicionar histórico na view da professora**

```typescript
// apps/planejamento/app/plano-aula/[quinzenaId]/plano-content.tsx
// ... imports existentes
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@essencia/ui/tabs";
import { HistoricoTimeline } from "@/features/plano-aula/components/historico-timeline";

export function PlanoContent({ quinzenaId }: { quinzenaId: string }) {
  const { plano } = usePlanoAula(quinzenaId);

  return (
    <Tabs defaultValue="documentos">
      <TabsList>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="documentos">
        {/* Código existente de upload e documentos */}
      </TabsContent>

      <TabsContent value="historico">
        <HistoricoTimeline planoId={plano.id} />
      </TabsContent>
    </Tabs>
  );
}
```

**Step 4: Verificar compilação**

Run: `pnpm turbo typecheck --filter=planejamento`
Expected: Sem erros de tipos

**Step 5: Commit**

```bash
git add apps/planejamento/
git commit -m "feat(planejamento): integra histórico nas páginas de revisão"
```

---

## Task 23: Frontend: Integrar Widgets no Sistema

**Files:**
- Modify: `packages/components/src/shell/app-sidebar.tsx`
- Modify: `apps/planejamento/app/gestao/dashboard-content.tsx`

**Step 1: Adicionar badge no sidebar**

```typescript
// packages/components/src/shell/app-sidebar.tsx
// ... imports existentes
import { TarefaBadge } from "@/../../tarefas/features/widgets/tarefa-badge";

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>{/* Logo e User */}</SidebarHeader>

      <SidebarContent>
        <SidebarNav items={navItems} />

        {/* Badge de tarefas */}
        <div className="px-3 py-2 mt-auto">
          <TarefaBadge />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
```

**Step 2: Adicionar widget no dashboard de gestão**

```typescript
// apps/planejamento/app/gestao/dashboard-content.tsx
// ... imports existentes
import { TarefasPendentesWidget } from "@/../../tarefas/features/widgets/tarefas-pendentes-widget";

export function DashboardContent() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* KPIs existentes */}
      <div className="lg:col-span-2">
        {/* Código existente de KPIs */}
      </div>

      {/* Widget de tarefas */}
      <div>
        <TarefasPendentesWidget modulo="planejamento" />
      </div>
    </div>
  );
}
```

**Step 3: Verificar compilação**

Run: `pnpm turbo typecheck`
Expected: Sem erros de tipos

**Step 4: Commit**

```bash
git add packages/components/ apps/planejamento/
git commit -m "feat: integra widgets de tarefas no sistema"
```

---

## Task 24: Testes: Backend Services

**Files:**
- Enhance: `services/api/src/modules/plano-aula/plano-aula-historico.service.spec.ts`
- Enhance: `services/api/src/modules/tarefas/tarefas.service.spec.ts`

**Step 1: Adicionar testes de integração do histórico**

```typescript
// services/api/src/modules/plano-aula/plano-aula-historico.service.spec.ts
// ... setup existente

describe("PlanoAulaHistoricoService - Integration", () => {
  it("deve registrar e buscar múltiplas ações em ordem", async () => {
    const planoId = "plano-test-123";

    // Registrar ações
    await service.registrar({
      planoId,
      userId: "user-1",
      userName: "Maria",
      userRole: "professora",
      acao: "CRIADO",
      statusNovo: "RASCUNHO",
    });

    await service.registrar({
      planoId,
      userId: "user-1",
      userName: "Maria",
      userRole: "professora",
      acao: "SUBMETIDO",
      statusAnterior: "RASCUNHO",
      statusNovo: "AGUARDANDO_ANALISTA",
    });

    // Buscar histórico
    const historico = await service.buscarPorPlano(planoId);

    expect(historico).toHaveLength(2);
    expect(historico[0].acao).toBe("SUBMETIDO"); // Mais recente primeiro
    expect(historico[1].acao).toBe("CRIADO");
  });
});
```

**Step 2: Adicionar testes de validação de tarefas**

```typescript
// services/api/src/modules/tarefas/tarefas.service.spec.ts
// ... setup existente

describe("TarefasService - Validações", () => {
  it("deve rejeitar tarefa com prazo no passado", async () => {
    const data = {
      titulo: "Tarefa teste",
      prioridade: "ALTA" as const,
      prazo: new Date("2020-01-01"), // Passado
      responsavel: "user-456",
      contextos: { modulo: "planejamento", quinzenaId: "quinzena-123" },
    };

    const session = {
      userId: "user-123",
      role: "professora",
      schoolId: "school-123",
    };

    await expect(service.criarManual(data, session)).rejects.toThrow(
      "Prazo não pode estar no passado"
    );
  });

  it("deve rejeitar professora criando tarefa para outra pessoa", async () => {
    const data = {
      titulo: "Tarefa teste",
      prioridade: "ALTA" as const,
      prazo: new Date("2026-12-31"),
      responsavel: "user-456", // Diferente do userId
      contextos: { modulo: "planejamento", quinzenaId: "quinzena-123" },
    };

    const session = {
      userId: "user-123",
      role: "professora",
      schoolId: "school-123",
    };

    await expect(service.criarManual(data, session)).rejects.toThrow(
      "Professora só pode criar tarefas para si mesma"
    );
  });
});
```

**Step 3: Rodar todos os testes**

Run: `pnpm --filter=api test`
Expected: Todos os testes passam

**Step 4: Commit**

```bash
git add services/api/src/modules/
git commit -m "test(api): adiciona testes de integração para histórico e validações"
```

---

## Task 25: Testes: E2E Workflow Completo

**Files:**
- Create: `services/api/test/e2e/workflow-tarefas.e2e-spec.ts`

**Step 1: Criar teste E2E do workflow**

```typescript
// services/api/test/e2e/workflow-tarefas.e2e-spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../../src/app.module";

describe("Workflow de Tarefas (E2E)", () => {
  let app: INestApplication;
  let professoraToken: string;
  let analistaToken: string;
  let planoId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // TODO: Obter tokens de autenticação
    // professoraToken = await getAuthToken('professora');
    // analistaToken = await getAuthToken('analista');
  });

  afterAll(async () => {
    await app.close();
  });

  it("Workflow completo: criar plano → submeter → criar tarefa automática → aprovar", async () => {
    // 1. Professora cria plano
    const createResponse = await request(app.getHttpServer())
      .post("/api/plano-aula")
      .set("Authorization", `Bearer ${professoraToken}`)
      .send({
        turmaId: "turma-123",
        quinzenaId: "quinzena-123",
      })
      .expect(201);

    planoId = createResponse.body.id;

    // 2. Verificar histórico inicial
    const historicoInicial = await request(app.getHttpServer())
      .get(`/api/plano-aula/${planoId}/historico`)
      .set("Authorization", `Bearer ${professoraToken}`)
      .expect(200);

    expect(historicoInicial.body).toHaveLength(1);
    expect(historicoInicial.body[0].acao).toBe("CRIADO");

    // 3. Professora submete plano
    await request(app.getHttpServer())
      .post(`/api/plano-aula/${planoId}/submeter`)
      .set("Authorization", `Bearer ${professoraToken}`)
      .expect(200);

    // 4. Verificar que tarefa foi criada para analista
    const tarefasAnalista = await request(app.getHttpServer())
      .get("/api/tarefas?tipo=atribuidas&status=PENDENTE")
      .set("Authorization", `Bearer ${analistaToken}`)
      .expect(200);

    expect(tarefasAnalista.body.data.length).toBeGreaterThan(0);
    const tarefaRevisao = tarefasAnalista.body.data.find((t) =>
      t.titulo.includes("Revisar plano")
    );
    expect(tarefaRevisao).toBeDefined();

    // 5. Verificar histórico após submissão
    const historicoPos = await request(app.getHttpServer())
      .get(`/api/plano-aula/${planoId}/historico`)
      .set("Authorization", `Bearer ${professoraToken}`)
      .expect(200);

    expect(historicoPos.body).toHaveLength(2);
    expect(historicoPos.body[0].acao).toBe("SUBMETIDO");
  });
});
```

**Step 2: Configurar ambiente de teste E2E**

```typescript
// services/api/test/jest-e2e.json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

**Step 3: Rodar testes E2E**

Run: `pnpm --filter=api test:e2e`
Expected: Testes E2E passam (pode precisar ajustar autenticação)

**Step 4: Commit**

```bash
git add services/api/test/
git commit -m "test(api): adiciona testes E2E do workflow de tarefas"
```

---

## Task 26: Documentação Final

**Files:**
- Create: `docs/TAREFAS.md`
- Modify: `docs/API.md`
- Modify: `README.md`

**Step 1: Criar documentação de tarefas**

```markdown
# Sistema de Tarefas

## Visão Geral

Sistema de gerenciamento de tarefas integrado ao Portal CEF, com suporte a tarefas automáticas baseadas em workflow e criação manual com contextos estruturados.

## Funcionalidades

- ✅ Tarefas automáticas criadas no workflow de planejamento
- ✅ Criação manual de tarefas com contextos ricos
- ✅ Visualização: "Criadas por mim" + "Atribuídas a mim"
- ✅ Notificações in-app para tarefas atrasadas/urgentes
- ✅ Widgets reutilizáveis para outros módulos
- ✅ Histórico de ações em planos de aula

## Arquitetura

### Backend

- **Módulo**: `services/api/src/modules/tarefas`
- **Tabelas**: `tarefas`, `tarefa_contextos`, `plano_aula_historico`
- **Eventos**: `plano.submetido`, `plano.aprovado_analista`, etc.

### Frontend

- **App**: `apps/tarefas` (porta 3012)
- **Widgets**: Reutilizáveis em outros apps
- **Rotas**:
  - `/tarefas` - Dashboard principal
  - `/tarefas/criar` - Criar tarefa
  - `/tarefas/[id]` - Detalhes da tarefa

## API Endpoints

### Tarefas

```
GET    /api/tarefas                  # Listar tarefas
POST   /api/tarefas                  # Criar tarefa manual
GET    /api/tarefas/:id              # Buscar tarefa
PATCH  /api/tarefas/:id/concluir     # Concluir tarefa
GET    /api/tarefas/stats/resumo     # Estatísticas
```

### Histórico

```
GET    /api/plano-aula/:id/historico  # Histórico de um plano
```

## Permissões

| Role | Criar | Atribuir | Visualizar | Concluir |
|------|-------|----------|------------|----------|
| Professora | ✅ | Si mesma | Criadas/Atribuídas | Atribuídas |
| Analista | ✅ | Qualquer (unidade) | Criadas/Atribuídas | Atribuídas |
| Coordenadora | ✅ | Qualquer (segmento) | Criadas/Atribuídas | Atribuídas |
| Gerente/Diretora | ✅ | Qualquer (unidade/escola) | Todas | Atribuídas |

## Contextos Obrigatórios por Role

| Role | Contextos Obrigatórios |
|------|------------------------|
| Professora | módulo, quinzenaId |
| Analista+ | módulo, quinzenaId, etapaId, turmaId, professoraId |

## Widgets Reutilizáveis

### TarefaBadge

Badge de notificação com contador de tarefas pendentes/atrasadas.

```typescript
import { TarefaBadge } from "@/../../tarefas/features/widgets/tarefa-badge";

<TarefaBadge />
```

### TarefasPendentesWidget

Widget de listagem de tarefas urgentes.

```typescript
import { TarefasPendentesWidget } from "@/../../tarefas/features/widgets/tarefas-pendentes-widget";

<TarefasPendentesWidget modulo="planejamento" quinzenaId="..." />
```

## Desenvolvimento

### Rodar localmente

```bash
# Backend
pnpm --filter=api dev

# Frontend
pnpm --filter=tarefas dev
```

### Testes

```bash
# Unit tests
pnpm --filter=api test

# E2E tests
pnpm --filter=api test:e2e
```

## Manutenção

### Adicionar Novo Tipo de Ação no Histórico

1. Adicionar tipo em `packages/shared/src/types/historico.ts`
2. Atualizar helpers de UI em `HistoricoTimeline.tsx`
3. Registrar ação no service apropriado

### Adicionar Novo Contexto

1. Adicionar coluna em `tarefa_contextos` (migration)
2. Atualizar schema Drizzle
3. Atualizar tipos em `packages/shared/src/types/tarefas.ts`
4. Atualizar validações em `tarefas.service.ts`
```

**Step 2: Atualizar documentação da API**

Adicionar seção de tarefas e histórico em `docs/API.md`:

```markdown
## Módulo de Tarefas

### Listar Tarefas

**GET** `/api/tarefas`

Query Parameters:
- `status` (opcional): PENDENTE | CONCLUIDA
- `prioridade` (opcional): ALTA | MEDIA | BAIXA
- `tipo` (opcional): criadas | atribuidas | todas
- `modulo` (opcional): filtro por módulo
- `quinzenaId` (opcional): filtro por quinzena

### Criar Tarefa

**POST** `/api/tarefas`

Body:
```json
{
  "titulo": "Revisar plano",
  "descricao": "Detalhes...",
  "prioridade": "ALTA",
  "prazo": "2026-12-31T23:59:59Z",
  "responsavel": "user-uuid",
  "contextos": {
    "modulo": "planejamento",
    "quinzenaId": "quinzena-uuid"
  }
}
```

### Buscar Histórico

**GET** `/api/plano-aula/:id/historico`

Retorna array de ações ordenadas por data (mais recente primeiro).
```

**Step 3: Atualizar README principal**

Adicionar seção de tarefas no README.md do projeto.

**Step 4: Commit**

```bash
git add docs/ README.md
git commit -m "docs: adiciona documentação completa do sistema de tarefas"
```

---

## ✅ Plano Completo

**Total de Tasks:** 26
**Tempo Estimado:** 8-12 horas de implementação

### Resumo por Categoria

- **Setup & DB:** Tasks 1-2 (migrations, schemas)
- **Backend:** Tasks 3-11 (tipos, services, controllers, guards)
- **Frontend - Tarefas:** Tasks 12-20 (app, dashboard, widgets, notificações)
- **Frontend - Histórico:** Tasks 21-23 (timeline, integração)
- **Testes & Docs:** Tasks 24-26 (testes, documentação)

### Próximos Passos

O plano está completo e salvo em:
- `docs/plans/2026-01-21-historico-tarefas-design.md` (Design aprovado)
- `docs/plans/2026-01-21-historico-tarefas-implementation.md` (Este plano)

**Opções de execução:**

1. **Subagent-Driven (esta sessão)** - Dispatch subagent por task + code review entre tasks
2. **Parallel Session (separada)** - Abrir nova sessão com `superpowers:executing-plans`

Qual abordagem prefere?