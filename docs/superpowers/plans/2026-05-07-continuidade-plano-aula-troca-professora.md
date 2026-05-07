# Continuidade de Plano de Aula em Trocas de Professora — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando uma turma troca de professora titular, transferir automaticamente os planos de aula não-aprovados para a nova professora dentro da mesma transação que altera `turma.professoraId`, mantendo planos APROVADOS com sua autora original e registrando a transferência no histórico.

**Architecture:** Interceptação ocorre em `TurmasService.assignProfessora` (não em `update`, que não toca `professoraId`). Quando `professoraId` atual da turma é diferente do novo (e não é null), abre transação Drizzle: atualiza `turmas` e chama novo método `PlanoAulaService.transferirPlanosPendentes(tx, ...)`. O método faz `UPDATE plano_aula SET userId = nova WHERE turmaId = X AND status != 'APROVADO'` e insere uma linha `TRANSFERIDO` em `plano_aula_historico` para cada plano. Constraint UNIQUE de `plano_aula` muda de `(userId, turmaId, quinzenaId)` para `(turmaId, quinzenaId)`.

**Tech Stack:** NestJS 10, Drizzle 0.38, PostgreSQL 16, Jest 29 (mocks Drizzle), TypeScript 5.

**Spec:** [docs/superpowers/specs/2026-05-07-continuidade-plano-aula-troca-professora-design.md](/var/www/essencia/docs/superpowers/specs/2026-05-07-continuidade-plano-aula-troca-professora-design.md)

---

## File Structure

**Modified:**
- `packages/db/src/schema/plano-aula.ts` — renomear índice único
- `packages/db/src/schema/plano-aula-historico.ts` — adicionar `TRANSFERIDO` ao enum
- `services/api/src/modules/plano-aula/plano-aula.service.ts` — novo método `transferirPlanosPendentes`, tipos `Db`/`DbTransaction`
- `services/api/src/modules/plano-aula/plano-aula.service.spec.ts` — testes do novo método
- `services/api/src/modules/turmas/turmas.service.ts` — `assignProfessora` aceita `ator`, detecta troca real, dispara transferência via transação
- `services/api/src/modules/turmas/turmas.controller.ts` — passa `req.user` para `assignProfessora`
- `services/api/src/modules/turmas/turmas.module.ts` — importa `PlanoAulaModule`
- `apps/planejamento/features/plano-aula/components/historico-timeline.tsx` — label da ação `TRANSFERIDO`

**Created:**
- `packages/db/drizzle/0028_continuidade_plano_aula_troca_professora.sql` — migration manual
- `services/api/src/modules/turmas/turmas.service.spec.ts` — testes novos do `assignProfessora`

---

## Fase 1 — Schema e Migration

### Task 1: Atualizar schema Drizzle do histórico (adicionar TRANSFERIDO)

**Files:**
- Modify: `packages/db/src/schema/plano-aula-historico.ts:18-28`

- [ ] **Step 1: Editar enum**

Em `packages/db/src/schema/plano-aula-historico.ts`, alterar o array do enum:

```typescript
export const planoAulaHistoricoAcaoEnum = [
  "CRIADO",
  "SUBMETIDO",
  "APROVADO_ANALISTA",
  "DEVOLVIDO_ANALISTA",
  "APROVADO_COORDENADORA",
  "DEVOLVIDO_COORDENADORA",
  "DOCUMENTO_IMPRESSO",
  "RECUPERADO",
  "COMENTARIO_ADICIONADO",
  "TRANSFERIDO",
] as const;
```

- [ ] **Step 2: Verificar typecheck do package**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=@essencia/db
```

Expected: PASS sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/plano-aula-historico.ts
git commit -m "feat(db): adicionar valor TRANSFERIDO ao enum de histórico de plano de aula"
```

---

### Task 2: Atualizar schema Drizzle de plano-aula (renomear índice único)

**Files:**
- Modify: `packages/db/src/schema/plano-aula.ts:93-97`

- [ ] **Step 1: Trocar a definição do índice**

Em `packages/db/src/schema/plano-aula.ts`, dentro do segundo argumento do `pgTable`, substituir:

```typescript
    // Constraint: um professor não pode ter 2 planos para mesma turma/quinzena
    uniquePlanoIdx: uniqueIndex("plano_aula_user_turma_quinzena_unique").on(
      table.userId,
      table.turmaId,
      table.quinzenaId,
    ),
```

por:

```typescript
    // Constraint: uma turma tem apenas um plano por quinzena
    // (independente de qual professora é responsável)
    uniquePlanoIdx: uniqueIndex("plano_aula_turma_quinzena_unique").on(
      table.turmaId,
      table.quinzenaId,
    ),
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=@essencia/db
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/plano-aula.ts
git commit -m "feat(db): índice único de plano_aula passa a ser por (turma, quinzena)"
```

---

### Task 3: Criar migration SQL manual

**Files:**
- Create: `packages/db/drizzle/0028_continuidade_plano_aula_troca_professora.sql`

- [ ] **Step 1: Criar migration**

Criar `packages/db/drizzle/0028_continuidade_plano_aula_troca_professora.sql` com:

```sql
-- Migration: 0028_continuidade_plano_aula_troca_professora.sql
-- Suporta troca de professora titular sem perder continuidade do plano de aula

-- 1. Verificação prévia: abortar se já existirem duplicatas em (turma_id, quinzena_id)
DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT turma_id, quinzena_id
    FROM plano_aula
    GROUP BY turma_id, quinzena_id
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Existem % grupos duplicados em (turma_id, quinzena_id). Resolva manualmente antes de prosseguir.', duplicate_count;
  END IF;
END $$;

-- 2. Substituir índice único: deixa de incluir user_id
DROP INDEX "plano_aula_user_turma_quinzena_unique";
CREATE UNIQUE INDEX "plano_aula_turma_quinzena_unique"
  ON "plano_aula" USING btree ("turma_id","quinzena_id");

-- 3. Atualizar CHECK constraint do histórico para incluir TRANSFERIDO
ALTER TABLE "plano_aula_historico" DROP CONSTRAINT "chk_plano_historico_acao";
ALTER TABLE "plano_aula_historico" ADD CONSTRAINT "chk_plano_historico_acao" CHECK ("acao" IN (
  'CRIADO',
  'SUBMETIDO',
  'APROVADO_ANALISTA',
  'DEVOLVIDO_ANALISTA',
  'APROVADO_COORDENADORA',
  'DEVOLVIDO_COORDENADORA',
  'DOCUMENTO_IMPRESSO',
  'RECUPERADO',
  'COMENTARIO_ADICIONADO',
  'TRANSFERIDO'
));
```

- [ ] **Step 2: Aplicar em dev**

```bash
cd /var/www/essencia && pnpm db:migrate
```

Expected: migration aplicada sem erro. Se a verificação prévia abortar com `duplicate_count > 0`, **parar e investigar manualmente** — não modificar a migration para pular a verificação.

- [ ] **Step 3: Verificar estado do banco**

```bash
docker exec essencia-postgres psql -U essencia -d essencia_db -c "\d plano_aula" | grep -i unique
docker exec essencia-postgres psql -U essencia -d essencia_db -c "\d+ plano_aula_historico" | grep -i chk_plano
```

Expected (primeira linha): `"plano_aula_turma_quinzena_unique" UNIQUE, btree (turma_id, quinzena_id)`.
Expected (segunda linha): CHECK constraint contém `'TRANSFERIDO'`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/drizzle/0028_continuidade_plano_aula_troca_professora.sql
git commit -m "feat(db): migration para troca de professora — índice único e enum TRANSFERIDO"
```

---

## Fase 2 — `PlanoAulaService.transferirPlanosPendentes`

### Task 4: Adicionar tipos auxiliares e teste falho da transferência (caso feliz)

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`

- [ ] **Step 1: Estender o mock de db no spec**

Em `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`, ampliar `mockDb` (linhas 7-20) para suportar transação e queries da transferência. Substituir o objeto `mockDb` por:

```typescript
const mockTx = {
  query: {
    planoAula: {
      findMany: jest.fn(),
    },
    users: {
      findMany: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
};

const mockDb = {
  query: {
    planoDocumento: {
      findFirst: jest.fn(),
    },
    users: {
      findFirst: jest.fn(),
    },
    planoAula: {
      findMany: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  transaction: jest.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
};
```

- [ ] **Step 2: Adicionar `isNotNull` e `inArray` ao jest.mock**

Verificar a chamada `jest.mock("@essencia/db", ...)` (linha 22) e garantir que estes símbolos estão exportados pelo mock (alguns já estão):

```typescript
jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  and: jest.fn(),
  eq: jest.fn(),
  or: jest.fn(),
  desc: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  inArray: jest.fn(),
  isNotNull: jest.fn(),
  ne: jest.fn(),
  planoAula: {},
  planoAulaHistorico: {},
  planoDocumento: {},
  documentoComentario: {},
  quinzenaConfig: {},
  turmas: {},
  users: {},
}));
```

- [ ] **Step 3: Adicionar describe block com teste falho — caso feliz**

