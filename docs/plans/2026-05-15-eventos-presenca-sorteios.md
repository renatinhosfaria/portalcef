# Presença e Sorteios do Módulo Eventos Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar confirmação de presença persistida e sorteio de brindes por Nº Inscrição no módulo eventos, garantindo que a mesma inscrita não ganhe mais de uma vez no mesmo evento.

**Architecture:** A regra ficará no backend: a presença será gravada em `evento_inscricoes`, e cada sorteio será gravado em `evento_sorteios`. O frontend apenas chama a API e exibe presença, elegíveis, último resultado e histórico; a proteção contra ganhadora repetida fica no service e no índice único do banco.

**Tech Stack:** PostgreSQL + Drizzle, NestJS + Fastify, Zod, Jest, Next.js App Router, React, shadcn/ui, Tailwind, Vitest.

---

## Observações de Estado Atual

- Existem mudanças locais fora deste plano, inclusive em arquivos que esta feature tocará:
  - `apps/eventos/app/inscricoes-evento/page.tsx`
  - `services/api/src/modules/evento-inscricoes/evento-inscricoes.controller.ts`
  - `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.ts`
  - `packages/components/src/shell/app-sidebar.tsx`
  - `apps/loja-admin/__tests__/modulo-eventos.test.ts`
- Essas mudanças liberam `auxiliar_administrativo` no módulo eventos e removem o deadline de inscrição do evento. Elas devem ser preservadas.
- Antes de executar este plano, usar `superpowers:using-git-worktrees` se houver um diretório de worktree configurado. Como não havia `.worktrees/`, `worktrees/` nem preferência em `CLAUDE.md` no momento da escrita, confirmar o local do worktree ou executar no workspace atual preservando os diffs existentes.

## Convenções

- Comunicação, comentários de domínio, mensagens de erro e commits em Português do Brasil.
- Não acessar banco diretamente em app frontend; todo fluxo passa pela API HTTP.
- Seguir TDD: escrever teste, confirmar falha, implementar o mínimo, confirmar que passa.
- Commits pequenos após cada tarefa concluída.

## Task 1: DTOs dos Fluxos de Presença e Sorteio

**Files:**
- Modify: `services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.ts`
- Modify: `services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.spec.ts`

**Step 1: Write the failing test**

Adicionar testes para:

```typescript
import {
  atualizarPresencaSchema,
  criarSorteioSchema,
  listarInscricoesSchema,
} from "./evento-inscricoes.dto";

describe("listarInscricoesSchema", () => {
  it("aceita filtro somentePresentes como boolean coercido", () => {
    const result = listarInscricoesSchema.parse({ somentePresentes: "true" });

    expect(result.somentePresentes).toBe(true);
  });
});

describe("atualizarPresencaSchema", () => {
  it("exige campo presente booleano", () => {
    expect(atualizarPresencaSchema.parse({ presente: true })).toEqual({
      presente: true,
    });

    expect(() => atualizarPresencaSchema.parse({ presente: "sim" })).toThrow();
  });
});

describe("criarSorteioSchema", () => {
  it("normaliza brinde e rejeita texto vazio", () => {
    expect(criarSorteioSchema.parse({ brinde: "  Cesta de café  " })).toEqual({
      brinde: "Cesta de café",
    });

    expect(() => criarSorteioSchema.parse({ brinde: "   " })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- --runTestsByPath src/modules/evento-inscricoes/dto/evento-inscricoes.dto.spec.ts --no-coverage
```

Expected: FAIL porque `atualizarPresencaSchema` e `criarSorteioSchema` ainda não existem e `somentePresentes` ainda não é aceito.

**Step 3: Write minimal implementation**

Em `evento-inscricoes.dto.ts`:

```typescript
export const listarInscricoesSchema = z.object({
  turma: z.string().trim().optional(),
  q: z.string().trim().optional(),
  somentePresentes: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const atualizarPresencaSchema = z.object({
  presente: z.boolean(),
});

export const criarSorteioSchema = z.object({
  brinde: z.string().trim().min(1, "Informe o nome do brinde").max(200),
});

export type AtualizarPresencaDto = z.infer<typeof atualizarPresencaSchema>;
export type CriarSorteioDto = z.infer<typeof criarSorteioSchema>;
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- --runTestsByPath src/modules/evento-inscricoes/dto/evento-inscricoes.dto.spec.ts --no-coverage
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.ts \
        services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.spec.ts
git commit -m "test(eventos): cobrir contratos de presença e sorteio"
```

