# Plano de Aula - Plano de Implementação

> **Para Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar este plano task-by-task.

**Goal:** Recriar o módulo de planejamento com fluxo de aprovação em 2 níveis (Analista → Coordenadora) baseado em upload de documentos.

**Architecture:** Novo módulo `plano-aula` separado do `plannings` existente. Schema com 4 tabelas (plano_aula, plano_documento, documento_comentario, quinzena_config). API REST com endpoints específicos por role. Frontend com telas distintas para cada perfil.

**Tech Stack:** NestJS (API), Drizzle ORM, PostgreSQL, MinIO (storage), Next.js 15 (frontend), shadcn/ui, TailwindCSS

---

## Fase 1: Schema e Migração

### Task 1.1: Criar schema plano-aula

**Files:**
- Create: `packages/db/src/schema/plano-aula.ts`
- Modify: `packages/db/src/schema/index.ts`

**Step 1: Criar arquivo do schema**

```typescript
// packages/db/src/schema/plano-aula.ts
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { turmas } from "./turmas.js";
import { units } from "./units.js";
import { users } from "./users.js";

// ============================================
// Status Enum
// ============================================
export const planoAulaStatusEnum = [
  "RASCUNHO",
  "AGUARDANDO_ANALISTA",
  "AGUARDANDO_COORDENADORA",
  "DEVOLVIDO_ANALISTA",
  "DEVOLVIDO_COORDENADORA",
  "REVISAO_ANALISTA",
  "APROVADO",
] as const;
export type PlanoAulaStatus = (typeof planoAulaStatusEnum)[number];

// ============================================
// Table: plano_aula
// ============================================
export const planoAula = pgTable(
  "plano_aula",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamentos
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    turmaId: uuid("turma_id")
      .notNull()
      .references(() => turmas.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),

    // Identificação
    quinzenaId: varchar("quinzena_id", { length: 10 }).notNull(), // Ex: "2026-Q01"

    // Status e fluxo
    status: text("status", { enum: planoAulaStatusEnum })
      .notNull()
      .default("RASCUNHO"),

    // Timestamps de workflow
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    // Timestamps padrão
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusIdx: index("plano_aula_status_idx").on(table.status),
    quinzenaIdx: index("plano_aula_quinzena_idx").on(table.quinzenaId),
    unitIdx: index("plano_aula_unit_idx").on(table.unitId),
    uniquePlanoIdx: uniqueIndex("plano_aula_user_turma_quinzena_unique").on(
      table.userId,
      table.turmaId,
      table.quinzenaId,
    ),
  }),
);

export type PlanoAula = typeof planoAula.$inferSelect;
export type NewPlanoAula = typeof planoAula.$inferInsert;

// ============================================
// Table: plano_documento
// ============================================
export const planoDocumento = pgTable(
  "plano_documento",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    planoId: uuid("plano_id")
      .notNull()
      .references(() => planoAula.id, { onDelete: "cascade" }),

    // Tipo do documento
    tipo: varchar("tipo", { length: 20 }).notNull(), // 'ARQUIVO' ou 'LINK_YOUTUBE'

    // Dados do arquivo (para tipo ARQUIVO)
    storageKey: varchar("storage_key", { length: 500 }),
    url: varchar("url", { length: 500 }),
    fileName: varchar("file_name", { length: 255 }),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    planoIdx: index("plano_documento_plano_idx").on(table.planoId),
  }),
);

export type PlanoDocumento = typeof planoDocumento.$inferSelect;
export type NewPlanoDocumento = typeof planoDocumento.$inferInsert;

// ============================================
// Table: documento_comentario
// ============================================
export const documentoComentario = pgTable(
  "documento_comentario",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    documentoId: uuid("documento_id")
      .notNull()
      .references(() => planoDocumento.id, { onDelete: "cascade" }),
    autorId: uuid("autor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    comentario: text("comentario").notNull(),
    resolved: boolean("resolved").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    documentoIdx: index("documento_comentario_documento_idx").on(
      table.documentoId,
    ),
  }),
);

export type DocumentoComentario = typeof documentoComentario.$inferSelect;
export type NewDocumentoComentario = typeof documentoComentario.$inferInsert;

// ============================================
// Table: quinzena_config
// ============================================
export const quinzenaConfig = pgTable(
  "quinzena_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    quinzenaId: varchar("quinzena_id", { length: 10 }).notNull(),

    deadline: timestamp("deadline", { withTimezone: true }).notNull(),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueConfigIdx: uniqueIndex("quinzena_config_unit_quinzena_unique").on(
      table.unitId,
      table.quinzenaId,
    ),
  }),
);

export type QuinzenaConfig = typeof quinzenaConfig.$inferSelect;
export type NewQuinzenaConfig = typeof quinzenaConfig.$inferInsert;

// ============================================
// Relations
// ============================================
export const planoAulaRelations = relations(planoAula, ({ one, many }) => ({
  user: one(users, {
    fields: [planoAula.userId],
    references: [users.id],
  }),
  turma: one(turmas, {
    fields: [planoAula.turmaId],
    references: [turmas.id],
  }),
  unit: one(units, {
    fields: [planoAula.unitId],
    references: [units.id],
  }),
  documentos: many(planoDocumento),
}));

export const planoDocumentoRelations = relations(
  planoDocumento,
  ({ one, many }) => ({
    plano: one(planoAula, {
      fields: [planoDocumento.planoId],
      references: [planoAula.id],
    }),
    comentarios: many(documentoComentario),
  }),
);

export const documentoComentarioRelations = relations(
  documentoComentario,
  ({ one }) => ({
    documento: one(planoDocumento, {
      fields: [documentoComentario.documentoId],
      references: [planoDocumento.id],
    }),
    autor: one(users, {
      fields: [documentoComentario.autorId],
      references: [users.id],
    }),
  }),
);

export const quinzenaConfigRelations = relations(quinzenaConfig, ({ one }) => ({
  unit: one(units, {
    fields: [quinzenaConfig.unitId],
    references: [units.id],
  }),
  createdByUser: one(users, {
    fields: [quinzenaConfig.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// Zod Schemas
// ============================================
export const insertPlanoAulaSchema = createInsertSchema(planoAula);
export const selectPlanoAulaSchema = createSelectSchema(planoAula);

export const insertPlanoDocumentoSchema = createInsertSchema(planoDocumento);
export const selectPlanoDocumentoSchema = createSelectSchema(planoDocumento);

export const insertDocumentoComentarioSchema =
  createInsertSchema(documentoComentario);
export const selectDocumentoComentarioSchema =
  createSelectSchema(documentoComentario);

export const insertQuinzenaConfigSchema = createInsertSchema(quinzenaConfig);
export const selectQuinzenaConfigSchema = createSelectSchema(quinzenaConfig);
```

