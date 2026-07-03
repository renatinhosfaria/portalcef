# Correcoes da Auditoria do Planejamento Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir os riscos de perda de dados, vazamento entre unidades, divergencia de permissoes, datas civis e inconsistencias de UX encontrados na auditoria completa do modulo `planejamento`.

**Architecture:** As correcoes devem reforcar invariantes no backend antes de ajustar a interface: exclusoes protegidas, validacao de tenant no proprio service e parametros de unidade controlados pela sessao. O frontend deve consumir permissoes reais do contexto autenticado, enviar os nomes de parametros esperados pela API e tratar datas civis `YYYY-MM-DD` sem conversao UTC acidental. O plano mantem TDD em cada tarefa e commits pequenos para permitir revisao incremental.

**Tech Stack:** Turborepo, pnpm, Next.js App Router, React 19, Vitest, Testing Library, NestJS, Jest, ts-jest, Drizzle, PostgreSQL.

---

## Contexto Obrigatorio

Leia antes de executar:

- `AGENTS.md`
- `docs/plans/2026-05-21-correcoes-planejamento.md`
- `docs/plans/2026-05-21-ajustes-review-planejamento.md`
- `apps/planejamento/app/gestao/periodos/periodos-content.tsx`
- `apps/planejamento/app/provas/gestao/ciclos/ciclos-content.tsx`
- `apps/planejamento/features/periodos/hooks/use-periodos.ts`
- `apps/planejamento/features/prova/hooks/use-ciclos.ts`
- `apps/planejamento/features/periodos/components/periodos-list.tsx`
- `apps/planejamento/features/prova/components/ciclos-list.tsx`
- `apps/planejamento/features/periodos/components/plano-aula-card.tsx`
- `apps/planejamento/features/periodos/components/periodo-card-professora.tsx`
- `apps/planejamento/features/periodos/components/plano-aula-grid.tsx`
- `apps/planejamento/features/prova/hooks/use-prova.ts`
- `apps/planejamento/features/plano-aula/hooks/use-plano-aula.ts`
- `packages/shared/src/formatar-data.ts`
- `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.ts`
- `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`
- `services/api/src/modules/prova-ciclo/prova-ciclo.controller.ts`
- `services/api/src/modules/prova-ciclo/prova-ciclo.service.ts`
- `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- `services/api/src/modules/plano-aula/plano-aula.service.ts`
- `services/api/src/modules/plano-aula/dto/plano-aula.dto.ts`
- `services/api/src/modules/prova/prova.controller.ts`
- `services/api/src/modules/prova/prova.service.ts`
- `services/api/src/modules/prova/dto/prova.dto.ts`
- `packages/db/src/schema/plano-aula.ts`
- `packages/db/src/schema/prova.ts`

Regras de execucao:

- Comunicacao, comentarios, documentacao e commits em Portugues do Brasil.
- Rode `git status --short` antes de editar.
- Existem alteracoes locais nao relacionadas em `apps/loja`, `nginx.conf` e um backup SQL. Nao altere nem reverta esses arquivos.
- Use @superpowers:test-driven-development em cada mudanca de comportamento.
- Use @superpowers:systematic-debugging se qualquer teste ou build falhar de forma inesperada.
- Use @superpowers:verification-before-completion antes de declarar pronto.
- Faca commits pequenos e stage apenas os arquivos da tarefa atual.

## Politica de Permissao Alvo

Use esta matriz para alinhar frontend e backend:

- `master`: pode visualizar qualquer unidade quando um `unitId` explicito for aceito; pode gerenciar periodos/ciclos de qualquer etapa da unidade selecionada.
- `diretora_geral`, `gerente_unidade`, `coordenadora_geral`: acesso total dentro da propria unidade da sessao; nao podem consultar outra unidade por query string.
- `gerente_financeiro`: pode acessar dashboards/listagens gerenciais da propria unidade, mas nao cria, edita nem exclui periodos/ciclos pedagogicos.
- `coordenadora_bercario`, `coordenadora_infantil`, `coordenadora_fundamental_i`, `coordenadora_fundamental_ii`, `coordenadora_medio`: acesso pedagogico limitado a propria etapa, dentro da propria unidade.
- `analista_pedagogico`: visualizacao e analise; nao gerencia periodos/ciclos.
- `professora`, `auxiliar_sala`: acesso aos proprios planos/provas e aos periodos/ciclos da turma.

Se essa politica precisar mudar, pare antes da Task 4 e confirme com o responsavel do produto. Nao implemente permissoes ambiguas.

## Task 0: Baseline e Escopo

**Files:**
- Read: `git status --short`
- Read: `apps/planejamento/package.json`
- Read: `services/api/package.json`

**Step 1: Conferir estado local**

Run:

```bash
git status --short
```

Expected: listar alteracoes locais fora do escopo em loja, `nginx.conf` e backup SQL. Nao revertar.

**Step 2: Confirmar baseline focado**

Run:

```bash
pnpm --filter planejamento test
pnpm --filter planejamento lint
pnpm --filter planejamento typecheck
pnpm --filter @essencia/api test -- src/modules/plannings/plannings.service.spec.ts src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts src/modules/plano-aula-periodo/plano-aula-periodo.controller.spec.ts src/modules/plano-aula/plano-aula.service.spec.ts src/modules/plano-aula/plano-aula.controller.spec.ts src/modules/plano-aula/plano-aula-historico.service.spec.ts --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: comandos passam. O teste da API pode emitir warnings antigos do `ts-jest`, sem falhas.