## Task 2: Schema e Migration de Presença/Sorteios

**Files:**
- Modify: `packages/db/src/schema/evento-inscricoes.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0030_eventos_presenca_sorteios.sql`

**Step 1: Write the failing check**

Usar o typecheck do pacote db como verificação de contrato após editar temporariamente os imports no schema. Primeiro não alterar produção; rodar o comando para confirmar baseline:

```bash
pnpm --filter @essencia/db typecheck
```

Expected: PASS ou falha preexistente. Se falhar, registrar a saída antes de continuar.

**Step 2: Write the migration**

Criar `packages/db/drizzle/0030_eventos_presenca_sorteios.sql`:

```sql
ALTER TABLE "evento_inscricoes"
  ADD COLUMN IF NOT EXISTS "presenca_confirmada_em" timestamptz,
  ADD COLUMN IF NOT EXISTS "presenca_confirmada_por" uuid;

CREATE TABLE IF NOT EXISTS "evento_sorteios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "evento_slug" varchar(80) NOT NULL,
  "brinde" varchar(200) NOT NULL,
  "inscricao_id" uuid NOT NULL,
  "numero_inscricao" varchar(7) NOT NULL,
  "sorteado_em" timestamptz NOT NULL DEFAULT now(),
  "sorteado_por" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "evento_sorteios_inscricao_id_fk"
    FOREIGN KEY ("inscricao_id")
    REFERENCES "evento_inscricoes"("id")
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_evento_sorteios_evento_inscricao"
  ON "evento_sorteios" USING btree ("evento_slug", "inscricao_id");

CREATE INDEX IF NOT EXISTS "idx_evento_sorteios_evento_slug"
  ON "evento_sorteios" USING btree ("evento_slug");

CREATE INDEX IF NOT EXISTS "idx_evento_sorteios_sorteado_em"
  ON "evento_sorteios" USING btree ("sorteado_em" DESC);

CREATE INDEX IF NOT EXISTS "idx_evento_inscricoes_presenca"
  ON "evento_inscricoes" USING btree ("evento_slug", "presenca_confirmada_em");
```

**Step 3: Update Drizzle schema**

Em `packages/db/src/schema/evento-inscricoes.ts`:

- importar `boolean` não é necessário;
- adicionar `presencaConfirmadaEm` e `presencaConfirmadaPor` em `eventoInscricoes`;
- criar tabela `eventoSorteios`;
- exportar tipos `EventoSorteio` e `NewEventoSorteio`;
- adicionar relação `sorteios: many(eventoSorteios)` em `eventoInscricoesRelations`;
- adicionar `eventoSorteiosRelations`;
- exportar schemas zod de insert/select.

Formato esperado:

```typescript
export const eventoSorteios = pgTable(
  "evento_sorteios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventoSlug: varchar("evento_slug", { length: 80 }).notNull(),
    brinde: varchar("brinde", { length: 200 }).notNull(),
    inscricaoId: uuid("inscricao_id")
      .notNull()
      .references(() => eventoInscricoes.id, { onDelete: "restrict" }),
    numeroInscricao: varchar("numero_inscricao", { length: 7 }).notNull(),
    sorteadoEm: timestamp("sorteado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sorteadoPor: uuid("sorteado_por"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    eventoInscricaoUnique: uniqueIndex(
      "uq_evento_sorteios_evento_inscricao",
    ).on(table.eventoSlug, table.inscricaoId),
    eventoSlugIdx: index("idx_evento_sorteios_evento_slug").on(
      table.eventoSlug,
    ),
    sorteadoEmIdx: index("idx_evento_sorteios_sorteado_em").on(
      table.sorteadoEm,
    ),
  }),
);
```

**Step 4: Run typecheck**

Run:

```bash
pnpm --filter @essencia/db typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db/src/schema/evento-inscricoes.ts \
        packages/db/src/schema/index.ts \
        packages/db/drizzle/0030_eventos_presenca_sorteios.sql
git commit -m "feat(eventos): adicionar schema de presença e sorteios"
```

## Task 3: Service de Presença e Sorteio

**Files:**
- Create: `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.spec.ts`
- Modify: `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.ts`

**Step 1: Write the failing tests**