**Step 2: Atualizar index.ts do schema**

Adicionar ao final de `packages/db/src/schema/index.ts`:

```typescript
export * from "./plano-aula.js";
```

**Step 3: Verificar tipos**

Run: `cd /var/www/essencia && pnpm turbo typecheck --filter=@essencia/db`
Expected: PASS sem erros

**Step 4: Commit**

```bash
git add packages/db/src/schema/plano-aula.ts packages/db/src/schema/index.ts
git commit -m "feat(db): adiciona schema plano-aula com tabelas de documento e comentário"
```

---

### Task 1.2: Gerar e aplicar migration

**Files:**
- Create: `packages/db/drizzle/XXXX_plano_aula.sql` (gerado)

**Step 1: Gerar migration**

Run: `cd /var/www/essencia && pnpm db:generate`
Expected: Migration file criado em `packages/db/drizzle/`

**Step 2: Verificar SQL gerado**

Verificar que o arquivo contém:
- CREATE TABLE plano_aula
- CREATE TABLE plano_documento
- CREATE TABLE documento_comentario
- CREATE TABLE quinzena_config
- Índices e constraints

**Step 3: Aplicar migration (dev)**

Run: `cd /var/www/essencia && pnpm db:migrate`
Expected: Migration aplicada com sucesso

**Step 4: Verificar tabelas no banco**

Run: `docker exec essencia-postgres psql -U essencia -d essencia_db -c "\dt plano*"`
Expected: Lista tabelas plano_aula, plano_documento

**Step 5: Commit**

```bash
git add packages/db/drizzle/
git commit -m "chore(db): migration para tabelas plano-aula"
```

---

## Fase 2: API Backend - Service Base

### Task 2.1: Criar módulo plano-aula (estrutura)

**Files:**
- Create: `services/api/src/modules/plano-aula/plano-aula.module.ts`
- Create: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Create: `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- Create: `services/api/src/modules/plano-aula/index.ts`
- Create: `services/api/src/modules/plano-aula/dto/plano-aula.dto.ts`

**Step 1: Criar estrutura de pastas**

```bash
mkdir -p services/api/src/modules/plano-aula/dto
```

**Step 2: Criar DTOs**

```typescript
// services/api/src/modules/plano-aula/dto/plano-aula.dto.ts
import { z } from "zod";

export const createPlanoSchema = z.object({
  turmaId: z.string().uuid(),
  quinzenaId: z.string().regex(/^\d{4}-Q\d{2}$/),
});

export type CreatePlanoDto = z.infer<typeof createPlanoSchema>;

export const addDocumentoSchema = z.object({
  tipo: z.enum(["ARQUIVO", "LINK_YOUTUBE"]),
  url: z.string().url().optional(),
  storageKey: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
});

export type AddDocumentoDto = z.infer<typeof addDocumentoSchema>;

export const addComentarioSchema = z.object({
  documentoId: z.string().uuid(),
  comentario: z.string().min(1).max(2000),
});

export type AddComentarioDto = z.infer<typeof addComentarioSchema>;

export const devolverPlanoSchema = z.object({
  destino: z.enum(["PROFESSORA", "ANALISTA"]).optional(),
  comentarios: z.array(
    z.object({
      documentoId: z.string().uuid(),
      comentario: z.string().min(1),
    }),
  ).optional(),
});

export type DevolverPlanoDto = z.infer<typeof devolverPlanoSchema>;

export const setDeadlineSchema = z.object({
  quinzenaId: z.string().regex(/^\d{4}-Q\d{2}$/),
  deadline: z.string().datetime(),
});

export type SetDeadlineDto = z.infer<typeof setDeadlineSchema>;
```

**Step 3: Criar service base**

```typescript
// services/api/src/modules/plano-aula/plano-aula.service.ts
import {
  and,
  desc,
  eq,
  getDb,
  inArray,
  planoAula,
  planoDocumento,
  documentoComentario,
  quinzenaConfig,
  turmas,
  users,
  educationStages,
} from "@essencia/db";
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreatePlanoDto,
  AddComentarioDto,
  SetDeadlineDto,
} from "./dto/plano-aula.dto";

export interface UserContext {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
}

// Roles que podem aprovar como Analista
const ANALISTA_ROLES = ["analista_pedagogico"];

// Roles que podem aprovar como Coordenadora (por segmento)
const COORDENADORA_ROLES = [
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
];

// Roles de gestão (visualização)
const GESTAO_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
];

@Injectable()
export class PlanoAulaService {
  private readonly logger = new Logger(PlanoAulaService.name);

  // ==========================================
  // Professora: Criar/Editar Plano
  // ==========================================

  async criarPlano(user: UserContext, dto: CreatePlanoDto) {
    if (!user.unitId) {
      throw new ForbiddenException("Usuário não está associado a uma unidade");
    }

    const db = getDb();

    // Verificar se já existe plano para essa turma/quinzena
    const [existente] = await db
      .select({ id: planoAula.id })
      .from(planoAula)
      .where(
        and(
          eq(planoAula.userId, user.userId),
          eq(planoAula.turmaId, dto.turmaId),
          eq(planoAula.quinzenaId, dto.quinzenaId),
        ),
      );

    if (existente) {
      return { id: existente.id, created: false };
    }

    const [plano] = await db
      .insert(planoAula)
      .values({
        userId: user.userId,
        turmaId: dto.turmaId,
        unitId: user.unitId,
        quinzenaId: dto.quinzenaId,
        status: "RASCUNHO",
      })
      .returning();

    this.logger.log(`Plano criado: ${plano.id}`);
    return { id: plano.id, created: true };
  }

