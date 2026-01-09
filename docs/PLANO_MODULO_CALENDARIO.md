# Plano de Implementacao: Modulo Calendario Escolar

> **Portal Digital Colegio Essencia Feliz**
> Documento de Planejamento Tecnico
> Data: Janeiro 2026

---

## Indice

1. [Visao Geral](#1-visao-geral)
2. [Requisitos](#2-requisitos)
3. [Arquitetura](#3-arquitetura)
4. [Modelo de Dados](#4-modelo-de-dados)
5. [API Backend](#5-api-backend)
6. [Frontend](#6-frontend)
7. [Tipos Compartilhados](#7-tipos-compartilhados)
8. [Testes](#8-testes)
9. [Sequencia de Implementacao](#9-sequencia-de-implementacao)
10. [Checklist de Entrega](#10-checklist-de-entrega)

---

## 1. Visao Geral

### 1.1 Objetivo

Criar um novo modulo chamado **Calendario** (`apps/calendario`) para visualizacao e gestao do calendario escolar. O modulo permitira que usuarios de gestao visualizem e gerenciem eventos escolares como feriados, recessos, semanas de prova, dias letivos, entre outros.

### 1.2 Contexto

O calendario escolar 2026 possui **200 dias letivos** distribuidos ao longo do ano, conforme documento oficial da escola (PDF do Calendario Ano Letivo 2026).

### 1.3 Stack Tecnologica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15 (App Router) |
| Backend | NestJS + Fastify |
| Database | PostgreSQL + Drizzle ORM |
| UI | Tailwind CSS + shadcn/ui |
| Validacao | Zod |
| Formularios | react-hook-form |
| Datas | date-fns |

---

## 2. Requisitos

### 2.1 Requisitos Funcionais

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF01 | Visualizar calendario mensal com eventos | Alta |
| RF02 | Navegar entre meses (anterior/proximo) | Alta |
| RF03 | Criar novo evento no calendario | Alta |
| RF04 | Editar evento existente | Alta |
| RF05 | Deletar evento | Alta |
| RF06 | Filtrar eventos por tipo | Media |
| RF07 | Visualizar estatisticas de dias letivos | Media |
| RF08 | Visualizar resumo anual | Baixa |

### 2.2 Requisitos Nao-Funcionais

| ID | Requisito |
|----|-----------|
| RNF01 | Porta do servidor: 3002 |
| RNF02 | Multi-tenant: calendario por unidade |
| RNF03 | RBAC: apenas roles de gestao |
| RNF04 | Responsivo: mobile-first |
| RNF05 | Testes: cobertura minima de casos criticos |

### 2.3 Permissoes (RBAC)

**Roles com acesso ao modulo:**

| Role | Nivel | Visualizar | Criar/Editar | Deletar |
|------|-------|------------|--------------|---------|
| master | 0 | Todas unidades | Sim | Sim |
| diretora_geral | 1 | Escola inteira | Sim | Sim |
| gerente_unidade | 2 | Sua unidade | Sim | Sim |
| gerente_financeiro | 3 | Sua unidade | Nao | Nao |
| coordenadora_geral | 4 | Sua unidade | Sim | Sim |
| coordenadora_bercario | 5 | Sua unidade | Sim | Nao |
| coordenadora_infantil | 6 | Sua unidade | Sim | Nao |
| coordenadora_fundamental_i | 7 | Sua unidade | Sim | Nao |
| coordenadora_fundamental_ii | 8 | Sua unidade | Sim | Nao |
| coordenadora_medio | 9 | Sua unidade | Sim | Nao |
| analista_pedagogico | 10 | Sua unidade | Nao | Nao |

**Roles SEM acesso:**
- professora
- auxiliar_administrativo
- auxiliar_sala

### 2.4 Tipos de Eventos

Baseado no PDF do calendario 2026:

| Tipo | Codigo | Cor | Dia Letivo? | Descricao |
|------|--------|-----|-------------|-----------|
| Inicio de Semestre | INICIO_SEMESTRE | Azul (#3B82F6) | Sim | Primeiro dia letivo do semestre |
| Termino de Semestre | TERMINO_SEMESTRE | Azul (#3B82F6) | Sim | Ultimo dia letivo do semestre |
| Feriado | FERIADO | Vermelho (#EF4444) | Nao | Feriados nacionais/estaduais |
| Recesso | RECESSO | Laranja (#F97316) | Nao | Recessos escolares |
| Ferias dos Professores | FERIAS_PROFESSORES | Cinza (#6B7280) | Nao | Periodo de ferias docentes |
| Sabado Letivo | SABADO_LETIVO | Amarelo (#EAB308) | Sim | Sabados com aula |
| Semana de Provas | SEMANA_PROVAS | Roxo (#8B5CF6) | Sim | Periodo de avaliacoes |
| Dia Letivo | DIA_LETIVO | Branco (#FFFFFF) | Sim | Dia normal de aula |
| Reuniao Pedagogica | REUNIAO_PEDAGOGICA | Teal (#14B8A6) | Nao | Reunioes de professores |
| Evento Especial | EVENTO_ESPECIAL | Rosa (#EC4899) | Depende | Eventos da escola |

### 2.5 Dados do Calendario 2026 (Referencia)

| Mes | Dias Letivos | Total de Dias |
|-----|--------------|---------------|
| Janeiro | 0 | 31 |
| Fevereiro | 17 | 28 |
| Marco | 22 | 31 |
| Abril | 18 | 30 |
| Maio | 21 | 31 |
| Junho | 21 | 30 |
| Julho | 11 | 31 |
| Agosto | 21 | 31 |
| Setembro | 21 | 30 |
| Outubro | 17 | 31 |
| Novembro | 20 | 30 |
| Dezembro | 11 | 31 |
| **Total** | **200** | **365** |

---

## 3. Arquitetura

### 3.1 Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    apps/calendario (:3002)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Layout    │  │   Pages     │  │       Features          │  │
│  │  (Shell)    │  │  (Routes)   │  │  ┌─────────────────┐    │  │
│  │             │  │             │  │  │    calendar/    │    │  │
│  │ TenantProv  │  │  /          │  │  │  - components   │    │  │
│  │             │  │             │  │  │  - hooks        │    │  │
│  └─────────────┘  └─────────────┘  │  │  - schemas      │    │  │
│                                     │  └─────────────────┘    │  │
│                                     └─────────────────────────┘  │
│                              │                                   │
│                    API Proxy (app/api/[...path])                 │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│                   services/api (:3001)                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              modules/calendar/                           │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │  Controller  │  │   Service    │  │    DTOs      │   │    │
│  │  │              │  │              │  │              │   │    │
│  │  │ GET /events  │  │ getEvents()  │  │ CreateDTO    │   │    │
│  │  │ POST /events │  │ create()     │  │ UpdateDTO    │   │    │
│  │  │ PUT /events  │  │ update()     │  │ QueryDTO     │   │    │
│  │  │ DELETE       │  │ delete()     │  │              │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│              Guards: AuthGuard → RolesGuard → TenantGuard        │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│                   packages/db (Drizzle)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  calendar_events                         │    │
│  │  ┌─────────┬──────────────┬─────────────────────────┐   │    │
│  │  │ id      │ uuid PK      │ Identificador unico     │   │    │
│  │  │ unitId  │ uuid FK      │ Multi-tenant (unidade)  │   │    │
│  │  │ title   │ text         │ Titulo do evento        │   │    │
│  │  │ type    │ enum         │ Tipo do evento          │   │    │
│  │  │ start   │ date         │ Data inicio             │   │    │
│  │  │ end     │ date         │ Data fim                │   │    │
│  │  │ ...     │              │                         │   │    │
│  │  └─────────┴──────────────┴─────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Estrutura de Diretorios

#### Frontend (apps/calendario)

```
apps/calendario/
├── app/
│   ├── layout.tsx                    # Layout raiz (TenantProvider + Shell)
│   ├── page.tsx                      # Pagina principal do calendario
│   ├── globals.css                   # Estilos globais
│   └── api/
│       └── [...path]/
│           └── route.ts              # Proxy para API backend
│
├── components/
│   └── providers/
│       └── tenant-provider.tsx       # Provider com verificacao de role
│
├── features/
│   └── calendar/
│       ├── components/
│       │   ├── index.ts              # Barrel exports
│       │   ├── calendar-view.tsx     # Componente principal do calendario
│       │   ├── calendar-header.tsx   # Header com navegacao
│       │   ├── calendar-grid.tsx     # Grid de dias
│       │   ├── day-cell.tsx          # Celula de dia individual
│       │   ├── event-card.tsx        # Card de evento
│       │   ├── event-form.tsx        # Formulario criar/editar
│       │   ├── event-type-badge.tsx  # Badge colorido do tipo
│       │   ├── event-type-select.tsx # Select de tipo de evento
│       │   ├── legend.tsx            # Legenda de cores
│       │   ├── month-stats.tsx       # Estatisticas mensais
│       │   └── year-summary.tsx      # Resumo anual
│       │
│       ├── hooks/
│       │   ├── index.ts              # Barrel exports
│       │   ├── use-calendar-events.ts    # Hook para buscar eventos
│       │   ├── use-event-mutations.ts    # Hook para CRUD
│       │   └── use-calendar-navigation.ts # Hook navegacao meses
│       │
│       ├── schemas.ts                # Schemas Zod locais
│       ├── constants.ts              # Constantes (cores, labels)
│       └── types.ts                  # Tipos TypeScript locais
│
├── lib/
│   ├── utils.ts                      # Utilitarios
│   └── api.ts                        # Funcoes de API
│
├── public/
│   └── favicon.ico
│
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── .eslintrc.cjs
├── vitest.config.ts
└── vitest.setup.ts
```

#### Backend (services/api/src/modules/calendar)

```
services/api/src/modules/calendar/
├── calendar.module.ts                # Modulo NestJS
├── calendar.controller.ts            # Controller REST
├── calendar.service.ts               # Service com logica de negocio
├── calendar.controller.spec.ts       # Testes do controller
├── dto/
│   ├── index.ts                      # Barrel exports
│   ├── create-event.dto.ts           # DTO criacao
│   ├── update-event.dto.ts           # DTO atualizacao
│   └── query-events.dto.ts           # DTO query params
└── index.ts                          # Exports do modulo
```

#### Database (packages/db/src/schema)

```
packages/db/src/schema/
├── calendar-events.ts                # Schema da tabela (NOVO)
├── index.ts                          # Atualizar exports
└── ... (outros schemas existentes)
```

#### Shared (packages/shared/src)

```
packages/shared/src/
├── schemas/
│   ├── calendar.ts                   # Schemas Zod (NOVO)
│   └── index.ts                      # Atualizar exports
│
└── types/
    ├── calendar.ts                   # Tipos TypeScript (NOVO)
    └── index.ts                      # Atualizar exports
```

---

## 4. Modelo de Dados

### 4.1 Tabela: calendar_events

```sql
CREATE TABLE calendar_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id                 UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    title                   TEXT NOT NULL,
    description             TEXT,
    event_type              TEXT NOT NULL,
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    is_school_day           BOOLEAN NOT NULL DEFAULT true,
    is_recurring_annually   BOOLEAN NOT NULL DEFAULT false,
    created_by              UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX calendar_events_unit_date_idx
    ON calendar_events (unit_id, start_date, end_date);

CREATE INDEX calendar_events_type_idx
    ON calendar_events (event_type);
```

### 4.2 Schema Drizzle

**Arquivo:** `packages/db/src/schema/calendar-events.ts`

```typescript
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { units } from "./units";
import { users } from "./users";

// Enum de tipos de evento
export const calendarEventTypeEnum = [
  "INICIO_SEMESTRE",
  "TERMINO_SEMESTRE",
  "FERIADO",
  "RECESSO",
  "FERIAS_PROFESSORES",
  "SABADO_LETIVO",
  "SEMANA_PROVAS",
  "DIA_LETIVO",
  "REUNIAO_PEDAGOGICA",
  "EVENTO_ESPECIAL",
] as const;

export type CalendarEventType = (typeof calendarEventTypeEnum)[number];

// Tabela calendar_events
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Multi-tenant: evento pertence a uma unidade
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),

    // Dados do evento
    title: text("title").notNull(),
    description: text("description"),
    eventType: text("event_type", { enum: calendarEventTypeEnum }).notNull(),

    // Range de datas (evento de um dia ou varios dias)
    startDate: date("start_date", { mode: "date" }).notNull(),
    endDate: date("end_date", { mode: "date" }).notNull(),

    // Flags
    isSchoolDay: boolean("is_school_day").notNull().default(true),
    isRecurringAnnually: boolean("is_recurring_annually").notNull().default(false),

    // Auditoria
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unitDateIdx: index("calendar_events_unit_date_idx").on(
      table.unitId,
      table.startDate,
      table.endDate,
    ),
    eventTypeIdx: index("calendar_events_type_idx").on(table.eventType),
  }),
);

// Tipos inferidos
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;

// Relations
export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  unit: one(units, {
    fields: [calendarEvents.unitId],
    references: [units.id],
  }),
  creator: one(users, {
    fields: [calendarEvents.createdBy],
    references: [users.id],
  }),
}));
```

---

## 5. API Backend

### 5.1 Endpoints

| Metodo | Rota | Descricao | Roles |
|--------|------|-----------|-------|
| GET | /calendar/events | Listar eventos | Todas gestao |
| GET | /calendar/events/:id | Buscar evento por ID | Todas gestao |
| POST | /calendar/events | Criar evento | Gestao (exceto analista) |
| PUT | /calendar/events/:id | Atualizar evento | Gestao (exceto analista) |
| DELETE | /calendar/events/:id | Deletar evento | Diretores + Master |
| GET | /calendar/stats | Estatisticas de dias | Todas gestao |

### 5.2 Query Parameters (GET /events)

| Param | Tipo | Descricao |
|-------|------|-----------|
| unitId | uuid | Filtrar por unidade (obrigatorio para master) |
| year | number | Filtrar por ano (ex: 2026) |
| month | number | Filtrar por mes (1-12) |
| eventType | string | Filtrar por tipo de evento |

### 5.3 Request Body (POST/PUT)

```typescript
interface CreateEventPayload {
  unitId: string;           // UUID da unidade
  title: string;            // Titulo (2-200 caracteres)
  description?: string;     // Descricao opcional (max 1000)
  eventType: CalendarEventType;
  startDate: string;        // ISO date (YYYY-MM-DD)
  endDate: string;          // ISO date (YYYY-MM-DD)
  isSchoolDay: boolean;     // E dia letivo?
  isRecurringAnnually: boolean; // Repete todo ano?
}
```

### 5.4 Response Envelope

**Sucesso (200/201):**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-05T12:00:00Z"
  }
}
```

**Erro (4xx/5xx):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados invalidos",
    "details": { ... }
  }
}
```

### 5.5 Controller Implementation

**Arquivo:** `services/api/src/modules/calendar/calendar.controller.ts`

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CalendarService } from "./calendar.service";
import { CreateEventDto, QueryEventsDto, UpdateEventDto } from "./dto";

// Roles de gestao com acesso ao calendario
const VIEW_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "analista_pedagogico",
] as const;

const EDIT_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
] as const;

const DELETE_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
] as const;

@Controller("calendar")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("events")
  @Roles(...VIEW_ROLES)
  async getEvents(
    @CurrentUser() user: UserContext,
    @Query() query: QueryEventsDto,
  ) {
    const events = await this.calendarService.getEvents(user, query);
    return { success: true, data: events };
  }

  @Get("events/:id")
  @Roles(...VIEW_ROLES)
  async getEventById(
    @CurrentUser() user: UserContext,
    @Param("id") id: string,
  ) {
    const event = await this.calendarService.getEventById(user, id);
    return { success: true, data: event };
  }

  @Post("events")
  @Roles(...EDIT_ROLES)
  async createEvent(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateEventDto,
  ) {
    const event = await this.calendarService.createEvent(user, dto);
    return { success: true, data: event };
  }

  @Put("events/:id")
  @Roles(...EDIT_ROLES)
  async updateEvent(
    @CurrentUser() user: UserContext,
    @Param("id") id: string,
    @Body() dto: UpdateEventDto,
  ) {
    const event = await this.calendarService.updateEvent(user, id, dto);
    return { success: true, data: event };
  }

  @Delete("events/:id")
  @HttpCode(HttpStatus.OK)
  @Roles(...DELETE_ROLES)
  async deleteEvent(
    @CurrentUser() user: UserContext,
    @Param("id") id: string,
  ) {
    await this.calendarService.deleteEvent(user, id);
    return { success: true, data: null };
  }

  @Get("stats")
  @Roles(...VIEW_ROLES)
  async getStats(
    @CurrentUser() user: UserContext,
    @Query("unitId") unitId?: string,
    @Query("year") year?: string,
  ) {
    const stats = await this.calendarService.getStats(
      user,
      unitId,
      year ? parseInt(year, 10) : new Date().getFullYear(),
    );
    return { success: true, data: stats };
  }
}
```

---

## 6. Frontend

### 6.1 Package.json

**Arquivo:** `apps/calendario/package.json`

```json
{
  "name": "calendario",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "clean": "rimraf .next",
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "test": "vitest run --environment jsdom --globals"
  },
  "dependencies": {
    "@essencia/components": "workspace:*",
    "@essencia/shared": "workspace:*",
    "@essencia/tailwind-config": "workspace:*",
    "@essencia/ui": "workspace:*",
    "@hookform/resolvers": "^5.2.2",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.469.0",
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-hook-form": "^7.69.0",
    "tailwind-merge": "^2.6.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@essencia/config": "workspace:*",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.1",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^5.1.2",
    "jsdom": "^27.3.0",
    "postcss": "^8.4.49",
    "rimraf": "^5.0.5",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vitest": "^4.0.16"
  }
}
```

### 6.2 Layout Principal

**Arquivo:** `apps/calendario/app/layout.tsx`

```typescript
import { Shell } from "@essencia/components/shell/shell";
import { TenantProvider } from "@/components/providers/tenant-provider";
import "@essencia/ui/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Calendario | Essencia",
  description: "Calendario escolar do Portal Essencia Feliz",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <TenantProvider>
          <Shell>{children}</Shell>
        </TenantProvider>
      </body>
    </html>
  );
}
```

### 6.3 Componente CalendarView

**Arquivo:** `apps/calendario/features/calendar/components/calendar-view.tsx`

```typescript
"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@essencia/ui/components/button";
import { cn } from "@essencia/ui/lib/utils";

import type { CalendarEvent } from "@essencia/shared/types/calendar";
import { eventTypeConfig } from "@essencia/shared/types/calendar";

import { EventCard } from "./event-card";
import { Legend } from "./legend";

interface CalendarViewProps {
  events: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onCreateEvent?: () => void;
  canEdit?: boolean;
}

export function CalendarView({
  events,
  onDateClick,
  onEventClick,
  onCreateEvent,
  canEdit = false,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((event) =>
      isWithinInterval(day, {
        start: new Date(event.startDate),
        end: new Date(event.endDate),
      })
    );

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900 capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {canEdit && onCreateEvent && (
          <Button onClick={onCreateEvent}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-medium text-slate-600"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[120px] p-2 border-b border-r cursor-pointer transition-colors",
                  "hover:bg-slate-50",
                  !isCurrentMonth && "bg-slate-50/50 text-slate-400",
                  isToday && "bg-blue-50/50",
                )}
                onClick={() => onDateClick?.(day)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm",
                      isToday && "bg-blue-600 text-white font-bold",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                      compact
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-xs text-slate-500 pl-1">
                      +{dayEvents.length - 3} mais
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <Legend />
    </div>
  );
}
```

### 6.4 Componente EventForm

**Arquivo:** `apps/calendario/features/calendar/components/event-form.tsx`

```typescript
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useForm } from "react-hook-form";

import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import { Textarea } from "@essencia/ui/components/textarea";
import { Checkbox } from "@essencia/ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@essencia/ui/components/sheet";

import {
  createCalendarEventSchema,
  type CalendarEvent,
  type CreateCalendarEventInput,
} from "@essencia/shared/schemas/calendar";
import { eventTypeConfig } from "@essencia/shared/types/calendar";

interface EventFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateCalendarEventInput) => Promise<void>;
  event?: CalendarEvent;
  unitId: string;
  defaultDate?: Date;
}

export function EventForm({
  open,
  onClose,
  onSave,
  event,
  unitId,
  defaultDate,
}: EventFormProps) {
  const isEditing = !!event;

  const form = useForm<CreateCalendarEventInput>({
    resolver: zodResolver(createCalendarEventSchema),
    defaultValues: {
      unitId,
      title: event?.title ?? "",
      description: event?.description ?? "",
      eventType: event?.eventType ?? "DIA_LETIVO",
      startDate: event?.startDate ?? defaultDate ?? new Date(),
      endDate: event?.endDate ?? defaultDate ?? new Date(),
      isSchoolDay: event?.isSchoolDay ?? true,
      isRecurringAnnually: event?.isRecurringAnnually ?? false,
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSave(data);
    onClose();
    form.reset();
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Editar Evento" : "Novo Evento"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          {/* Titulo */}
          <div className="space-y-2">
            <Label htmlFor="title">Titulo *</Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder="Ex: Feriado de Carnaval"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-red-500">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          {/* Tipo de Evento */}
          <div className="space-y-2">
            <Label htmlFor="eventType">Tipo de Evento *</Label>
            <Select
              value={form.watch("eventType")}
              onValueChange={(value) => form.setValue("eventType", value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(eventTypeConfig).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn("w-3 h-3 rounded-full", config.bgColor)}
                      />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicio *</Label>
              <Input
                id="startDate"
                type="date"
                {...form.register("startDate")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Fim *</Label>
              <Input
                id="endDate"
                type="date"
                {...form.register("endDate")}
              />
            </div>
          </div>
          {form.formState.errors.endDate && (
            <p className="text-sm text-red-500">
              {form.formState.errors.endDate.message}
            </p>
          )}

          {/* Descricao */}
          <div className="space-y-2">
            <Label htmlFor="description">Descricao</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Detalhes adicionais sobre o evento..."
              rows={3}
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isSchoolDay"
                checked={form.watch("isSchoolDay")}
                onCheckedChange={(checked) =>
                  form.setValue("isSchoolDay", !!checked)
                }
              />
              <Label htmlFor="isSchoolDay" className="text-sm font-normal">
                E dia letivo
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isRecurringAnnually"
                checked={form.watch("isRecurringAnnually")}
                onCheckedChange={(checked) =>
                  form.setValue("isRecurringAnnually", !!checked)
                }
              />
              <Label htmlFor="isRecurringAnnually" className="text-sm font-normal">
                Repete anualmente
              </Label>
            </div>
          </div>

          {/* Botoes */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

---

## 7. Tipos Compartilhados

### 7.1 Schemas Zod

**Arquivo:** `packages/shared/src/schemas/calendar.ts`

```typescript
import { z } from "zod";

// Enum de tipos de evento
export const calendarEventTypeSchema = z.enum([
  "INICIO_SEMESTRE",
  "TERMINO_SEMESTRE",
  "FERIADO",
  "RECESSO",
  "FERIAS_PROFESSORES",
  "SABADO_LETIVO",
  "SEMANA_PROVAS",
  "DIA_LETIVO",
  "REUNIAO_PEDAGOGICA",
  "EVENTO_ESPECIAL",
]);

// Schema completo do evento
export const calendarEventSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(1000).nullable(),
  eventType: calendarEventTypeSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isSchoolDay: z.boolean(),
  isRecurringAnnually: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Schema para criacao
export const createCalendarEventSchema = z
  .object({
    unitId: z.string().uuid("Unidade invalida"),
    title: z
      .string()
      .min(2, "Titulo deve ter pelo menos 2 caracteres")
      .max(200, "Titulo deve ter no maximo 200 caracteres"),
    description: z.string().max(1000).optional(),
    eventType: calendarEventTypeSchema,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isSchoolDay: z.boolean().default(true),
    isRecurringAnnually: z.boolean().default(false),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Data final deve ser maior ou igual a data inicial",
    path: ["endDate"],
  });

// Schema para atualizacao
export const updateCalendarEventSchema = createCalendarEventSchema
  .omit({ unitId: true })
  .partial();

// Schema para query params
export const queryCalendarEventsSchema = z.object({
  unitId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  eventType: calendarEventTypeSchema.optional(),
});

// Tipos exportados
export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;
export type QueryCalendarEventsInput = z.infer<typeof queryCalendarEventsSchema>;
```

### 7.2 Tipos e Configuracoes

**Arquivo:** `packages/shared/src/types/calendar.ts`

```typescript
import type { CalendarEventType } from "../schemas/calendar";

// Configuracao visual de cada tipo de evento
export interface EventTypeConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const eventTypeConfig: Record<CalendarEventType, EventTypeConfig> = {
  INICIO_SEMESTRE: {
    label: "Inicio de Semestre",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    borderColor: "border-blue-300",
  },
  TERMINO_SEMESTRE: {
    label: "Termino de Semestre",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    borderColor: "border-blue-300",
  },
  FERIADO: {
    label: "Feriado",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    borderColor: "border-red-300",
  },
  RECESSO: {
    label: "Recesso",
    color: "orange",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
    borderColor: "border-orange-300",
  },
  FERIAS_PROFESSORES: {
    label: "Ferias dos Professores",
    color: "gray",
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
    borderColor: "border-gray-300",
  },
  SABADO_LETIVO: {
    label: "Sabado Letivo",
    color: "yellow",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    borderColor: "border-yellow-300",
  },
  SEMANA_PROVAS: {
    label: "Semana de Provas",
    color: "purple",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    borderColor: "border-purple-300",
  },
  DIA_LETIVO: {
    label: "Dia Letivo",
    color: "slate",
    bgColor: "bg-white",
    textColor: "text-slate-700",
    borderColor: "border-slate-200",
  },
  REUNIAO_PEDAGOGICA: {
    label: "Reuniao Pedagogica",
    color: "teal",
    bgColor: "bg-teal-100",
    textColor: "text-teal-700",
    borderColor: "border-teal-300",
  },
  EVENTO_ESPECIAL: {
    label: "Evento Especial",
    color: "pink",
    bgColor: "bg-pink-100",
    textColor: "text-pink-700",
    borderColor: "border-pink-300",
  },
};

// Estatisticas mensais
export interface MonthlyStats {
  month: number;
  name: string;
  schoolDays: number;
  totalDays: number;
}

// Dados de referencia 2026
export const monthlyStats2026: MonthlyStats[] = [
  { month: 1, name: "Janeiro", schoolDays: 0, totalDays: 31 },
  { month: 2, name: "Fevereiro", schoolDays: 17, totalDays: 28 },
  { month: 3, name: "Marco", schoolDays: 22, totalDays: 31 },
  { month: 4, name: "Abril", schoolDays: 18, totalDays: 30 },
  { month: 5, name: "Maio", schoolDays: 21, totalDays: 31 },
  { month: 6, name: "Junho", schoolDays: 21, totalDays: 30 },
  { month: 7, name: "Julho", schoolDays: 11, totalDays: 31 },
  { month: 8, name: "Agosto", schoolDays: 21, totalDays: 31 },
  { month: 9, name: "Setembro", schoolDays: 21, totalDays: 30 },
  { month: 10, name: "Outubro", schoolDays: 17, totalDays: 31 },
  { month: 11, name: "Novembro", schoolDays: 20, totalDays: 30 },
  { month: 12, name: "Dezembro", schoolDays: 11, totalDays: 31 },
];

export const TOTAL_SCHOOL_DAYS_2026 = 200;
```

---

## 8. Testes

### 8.1 Testes Backend (Jest)

**Arquivo:** `services/api/src/modules/calendar/calendar.controller.spec.ts`

```typescript
describe("CalendarController", () => {
  describe("GET /calendar/events", () => {
    it("should return 401 when not authenticated");
    it("should return 403 when role is professora");
    it("should return 403 when role is auxiliar_sala");
    it("should return 403 when accessing different unit");
    it("should return 200 with events for coordenadora");
    it("should filter events by year");
    it("should filter events by month");
    it("should filter events by type");
  });

  describe("GET /calendar/events/:id", () => {
    it("should return 404 when event not found");
    it("should return 403 when event belongs to different unit");
    it("should return 200 with event data");
  });

  describe("POST /calendar/events", () => {
    it("should return 401 when not authenticated");
    it("should return 403 when role is analista_pedagogico");
    it("should return 400 when title is empty");
    it("should return 400 when endDate < startDate");
    it("should return 400 when eventType is invalid");
    it("should return 201 and create event when valid");
  });

  describe("PUT /calendar/events/:id", () => {
    it("should return 404 when event not found");
    it("should return 403 when event belongs to different unit");
    it("should return 400 when payload is invalid");
    it("should return 200 and update event when valid");
  });

  describe("DELETE /calendar/events/:id", () => {
    it("should return 401 when not authenticated");
    it("should return 403 when role is coordenadora_bercario");
    it("should return 404 when event not found");
    it("should return 200 and delete event for diretora_geral");
    it("should return 200 and delete event for master");
  });

  describe("GET /calendar/stats", () => {
    it("should return school days statistics for unit");
    it("should calculate correct totals");
  });
});
```

### 8.2 Testes Frontend (Vitest)

**Arquivo:** `apps/calendario/features/calendar/components/calendar-view.test.tsx`

```typescript
describe("CalendarView", () => {
  it("should render current month by default");
  it("should display month name in Portuguese");
  it("should navigate to previous month when clicking left arrow");
  it("should navigate to next month when clicking right arrow");
  it("should display all 7 weekday headers");
  it("should display events on correct days");
  it("should show event type colors correctly");
  it("should highlight today's date");
  it("should dim days from other months");
  it("should call onDateClick when day is clicked");
  it("should call onEventClick when event is clicked");
  it("should show '+N mais' when day has more than 3 events");
  it("should show 'Novo Evento' button when canEdit is true");
  it("should hide 'Novo Evento' button when canEdit is false");
});
```

**Arquivo:** `apps/calendario/features/calendar/components/event-form.test.tsx`

```typescript
describe("EventForm", () => {
  it("should render 'Novo Evento' title when creating");
  it("should render 'Editar Evento' title when editing");
  it("should populate form with event data when editing");
  it("should show validation error when title is empty");
  it("should show validation error when endDate < startDate");
  it("should call onSave with valid data");
  it("should show loading state during submit");
  it("should close form after successful save");
  it("should display all event types in select");
});
```

### 8.3 Testes E2E (Playwright)

**Arquivo:** `e2e/calendario.spec.ts`

```typescript
describe("Calendario E2E", () => {
  test("fluxo completo: login -> visualizar -> criar -> editar -> deletar", async ({ page }) => {
    // 1. Login como coordenadora
    await page.goto("/login");
    await page.fill('[name="email"]', "coordenadora@escola.com");
    await page.fill('[name="password"]', "senha123");
    await page.click('button[type="submit"]');

    // 2. Navegar para calendario
    await page.goto("/calendario");
    await expect(page).toHaveURL("/calendario");

    // 3. Criar evento
    await page.click('text=Novo Evento');
    await page.fill('[name="title"]', "Feriado Teste");
    await page.selectOption('[name="eventType"]', "FERIADO");
    await page.fill('[name="startDate"]', "2026-03-15");
    await page.fill('[name="endDate"]', "2026-03-15");
    await page.click('text=Salvar');

    // 4. Verificar evento criado
    await expect(page.locator('text=Feriado Teste')).toBeVisible();

    // 5. Editar evento
    await page.click('text=Feriado Teste');
    await page.fill('[name="title"]', "Feriado Editado");
    await page.click('text=Salvar');
    await expect(page.locator('text=Feriado Editado')).toBeVisible();

    // 6. Deletar evento
    await page.click('text=Feriado Editado');
    await page.click('text=Excluir');
    await page.click('text=Confirmar');
    await expect(page.locator('text=Feriado Editado')).not.toBeVisible();
  });

  test("deve bloquear acesso sem autenticacao", async ({ page }) => {
    await page.goto("/calendario");
    await expect(page).toHaveURL("/login");
  });

  test("deve bloquear acesso para professora", async ({ page }) => {
    // Login como professora
    await page.goto("/login");
    await page.fill('[name="email"]', "professora@escola.com");
    await page.fill('[name="password"]', "senha123");
    await page.click('button[type="submit"]');

    // Tentar acessar calendario
    await page.goto("/calendario");
    await expect(page.locator('text=Acesso negado')).toBeVisible();
  });

  test("deve permitir acesso para coordenadora", async ({ page }) => {
    // Login como coordenadora
    await page.goto("/login");
    await page.fill('[name="email"]', "coordenadora@escola.com");
    await page.fill('[name="password"]', "senha123");
    await page.click('button[type="submit"]');

    // Acessar calendario
    await page.goto("/calendario");
    await expect(page.locator('text=Calendario')).toBeVisible();
  });
});
```

---

## 9. Sequencia de Implementacao

### Fase 1: Database & Shared (Dia 1)

| # | Tarefa | Arquivo |
|---|--------|---------|
| 1.1 | Criar schema calendar-events | `packages/db/src/schema/calendar-events.ts` |
| 1.2 | Atualizar exports do schema | `packages/db/src/schema/index.ts` |
| 1.3 | Gerar migration | `pnpm turbo db:generate` |
| 1.4 | Aplicar migration | `pnpm turbo db:migrate` |
| 1.5 | Criar schemas Zod | `packages/shared/src/schemas/calendar.ts` |
| 1.6 | Criar tipos TypeScript | `packages/shared/src/types/calendar.ts` |
| 1.7 | Atualizar exports schemas | `packages/shared/src/schemas/index.ts` |
| 1.8 | Atualizar exports types | `packages/shared/src/types/index.ts` |
| 1.9 | Validar build shared | `pnpm --filter @essencia/shared build` |

### Fase 2: Backend API (Dia 2)

| # | Tarefa | Arquivo |
|---|--------|---------|
| 2.1 | Criar estrutura do modulo | `services/api/src/modules/calendar/` |
| 2.2 | Implementar DTOs | `services/api/src/modules/calendar/dto/` |
| 2.3 | Implementar CalendarService | `services/api/src/modules/calendar/calendar.service.ts` |
| 2.4 | Implementar CalendarController | `services/api/src/modules/calendar/calendar.controller.ts` |
| 2.5 | Implementar CalendarModule | `services/api/src/modules/calendar/calendar.module.ts` |
| 2.6 | Registrar no AppModule | `services/api/src/app.module.ts` |
| 2.7 | Escrever testes backend | `services/api/src/modules/calendar/calendar.controller.spec.ts` |
| 2.8 | Executar testes | `pnpm --filter @essencia/api test` |

### Fase 3: Frontend App (Dias 3-4)

| # | Tarefa | Arquivo |
|---|--------|---------|
| 3.1 | Criar diretorio do app | `apps/calendario/` |
| 3.2 | Configurar package.json | `apps/calendario/package.json` |
| 3.3 | Configurar next.config.js | `apps/calendario/next.config.js` |
| 3.4 | Configurar tailwind.config.ts | `apps/calendario/tailwind.config.ts` |
| 3.5 | Configurar tsconfig.json | `apps/calendario/tsconfig.json` |
| 3.6 | Configurar vitest | `apps/calendario/vitest.config.ts` |
| 3.7 | Criar API proxy | `apps/calendario/app/api/[...path]/route.ts` |
| 3.8 | Implementar TenantProvider | `apps/calendario/components/providers/tenant-provider.tsx` |
| 3.9 | Implementar layout.tsx | `apps/calendario/app/layout.tsx` |
| 3.10 | Implementar page.tsx | `apps/calendario/app/page.tsx` |
| 3.11 | Implementar CalendarView | `apps/calendario/features/calendar/components/calendar-view.tsx` |
| 3.12 | Implementar EventCard | `apps/calendario/features/calendar/components/event-card.tsx` |
| 3.13 | Implementar EventForm | `apps/calendario/features/calendar/components/event-form.tsx` |
| 3.14 | Implementar Legend | `apps/calendario/features/calendar/components/legend.tsx` |
| 3.15 | Implementar hooks | `apps/calendario/features/calendar/hooks/` |
| 3.16 | Escrever testes frontend | `apps/calendario/features/calendar/components/*.test.tsx` |
| 3.17 | Executar testes | `pnpm --filter calendario test` |

### Fase 4: Integracao & Documentacao (Dia 5)

| # | Tarefa | Arquivo |
|---|--------|---------|
| 4.1 | Escrever testes E2E | `e2e/calendario.spec.ts` |
| 4.2 | Atualizar API.md | `docs/API.md` |
| 4.3 | Atualizar DATABASE.md | `docs/DATABASE.md` |
| 4.4 | Atualizar ARCHITECTURE.md | `docs/ARCHITECTURE.md` |
| 4.5 | Atualizar CHANGELOG.md | `docs/CHANGELOG.md` |
| 4.6 | Atualizar README.md | `README.md` |
| 4.7 | Executar ciclo de qualidade | `pnpm turbo format && pnpm turbo lint && pnpm turbo typecheck && pnpm turbo build && pnpm turbo test` |

---

## 10. Checklist de Entrega

### Database

- [ ] Schema `calendar_events` criado
- [ ] Migration gerada e aplicada
- [ ] Indexes criados (unit_date_idx, event_type_idx)
- [ ] Relations definidas (unit, creator)

### Shared

- [ ] Schemas Zod criados e exportados
- [ ] Tipos TypeScript criados e exportados
- [ ] `eventTypeConfig` com todas as cores
- [ ] Build do pacote passando

### Backend

- [ ] CalendarModule implementado
- [ ] CalendarController com todos endpoints
- [ ] CalendarService com logica de negocio
- [ ] Guards aplicados (Auth + Roles + Tenant)
- [ ] Testes cobrindo 401/403/400/404/200

### Frontend

- [ ] App calendario na porta 3002
- [ ] TenantProvider verificando role gestao
- [ ] CalendarView com navegacao mensal
- [ ] EventForm com validacao Zod
- [ ] Cores corretas por tipo de evento
- [ ] Testes de componentes passando

### Qualidade

- [ ] `pnpm turbo format` passando
- [ ] `pnpm turbo lint` passando
- [ ] `pnpm turbo typecheck` passando
- [ ] `pnpm turbo test` passando
- [ ] `pnpm turbo build` passando

### Documentacao

- [ ] API.md atualizado com endpoints
- [ ] DATABASE.md atualizado com schema
- [ ] ARCHITECTURE.md atualizado com modulo
- [ ] CHANGELOG.md com entrada do modulo
- [ ] README.md com porta 3002

---

## Anexos

### A. Comandos Uteis

```bash
# Instalar dependencias
pnpm install

# Desenvolvimento
pnpm dev                          # Todos os apps
pnpm --filter calendario dev      # Apenas calendario

# Database
pnpm turbo db:generate            # Gerar migration
pnpm turbo db:migrate             # Aplicar migration
pnpm turbo db:studio              # Drizzle Studio

# Testes
pnpm turbo test                   # Todos os testes
pnpm --filter calendario test     # Apenas calendario
pnpm --filter @essencia/api test  # Apenas API

# Build
pnpm turbo build                  # Build de producao

# Qualidade
pnpm turbo format                 # Formatar codigo
pnpm turbo lint                   # Verificar linting
pnpm turbo typecheck              # Verificar tipos
```

### B. Portas dos Servicos

| Servico | Porta |
|---------|-------|
| home | 3000 |
| api | 3001 |
| **calendario** | **3002** |
| login | 3003 |
| usuarios | 3004 |
| escolas | 3005 |
| turmas | 3006 |
| planejamento | 3007 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

**Documento gerado em:** Janeiro 2026
**Versao:** 1.0
**Autor:** Claude AI
**Projeto:** Portal Digital Colegio Essencia Feliz