Criar testes unitários para os comportamentos de serviço. Usar um fake de DB pequeno, com métodos encadeáveis, para validar chamadas e retornos sem conectar no banco.

Casos obrigatórios:

```typescript
describe("EventoInscricoesService - presença", () => {
  it("confirma presença gravando data e usuário responsável", async () => {});
  it("desfaz presença limpando data e usuário responsável", async () => {});
});

describe("EventoInscricoesService - sorteios", () => {
  it("sorteia apenas inscrita presente que ainda não ganhou brinde", async () => {});
  it("retorna erro claro quando não há inscritas elegíveis", async () => {});
  it("não permite sortear brinde sem nome", async () => {});
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- --runTestsByPath src/modules/evento-inscricoes/evento-inscricoes.service.spec.ts --no-coverage
```

Expected: FAIL porque `confirmarPresenca`, `listarSorteios` e `sortearBrinde` ainda não existem.

**Step 3: Write minimal implementation**

Em `evento-inscricoes.service.ts`:

- importar `BadRequestException`, `NotFoundException` e, se necessário, `ServiceUnavailableException`;
- importar `isNotNull`, `notExists` ou usar `sql` para exclusão dos sorteados;
- importar `eventoSorteios`;
- adicionar tipos:

```typescript
export interface SorteioEvento {
  id: string;
  eventoSlug: string;
  brinde: string;
  inscricaoId: string;
  numeroInscricao: string;
  nome: string;
  telefone: string;
  email: string;
  sorteadoEm: Date;
  sorteadoPor: string | null;
}
```

- atualizar `InscricaoComFilhos` para incluir:

```typescript
presencaConfirmadaEm: Date | null;
presencaConfirmadaPor: string | null;
```

- no método `listar`, incluir busca por `numeroInscricao` e filtro `somentePresentes`;
- criar método `atualizarPresenca(eventoSlug, id, presente, userId)`;
- criar método `listarSorteios(eventoSlug)`;
- criar método `sortearBrinde(eventoSlug, brinde, userId)`.

Regra do sorteio:

```typescript
const [ganhadora] = await tx
  .select()
  .from(eventoInscricoes)
  .where(
    and(
      eq(eventoInscricoes.eventoSlug, eventoSlug),
      isNotNull(eventoInscricoes.presencaConfirmadaEm),
      sql`not exists (
        select 1
        from evento_sorteios s
        where s.evento_slug = ${eventoInscricoes.eventoSlug}
          and s.inscricao_id = ${eventoInscricoes.id}
      )`,
    ),
  )
  .orderBy(sql`random()`)
  .limit(1);
```

Depois inserir em `eventoSorteios` com `brinde`, `inscricaoId`, `numeroInscricao` e `sorteadoPor`.

**Step 4: Run focused tests**

Run:

```bash
pnpm --filter @essencia/api test -- --runTestsByPath src/modules/evento-inscricoes/evento-inscricoes.service.spec.ts --no-coverage
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/evento-inscricoes/evento-inscricoes.service.ts \
        services/api/src/modules/evento-inscricoes/evento-inscricoes.service.spec.ts
git commit -m "feat(eventos): implementar presença e sorteio no service"
```

## Task 4: Endpoints Autenticados

**Files:**
- Modify: `services/api/src/modules/evento-inscricoes/evento-inscricoes.controller.ts`
- Modify: `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.spec.ts`

**Step 1: Write the failing controller contract test**

Se não houver harness de controller simples para este módulo, ampliar o teste de service com validação textual mínima ou criar `evento-inscricoes.controller.spec.ts` cobrindo:

- `PATCH /:slug/inscricoes/:id/presenca` usa `@Roles(...ADMIN_ROLES)`;
- `GET /:slug/sorteios` usa `@Roles(...ADMIN_ROLES)`;
- `POST /:slug/sorteios` usa `@Roles(...ADMIN_ROLES)`;
- controller importa e usa `CurrentUser`;
- valida `atualizarPresencaSchema` e `criarSorteioSchema`.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- --runTestsByPath src/modules/evento-inscricoes/evento-inscricoes.controller.spec.ts --no-coverage
```

Expected: FAIL porque os endpoints ainda não existem.

**Step 3: Write minimal implementation**

Em `evento-inscricoes.controller.ts`:

```typescript
import { Patch } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  atualizarPresencaSchema,
  criarSorteioSchema,
} from "./dto/evento-inscricoes.dto";
```

Adicionar:

```typescript
@Patch(":slug/inscricoes/:id/presenca")
@Roles(...ADMIN_ROLES)
async atualizarPresenca(
  @Param("slug") slug: string,
  @Param("id") id: string,
  @Body() body: unknown,
  @CurrentUser() user: { userId: string },
) {
  if (!SLUG_REGEX.test(slug)) {
    throw new BadRequestException("Slug do evento inválido");
  }
  const parsed = atualizarPresencaSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException("Dados de presença inválidos");
  }
  return this.eventoInscricoesService.atualizarPresenca(
    slug,
    id,
    parsed.data.presente,
    user.userId,
  );
}
```

Adicionar também:

```typescript
@Get(":slug/sorteios")
@Roles(...ADMIN_ROLES)
async listarSorteios(@Param("slug") slug: string) {}

@Post(":slug/sorteios")
@Roles(...ADMIN_ROLES)
@HttpCode(201)
async sortearBrinde(
  @Param("slug") slug: string,
  @Body() body: unknown,
  @CurrentUser() user: { userId: string },
) {}
```

**Step 4: Run focused tests**

Run:

```bash
pnpm --filter @essencia/api test -- --runTestsByPath src/modules/evento-inscricoes/evento-inscricoes.controller.spec.ts --no-coverage
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/evento-inscricoes/evento-inscricoes.controller.ts \
        services/api/src/modules/evento-inscricoes/evento-inscricoes.controller.spec.ts
git commit -m "feat(eventos): expor endpoints de presença e sorteio"
```

## Task 5: UI de Presença na Lista

**Files:**
- Modify: `apps/eventos/app/inscricoes-evento/page.tsx`
- Modify: `apps/loja-admin/__tests__/modulo-eventos.test.ts`

**Step 1: Write the failing test**

Ampliar `apps/loja-admin/__tests__/modulo-eventos.test.ts` com teste textual do módulo eventos:

```typescript
it("exibe controles de presença no módulo eventos", () => {
  const eventosPage = lerArquivoRepositorio(
    "apps/eventos/app/inscricoes-evento/page.tsx",
  );

  expect(eventosPage).toContain("Presentes confirmadas");
  expect(eventosPage).toContain("Somente presentes");
  expect(eventosPage).toContain("Confirmar presença");
  expect(eventosPage).toContain("Desfazer presença");
  expect(eventosPage).toContain("presencaConfirmadaEm");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/loja-admin test -- __tests__/modulo-eventos.test.ts
```

Expected: FAIL porque a UI ainda não tem controles de presença.

**Step 3: Write minimal implementation**

Em `page.tsx`:

- estender `Inscricao`:

```typescript
presencaConfirmadaEm: string | null;
presencaConfirmadaPor: string | null;
```

- adicionar estado:

```typescript
const [somentePresentes, setSomentePresentes] = useState(false);
const [atualizandoPresencaId, setAtualizandoPresencaId] = useState<string | null>(null);
```

- enviar query param:

```typescript
if (somentePresentes) params.set("somentePresentes", "true");
```

- criar `atualizarPresenca`:

```typescript
async function atualizarPresenca(inscricao: Inscricao, presente: boolean) {
  setAtualizandoPresencaId(inscricao.id);
  try {
    const resp = await fetch(
      `/api/eventos/${EVENTO_SLUG}/inscricoes/${inscricao.id}/presenca`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ presente }),
      },
    );
    if (!resp.ok) throw new Error("Falha ao atualizar presença");
    await carregar();
  } catch (err) {
    console.error(err);
    setErro("Não foi possível atualizar a presença.");
  } finally {
    setAtualizandoPresencaId(null);
  }
}
```

- adicionar coluna **Presença** e botões;
- adicionar card **Presentes confirmadas**;
- adicionar checkbox ou botão de filtro **Somente presentes**;
- incluir presença nos exports.

**Step 4: Run focused test**

Run:

```bash
pnpm --filter @essencia/loja-admin test -- __tests__/modulo-eventos.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/eventos/app/inscricoes-evento/page.tsx \
        apps/loja-admin/__tests__/modulo-eventos.test.ts