  async getPlanoById(user: UserContext, planoId: string) {
    const db = getDb();

    const [plano] = await db
      .select({
        id: planoAula.id,
        userId: planoAula.userId,
        turmaId: planoAula.turmaId,
        quinzenaId: planoAula.quinzenaId,
        status: planoAula.status,
        submittedAt: planoAula.submittedAt,
        approvedAt: planoAula.approvedAt,
        createdAt: planoAula.createdAt,
        updatedAt: planoAula.updatedAt,
        unitId: planoAula.unitId,
        professorName: users.name,
        turmaName: turmas.name,
        turmaCode: turmas.code,
        stageId: turmas.stageId,
      })
      .from(planoAula)
      .innerJoin(users, eq(planoAula.userId, users.id))
      .innerJoin(turmas, eq(planoAula.turmaId, turmas.id))
      .where(eq(planoAula.id, planoId));

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    // Verificar acesso
    this.verificarAcesso(user, plano);

    // Buscar documentos
    const documentos = await db
      .select()
      .from(planoDocumento)
      .where(eq(planoDocumento.planoId, planoId))
      .orderBy(desc(planoDocumento.createdAt));

    // Buscar comentários de cada documento
    const documentosComComentarios = await Promise.all(
      documentos.map(async (doc) => {
        const comentarios = await db
          .select({
            id: documentoComentario.id,
            comentario: documentoComentario.comentario,
            resolved: documentoComentario.resolved,
            createdAt: documentoComentario.createdAt,
            autorId: documentoComentario.autorId,
            autorName: users.name,
          })
          .from(documentoComentario)
          .innerJoin(users, eq(documentoComentario.autorId, users.id))
          .where(eq(documentoComentario.documentoId, doc.id))
          .orderBy(desc(documentoComentario.createdAt));

        return { ...doc, comentarios };
      }),
    );

    // Buscar deadline
    const [config] = await db
      .select({ deadline: quinzenaConfig.deadline })
      .from(quinzenaConfig)
      .where(
        and(
          eq(quinzenaConfig.unitId, plano.unitId),
          eq(quinzenaConfig.quinzenaId, plano.quinzenaId),
        ),
      );

    return {
      ...plano,
      documentos: documentosComComentarios,
      deadline: config?.deadline || null,
    };
  }

  private verificarAcesso(user: UserContext, plano: { userId: string; unitId: string }) {
    const isOwner = plano.userId === user.userId;
    const isSameUnit = plano.unitId === user.unitId;
    const isGestao = GESTAO_ROLES.includes(user.role);
    const isAnalista = ANALISTA_ROLES.includes(user.role);
    const isCoordenadora = COORDENADORA_ROLES.includes(user.role);

    if (!isOwner && !isGestao && !(isSameUnit && (isAnalista || isCoordenadora))) {
      throw new ForbiddenException("Acesso negado a este plano");
    }
  }

  // ==========================================
  // Professora: Submeter para Análise
  // ==========================================

  async submeterPlano(user: UserContext, planoId: string) {
    const db = getDb();

    const [plano] = await db
      .select()
      .from(planoAula)
      .where(eq(planoAula.id, planoId));

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.userId !== user.userId) {
      throw new ForbiddenException("Apenas o autor pode submeter o plano");
    }

    const statusPermitidos = ["RASCUNHO", "DEVOLVIDO_ANALISTA", "DEVOLVIDO_COORDENADORA"];
    if (!statusPermitidos.includes(plano.status)) {
      throw new ForbiddenException(`Não é possível submeter plano com status ${plano.status}`);
    }

    // Verificar se tem pelo menos 1 documento
    const [docCount] = await db
      .select({ count: planoDocumento.id })
      .from(planoDocumento)
      .where(eq(planoDocumento.planoId, planoId));

    if (!docCount) {
      throw new ForbiddenException("Adicione pelo menos um documento antes de submeter");
    }

    await db
      .update(planoAula)
      .set({
        status: "AGUARDANDO_ANALISTA",
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(planoAula.id, planoId));

    this.logger.log(`Plano ${planoId} submetido para análise`);
    return { success: true };
  }

  // ==========================================
  // Analista: Listar Pendentes
  // ==========================================

  async listarPendentesAnalista(user: UserContext) {
    if (!ANALISTA_ROLES.includes(user.role) && !GESTAO_ROLES.includes(user.role)) {
      throw new ForbiddenException("Acesso negado");
    }

    const db = getDb();

    const planos = await db
      .select({
        id: planoAula.id,
        quinzenaId: planoAula.quinzenaId,
        status: planoAula.status,
        submittedAt: planoAula.submittedAt,
        professorName: users.name,
        turmaName: turmas.name,
        turmaCode: turmas.code,
        stageCode: educationStages.code,
        stageName: educationStages.name,
      })
      .from(planoAula)
      .innerJoin(users, eq(planoAula.userId, users.id))
      .innerJoin(turmas, eq(planoAula.turmaId, turmas.id))
      .leftJoin(educationStages, eq(turmas.stageId, educationStages.id))
      .where(
        and(
          eq(planoAula.unitId, user.unitId!),
          inArray(planoAula.status, ["AGUARDANDO_ANALISTA", "REVISAO_ANALISTA"]),
        ),
      )
      .orderBy(planoAula.submittedAt);

    return planos;
  }

  // ==========================================
  // Analista: Aprovar / Devolver
  // ==========================================

  async aprovarComoAnalista(user: UserContext, planoId: string) {
    if (!ANALISTA_ROLES.includes(user.role)) {
      throw new ForbiddenException("Apenas analista pedagógica pode aprovar");
    }

    const db = getDb();

    const [plano] = await db
      .select()
      .from(planoAula)
      .where(eq(planoAula.id, planoId));

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.unitId !== user.unitId) {
      throw new ForbiddenException("Plano não pertence à sua unidade");
    }

    const statusPermitidos = ["AGUARDANDO_ANALISTA", "REVISAO_ANALISTA"];
    if (!statusPermitidos.includes(plano.status)) {
      throw new ForbiddenException(`Não é possível aprovar plano com status ${plano.status}`);
    }

    await db
      .update(planoAula)
      .set({
        status: "AGUARDANDO_COORDENADORA",
        updatedAt: new Date(),
      })
      .where(eq(planoAula.id, planoId));

