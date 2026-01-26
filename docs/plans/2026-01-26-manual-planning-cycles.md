# Manual Planning Cycles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transition from automatically calculated fortnights to explicitly managed planning cycles configuration per school/stage.

**Architecture:** Database-first migration adding `planning_templates`, followed by Backend CRUD API, Frontend Management UI updates, and Teacher Dashboard refactor to consume the new data source.

**Tech Stack:** NestJS, Drizzle ORM, Postgres, Next.js (App Router), React Query (assumed), Tailwind/Shadcn.

---

### Task 1: Database Migration & Schema

**Files:**
- Create: `packages/db/drizzle/00XX_planning_templates.sql` (via generate)
- Modify: `packages/db/src/schema/planning.ts`
- Modify: `packages/db/src/schema/index.ts`

**Step 1: Define Drizzle Schema**

Create/Modify `packages/db/src/schema/planning.ts`:
```typescript
import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
// ... existing imports

// NEW TABLE
export const planningTemplates = pgTable("planning_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull(),
  stage: text("stage").notNull(), // 'BERCARIO', 'INFANTIL', etc
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  submissionDeadline: timestamp("submission_deadline").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  schoolStageIdx: index("idx_planning_templates_school_stage").on(table.schoolId, table.stage),
}));

// Add relation to planos_aula (later) or keep separate for now
```

**Step 2: Generate Migration**

Run: `pnpm db:generate`
Expected: Creates SQL migration file.

**Step 3: Run Migration (Dev)**

Run: `pnpm db:migrate`
Expected: Success.

**Step 4: Commit**
```bash
git add packages/db/src/schema/planning.ts packages/db/drizzle/*
git commit -m "feat(db): add planning_templates table"
```

---

### Task 2: Backend - Planning Templates Module (Setup)

**Files:**
- Create: `apps/api/src/modules/planning-templates/planning-templates.module.ts`
- Create: `apps/api/src/modules/planning-templates/planning-templates.controller.ts`
- Create: `apps/api/src/modules/planning-templates/planning-templates.service.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create Module Structure**

Create minimal controller/service/module files.
Controller should have `@Controller('planning-templates')`.

**Step 2: Register Module in App Module**

Modify `apps/api/src/app.module.ts` to import `PlanningTemplatesModule`.

**Step 3: Test Server Start**

Run: `pnpm turbo dev --filter=api`
Expected: Server starts without error.

**Step 4: Commit**
```bash
git add apps/api/src/modules/planning-templates
git commit -m "feat(api): scaffold planning-templates module"
```

---

### Task 3: Backend - Create & List Templates (TDD)

**Files:**
- Test: `apps/api/src/modules/planning-templates/planning-templates.controller.spec.ts`
- Modify: `apps/api/src/modules/planning-templates/planning-templates.controller.ts`
- Modify: `apps/api/src/modules/planning-templates/planning-templates.service.ts`

**Step 1: Write Test for CREATE**

```typescript
describe('create', () => {
  it('should call service with current user schoolId', async () => {
    // Mock user session
    // Call controller.create(dto, user)
    // Expect service.create to be called with correct data
  });
});
```

**Step 2: Implementation (Service)**

Implement `create` method using Drizzle `db.insert(planningTemplates)`.

**Step 3: Implementation (Controller)**

Add `@Post()` endpoint.
Use DTO validation (create DTO file if needed).

**Step 4: Write Test for LIST**

Test `findAll` filtering by schoolId and grouping by stage (if needed, or just plain list).

**Step 5: Implementation (LIST)**

Implement `findAll(schoolId)` in service.
Add `@Get()` endpoint in controller.

**Step 6: Commit**
```bash
git add apps/api/src/modules/planning-templates
git commit -m "feat(api): implement create and list planning templates"
```

---

### Task 4: Frontend - Management Page Structure

**Files:**
- Create: `apps/planejamento/app/planejamento/gestao/page.tsx`
- Create: `apps/planejamento/app/planejamento/gestao/components/templates-list.tsx`
- Create: `apps/planejamento/app/planejamento/gestao/components/create-template-dialog.tsx`

**Step 1: Create Page Layout**

Create page with Tabs (Shadcn) for stages: BERCARIO, INFANTIL, FUNDAMENTAL_I.

**Step 2: Fetch Data Hook**

Use existing fetcher pattern (or React Query) to `GET /planning-templates`.

**Step 3: Render Lists**

Inside each Tab, render `TemplatesList` component passing filtered data for that stage.

**Step 4: Commit**
```bash
git add apps/planejamento/app/planejamento/gestao
git commit -m "feat(web): add planning management page layout"
```

---

### Task 5: Frontend - Create Template Modal

**Files:**
- Modify: `apps/planejamento/app/planejamento/gestao/components/create-template-dialog.tsx`
- Modify: `apps/planejamento/actions/planning-templates.ts` (Server Action or API wrapper)

**Step 1: Build Form**

Inputs: Name, Start Date, End Date, Submission Deadline.
Validation: Start < End.

**Step 2: Connect to API**

Implement submission logic calling the POST endpoint.

**Step 3: Refresh Logic**

Ensure list updates after creation (invalidate tag or router.refresh).

**Step 4: Commit**
```bash
git add apps/planejamento/app/planejamento/gestao
git commit -m "feat(web): implement create template modal"
```

---

### Task 6: Data Migration - Planos Aula Link

**Files:**
- Modify: `packages/db/src/schema/planning.ts`
- Migration: `packages/db/drizzle/00XY_link_planos_template.sql`

**Step 1: Add FK to Planos Aula**

Modify `planos_aula` table to add `planning_template_id` (uuid) referencing `planning_templates(id)`.
Make it nullable initially if there are existing records, but goal is explicitly managed cycles.

**Step 2: Generate & Run Migration**

**Step 3: Commit**
```bash
git add packages/db/src/schema/planning.ts
git commit -m "feat(db): link plano_aula to planning_template"
```

---

### Task 7: Teacher Dashboard - Switch to explicit cycles

**Files:**
- Modify: `apps/planejamento/app/(dashboard)/dashboard-content.tsx`
- Modify: `apps/planejamento/hooks/use-plano-aula.ts` (or relevant hook)

**Step 1: Modify Data Fetching**

Instead of just fetching "current quinzena", fetch ALL active `planning_templates` for the teacher's stage.
AND fetch user's existing `planos_aula`.

**Step 2: Render Cards**

Map over `templates`.
Find matching `plano` for that template.
Render Card:
- Header: Template Name
- Dates: Start - End (Deadline msg)
- Body: If plano exists -> Status. If not -> "Start" button.

**Step 3: Handle "Start"**

Clicking "Start" should create a `plano_aula` linked to that `template_id`.

**Step 4: Commit**
```bash
git add apps/planejamento/app
git commit -m "feat(web): refactor dashboard to use explicit planning templates"
```

---

### Task 8: Cleanup & Polish

**Files:**
- Modify: `apps/planejamento/app/planejamento/gestao/page.tsx`
- Verify: `apps/planejamento/app/(dashboard)/page.tsx`

**Step 1: Verify End-to-End**

Flow:
1. Log in as Coord -> Go to /gestao -> Create "Ciclo 1".
2. Log in as Teacher -> See "Ciclo 1" card -> Click Start -> Fill plan.
3. Log in as Coord -> See plan in review (existing flow).

**Step 2: Remove Dead Code**

Identify and remove old "QuinzenaCalculator" or "AutoDate" utilities.

**Step 3: Commit**
```bash
git add .
git commit -m "chore: cleanup legacy planning logic"
```