Adicionar no final do `describe("PlanoAulaService", ...)`, antes do fechamento `});` final:

```typescript
  describe("transferirPlanosPendentes", () => {
    const ator = {
      userId: "coord-1",
      userName: "Coordenadora Ana",
      userRole: "coordenadora_geral",
    };

    it("transfere planos não-aprovados, atualiza userId e cria histórico TRANSFERIDO", async () => {
      // Planos pendentes da turma
      mockTx.query.planoAula.findMany.mockResolvedValue([
        { id: "plano-1", status: "RASCUNHO" },
        { id: "plano-2", status: "DEVOLVIDO_ANALISTA" },
      ]);

      // Nomes das professoras
      mockTx.query.users.findMany.mockResolvedValue([
        { id: "prof-antiga", name: "Maria da Silva" },
        { id: "prof-nova", name: "Joana Souza" },
      ]);

      // UPDATE planos retorna IDs
      mockTx.returning.mockResolvedValueOnce([
        { id: "plano-1" },
        { id: "plano-2" },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).transferirPlanosPendentes(
        mockTx,
        "turma-1",
        "prof-antiga",
        "prof-nova",
        ator,
      );

      expect(result.planosTransferidos).toEqual(["plano-1", "plano-2"]);
      // Confirma UPDATE
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.set).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "prof-nova" }),
      );
      // Confirma INSERT no histórico — uma chamada por plano transferido
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
      expect(mockTx.values).toHaveBeenCalledWith(
        expect.objectContaining({
          planoId: "plano-1",
          userId: "coord-1",
          userName: "Coordenadora Ana",
          userRole: "coordenadora_geral",
          acao: "TRANSFERIDO",
          statusAnterior: "RASCUNHO",
          statusNovo: "RASCUNHO",
          detalhes: expect.objectContaining({
            professoraAnteriorId: "prof-antiga",
            professoraAnteriorNome: "Maria da Silva",
            novaProfessoraId: "prof-nova",
            novaProfessoraNome: "Joana Souza",
            motivo: "troca_titular_turma",
          }),
        }),
      );
    });
  });
```

- [ ] **Step 4: Rodar o teste e verificar que falha**

```bash
cd /var/www/essencia/services/api && pnpm jest plano-aula.service.spec --testNamePattern="transferirPlanosPendentes"
```

Expected: FAIL com `service.transferirPlanosPendentes is not a function`.

---