    this.logger.log(`Plano ${planoId} aprovado pela analista, enviado para coordenação`);
    return { success: true };
  }

  async devolverComoAnalista(user: UserContext, planoId: string, comentarios?: { documentoId: string; comentario: string }[]) {
    if (!ANALISTA_ROLES.includes(user.role)) {
      throw new ForbiddenException("Apenas analista pedagógica pode devolver");
    }

    const db = getDb();

    const [plano] = await db
      .select()
      .from(planoAula)
      .where(eq(planoAula.id, planoId));

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.unitId !== user.unitId) {
      throw new ForbiddenException("Plano não pertence à sua unidade");
    }

    // Adicionar comentários se fornecidos
    if (comentarios && comentarios.length > 0) {
      await db.insert(documentoComentario).values(
        comentarios.map((c) => ({
          documentoId: c.documentoId,
          autorId: user.userId,
          comentario: c.comentario,
        })),
      );
    }

    await db
      .update(planoAula)
      .set({
        status: "DEVOLVIDO_ANALISTA",
        updatedAt: new Date(),
      })
      .where(eq(planoAula.id, planoId));

    this.logger.log(`Plano ${planoId} devolvido pela analista`);
    return { success: true };
  }

  // ==========================================
  // Coordenadora: Listar Pendentes
  // ==========================================

  async listarPendentesCoordenadora(user: UserContext) {
    if (!COORDENADORA_ROLES.includes(user.role) && !GESTAO_ROLES.includes(user.role)) {
      throw new ForbiddenException("Acesso negado");
    }

    const db = getDb();

    // Mapear role para stageId (se coordenadora de segmento)
    const stageFilter = this.getStageFilterForRole(user.role);

    let query = db
      .select({
        id: planoAula.id,
        quinzenaId: planoAula.quinzenaId,
        status: planoAula.status,
        submittedAt: planoAula.submittedAt,
        professorName: users.name,
        turmaName: turmas.name,
        turmaCode: turmas.code,
        stageCode: educationStages.code,
        stageName: educationStages.name,
      })
      .from(planoAula)
      .innerJoin(users, eq(planoAula.userId, users.id))
      .innerJoin(turmas, eq(planoAula.turmaId, turmas.id))
      .leftJoin(educationStages, eq(turmas.stageId, educationStages.id))
      .where(
        and(
          eq(planoAula.unitId, user.unitId!),
          eq(planoAula.status, "AGUARDANDO_COORDENADORA"),
        ),
      )
      .orderBy(planoAula.submittedAt);

    const planos = await query;

    // Filtrar por segmento se for coordenadora específica
    if (stageFilter) {
      return planos.filter((p) => p.stageCode === stageFilter);
    }

    return planos;
  }

  private getStageFilterForRole(role: string): string | null {
    const mapping: Record<string, string> = {
      coordenadora_bercario: "BERCARIO",
      coordenadora_infantil: "INFANTIL",
      coordenadora_fundamental_i: "FUNDAMENTAL_I",
      coordenadora_fundamental_ii: "FUNDAMENTAL_II",
    };
    return mapping[role] || null;
  }

  // ==========================================
  // Coordenadora: Aprovar / Devolver
  // ==========================================

  async aprovarComoCoordenadora(user: UserContext, planoId: string) {
    if (!COORDENADORA_ROLES.includes(user.role) && !GESTAO_ROLES.includes(user.role)) {
      throw new ForbiddenException("Apenas coordenadora pode aprovar");
    }

    const db = getDb();

    const [plano] = await db
      .select({
        id: planoAula.id,
        status: planoAula.status,
        unitId: planoAula.unitId,
        stageCode: educationStages.code,
      })
      .from(planoAula)
      .innerJoin(turmas, eq(planoAula.turmaId, turmas.id))
      .leftJoin(educationStages, eq(turmas.stageId, educationStages.id))
      .where(eq(planoAula.id, planoId));

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.unitId !== user.unitId) {
      throw new ForbiddenException("Plano não pertence à sua unidade");
    }

    // Verificar se coordenadora tem acesso ao segmento
    const stageFilter = this.getStageFilterForRole(user.role);
    if (stageFilter && plano.stageCode !== stageFilter) {
      throw new ForbiddenException("Você não tem permissão para aprovar planos deste segmento");
    }

    if (plano.status !== "AGUARDANDO_COORDENADORA") {
      throw new ForbiddenException(`Não é possível aprovar plano com status ${plano.status}`);
    }

    await db
      .update(planoAula)
      .set({
        status: "APROVADO",
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(planoAula.id, planoId));

    this.logger.log(`Plano ${planoId} aprovado pela coordenadora`);
    return { success: true };
  }

  async devolverComoCoordenadora(
    user: UserContext,
    planoId: string,
    destino: "PROFESSORA" | "ANALISTA",
    comentarios?: { documentoId: string; comentario: string }[],
  ) {
    if (!COORDENADORA_ROLES.includes(user.role) && !GESTAO_ROLES.includes(user.role)) {
      throw new ForbiddenException("Apenas coordenadora pode devolver");
    }

    const db = getDb();

    const [plano] = await db
      .select()
      .from(planoAula)
      .where(eq(planoAula.id, planoId));

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.unitId !== user.unitId) {
      throw new ForbiddenException("Plano não pertence à sua unidade");
    }

    // Adicionar comentários se fornecidos
    if (comentarios && comentarios.length > 0) {
      await db.insert(documentoComentario).values(
        comentarios.map((c) => ({
          documentoId: c.documentoId,
          autorId: user.userId,
          comentario: c.comentario,
        })),
      );
    }

    const novoStatus = destino === "ANALISTA" ? "REVISAO_ANALISTA" : "DEVOLVIDO_COORDENADORA";

    await db
      .update(planoAula)
      .set({
        status: novoStatus,
        updatedAt: new Date(),
      })
      .where(eq(planoAula.id, planoId));

    this.logger.log(`Plano ${planoId} devolvido pela coordenadora para ${destino}`);
    return { success: true };
  }

  // ==========================================
  // Gestão: Dashboard
  // ==========================================

  async getDashboard(user: UserContext, unitId?: string) {
    if (!GESTAO_ROLES.includes(user.role) && !COORDENADORA_ROLES.includes(user.role) && !ANALISTA_ROLES.includes(user.role)) {
      throw new ForbiddenException("Acesso negado ao dashboard");
    }

    const db = getDb();
    const targetUnitId = unitId || user.unitId;

    if (!targetUnitId) {
      throw new ForbiddenException("Unidade não especificada");
    }

    // Contar planos por status
    const planos = await db
      .select({
        status: planoAula.status,
        stageCode: educationStages.code,
      })
      .from(planoAula)
      .innerJoin(turmas, eq(planoAula.turmaId, turmas.id))
      .leftJoin(educationStages, eq(turmas.stageId, educationStages.id))
      .where(eq(planoAula.unitId, targetUnitId));

    const stats = {
      total: planos.length,
      rascunho: planos.filter((p) => p.status === "RASCUNHO").length,
      aguardandoAnalista: planos.filter((p) => p.status === "AGUARDANDO_ANALISTA").length,
      aguardandoCoordenadora: planos.filter((p) => p.status === "AGUARDANDO_COORDENADORA").length,
      devolvidos: planos.filter((p) =>
        ["DEVOLVIDO_ANALISTA", "DEVOLVIDO_COORDENADORA", "REVISAO_ANALISTA"].includes(p.status),
      ).length,
      aprovados: planos.filter((p) => p.status === "APROVADO").length,
    };

    // Agrupar por segmento
    const porSegmento = planos.reduce(
      (acc, p) => {
        const stage = p.stageCode || "SEM_ETAPA";
        if (!acc[stage]) {
          acc[stage] = { total: 0, aprovados: 0 };
        }
        acc[stage].total++;
        if (p.status === "APROVADO") {
          acc[stage].aprovados++;
        }
        return acc;
      },
      {} as Record<string, { total: number; aprovados: number }>,
    );

    return { stats, porSegmento };
  }

  // ==========================================
  // Configuração: Deadline
  // ==========================================

  async setDeadline(user: UserContext, dto: SetDeadlineDto) {
    if (!["coordenadora_geral", "master", "diretora_geral", "gerente_unidade"].includes(user.role)) {
      throw new ForbiddenException("Apenas coordenadora geral pode definir prazos");
    }

    if (!user.unitId) {
      throw new ForbiddenException("Usuário não está associado a uma unidade");
    }

    const db = getDb();

    await db
      .insert(quinzenaConfig)
      .values({
        unitId: user.unitId,
        quinzenaId: dto.quinzenaId,
        deadline: new Date(dto.deadline),
        createdBy: user.userId,
      })
      .onConflictDoUpdate({
        target: [quinzenaConfig.unitId, quinzenaConfig.quinzenaId],
        set: {
          deadline: new Date(dto.deadline),
          updatedAt: new Date(),
        },
      });

    this.logger.log(`Deadline definido para ${dto.quinzenaId}: ${dto.deadline}`);
    return { success: true };
  }

  async getDeadlines(user: UserContext) {
    if (!user.unitId) {
      throw new ForbiddenException("Usuário não está associado a uma unidade");
    }

    const db = getDb();

    const configs = await db
      .select()
      .from(quinzenaConfig)
      .where(eq(quinzenaConfig.unitId, user.unitId))
      .orderBy(quinzenaConfig.quinzenaId);

    return configs;
  }
}
```

**Step 4: Criar module**

```typescript
// services/api/src/modules/plano-aula/plano-aula.module.ts
import { Module } from "@nestjs/common";
import { StorageModule } from "../../common/storage/storage.module";
import { PlanoAulaController } from "./plano-aula.controller";
import { PlanoAulaService } from "./plano-aula.service";