**Step 3: Commit**

Nao commitar nesta task.

## Task 1: Proteger Exclusao de Periodos com Planos Vinculados

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`
- Test: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`
- Optional migration/schema follow-up: `packages/db/src/schema/plano-aula.ts`

**Step 1: Escrever teste que falha para exclusao protegida**

Em `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`, adicione casos para `excluirPeriodo`:

```ts
describe("excluirPeriodo", () => {
  it("bloqueia exclusao quando ha planos vinculados ao periodo", async () => {
    jest.spyOn(service as any, "contarPlanosVinculados").mockResolvedValue(2);

    await expect(service.excluirPeriodo("periodo-id")).rejects.toThrow(
      "Nao e possivel excluir",
    );

    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("exclui periodo sem planos vinculados e renumera a etapa", async () => {
    jest.spyOn(service as any, "contarPlanosVinculados").mockResolvedValue(0);
    jest.spyOn(service, "buscarPorIdSemTenant" as any).mockResolvedValue({
      id: "periodo-id",
      unidadeId: "unit-1",
      etapa: "INFANTIL",
    });

    await service.excluirPeriodo("periodo-id");

    expect(mockDb.delete).toHaveBeenCalled();
  });
});
```

Se o mock atual nao suportar esse formato, ajuste apenas o mock, nao a regra.

**Step 2: Rodar teste para verificar falha**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts --runInBand
```

Expected: FAIL porque `excluirPeriodo` ainda nao consulta `plano_aula.plano_aula_periodo_id`.

**Step 3: Implementar contagem real**

Em `plano-aula-periodo.service.ts`, importar `sql` e `planoAula`:

```ts
import { eq, and, asc, getDb, sql } from "@essencia/db";
import { planoAulaPeriodo, planoAula, type PlanoAulaPeriodo, turmas, educationStages } from "@essencia/db/schema";
```

Adicionar metodo privado:

```ts
private async contarPlanosVinculados(periodoId: string): Promise<number> {
  const [resultado] = await this.db
    .select({ total: sql<number>`count(*)::int` })
    .from(planoAula)
    .where(eq(planoAula.planoAulaPeriodoId, periodoId));

  return Number(resultado?.total ?? 0);
}
```

Alterar `excluirPeriodo` antes do delete:

```ts
const planosVinculados = await this.contarPlanosVinculados(id);
if (planosVinculados > 0) {
  throw new BadRequestException(
    `Nao e possivel excluir. ${planosVinculados} professoras ja iniciaram este periodo.`,
  );
}
```

**Step 4: Retornar contador na listagem**

Ainda em `plano-aula-periodo.service.ts`, altere `listarPorUnidade` para anexar `planosVinculados`:

```ts
const periodos = await this.db
  .select()
  .from(planoAulaPeriodo)
  .where(eq(planoAulaPeriodo.unidadeId, unidadeId))
  .orderBy(asc(planoAulaPeriodo.etapa), asc(planoAulaPeriodo.numero));

return Promise.all(
  periodos.map(async (periodo) => ({
    ...periodo,
    planosVinculados: await this.contarPlanosVinculados(periodo.id),
  })),
);
```

Mantenha YAGNI: nao otimize para query agregada ate haver volume que justifique. Se preferir agregacao, escreva teste primeiro.

**Step 5: Rodar teste focado**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts --runInBand
```

Expected: PASS.