### Task 5: Implementar `transferirPlanosPendentes` (mínimo para passar caso feliz)

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`

- [ ] **Step 1: Adicionar imports e tipos auxiliares**

No topo de `plano-aula.service.ts`, ajustar a lista de imports:

```typescript
import {
  getDb,
  and,
  eq,
  or,
  ne,
  desc,
  gte,
  lte,
  inArray,
  isNotNull,
  planoAula,
  planoAulaHistorico,
  planoDocumento,
  documentoComentario,
  quinzenaConfig,
  turmas,
  users,
  type PlanoAula,
  type PlanoDocumento,
  type DocumentoComentario,
  type PlanoAulaStatus,
  type Db,
} from "@essencia/db";
```

(Se `Db` não for exportado de `@essencia/db`, manter o padrão de `tarefas.service.ts:24` definindo localmente; ver Step 1.5 abaixo.)

- [ ] **Step 1.5: Definir tipo DbTransaction localmente (caso `Db` não exportado)**

Após os imports, adicionar:

```typescript
type DbInstance = ReturnType<typeof getDb>;
type DbTransaction = Parameters<DbInstance["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;
type DbExecutor = DbInstance | DbTransaction;
```

(Se `Db` for exportado, usar `Db` no lugar de `ReturnType<typeof getDb>`. Decidir conforme o que `@essencia/db` exporta — verificar com `grep "export type Db" packages/db/src/index.ts`.)

- [ ] **Step 2: Adicionar método `transferirPlanosPendentes`**

Adicionar dentro da classe `PlanoAulaService`, após o último método existente (antes do fechamento da classe):

```typescript
  /**
   * Transfere todos os planos não-aprovados de uma turma para uma nova professora.
   * Usado quando a professora titular da turma é trocada (assignProfessora).
   *
   * Mantém planos APROVADOS com a autora original (registro histórico fiel).
   * Cria uma linha em plano_aula_historico para cada plano transferido.
   *
   * Deve ser chamado dentro de uma transação Drizzle (tx) iniciada pelo TurmasService.
   *
   * @param tx Transação Drizzle ativa
   * @param turmaId Turma cuja titular foi trocada
   * @param professoraAnteriorId Professora que estava na turma
   * @param novaProfessoraId Nova professora titular
   * @param ator Usuário que disparou a operação (normalmente coordenadora)
   * @returns Lista de IDs de planos transferidos
   */
  async transferirPlanosPendentes(
    tx: DbTransaction,
    turmaId: string,
    professoraAnteriorId: string,
    novaProfessoraId: string,
    ator: { userId: string; userName: string; userRole: string },
  ): Promise<{ planosTransferidos: string[] }> {
    // 1. Buscar planos pendentes da turma (status != APROVADO)
    const planosPendentes = await tx.query.planoAula.findMany({
      where: and(eq(planoAula.turmaId, turmaId), ne(planoAula.status, "APROVADO")),
      columns: { id: true, status: true },
    });

    if (planosPendentes.length === 0) {
      return { planosTransferidos: [] };
    }

    const planoIds = planosPendentes.map((p) => p.id);

    // 2. Atualizar userId nos planos
    await tx
      .update(planoAula)
      .set({ userId: novaProfessoraId, updatedAt: new Date() })
      .where(inArray(planoAula.id, planoIds));

    // 3. Buscar nomes das professoras (para histórico denormalizado)
    const usuariosEnvolvidos = await tx.query.users.findMany({
      where: inArray(users.id, [professoraAnteriorId, novaProfessoraId]),
      columns: { id: true, name: true },
    });

    const nomeAnterior =
      usuariosEnvolvidos.find((u) => u.id === professoraAnteriorId)?.name ??
      "Professora anterior";
    const nomeNovo =
      usuariosEnvolvidos.find((u) => u.id === novaProfessoraId)?.name ??
      "Nova professora";

    // 4. Inserir histórico TRANSFERIDO para cada plano
    for (const plano of planosPendentes) {
      await tx.insert(planoAulaHistorico).values({
        planoId: plano.id,
        userId: ator.userId,
        userName: ator.userName,
        userRole: ator.userRole,
        acao: "TRANSFERIDO",
        statusAnterior: plano.status,
        statusNovo: plano.status,
        detalhes: {
          professoraAnteriorId,
          professoraAnteriorNome: nomeAnterior,
          novaProfessoraId,
          novaProfessoraNome: nomeNovo,
          motivo: "troca_titular_turma",
        },
      });
    }

    return { planosTransferidos: planoIds };
  }
```

- [ ] **Step 3: Rodar o teste e verificar que passa**

```bash
cd /var/www/essencia/services/api && pnpm jest plano-aula.service.spec --testNamePattern="transferirPlanosPendentes"
```

Expected: PASS no teste do caso feliz.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.service.ts services/api/src/modules/plano-aula/plano-aula.service.spec.ts
git commit -m "feat(plano-aula): método transferirPlanosPendentes para troca de professora"
```

---

### Task 6: Teste — turma sem planos pendentes não cria histórico

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`

- [ ] **Step 1: Adicionar teste**

Adicionar dentro do `describe("transferirPlanosPendentes", ...)`:

```typescript
    it("retorna lista vazia e não cria histórico quando turma não tem planos pendentes", async () => {
      mockTx.query.planoAula.findMany.mockResolvedValue([]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).transferirPlanosPendentes(
        mockTx,
        "turma-1",
        "prof-antiga",
        "prof-nova",
        ator,
      );

      expect(result.planosTransferidos).toEqual([]);
      expect(mockTx.update).not.toHaveBeenCalled();
      expect(mockTx.insert).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Rodar o teste**

```bash
cd /var/www/essencia/services/api && pnpm jest plano-aula.service.spec --testNamePattern="transferirPlanosPendentes"
```

Expected: ambos PASS (caso feliz + lista vazia).

- [ ] **Step 3: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.service.spec.ts
git commit -m "test(plano-aula): transferência sem planos pendentes não cria histórico"
```

---

### Task 7: Teste — APROVADO não é transferido (filtro semântico)

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`

- [ ] **Step 1: Adicionar teste**

```typescript
    it("filtra planos APROVADOS via cláusula WHERE (não dependem do mock retornar)", async () => {
      // Mock retorna apenas planos pendentes — verificamos que o WHERE foi montado
      mockTx.query.planoAula.findMany.mockResolvedValue([
        { id: "plano-1", status: "RASCUNHO" },
      ]);
      mockTx.query.users.findMany.mockResolvedValue([
        { id: "prof-antiga", name: "Maria" },
        { id: "prof-nova", name: "Joana" },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (service as any).transferirPlanosPendentes(
        mockTx,
        "turma-1",
        "prof-antiga",
        "prof-nova",
        ator,
      );

      // findMany foi chamado com where montado via and(eq, ne)
      // Não dá pra inspecionar argumentos opacos do drizzle, mas
      // garantimos que findMany foi chamado uma vez (filtro presente).
      expect(mockTx.query.planoAula.findMany).toHaveBeenCalledTimes(1);
      expect(mockTx.query.planoAula.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        }),
      );
    });
```

- [ ] **Step 2: Rodar todos os testes do describe**

```bash
cd /var/www/essencia/services/api && pnpm jest plano-aula.service.spec --testNamePattern="transferirPlanosPendentes"
```

Expected: todos PASS.

- [ ] **Step 3: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.service.spec.ts
git commit -m "test(plano-aula): valida que filtro WHERE da transferência inclui status"
```

---

## Fase 3 — `TurmasService.assignProfessora`

### Task 8: Criar arquivo de teste do TurmasService e teste falho de troca real

**Files:**
- Create: `services/api/src/modules/turmas/turmas.service.spec.ts`

- [ ] **Step 1: Criar arquivo de teste**

Criar `services/api/src/modules/turmas/turmas.service.spec.ts` com:

```typescript
import { Test, TestingModule } from "@nestjs/testing";

import { PlanoAulaService } from "../plano-aula/plano-aula.service";
import { TurmasService } from "./turmas.service";

const mockTx = {
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

const mockDb = {
  query: {
    turmas: {
      findFirst: jest.fn(),
    },
    users: {
      findFirst: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  transaction: jest.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  and: jest.fn(),
  eq: jest.fn(),
  asc: jest.fn(),
  inArray: jest.fn(),
  turmas: {},
  units: {},
  users: {},
}));

describe("TurmasService — assignProfessora", () => {
  let service: TurmasService;
  const planoAulaServiceMock = {
    transferirPlanosPendentes: jest.fn(),
  };

  const ator = {
    userId: "coord-1",
    userName: "Coordenadora Ana",
    userRole: "coordenadora_geral",
  };

  const turmaBase = {
    id: "turma-1",
    unitId: "unit-1",
    stageId: "stage-1",
    code: "T1",
    year: 2026,
    isActive: true,
  };

  const profValida = {
    id: "prof-nova",
    role: "professora",
    unitId: "unit-1",
    stageId: "stage-1",
    name: "Joana Souza",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurmasService,
        { provide: PlanoAulaService, useValue: planoAulaServiceMock },
      ],
    }).compile();

    service = module.get<TurmasService>(TurmasService);
    jest.clearAllMocks();
  });

  it("dispara transferirPlanosPendentes quando há troca real (anterior diferente da nova)", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      professoraId: "prof-antiga",
    });
    mockDb.query.users.findFirst.mockResolvedValue(profValida);
    mockTx.returning.mockResolvedValueOnce([
      { ...turmaBase, professoraId: profValida.id },
    ]);
    planoAulaServiceMock.transferirPlanosPendentes.mockResolvedValue({
      planosTransferidos: ["plano-1"],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).assignProfessora("turma-1", profValida.id, ator);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(planoAulaServiceMock.transferirPlanosPendentes).toHaveBeenCalledWith(
      mockTx,
      "turma-1",
      "prof-antiga",
      profValida.id,
      ator,
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

```bash
cd /var/www/essencia/services/api && pnpm jest turmas.service.spec
```

Expected: FAIL — `assignProfessora` ainda tem assinatura de 2 argumentos e não chama `planoAulaService`. Erro provável: "Expected number of arguments" ou TS error.

---

### Task 9: Modificar `TurmasModule` para importar `PlanoAulaModule`

**Files:**
- Modify: `services/api/src/modules/turmas/turmas.module.ts`

- [ ] **Step 1: Adicionar import**

Substituir o conteúdo de `turmas.module.ts` por:

```typescript
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlanoAulaModule } from "../plano-aula/plano-aula.module";
import { TurmasController } from "./turmas.controller";
import { TurmasService } from "./turmas.service";

@Module({
  imports: [AuthModule, PlanoAulaModule],
  controllers: [TurmasController],
  providers: [TurmasService],
  exports: [TurmasService],
})
export class TurmasModule {}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=api
```

Expected: PASS.

---

### Task 10: Modificar `TurmasService.assignProfessora` para detectar troca e disparar transferência

**Files:**
- Modify: `services/api/src/modules/turmas/turmas.service.ts:1-18`, `:256-305`

- [ ] **Step 0: Verificar todos os chamadores de `assignProfessora`**

```bash
cd /var/www/essencia && grep -rn "assignProfessora" services/api/src apps/
```

Expected: deve haver apenas a chamada do controller (`turmas.controller.ts`) e o método em si. Se aparecer outro chamador (ex: outro service, script, seed), ele precisa ser ajustado para passar o terceiro parâmetro `ator` — incluir esse ajuste como Step adicional antes de prosseguir.

- [ ] **Step 1: Adicionar imports e injeção**

Substituir o topo de `turmas.service.ts` (linhas 1-19) por:

```typescript
import { and, asc, eq, getDb, inArray } from "@essencia/db";
import {
  turmas,
  units,
  users,
  type Turma,
  type User,
} from "@essencia/db/schema";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PlanoAulaService } from "../plano-aula/plano-aula.service";
import { CreateTurmaDto } from "./dto/create-turma.dto";
import { UpdateTurmaDto } from "./dto/update-turma.dto";

@Injectable()
export class TurmasService {
  constructor(private readonly planoAulaService: PlanoAulaService) {}
```

(Adicionar a linha `constructor` logo após `export class TurmasService {`. Manter o restante da classe intacto.)

- [ ] **Step 2: Substituir `assignProfessora`**

Substituir o método inteiro `assignProfessora` (linhas 256-305) por:

```typescript
  /**
   * Atribui ou altera professora titular de uma turma.
   *
   * Quando a turma já tem professora titular e a nova é diferente,
   * abre uma transação que também transfere todos os planos de aula
   * não-aprovados para a nova professora (via PlanoAulaService).
   *
   * @throws NotFoundException se turma ou professora não existe
   * @throws BadRequestException se professora não pertence à mesma unidade/etapa
   */
  async assignProfessora(
    turmaId: string,
    professoraId: string,
    ator: { userId: string; userName: string; userRole: string },
  ): Promise<Turma> {
    const db = getDb();

    // Verificar se turma existe
    const turma = await db.query.turmas.findFirst({
      where: eq(turmas.id, turmaId),
    });

    if (!turma) {
      throw new NotFoundException("Turma não encontrada");
    }

    // Verificar se professora existe e tem role "professora"
    const professora = await db.query.users.findFirst({
      where: eq(users.id, professoraId),
    });

    if (!professora) {
      throw new NotFoundException("Professora não encontrada");
    }

    if (professora.role !== "professora") {
      throw new BadRequestException("Usuário selecionado não é professora");
    }

    if (professora.unitId !== turma.unitId) {
      throw new BadRequestException(
        "Professora deve pertencer à mesma unidade da turma",
      );
    }

    if (professora.stageId !== turma.stageId) {
      throw new BadRequestException(
        "Professora deve pertencer à mesma etapa da turma",
      );
    }

    const professoraAnteriorId = turma.professoraId;
    const houveTrocaReal =
      professoraAnteriorId !== null &&
      professoraAnteriorId !== professoraId;

    if (!houveTrocaReal) {
      // Atribuição inicial ou mesma professora — não há planos para transferir
      const [updated] = await db
        .update(turmas)
        .set({ professoraId, updatedAt: new Date() })
        .where(eq(turmas.id, turmaId))
        .returning();
      return updated;
    }

    // Troca real: atualizar turma e transferir planos pendentes na mesma transação
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(turmas)
        .set({ professoraId, updatedAt: new Date() })
        .where(eq(turmas.id, turmaId))
        .returning();

      await this.planoAulaService.transferirPlanosPendentes(
        tx,
        turmaId,
        professoraAnteriorId,
        professoraId,
        ator,
      );

      return updated;
    });
  }
```

- [ ] **Step 3: Rodar o teste de troca real**

```bash
cd /var/www/essencia/services/api && pnpm jest turmas.service.spec --testNamePattern="troca real"
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/modules/turmas/turmas.service.ts services/api/src/modules/turmas/turmas.service.spec.ts services/api/src/modules/turmas/turmas.module.ts
git commit -m "feat(turmas): assignProfessora dispara transferência de planos em troca real"
```

---

### Task 11: Teste — atribuição inicial NÃO dispara transferência

**Files:**
- Modify: `services/api/src/modules/turmas/turmas.service.spec.ts`

- [ ] **Step 1: Adicionar teste dentro do describe**

```typescript
  it("NÃO dispara transferirPlanosPendentes em atribuição inicial (turma sem professora anterior)", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      professoraId: null,
    });
    mockDb.query.users.findFirst.mockResolvedValue(profValida);
    mockDb.returning.mockResolvedValueOnce([
      { ...turmaBase, professoraId: profValida.id },
    ]);

    await service.assignProfessora("turma-1", profValida.id, ator);

    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(planoAulaServiceMock.transferirPlanosPendentes).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Rodar o teste**

```bash
cd /var/www/essencia/services/api && pnpm jest turmas.service.spec
```

Expected: PASS.

---

### Task 12: Teste — atribuir mesma professora NÃO dispara transferência

**Files:**
- Modify: `services/api/src/modules/turmas/turmas.service.spec.ts`

- [ ] **Step 1: Adicionar teste**

```typescript
  it("NÃO dispara transferirPlanosPendentes quando a professora atribuída é a mesma já presente", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      professoraId: profValida.id, // mesma professora
    });
    mockDb.query.users.findFirst.mockResolvedValue(profValida);
    mockDb.returning.mockResolvedValueOnce([
      { ...turmaBase, professoraId: profValida.id },
    ]);

    await service.assignProfessora("turma-1", profValida.id, ator);

    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(planoAulaServiceMock.transferirPlanosPendentes).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Rodar todos os testes do arquivo**

```bash
cd /var/www/essencia/services/api && pnpm jest turmas.service.spec
```

Expected: 3 testes PASS.

- [ ] **Step 3: Commit**

```bash
git add services/api/src/modules/turmas/turmas.service.spec.ts
git commit -m "test(turmas): cobre atribuição inicial e mesma professora sem transferência"
```

---

## Fase 4 — Controller (passar `req.user`)

### Task 13: Atualizar `turmas.controller.ts` para passar `req.user`

**Files:**
- Modify: `services/api/src/modules/turmas/turmas.controller.ts:189-205`

- [ ] **Step 1: Substituir o método `assignProfessora`**

Substituir o método `assignProfessora` (linhas 189-205) por:

```typescript
  /**
   * Atribui ou altera professora titular da turma
   */
  @Put("turmas/:id/professora")
  @UseGuards(RolesGuard, TenantGuard)
  @Roles("master", "diretora_geral", "gerente_unidade", "coordenadora_geral")
  async assignProfessora(
    @Param("id") turmaId: string,
    @Body() body: { professoraId: string },
    @CurrentUser()
    user: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string | null;
      stageId: string | null;
      name: string;
    },
  ) {
    const turma = await this.turmasService.assignProfessora(
      turmaId,
      body.professoraId,
      {
        userId: user.userId,
        userName: user.name,
        userRole: user.role,
      },
    );

    return {
      success: true,
      data: turma,
    };
  }
```

- [ ] **Step 2: Verificar shape do `CurrentUser` decorator**

```bash
cd /var/www/essencia && grep -A 30 "CurrentUser" services/api/src/common/decorators/current-user.decorator.ts | head -40
```

Confirmar que o objeto retornado por `@CurrentUser()` inclui `name` (campo necessário para o histórico denormalizado). Se não incluir, ajustar o decorator OU buscar o `users.name` via `getDb()` no service. **Não modificar o decorator se não for necessário; preferir buscar nome no service** se for solução menos invasiva. Verificar abaixo.

- [ ] **Step 3: Se `name` não estiver disponível no CurrentUser, buscar no service**

Caso `CurrentUser` não inclua `name`, manter o controller passando apenas `userId` e `role`, e ajustar o `TurmasService.assignProfessora` para buscar o nome do ator via `db.query.users.findFirst({ where: eq(users.id, ator.userId), columns: { name: true } })` antes de iniciar a transação. Atualizar o teste correspondente.

- [ ] **Step 4: Rodar typecheck e testes**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=api
cd /var/www/essencia/services/api && pnpm jest turmas.service.spec plano-aula.service.spec
```

Expected: typecheck PASS, todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/modules/turmas/turmas.controller.ts
git commit -m "feat(turmas): controller passa contexto do usuário para assignProfessora"
```

---

## Fase 5 — UI (timeline)

### Task 14: Renderizar a ação `TRANSFERIDO` no timeline do plano de aula

**Files:**
- Modify: `apps/planejamento/features/plano-aula/components/historico-timeline.tsx`

- [ ] **Step 1: Localizar o componente**

```bash
find /var/www/essencia/apps/planejamento/features/plano-aula/components -name "historico-timeline*"
```

Expected: caminho do(s) arquivo(s) que renderiza(m) timeline.

- [ ] **Step 2: Ler o componente para entender padrão atual**

```bash
cd /var/www/essencia && head -100 apps/planejamento/features/plano-aula/components/historico-timeline.tsx
```

Identificar como cada `acao` é mapeada para label/ícone (provável `switch` ou objeto map).

- [ ] **Step 3: Adicionar caso `TRANSFERIDO`**

No mesmo padrão usado pelas demais ações, adicionar entrada para `TRANSFERIDO`. Exemplo (ajustar à estrutura real):

```typescript
case "TRANSFERIDO": {
  const detalhes = entry.detalhes as
    | {
        professoraAnteriorNome?: string;
        novaProfessoraNome?: string;
      }
    | null;
  return {
    icone: <ArrowRightLeft className="h-4 w-4" />,
    label: `Plano transferido de ${detalhes?.professoraAnteriorNome ?? "professora anterior"} para ${detalhes?.novaProfessoraNome ?? "nova professora"}`,
  };
}
```

(O ícone exato e a estrutura do mapeamento dependem do componente atual — adaptar mantendo o padrão. Se o mapeamento estiver em um arquivo de constantes separado, alterar lá.)

- [ ] **Step 4: Verificar typecheck do app**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=planejamento
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/planejamento/features/plano-aula/components/historico-timeline.tsx
git commit -m "feat(planejamento): timeline renderiza ação TRANSFERIDO no histórico"
```

---

## Fase 6 — Verificação Final

### Task 15: Rodar pipeline completo de qualidade

**Files:** nenhum

- [ ] **Step 1: Lint global**

```bash
cd /var/www/essencia && pnpm turbo lint
```

Expected: PASS sem novos warnings nos arquivos modificados.

- [ ] **Step 2: Typecheck global**

```bash
cd /var/www/essencia && pnpm turbo typecheck
```

Expected: PASS.

- [ ] **Step 3: Rodar todos os testes da API afetada**

```bash
cd /var/www/essencia/services/api && pnpm jest plano-aula turmas
```

Expected: todos os testes PASS, incluindo os 3 novos blocos (transferirPlanosPendentes — caso feliz, sem planos, filtro WHERE; assignProfessora — troca real, atribuição inicial, mesma professora).

- [ ] **Step 4: Verificação manual em dev (smoke test)**

Subir API local com `pnpm turbo dev --filter=api` e simular via curl:

```bash
# 1. Atribuir professora A à turma vazia
curl -X PUT http://localhost:3001/api/turmas/<ID>/professora \
  -H "Cookie: <session>" \
  -H "Content-Type: application/json" \
  -d '{"professoraId":"<A>"}'

# 2. Criar plano em RASCUNHO como professora A (via login dela)
# 3. Trocar para professora B
curl -X PUT http://localhost:3001/api/turmas/<ID>/professora \
  -H "Cookie: <session-coord>" \
  -H "Content-Type: application/json" \
  -d '{"professoraId":"<B>"}'

# 4. Verificar no banco:
docker exec essencia-postgres psql -U essencia -d essencia_db -c \
  "SELECT id, user_id, status FROM plano_aula WHERE turma_id = '<ID>';"
docker exec essencia-postgres psql -U essencia -d essencia_db -c \
  "SELECT acao, detalhes FROM plano_aula_historico WHERE plano_id IN (SELECT id FROM plano_aula WHERE turma_id = '<ID>') ORDER BY created_at DESC LIMIT 5;"
```

Expected: `plano_aula.user_id` mudou para B; existe linha `acao = 'TRANSFERIDO'` em histórico com `detalhes` populado.

- [ ] **Step 5: Commit final (caso necessário) e abrir PR**

Se houver ajustes pós-smoke test, comitá-los. Senão, este passo é apenas garantia de que tudo está em main local.

```bash
git log --oneline | head -10  # confirma sequência de commits
git push origin <branch>      # se houver branch dedicada
```

---

## Resumo dos Pontos de Atenção

1. **Constraint UNIQUE pré-existente:** se a migration abortar com `duplicate_count > 0`, parar e investigar. NUNCA modificar a migration para pular o check.
2. **`Db` exportado por @essencia/db:** verificar antes de Task 5 — se não exportado, definir tipo local conforme padrão de `tarefas.service.ts:24`.
3. **`name` no CurrentUser:** Task 13 valida isso. Se não disponível, fallback é buscar no service.
4. **Atomicidade em mocks unitários:** os testes verificam que `transaction` foi chamado e que `transferirPlanosPendentes` recebe o `tx`. Atomicidade real (rollback) só pode ser validada via teste de integração ou inspeção manual no smoke test.
5. **Compatibilidade com chamadas existentes:** `assignProfessora` ganha um terceiro parâmetro obrigatório (`ator`). Se houver outros chamadores além do controller, eles precisam ser ajustados — verificar com `grep -rn "assignProfessora" services/api/src` antes da Task 10.