@Module({
  imports: [StorageModule],
  controllers: [PlanoAulaController],
  providers: [PlanoAulaService],
  exports: [PlanoAulaService],
})
export class PlanoAulaModule {}
```

**Step 5: Criar index**

```typescript
// services/api/src/modules/plano-aula/index.ts
export * from "./plano-aula.module";
export * from "./plano-aula.service";
export * from "./plano-aula.controller";
```

**Step 6: Verificar tipos**

Run: `cd /var/www/essencia && pnpm turbo typecheck --filter=api`
Expected: PASS (pode ter erros no controller que ainda não criamos)

**Step 7: Commit**

```bash
git add services/api/src/modules/plano-aula/
git commit -m "feat(api): adiciona PlanoAulaService com lógica de workflow"
```

---

### Task 2.2: Criar controller plano-aula

**Files:**
- Create: `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- Modify: `services/api/src/app.module.ts`

**Step 1: Criar controller**

```typescript
// services/api/src/modules/plano-aula/plano-aula.controller.ts
import { MultipartFile } from "@fastify/multipart";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "../../common/storage/storage.service";
import { PlanoAulaService, UserContext } from "./plano-aula.service";
import {
  createPlanoSchema,
  addComentarioSchema,
  devolverPlanoSchema,
  setDeadlineSchema,
} from "./dto/plano-aula.dto";
import { getDb, planoDocumento, eq } from "@essencia/db";

interface AuthenticatedRequest extends FastifyRequest {
  user: UserContext;
  isMultipart: () => boolean;
  file: () => Promise<MultipartFile>;
}

const ALL_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "analista_pedagogico",
  "professora",
];

@Controller("plano-aula")
@UseGuards(AuthGuard, RolesGuard)
export class PlanoAulaController {
  constructor(
    private readonly service: PlanoAulaService,
    private readonly storageService: StorageService,
  ) {}

  // ==========================================
  // Professora
  // ==========================================

  @Post()
  @Roles("professora")
  async criarPlano(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = createPlanoSchema.parse(body);
    const result = await this.service.criarPlano(req.user, dto);
    return { success: true, data: result };
  }

  @Get(":id")
  @Roles(...ALL_ROLES)
  async getPlano(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const plano = await this.service.getPlanoById(req.user, id);
    return { success: true, data: plano };
  }

  @Post(":id/documentos/upload")
  @Roles("professora")
  async uploadDocumento(
    @Req() req: AuthenticatedRequest,
    @Param("id") planoId: string,
  ) {
    if (!req.isMultipart()) {
      throw new BadRequestException("Request deve ser multipart/form-data");
    }

    const data = await req.file();
    if (!data) {
      throw new BadRequestException("Nenhum arquivo enviado");
    }

    // Validar tipo
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/png",
      "image/jpeg",
    ];

    if (!allowedMimeTypes.includes(data.mimetype)) {
      throw new BadRequestException("Tipo de arquivo não permitido");
    }

    // Validar tamanho (10MB)
    const buffer = await data.toBuffer();
    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException("Arquivo muito grande (máx 10MB)");
    }

    // Upload para MinIO
    const uploadResult = await this.storageService.uploadFile(data);

    // Salvar no banco
    const db = getDb();
    const [documento] = await db
      .insert(planoDocumento)
      .values({
        planoId,
        tipo: "ARQUIVO",
        storageKey: uploadResult.key,
        url: uploadResult.url,
        fileName: uploadResult.name,
        fileSize: buffer.length,
        mimeType: data.mimetype,
      })
      .returning();

    return { success: true, data: documento };
  }

  @Post(":id/documentos/link")
  @Roles("professora")
  async addLink(
    @Req() req: AuthenticatedRequest,
    @Param("id") planoId: string,
    @Body() body: { url: string },
  ) {
    if (!body.url || !body.url.includes("youtube")) {
      throw new BadRequestException("URL do YouTube inválida");
    }

    const db = getDb();
    const [documento] = await db
      .insert(planoDocumento)
      .values({
        planoId,
        tipo: "LINK_YOUTUBE",
        url: body.url,
      })
      .returning();

    return { success: true, data: documento };
  }

  @Delete(":planoId/documentos/:docId")
  @Roles("professora")
  async deleteDocumento(
    @Req() req: AuthenticatedRequest,
    @Param("planoId") planoId: string,
    @Param("docId") docId: string,
  ) {
    const db = getDb();
    await db.delete(planoDocumento).where(eq(planoDocumento.id, docId));
    return { success: true };
  }

  @Post(":id/submeter")
  @Roles("professora")
  async submeterPlano(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    const result = await this.service.submeterPlano(req.user, id);
    return { success: true, data: result };
  }

  // ==========================================
  // Analista
  // ==========================================

  @Get("analista/pendentes")
  @Roles("analista_pedagogico", "master", "diretora_geral", "gerente_unidade", "coordenadora_geral")
  async listarPendentesAnalista(@Req() req: AuthenticatedRequest) {
    const planos = await this.service.listarPendentesAnalista(req.user);
    return { success: true, data: planos };
  }

  @Post(":id/analista/aprovar")
  @Roles("analista_pedagogico")
  async aprovarAnalista(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    const result = await this.service.aprovarComoAnalista(req.user, id);
    return { success: true, data: result };
  }

  @Post(":id/analista/devolver")
  @Roles("analista_pedagogico")
  async devolverAnalista(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const dto = devolverPlanoSchema.parse(body);
    const result = await this.service.devolverComoAnalista(req.user, id, dto.comentarios);
    return { success: true, data: result };
  }

  // ==========================================
  // Coordenadora
  // ==========================================

  @Get("coordenadora/pendentes")
  @Roles(
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_geral",
    "master",
    "diretora_geral",
    "gerente_unidade",
  )
  async listarPendentesCoordenadora(@Req() req: AuthenticatedRequest) {
    const planos = await this.service.listarPendentesCoordenadora(req.user);
    return { success: true, data: planos };
  }

  @Post(":id/coordenadora/aprovar")
  @Roles(
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_geral",
  )
  async aprovarCoordenadora(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    const result = await this.service.aprovarComoCoordenadora(req.user, id);
    return { success: true, data: result };
  }

  @Post(":id/coordenadora/devolver")
  @Roles(
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_geral",
  )
  async devolverCoordenadora(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const dto = devolverPlanoSchema.parse(body);
    const destino = dto.destino || "PROFESSORA";
    const result = await this.service.devolverComoCoordenadora(
      req.user,
      id,
      destino,
      dto.comentarios,
    );
    return { success: true, data: result };
  }

  // ==========================================
  // Comentários
  // ==========================================

  @Post("comentarios")
  @Roles("analista_pedagogico", ...ALL_ROLES.filter((r) => r.startsWith("coordenadora")))
  async addComentario(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = addComentarioSchema.parse(body);
    const db = getDb();

    const [comentario] = await db
      .insert(require("@essencia/db").documentoComentario)
      .values({
        documentoId: dto.documentoId,
        autorId: req.user.userId,
        comentario: dto.comentario,
      })
      .returning();

    return { success: true, data: comentario };
  }

  // ==========================================
  // Dashboard e Configurações
  // ==========================================

  @Get("dashboard")
  @Roles(...ALL_ROLES)
  async getDashboard(@Req() req: AuthenticatedRequest) {
    const result = await this.service.getDashboard(req.user);
    return { success: true, data: result };
  }

  @Post("config/deadline")
  @Roles("coordenadora_geral", "master", "diretora_geral", "gerente_unidade")
  async setDeadline(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = setDeadlineSchema.parse(body);
    const result = await this.service.setDeadline(req.user, dto);
    return { success: true, data: result };
  }

  @Get("config/deadlines")
  @Roles(...ALL_ROLES)
  async getDeadlines(@Req() req: AuthenticatedRequest) {
    const result = await this.service.getDeadlines(req.user);
    return { success: true, data: result };
  }
}
```