**Step 6: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts
git commit -m "fix: bloqueia exclusao de periodos com planos"
```

## Task 2: Proteger Exclusao de Ciclos com Provas Vinculadas

**Files:**
- Modify: `services/api/src/modules/prova-ciclo/prova-ciclo.service.ts`
- Test: create `services/api/src/modules/prova-ciclo/prova-ciclo.service.spec.ts`
- Optional migration/schema follow-up: `packages/db/src/schema/prova.ts`

**Step 1: Criar teste que falha**

Crie `services/api/src/modules/prova-ciclo/prova-ciclo.service.spec.ts` cobrindo:

```ts
describe("ProvaCicloService", () => {
  it("bloqueia exclusao quando ha provas vinculadas ao ciclo", async () => {
    jest.spyOn(service as any, "contarProvasVinculadas").mockResolvedValue(1);

    await expect(service.excluirCiclo("ciclo-id")).rejects.toThrow(
      "Nao e possivel excluir",
    );

    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
```

Use o padrao de mocks de `plano-aula-periodo.service.spec.ts`.

**Step 2: Rodar teste para verificar falha**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/prova-ciclo/prova-ciclo.service.spec.ts --runInBand
```

Expected: FAIL porque o service ainda exclui sem contar provas.

**Step 3: Implementar contagem e bloqueio**

Em `prova-ciclo.service.ts`, importar `sql` e `prova`:

```ts
import { eq, and, asc, getDb, sql } from "@essencia/db";
import { provaCiclo, prova, type ProvaCiclo, turmas, educationStages } from "@essencia/db/schema";
```

Adicionar metodo privado:

```ts
private async contarProvasVinculadas(cicloId: string): Promise<number> {
  const [resultado] = await this.db
    .select({ total: sql<number>`count(*)::int` })
    .from(prova)
    .where(eq(prova.provaCicloId, cicloId));

  return Number(resultado?.total ?? 0);
}
```

Antes do delete em `excluirCiclo`:

```ts
const provasVinculadas = await this.contarProvasVinculadas(id);
if (provasVinculadas > 0) {
  throw new BadRequestException(
    `Nao e possivel excluir. ${provasVinculadas} professoras ja iniciaram este ciclo.`,
  );
}
```

**Step 4: Retornar contador na listagem**

Em `listarPorUnidade`, retorne `provasVinculadas` para a UI:

```ts
const ciclos = await this.db
  .select()
  .from(provaCiclo)
  .where(eq(provaCiclo.unidadeId, unidadeId))
  .orderBy(asc(provaCiclo.etapa), asc(provaCiclo.numero));

return Promise.all(
  ciclos.map(async (ciclo) => ({
    ...ciclo,
    provasVinculadas: await this.contarProvasVinculadas(ciclo.id),
  })),
);
```

**Step 5: Rodar teste focado**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/prova-ciclo/prova-ciclo.service.spec.ts --runInBand
```

Expected: PASS.

**Step 6: Commit**

```bash
git add services/api/src/modules/prova-ciclo/prova-ciclo.service.ts services/api/src/modules/prova-ciclo/prova-ciclo.service.spec.ts
git commit -m "fix: bloqueia exclusao de ciclos com provas"
```

## Task 3: Reforcar Restricao no Banco contra Cascade Acidental

**Files:**
- Modify: `packages/db/src/schema/plano-aula.ts`
- Modify: `packages/db/src/schema/prova.ts`
- Create: migration generated under `packages/db/drizzle/` or configured migration folder

**Step 1: Escrever verificacao de schema que falha**

Run:

```bash
rg -n 'onDelete: "cascade"' packages/db/src/schema/plano-aula.ts packages/db/src/schema/prova.ts
```

Expected: encontra os FKs de `planoAulaPeriodoId` e `provaCicloId`.

**Step 2: Trocar cascade por restrict**

Em `packages/db/src/schema/plano-aula.ts`, altere:

```ts
{ onDelete: "cascade" },
```

para:

```ts
{ onDelete: "restrict" },
```

apenas no FK `planoAulaPeriodoId`.

Em `packages/db/src/schema/prova.ts`, faca o mesmo apenas no FK `provaCicloId`.

**Step 3: Gerar migration**

Run:

```bash
pnpm db:generate
```

Expected: migration nova altera os FKs de `plano_aula.plano_aula_periodo_id` e `prova.prova_ciclo_id` para `ON DELETE RESTRICT` ou equivalente.

**Step 4: Revisar migration**

Run:

```bash
git diff -- packages/db/src/schema/plano-aula.ts packages/db/src/schema/prova.ts packages/db
```

Expected: sem alteracoes fora dos dois FKs e da migration.

**Step 5: Validar comandos de schema**

Run:

```bash
pnpm --filter @essencia/db typecheck
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/db/src/schema/plano-aula.ts packages/db/src/schema/prova.ts packages/db
git commit -m "fix: impede cascade em periodos e ciclos"
```

## Task 4: Bloquear Consulta de Outra Unidade em Dashboards

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Modify: `services/api/src/modules/prova/prova.service.ts`
- Test: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`
- Test: create or modify `services/api/src/modules/prova/prova.service.spec.ts`

**Step 1: Escrever testes que falham**

Em `plano-aula.service.spec.ts`, adicione:

```ts
it("bloqueia gerente_unidade consultando dashboard de outra unidade", async () => {
  const user = {
    userId: "user-1",
    role: "gerente_unidade",
    schoolId: "school-1",
    unitId: "unit-1",
    stageId: null,
  };

  await expect(service.getDashboard(user, "unit-2")).rejects.toThrow(
    ForbiddenException,
  );
});
```

Repita o mesmo padrao para `ProvaService.getDashboard`.

**Step 2: Rodar testes para verificar falha**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts src/modules/prova/prova.service.spec.ts --runInBand
```

Expected: FAIL porque `isGestao(user.role)` libera `unitId` arbitrario.

**Step 3: Implementar resolucao segura de unidade**

Em ambos os services, substitua a logica `unitId || user.unitId` por helper privado:

```ts
private resolverUnitIdEscopo(user: UserContext, unitId?: string): string {
  if (!user.unitId && user.role !== "master") {
    throw new BadRequestException("Unidade nao especificada");
  }

  if (user.role === "master") {
    const targetUnitId = unitId ?? user.unitId;
    if (!targetUnitId) {
      throw new BadRequestException("Unidade nao especificada");
    }
    return targetUnitId;
  }

  if (unitId && unitId !== user.unitId) {
    throw new ForbiddenException(
      "Voce nao tem permissao para acessar dados desta unidade",
    );
  }

  return user.unitId as string;
}
```

Use o helper em `getDashboard`. Nao altere listagens que ja ignoram query `unitId`, exceto se o teste mostrar o mesmo problema.

**Step 4: Rodar testes focados**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts src/modules/prova/prova.service.spec.ts --runInBand
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.service.ts services/api/src/modules/prova/prova.service.ts services/api/src/modules/plano-aula/plano-aula.service.spec.ts services/api/src/modules/prova/prova.service.spec.ts
git commit -m "fix: restringe dashboards a unidade da sessao"
```

## Task 5: Validar Periodo ao Criar Plano de Aula

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Test: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`

**Step 1: Escrever testes que falham**

Adicione testes em `criarPlano`:

```ts
it("bloqueia periodo de outra unidade ao criar plano", async () => {
  mockDb.query.turmas.findFirst.mockResolvedValue({
    id: "turma-1",
    unitId: "unit-1",
    stage: { code: "INFANTIL" },
  });
  mockDb.query.planoAulaPeriodo.findFirst.mockResolvedValue(null);

  await expect(
    service.criarPlano(usuarioProfessoraUnit1, {
      turmaId: "turma-1",
      quinzenaId: "periodo-outra-unidade",
    }),
  ).rejects.toThrow("Periodo de plano de aula nao encontrado");
});

it("bloqueia periodo de etapa diferente da turma", async () => {
  mockDb.query.turmas.findFirst.mockResolvedValue({
    id: "turma-1",
    unitId: "unit-1",
    stage: { code: "INFANTIL" },
  });
  mockDb.query.planoAulaPeriodo.findFirst.mockResolvedValue({
    id: "periodo-1",
    unidadeId: "unit-1",
    etapa: "FUNDAMENTAL_I",
  });

  await expect(
    service.criarPlano(usuarioProfessoraUnit1, {
      turmaId: "turma-1",
      quinzenaId: "periodo-1",
    }),
  ).rejects.toThrow("Periodo nao pertence a etapa da turma");
});
```

**Step 2: Rodar teste para verificar falha**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts --runInBand
```

Expected: FAIL porque `criarPlano` nao busca `planoAulaPeriodo`.

**Step 3: Implementar validacao**

Em `criarPlano`, carregue a turma com `stage` e valide o periodo:

```ts
const periodo = await db.query.planoAulaPeriodo.findFirst({
  where: and(
    eq(planoAulaPeriodo.id, dto.quinzenaId),
    eq(planoAulaPeriodo.unidadeId, user.unitId),
  ),
});

if (!periodo) {
  throw new NotFoundException(
    "Periodo de plano de aula nao encontrado ou nao pertence a sua unidade",
  );
}

const turmaStageCode = turma.stage?.code;
if (turmaStageCode && periodo.etapa !== turmaStageCode) {
  throw new BadRequestException("Periodo nao pertence a etapa da turma");
}
```

Se `turma.stage` nao estiver disponivel no query atual, inclua `with: { stage: true }`.

**Step 4: Rodar teste focado**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts --runInBand
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.service.ts services/api/src/modules/plano-aula/plano-aula.service.spec.ts
git commit -m "fix: valida periodo ao criar plano de aula"
```

## Task 6: Alinhar Matriz de Roles no Backend

**Files:**
- Modify: `services/api/src/modules/plano-aula/dto/plano-aula.dto.ts`
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.ts`
- Modify: `services/api/src/modules/prova-ciclo/prova-ciclo.controller.ts`
- Test: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.spec.ts`
- Test: create `services/api/src/modules/prova-ciclo/prova-ciclo.controller.spec.ts`

**Step 1: Escrever testes de politica**

Cubra estes cenarios:

- `gerente_financeiro` acessa dashboard/listagem de gestao, mas nao cria periodo/ciclo.
- `master` pode criar periodo/ciclo de qualquer etapa.
- `coordenadora_fundamental_i` consegue buscar periodo por turma de `FUNDAMENTAL_I`.
- `analista_pedagogico` consegue visualizar periodo/ciclo, mas nao editar.

Exemplo para controller de periodo:

```ts
it("permite master criar periodo de qualquer etapa", async () => {
  const session = {
    role: "master",
    unitId: "unit-1",
    userId: "user-1",
    schoolId: "school-1",
    stageId: null,
  };

  await expect(controller.criarPeriodo(session, dtoMedio)).resolves.toBeDefined();
});
```

**Step 2: Rodar testes para verificar falha**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula-periodo/plano-aula-periodo.controller.spec.ts src/modules/prova-ciclo/prova-ciclo.controller.spec.ts --runInBand
```

Expected: FAIL em cenarios hoje divergentes.

**Step 3: Atualizar constantes de roles**

Em `plano-aula.dto.ts`, inclua `gerente_financeiro` em `GESTAO_ROLES` se a politica de produto confirmar visualizacao gerencial:

```ts
export const GESTAO_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
] as const;
```

**Step 4: Atualizar controllers de periodos/ciclos**

Crie arrays locais para evitar repeticao:

```ts
const VISUALIZAR_PERIODOS_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_bercario",
  "coordenadora_medio",
  "analista_pedagogico",
  "professora",
] as const;

const GERENCIAR_PERIODOS_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_bercario",
  "coordenadora_medio",
] as const;
```

Use os arrays em `@Roles(...VISUALIZAR_PERIODOS_ROLES)` e `@Roles(...GERENCIAR_PERIODOS_ROLES)`.

Atualize `podeEditarEtapa`:

```ts
if (["master", "diretora_geral", "gerente_unidade", "coordenadora_geral"].includes(role)) {
  return true;
}
```

Repita a mesma estrutura em `prova-ciclo.controller.ts`.

**Step 5: Rodar testes focados**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula-periodo/plano-aula-periodo.controller.spec.ts src/modules/prova-ciclo/prova-ciclo.controller.spec.ts --runInBand
```

Expected: PASS.

**Step 6: Commit**

```bash
git add services/api/src/modules/plano-aula/dto/plano-aula.dto.ts services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.ts services/api/src/modules/prova-ciclo/prova-ciclo.controller.ts services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.spec.ts services/api/src/modules/prova-ciclo/prova-ciclo.controller.spec.ts
git commit -m "fix: alinha permissoes do planejamento"
```

## Task 7: Aplicar Tenant no Proprio Service para Editar e Excluir

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.ts`
- Modify: `services/api/src/modules/prova-ciclo/prova-ciclo.service.ts`
- Modify: `services/api/src/modules/prova-ciclo/prova-ciclo.controller.ts`
- Test: service specs correspondentes

**Step 1: Escrever testes que falham**

Adicione teste para garantir que update/delete usa `unitId`:

```ts
await expect(
  service.editarPeriodo("periodo-id", "unit-2", { descricao: "Nova" }),
).rejects.toThrow("Periodo nao encontrado");
```

Repita para `excluirPeriodo`, `editarCiclo` e `excluirCiclo`.

**Step 2: Rodar testes para verificar falha**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts src/modules/prova-ciclo/prova-ciclo.service.spec.ts --runInBand
```

Expected: FAIL porque as assinaturas ainda nao recebem `unitId`.

**Step 3: Alterar assinaturas**

Troque:

```ts
async editarPeriodo(id: string, dto: EditarPeriodoDto)
async excluirPeriodo(id: string)
```

por:

```ts
async editarPeriodo(id: string, unitId: string, dto: EditarPeriodoDto)
async excluirPeriodo(id: string, unitId: string)
```

Use `buscarPorId(id, unitId)` dentro do service e aplique `where(and(eq(id), eq(unidadeId, unitId)))` no `update` e `delete`.

Repita para ciclo:

```ts
async editarCiclo(id: string, unitId: string, dto: EditarCicloDto)
async excluirCiclo(id: string, unitId: string)
```

**Step 4: Atualizar controllers**

Passe `session.unitId`:

```ts
const data = await this.service.editarPeriodo(id, session.unitId, dto);
const result = await this.service.excluirPeriodo(id, session.unitId);
```

Repita para ciclos.

**Step 5: Rodar testes focados**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts src/modules/plano-aula-periodo/plano-aula-periodo.controller.spec.ts src/modules/prova-ciclo/prova-ciclo.service.spec.ts src/modules/prova-ciclo/prova-ciclo.controller.spec.ts --runInBand
```

Expected: PASS.

**Step 6: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo services/api/src/modules/prova-ciclo
git commit -m "fix: aplica tenant em alteracoes de periodos e ciclos"
```

## Task 8: Usar Role Real nas Telas de Gestao

**Files:**
- Modify: `apps/planejamento/app/gestao/periodos/periodos-content.tsx`
- Modify: `apps/planejamento/app/provas/gestao/ciclos/ciclos-content.tsx`
- Test: `apps/planejamento/app/gestao/periodos/periodos-content.test.tsx`
- Test: `apps/planejamento/app/provas/gestao/ciclos/ciclos-content.test.tsx`

**Step 1: Escrever testes que falham**

Mocke `useTenant` em ambos os testes:

```ts
vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => ({
    role: "coordenadora_infantil",
    isLoaded: true,
  }),
}));
```

Teste que `FUNDAMENTAL_I` fica desabilitado e que o modal recebe apenas `INFANTIL`.

Adicione outro teste com `role: "analista_pedagogico"` esperando mensagem de sem permissao e ausencia do botao "Adicionar".

**Step 2: Rodar testes para verificar falha**

Run:

```bash
pnpm --filter planejamento test -- app/gestao/periodos/periodos-content.test.tsx app/provas/gestao/ciclos/ciclos-content.test.tsx
```

Expected: FAIL porque as telas usam `const userRole = "coordenadora_geral"`.

**Step 3: Implementar uso de `useTenant`**

Em cada content:

```ts
import { useTenant } from "@essencia/shared/providers/tenant";
```

No componente:

```ts
const { role, isLoaded } = useTenant();

if (!isLoaded) {
  return <div className="container mx-auto py-6">...</div>;
}

const etapasPermitidas = getEtapasPermitidas(role);
```

Remova o TODO e a role fixa.

Atualize `getEtapasPermitidas` para seguir a politica alvo, sem liberar `gerente_financeiro` para CRUD.

**Step 4: Rodar testes focados**

Run:

```bash
pnpm --filter planejamento test -- app/gestao/periodos/periodos-content.test.tsx app/provas/gestao/ciclos/ciclos-content.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/planejamento/app/gestao/periodos/periodos-content.tsx apps/planejamento/app/gestao/periodos/periodos-content.test.tsx apps/planejamento/app/provas/gestao/ciclos/ciclos-content.tsx apps/planejamento/app/provas/gestao/ciclos/ciclos-content.test.tsx
git commit -m "fix: usa role real na gestao de periodos e ciclos"
```

## Task 9: Corrigir Datas Civis em Cards e Grid

**Files:**
- Modify: `packages/shared/src/formatar-data.ts`
- Test: create or modify `packages/shared/src/formatar-data.test.ts`
- Modify: `apps/planejamento/features/periodos/components/plano-aula-card.tsx`
- Modify: `apps/planejamento/features/periodos/components/periodo-card-professora.tsx`
- Modify: `apps/planejamento/features/periodos/components/plano-aula-grid.tsx`
- Test: create `apps/planejamento/features/periodos/components/plano-aula-grid.test.tsx`
- Test: create `apps/planejamento/features/periodos/components/plano-aula-card.test.tsx`

**Step 1: Escrever testes que falham**

Adicione teste para helper compartilhado:

```ts
expect(criarDataCivil("2026-03-01").getFullYear()).toBe(2026);
expect(criarDataCivil("2026-03-01").getMonth()).toBe(2);
expect(criarDataCivil("2026-03-01").getDate()).toBe(1);
```

Adicione teste para `PlanoAulaGrid`:

```tsx
render(
  <PlanoAulaGrid
    dataInicioFeriasJulho="2026-07-13"
    periodos={[
      periodo("p1", "2026-07-12"),
      periodo("p2", "2026-07-13"),
    ]}
  />,
);

expect(screen.getByText("1º Semestre").parentElement).toHaveTextContent("p1");
expect(screen.getByText("2º Semestre").parentElement).toHaveTextContent("p2");
```

Use texto/descricao estavel para localizar os cards.

**Step 2: Rodar testes para verificar falha**

Run:

```bash
pnpm --filter @essencia/shared test -- formatar-data
pnpm --filter planejamento test -- features/periodos/components/plano-aula-grid.test.tsx features/periodos/components/plano-aula-card.test.tsx
```

Expected: FAIL porque `criarDataCivil` ainda nao existe e os componentes usam `new Date("YYYY-MM-DD")`.

**Step 3: Exportar helper de data civil**

Em `packages/shared/src/formatar-data.ts`, adicione:

```ts
export function criarDataCivil(data: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return new Date(data);
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}
```

Altere o `toDate` interno para chamar `criarDataCivil(data)`.

**Step 4: Usar helper nos componentes**

Substitua `new Date(periodo.dataMaximaEntrega)` por `criarDataCivil(periodo.dataMaximaEntrega)` em:

- `plano-aula-card.tsx`
- `periodo-card-professora.tsx`

Substitua `new Date(dataInicio)` e `new Date(dataInicioFeriasJulho)` por `criarDataCivil(...)` em `plano-aula-grid.tsx`.

**Step 5: Rodar testes focados**

Run:

```bash
pnpm --filter @essencia/shared test -- formatar-data
pnpm --filter planejamento test -- features/periodos/components/plano-aula-grid.test.tsx features/periodos/components/plano-aula-card.test.tsx
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/shared/src/formatar-data.ts packages/shared/src/formatar-data.test.ts apps/planejamento/features/periodos/components/plano-aula-card.tsx apps/planejamento/features/periodos/components/periodo-card-professora.tsx apps/planejamento/features/periodos/components/plano-aula-grid.tsx apps/planejamento/features/periodos/components/plano-aula-grid.test.tsx apps/planejamento/features/periodos/components/plano-aula-card.test.tsx
git commit -m "fix: trata datas civis no planejamento"
```

## Task 10: Corrigir Filtro de Ciclo na Listagem de Provas

**Files:**
- Modify: `apps/planejamento/features/prova/hooks/use-prova.ts`
- Test: create `apps/planejamento/features/prova/hooks/use-prova.test.ts`

**Step 1: Escrever teste que falha**

Teste `useGestaoProvas.fetchProvas` garantindo que o endpoint contenha `cicloId`:

```ts
await result.current.fetchProvas({
  status: "todos",
  provaCicloId: "ciclo-1",
  page: 1,
  limit: 20,
});

expect(api.get).toHaveBeenCalledWith(
  expect.stringContaining("cicloId=ciclo-1"),
);
expect(api.get).not.toHaveBeenCalledWith(
  expect.stringContaining("provaCicloId=ciclo-1"),
);
```

**Step 2: Rodar teste para verificar falha**

Run:

```bash
pnpm --filter planejamento test -- features/prova/hooks/use-prova.test.ts
```

Expected: FAIL porque o hook envia `provaCicloId`.

**Step 3: Corrigir parametro**

Em `use-prova.ts`, dentro de `useGestaoProvas.fetchProvas`, troque:

```ts
params.append("provaCicloId", filtros.provaCicloId);
```

por:

```ts
params.append("cicloId", filtros.provaCicloId);
```

**Step 4: Rodar teste focado**

Run:

```bash
pnpm --filter planejamento test -- features/prova/hooks/use-prova.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/planejamento/features/prova/hooks/use-prova.ts apps/planejamento/features/prova/hooks/use-prova.test.ts
git commit -m "fix: envia filtro correto de ciclo de prova"
```

## Task 11: Ajustes de UX e Acessibilidade nas Listas

**Files:**
- Modify: `apps/planejamento/features/periodos/components/periodos-list.tsx`
- Modify: `apps/planejamento/features/prova/components/ciclos-list.tsx`
- Test: `apps/planejamento/features/periodos/components/periodos-list.test.tsx`
- Test: create `apps/planejamento/features/prova/components/ciclos-list.test.tsx`

**Step 1: Escrever testes que falham**

Adicione testes para:

- `planosVinculados: 0` nao renderiza texto `0` no titulo.
- `provasVinculadas: 0` nao renderiza texto `0` no titulo.
- Botoes de `CiclosList` tem nomes acessiveis `Editar 1a Prova` e `Excluir 1a Prova`.

**Step 2: Rodar testes para verificar falha**

Run:

```bash
pnpm --filter planejamento test -- features/periodos/components/periodos-list.test.tsx features/prova/components/ciclos-list.test.tsx
```

Expected: FAIL nos novos casos.

**Step 3: Corrigir render condicional e aria-label**

Troque:

```tsx
{periodo.planosVinculados && periodo.planosVinculados > 0 && (...)}
```

por:

```tsx
{(periodo.planosVinculados ?? 0) > 0 && (...)}
```

Repita para `ciclo.provasVinculadas`.

Adicione em `CiclosList`:

```tsx
aria-label={`Editar ${ciclo.numero}a Prova`}
aria-label={`Excluir ${ciclo.numero}a Prova`}
```

**Step 4: Rodar testes focados**

Run:

```bash
pnpm --filter planejamento test -- features/periodos/components/periodos-list.test.tsx features/prova/components/ciclos-list.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/planejamento/features/periodos/components/periodos-list.tsx apps/planejamento/features/periodos/components/periodos-list.test.tsx apps/planejamento/features/prova/components/ciclos-list.tsx apps/planejamento/features/prova/components/ciclos-list.test.tsx
git commit -m "fix: melhora listas de periodos e ciclos"
```

## Task 12: Remover Logs de Debug e Codigo Legado de Prazos

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`
- Modify: `apps/planejamento/features/plano-aula/hooks/use-plano-aula.ts`
- Modify: `apps/planejamento/features/plano-aula/hooks/index.ts`
- Modify: `apps/planejamento/features/plano-aula/index.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`

**Step 1: Confirmar usos reais antes de remover**

Run:

```bash
rg -n "useDeadlines|config/deadline|config/deadlines" apps/planejamento services/api/src/modules
```

Expected: apenas exports e endpoints legados. Se aparecer uso em tela real, pare e ajuste o plano.

**Step 2: Escrever verificacao que falha para logs**

Run:

```bash
rg -n "buscarPorTurma failed|Turma exists but mismatch|Turma ID does not exist|buscarPorTurma: Found turma" services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts
```

Expected: encontra logs de debug.

**Step 3: Remover logs de debug**

Remova `console.error` e `console.log` de debug em `buscarPorTurma`. Mantenha apenas:

```ts
if (!turma) {
  throw new BadRequestException("Turma não encontrada");
}
```

**Step 4: Remover legado de deadlines se sem uso**

Remova:

- `useDeadlines` de `use-plano-aula.ts`
- exports de `hooks/index.ts` e `features/plano-aula/index.ts`
- endpoints `POST /plano-aula/config/deadline` e `GET /plano-aula/config/deadlines`
- metodos `setDeadline` e `getDeadlines` se nao houver uso externo confirmado

Nao remova tabelas ou migrations de `quinzenaConfig` nesta tarefa.

**Step 5: Rodar buscas e testes**

Run:

```bash
rg -n "useDeadlines|config/deadline|config/deadlines" apps/planejamento services/api/src/modules
rg -n "console\\.log\\(|Debug logging|buscarPorTurma failed" services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts
pnpm --filter planejamento test
pnpm --filter @essencia/api test -- src/modules/plano-aula src/modules/plano-aula-periodo --runInBand
```

Expected: buscas nao retornam uso legado/logs; testes passam.

**Step 6: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts apps/planejamento/features/plano-aula services/api/src/modules/plano-aula
git commit -m "chore: remove legado e logs do planejamento"
```

## Task 13: Verificacao Final

**Files:**
- Read: all modified files

**Step 1: Rodar pipeline focado completo**

Run:

```bash
pnpm --filter planejamento test
pnpm --filter planejamento lint
pnpm --filter planejamento typecheck
pnpm --filter planejamento build
pnpm --filter @essencia/api test -- src/modules/plannings src/modules/plano-aula src/modules/plano-aula-periodo src/modules/prova src/modules/prova-ciclo --runInBand
pnpm --filter @essencia/api lint
pnpm --filter @essencia/api typecheck
pnpm --filter @essencia/api build
```

Expected: todos os comandos passam. O lint da API pode manter warnings antigos, mas nao pode introduzir erro novo.

**Step 2: Rodar pipeline obrigatorio do repositorio**

Run:

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected: exit code 0.

**Step 3: Conferir diff**

Run:

```bash
git diff --stat origin/main...HEAD
git status --short
```

Expected: apenas arquivos das tasks e alteracoes locais preexistentes fora do escopo. Nao incluir loja/nginx/backup SQL nos commits deste plano.

**Step 4: Revisao final**

Use @superpowers:requesting-code-review antes de push/PR.

**Step 5: Commit**

Nao commitar nesta task se nao houver mudancas adicionais. Se houver ajustes de verificacao, commit separado:

```bash
git add <arquivos-ajustados>
git commit -m "test: cobre invariantes finais do planejamento"
```

## Ordem Recomendada de Execucao

1. Tasks 1 a 3: perda de dados por exclusao e cascade.
2. Tasks 4 e 5: tenant e integridade de vinculo.
3. Tasks 6 a 8: matriz de roles e UI com role real.
4. Tasks 9 a 11: datas, filtros e UX.
5. Task 12: limpeza de legado/logs.
6. Task 13: verificacao final e revisao.

Nao avance para roles/frontend enquanto as protecoes de exclusao e tenant nao estiverem verdes.