git commit -m "feat(eventos): adicionar confirmação de presença na lista"
```

## Task 6: UI de Sorteio por Brinde

**Files:**
- Modify: `apps/eventos/app/inscricoes-evento/page.tsx`
- Modify: `apps/loja-admin/__tests__/modulo-eventos.test.ts`

**Step 1: Write the failing test**

Adicionar teste textual:

```typescript
it("exibe painel de sorteio de brindes no módulo eventos", () => {
  const eventosPage = lerArquivoRepositorio(
    "apps/eventos/app/inscricoes-evento/page.tsx",
  );

  expect(eventosPage).toContain("Sorteio de brindes");
  expect(eventosPage).toContain("Nome do brinde");
  expect(eventosPage).toContain("Sortear entre presentes");
  expect(eventosPage).toContain("Elegíveis para sorteio");
  expect(eventosPage).toContain("Histórico de sorteios");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/loja-admin test -- __tests__/modulo-eventos.test.ts
```

Expected: FAIL porque a UI ainda não tem painel de sorteio.

**Step 3: Write minimal implementation**

Em `page.tsx`:

- criar interface:

```typescript
interface Sorteio {
  id: string;
  eventoSlug: string;
  brinde: string;
  inscricaoId: string;
  numeroInscricao: string;
  nome: string;
  telefone: string;
  email: string;
  sorteadoEm: string;
  sorteadoPor: string | null;
}
```

- adicionar estados:

```typescript
const [sorteios, setSorteios] = useState<Sorteio[]>([]);
const [brinde, setBrinde] = useState("");
const [sorteando, setSorteando] = useState(false);
const [ultimoSorteio, setUltimoSorteio] = useState<Sorteio | null>(null);
```

- criar `carregarSorteios`;
- chamar `carregarSorteios` no `useEffect` junto com inscrições;
- criar `sortearBrinde` chamando `POST /api/eventos/${EVENTO_SLUG}/sorteios`;
- calcular elegíveis:

```typescript
const idsSorteados = useMemo(
  () => new Set(sorteios.map((s) => s.inscricaoId)),
  [sorteios],
);
const elegiveis = useMemo(
  () =>
    inscricoes.filter(
      (i) => i.presencaConfirmadaEm && !idsSorteados.has(i.id),
    ).length,
  [inscricoes, idsSorteados],
);
```

- renderizar card **Sorteio de brindes** antes da lista ou entre indicadores e lista.

**Step 4: Run focused test**

Run:

```bash
pnpm --filter @essencia/loja-admin test -- __tests__/modulo-eventos.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/eventos/app/inscricoes-evento/page.tsx \
        apps/loja-admin/__tests__/modulo-eventos.test.ts
git commit -m "feat(eventos): adicionar painel de sorteio de brindes"
```

## Task 7: Verificação Integrada

**Files:**
- No code changes expected.

**Step 1: Run focused API tests**

```bash
pnpm --filter @essencia/api test -- --runTestsByPath \
  src/modules/evento-inscricoes/dto/evento-inscricoes.dto.spec.ts \
  src/modules/evento-inscricoes/evento-inscricoes.service.spec.ts \
  src/modules/evento-inscricoes/evento-inscricoes.controller.spec.ts \
  --no-coverage
```

Expected: PASS.

**Step 2: Run frontend/module tests**

```bash
pnpm --filter @essencia/loja-admin test -- __tests__/modulo-eventos.test.ts
```

Expected: PASS.

**Step 3: Run typechecks**

```bash
pnpm --filter @essencia/db typecheck
pnpm --filter @essencia/api typecheck
pnpm --filter eventos typecheck
```

Expected: PASS.

**Step 4: Run mandatory quality gate**

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected: PASS antes de qualquer commit/PR final.

**Step 5: Final commit if needed**

Se houver ajustes finais:

```bash
git add <arquivos-ajustados>
git commit -m "fix(eventos): ajustar validações finais de presença e sorteio"
```

## Definition of Done

- Presença pode ser confirmada e desfeita pela tela de eventos.
- Busca da lista encontra também por Nº Inscrição.
- Filtro **Somente presentes** funciona.
- Sorteio exige nome do brinde.
- Sorteio usa apenas presentes que ainda não ganharam.
- Histórico de sorteios fica persistido e visível.
- Índice único no banco impede a mesma inscrita de ganhar mais de uma vez no mesmo evento.
- Testes focados passam.
- `pnpm turbo lint && pnpm turbo typecheck` passa antes de finalizar.