**Step 2: Registrar módulo no app.module.ts**

Adicionar import e módulo em `services/api/src/app.module.ts`:

```typescript
import { PlanoAulaModule } from "./modules/plano-aula";

@Module({
  imports: [
    // ... outros módulos
    PlanoAulaModule,
  ],
})
```

**Step 3: Verificar lint e tipos**

Run: `cd /var/www/essencia && pnpm turbo lint && pnpm turbo typecheck --filter=api`
Expected: PASS

**Step 4: Commit**

```bash
git add services/api/src/modules/plano-aula/ services/api/src/app.module.ts
git commit -m "feat(api): adiciona PlanoAulaController com endpoints completos"
```

---

## Fase 3: Frontend - Professora

### Task 3.1: Criar hooks e tipos para plano-aula

**Files:**
- Create: `apps/planejamento/features/plano-aula/types.ts`
- Create: `apps/planejamento/features/plano-aula/hooks/use-plano-aula.ts`
- Create: `apps/planejamento/features/plano-aula/hooks/index.ts`

**Step 1: Criar tipos**

```typescript
// apps/planejamento/features/plano-aula/types.ts
export type PlanoAulaStatus =
  | "RASCUNHO"
  | "AGUARDANDO_ANALISTA"
  | "AGUARDANDO_COORDENADORA"
  | "DEVOLVIDO_ANALISTA"
  | "DEVOLVIDO_COORDENADORA"
  | "REVISAO_ANALISTA"
  | "APROVADO";

export interface PlanoDocumento {
  id: string;
  planoId: string;
  tipo: "ARQUIVO" | "LINK_YOUTUBE";
  storageKey?: string;
  url?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  comentarios: DocumentoComentario[];
}

export interface DocumentoComentario {
  id: string;
  comentario: string;
  resolved: boolean;
  createdAt: string;
  autorId: string;
  autorName: string;
}

export interface PlanoAula {
  id: string;
  userId: string;
  turmaId: string;
  quinzenaId: string;
  status: PlanoAulaStatus;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  unitId: string;
  professorName: string;
  turmaName: string;
  turmaCode: string;
  stageId?: string;
  documentos: PlanoDocumento[];
  deadline?: string;
}

export interface PlanoAulaSummary {
  id: string;
  quinzenaId: string;
  status: PlanoAulaStatus;
  submittedAt?: string;
  professorName: string;
  turmaName: string;
  turmaCode: string;
  stageCode?: string;
  stageName?: string;
}

export interface DashboardStats {
  total: number;
  rascunho: number;
  aguardandoAnalista: number;
  aguardandoCoordenadora: number;
  devolvidos: number;
  aprovados: number;
}

export interface DashboardData {
  stats: DashboardStats;
  porSegmento: Record<string, { total: number; aprovados: number }>;
}
```

**Step 2: Criar hooks**

```typescript
// apps/planejamento/features/plano-aula/hooks/use-plano-aula.ts
"use client";

import { serverFetch } from "@essencia/shared/fetchers/server";
import { useCallback, useState } from "react";
import type { PlanoAula, PlanoAulaSummary, DashboardData } from "../types";

export function usePlanoAula() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criarPlano = useCallback(async (turmaId: string, quinzenaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await serverFetch("/plano-aula", {
        method: "POST",
        body: JSON.stringify({ turmaId, quinzenaId }),
      });
      return res.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar plano");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPlano = useCallback(async (id: string): Promise<PlanoAula> => {
    setLoading(true);
    setError(null);
    try {
      const res = await serverFetch(`/plano-aula/${id}`);
      return res.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar plano");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadDocumento = useCallback(async (planoId: string, file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await serverFetch(`/plano-aula/${planoId}/documentos/upload`, {
        method: "POST",
        body: formData,
        headers: {}, // Let browser set content-type for multipart
      });
      return res.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer upload");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addLink = useCallback(async (planoId: string, url: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await serverFetch(`/plano-aula/${planoId}/documentos/link`, {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      return res.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar link");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteDocumento = useCallback(async (planoId: string, docId: string) => {
    setLoading(true);
    setError(null);
    try {
      await serverFetch(`/plano-aula/${planoId}/documentos/${docId}`, {
        method: "DELETE",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir documento");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const submeterPlano = useCallback(async (planoId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await serverFetch(`/plano-aula/${planoId}/submeter`, {
        method: "POST",
      });
      return res.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao submeter plano");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    criarPlano,
    getPlano,
    uploadDocumento,
    addLink,
    deleteDocumento,
    submeterPlano,
  };
}

export function useAnalistaActions() {
  const [loading, setLoading] = useState(false);

  const listarPendentes = useCallback(async (): Promise<PlanoAulaSummary[]> => {
    const res = await serverFetch("/plano-aula/analista/pendentes");
    return res.data;
  }, []);

  const aprovar = useCallback(async (planoId: string) => {
    setLoading(true);
    try {
      await serverFetch(`/plano-aula/${planoId}/analista/aprovar`, {
        method: "POST",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const devolver = useCallback(
    async (planoId: string, comentarios?: { documentoId: string; comentario: string }[]) => {
      setLoading(true);
      try {
        await serverFetch(`/plano-aula/${planoId}/analista/devolver`, {
          method: "POST",
          body: JSON.stringify({ comentarios }),
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, listarPendentes, aprovar, devolver };
}

export function useCoordenadoraActions() {
  const [loading, setLoading] = useState(false);

  const listarPendentes = useCallback(async (): Promise<PlanoAulaSummary[]> => {
    const res = await serverFetch("/plano-aula/coordenadora/pendentes");
    return res.data;
  }, []);

  const aprovar = useCallback(async (planoId: string) => {
    setLoading(true);
    try {
      await serverFetch(`/plano-aula/${planoId}/coordenadora/aprovar`, {
        method: "POST",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const devolver = useCallback(
    async (
      planoId: string,
      destino: "PROFESSORA" | "ANALISTA",
      comentarios?: { documentoId: string; comentario: string }[],
    ) => {
      setLoading(true);
      try {
        await serverFetch(`/plano-aula/${planoId}/coordenadora/devolver`, {
          method: "POST",
          body: JSON.stringify({ destino, comentarios }),
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, listarPendentes, aprovar, devolver };
}

export function useDashboard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await serverFetch("/plano-aula/dashboard");
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, data, fetchDashboard };
}
```

**Step 3: Criar index**

```typescript
// apps/planejamento/features/plano-aula/hooks/index.ts
export * from "./use-plano-aula";
```

**Step 4: Verificar tipos**

Run: `cd /var/www/essencia && pnpm turbo typecheck --filter=planejamento`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/planejamento/features/plano-aula/
git commit -m "feat(planejamento): adiciona hooks e tipos para plano-aula"
```

---

### Task 3.2: Criar componente de upload de documentos

**Files:**
- Create: `apps/planejamento/features/plano-aula/components/documento-upload.tsx`
- Create: `apps/planejamento/features/plano-aula/components/documento-list.tsx`
- Create: `apps/planejamento/features/plano-aula/components/index.ts`

**Step 1: Criar componente de upload**

```typescript
// apps/planejamento/features/plano-aula/components/documento-upload.tsx
"use client";

import { Button } from "@essencia/components/ui/button";
import { Input } from "@essencia/components/ui/input";
import { Upload, Link, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

interface DocumentoUploadProps {
  onUpload: (file: File) => Promise<void>;
  onAddLink: (url: string) => Promise<void>;
  disabled?: boolean;
}

export function DocumentoUpload({ onUpload, onAddLink, disabled }: DocumentoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        await onUpload(file);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [onUpload],
  );

  const handleAddLink = useCallback(async () => {
    if (!linkUrl.trim()) return;

    setUploading(true);
    try {
      await onAddLink(linkUrl);
      setLinkUrl("");
      setShowLinkInput(false);
    } finally {
      setUploading(false);
    }
  }, [linkUrl, onAddLink]);

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-4">
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={disabled || uploading}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            />
            <Button variant="outline" disabled={disabled || uploading} asChild>
              <span>
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Enviar Arquivo
              </span>
            </Button>
          </label>

          <Button
            variant="outline"
            onClick={() => setShowLinkInput(!showLinkInput)}
            disabled={disabled || uploading}
          >
            <Link className="h-4 w-4 mr-2" />
            Adicionar Link YouTube
          </Button>
        </div>

        {showLinkInput && (
          <div className="flex gap-2 w-full max-w-md">
            <Input
              placeholder="https://youtube.com/..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              disabled={uploading}
            />
            <Button onClick={handleAddLink} disabled={!linkUrl.trim() || uploading}>
              Adicionar
            </Button>
          </div>
        )}

        <p className="text-sm text-gray-500">
          PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (máx. 10MB)
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Criar componente de lista de documentos**

```typescript
// apps/planejamento/features/plano-aula/components/documento-list.tsx
"use client";

import { Button } from "@essencia/components/ui/button";
import { Card } from "@essencia/components/ui/card";
import {
  FileText,
  Image,
  FileSpreadsheet,
  Youtube,
  Trash2,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import type { PlanoDocumento } from "../types";

interface DocumentoListProps {
  documentos: PlanoDocumento[];
  onDelete?: (docId: string) => void;
  showComments?: boolean;
  canDelete?: boolean;
}

function getFileIcon(mimeType?: string, tipo?: string) {
  if (tipo === "LINK_YOUTUBE") return <Youtube className="h-8 w-8 text-red-500" />;
  if (mimeType?.includes("image")) return <Image className="h-8 w-8 text-blue-500" />;
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel"))
    return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
  return <FileText className="h-8 w-8 text-gray-500" />;
}

function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentoList({
  documentos,
  onDelete,
  showComments = true,
  canDelete = false,
}: DocumentoListProps) {
  if (documentos.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        Nenhum documento adicionado ainda
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documentos.map((doc) => (
        <Card key={doc.id} className="p-4">
          <div className="flex items-start gap-4">
            {getFileIcon(doc.mimeType, doc.tipo)}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {doc.tipo === "LINK_YOUTUBE" ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Link do YouTube
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline truncate"
                  >
                    {doc.fileName}
                  </a>
                )}
              </div>

              {doc.fileSize && (
                <p className="text-sm text-gray-500">{formatFileSize(doc.fileSize)}</p>
              )}

              {showComments && doc.comentarios.length > 0 && (
                <div className="mt-3 space-y-2">
                  {doc.comentarios.map((c) => (
                    <div
                      key={c.id}
                      className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded"
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <MessageSquare className="h-4 w-4" />
                        <span className="font-medium">{c.autorName}</span>
                        <span>•</span>
                        <span>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="text-sm">{c.comentario}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(doc.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
```

**Step 3: Criar index**

```typescript
// apps/planejamento/features/plano-aula/components/index.ts
export * from "./documento-upload";
export * from "./documento-list";
```

**Step 4: Verificar tipos**

Run: `cd /var/www/essencia && pnpm turbo typecheck --filter=planejamento`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/planejamento/features/plano-aula/components/
git commit -m "feat(planejamento): adiciona componentes de upload e lista de documentos"
```

---

## Fase 4: Rotas do Frontend

As próximas tasks criarão as páginas para cada perfil. Por brevidade, apresento a estrutura geral:

### Task 4.1: Página da Professora - Detalhe da Quinzena

**Files:**
- Create: `apps/planejamento/app/plano-aula/[quinzenaId]/page.tsx`

Esta página mostra os planos da professora para uma quinzena específica, permitindo upload de documentos e submissão.

### Task 4.2: Página da Analista - Lista de Pendentes

**Files:**
- Create: `apps/planejamento/app/analise/page.tsx`

Dashboard da analista com abas por segmento e lista de planos pendentes.

### Task 4.3: Página da Analista - Revisão de Plano

**Files:**
- Create: `apps/planejamento/app/analise/[planoId]/page.tsx`

Visualização do plano com opções de aprovar/devolver e adicionar comentários.

### Task 4.4: Página da Coordenadora - Lista de Pendentes

**Files:**
- Create: `apps/planejamento/app/coordenacao/page.tsx`

Lista de planos aguardando aprovação final, filtrados por segmento.

### Task 4.5: Página da Coordenadora - Revisão de Plano

**Files:**
- Create: `apps/planejamento/app/coordenacao/[planoId]/page.tsx`

Visualização com opções de aprovar ou devolver (para professora ou analista).

### Task 4.6: Página de Gestão - Dashboard

**Files:**
- Create: `apps/planejamento/app/gestao/page.tsx`

Dashboard com indicadores e lista completa de planos.

### Task 4.7: Página de Configuração - Prazos

**Files:**
- Create: `apps/planejamento/app/configuracoes/prazos/page.tsx`

Configuração de deadlines por quinzena (Coordenadora Geral).

---

## Resumo de Commits

1. `feat(db): adiciona schema plano-aula com tabelas de documento e comentário`
2. `chore(db): migration para tabelas plano-aula`
3. `feat(api): adiciona PlanoAulaService com lógica de workflow`
4. `feat(api): adiciona PlanoAulaController com endpoints completos`
5. `feat(planejamento): adiciona hooks e tipos para plano-aula`
6. `feat(planejamento): adiciona componentes de upload e lista de documentos`
7. `feat(planejamento): adiciona página da professora para plano de aula`
8. `feat(planejamento): adiciona páginas da analista pedagógica`
9. `feat(planejamento): adiciona páginas da coordenadora`
10. `feat(planejamento): adiciona dashboard de gestão`
11. `feat(planejamento): adiciona configuração de prazos`

---

## Verificação Final

Após completar todas as tasks:

```bash
# Verificar lint e tipos
pnpm turbo lint && pnpm turbo typecheck

# Build completo
pnpm turbo build

# Testar em dev
pnpm turbo dev --filter=planejamento --filter=api
```

## Notas de Migração

- O módulo antigo `plannings` permanece funcional
- Dados existentes não são afetados
- Migração de dados pode ser feita posteriormente se necessário
- Remover código antigo apenas após validação completa em produção
