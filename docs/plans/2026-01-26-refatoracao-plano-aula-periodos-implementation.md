# Refatoração: Sistema de Planos de Aula com Períodos Configuráveis - Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir sistema hardcoded de quinzenas por períodos configuráveis criados pela gestão, com nomenclatura "Plano de Aula" e flexibilidade total de datas por etapa.

**Architecture:** Backend NestJS com Drizzle ORM + PostgreSQL para persistência e lógica de negócio; Frontend Next.js 15 com Server Components para interface de gestão e professoras; Guards em camadas (Auth → Roles → Tenant) para controle de acesso por etapa.

**Tech Stack:** NestJS 10.4, Drizzle ORM 0.38, PostgreSQL 16, Next.js 15, shadcn/ui, Tailwind CSS, Vitest para testes.

---

## Fase 1: Database Schema e Migration

### Task 1: Criar Schema da Tabela `plano_aula_periodo`

**Files:**
- Create: `packages/db/src/schema/plano-aula-periodo.ts`
- Modify: `packages/db/src/schema/index.ts`

**Step 1: Criar schema Drizzle**

```typescript
// packages/db/src/schema/plano-aula-periodo.ts
import { pgTable, uuid, text, integer, date, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { unidades } from "./unidades";
import { usuarios } from "./usuarios";
import { relations } from "drizzle-orm";

export const planoAulaPeriodo = pgTable(
  "plano_aula_periodo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unidadeId: uuid("unidade_id")
      .notNull()
      .references(() => unidades.id, { onDelete: "cascade" }),
    etapa: text("etapa").notNull(),
    numero: integer("numero").notNull(),
    descricao: text("descricao"),
    dataInicio: date("data_inicio").notNull(),
    dataFim: date("data_fim").notNull(),
    dataMaximaEntrega: date("data_maxima_entrega").notNull(),
    criadoPor: uuid("criado_por").references(() => usuarios.id),
    criadoEm: timestamp("criado_em").defaultNow().notNull(),
    atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  },
  (table) => ({
    periodoNumeroEtapaUnidadeIdx: uniqueIndex("idx_periodo_numero_etapa_unidade").on(
      table.unidadeId,
      table.etapa,
      table.numero
    ),
    unidadeIdx: index("idx_plano_aula_periodo_unidade").on(table.unidadeId),
    etapaIdx: index("idx_plano_aula_periodo_etapa").on(table.etapa),
    datasIdx: index("idx_plano_aula_periodo_datas").on(table.dataInicio, table.dataFim),
  })
);

export const planoAulaPeriodoRelations = relations(planoAulaPeriodo, ({ one, many }) => ({
  unidade: one(unidades, {
    fields: [planoAulaPeriodo.unidadeId],
    references: [unidades.id],
  }),
  criador: one(usuarios, {
    fields: [planoAulaPeriodo.criadoPor],
    references: [usuarios.id],
  }),
}));

export type PlanoAulaPeriodo = typeof planoAulaPeriodo.$inferSelect;
export type NovoPlanoAulaPeriodo = typeof planoAulaPeriodo.$inferInsert;
```

**Step 2: Exportar schema no index**

```typescript
// packages/db/src/schema/index.ts
// Adicionar ao final do arquivo
export * from "./plano-aula-periodo";
```

**Step 3: Commit**

```bash
git add packages/db/src/schema/plano-aula-periodo.ts packages/db/src/schema/index.ts
git commit -m "feat(db): adicionar schema plano_aula_periodo

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Atualizar Schema `plano_aula` (Remover quinzenaNumero, Adicionar periodoId)

**Files:**
- Modify: `packages/db/src/schema/plano-aula.ts`

**Step 1: Atualizar schema plano_aula**

Localizar a definição da tabela `planoAula` e fazer as alterações:

```typescript
// packages/db/src/schema/plano-aula.ts
// REMOVER esta linha:
// quinzenaNumero: integer("quinzena_numero").notNull(),

// ADICIONAR esta linha (após o campo turmaId):
planoAulaPeriodoId: uuid("plano_aula_periodo_id")
  .references(() => planoAulaPeriodo.id, { onDelete: "cascade" }),
```

**Step 2: Adicionar import necessário**

No início do arquivo, adicionar:

```typescript
import { planoAulaPeriodo } from "./plano-aula-periodo";
```

**Step 3: Adicionar índice**

Dentro da seção de índices do `planoAula` (segundo parâmetro da função `pgTable`), adicionar:

```typescript
periodoIdx: index("idx_plano_aula_periodo_id").on(table.planoAulaPeriodoId),
```

**Step 4: Atualizar relations**

Dentro de `planoAulaRelations`, adicionar:

```typescript
periodo: one(planoAulaPeriodo, {
  fields: [planoAula.planoAulaPeriodoId],
  references: [planoAulaPeriodo.id],
}),
```

**Step 5: Commit**

```bash
git add packages/db/src/schema/plano-aula.ts
git commit -m "feat(db): alterar plano_aula para usar plano_aula_periodo_id

Remove campo quinzena_numero hardcoded
Adiciona referência configurável a plano_aula_periodo

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Gerar Migration SQL

**Files:**
- Create: `packages/db/drizzle/0013_*.sql` (gerado automaticamente)
- Create: `packages/db/drizzle/meta/0013_snapshot.json` (gerado)

**Step 1: Gerar migration**

```bash
cd /var/www/essencia
pnpm db:generate
```

Expected output:
```
✓ Generated migration 0013_typical_plano_aula_periodo.sql
```

**Step 2: Revisar migration gerada**

Abrir o arquivo gerado em `packages/db/drizzle/0013_*.sql` e verificar:
- CREATE TABLE plano_aula_periodo
- ALTER TABLE plano_aula DROP COLUMN quinzena_numero
- ALTER TABLE plano_aula ADD COLUMN plano_aula_periodo_id
- Índices criados corretamente

**Step 3: Adicionar statements de limpeza manual**

IMPORTANTE: O Drizzle gera apenas DDL. Precisamos adicionar DML manualmente.

Editar o arquivo gerado `packages/db/drizzle/0013_*.sql` e ADICIONAR NO INÍCIO (antes do CREATE TABLE):

```sql
-- Limpeza de dados antigos (hard reset)
DELETE FROM plano_aula_historico WHERE plano_aula_id IN (SELECT id FROM plano_aula);
DELETE FROM plano_aula_comentarios WHERE plano_aula_id IN (SELECT id FROM plano_aula);
DELETE FROM quinzena_documents;
DELETE FROM plano_aula;

-- Remover tabelas obsoletas
DROP TABLE IF EXISTS quinzena_config CASCADE;
```

**Step 4: Commit**

```bash
git add packages/db/drizzle/
git commit -m "feat(db): migration para sistema de períodos configuráveis

- Hard delete de dados antigos (quinzenas hardcoded)
- Criação de plano_aula_periodo
- Alteração de plano_aula (remove quinzena_numero, adiciona periodo_id)
- Índices para performance

BREAKING CHANGE: Todos os planos de aula existentes serão deletados

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Fase 2: Backend - Service Layer (TDD)

### Task 4: DTOs para PlanoAulaPeriodo

**Files:**
- Create: `services/api/src/modules/plano-aula-periodo/dto/plano-aula-periodo.dto.ts`

**Step 1: Criar DTOs**

```typescript
// services/api/src/modules/plano-aula-periodo/dto/plano-aula-periodo.dto.ts
import { IsString, IsDateString, IsOptional, IsUUID, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarPeriodoDto {
  @ApiProperty({ example: 'INFANTIL' })
  @IsString()
  etapa: string;

  @ApiPropertyOptional({ example: 'Tema: Meio Ambiente' })
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  dataInicio: string;

  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  dataFim: string;

  @ApiProperty({ example: '2026-03-13' })
  @IsDateString()
  dataMaximaEntrega: string;
}

export class EditarPeriodoDto {
  @ApiPropertyOptional({ example: 'Tema: Sustentabilidade' })
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ example: '2026-03-13' })
  @IsOptional()
  @IsDateString()
  dataMaximaEntrega?: string;
}

export class PeriodoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  unidadeId: string;

  @ApiProperty()
  etapa: string;

  @ApiProperty()
  numero: number;

  @ApiProperty({ required: false })
  descricao?: string;

  @ApiProperty()
  dataInicio: string;

  @ApiProperty()
  dataFim: string;

  @ApiProperty()
  dataMaximaEntrega: string;

  @ApiProperty()
  criadoPor?: string;

  @ApiProperty()
  criadoEm: Date;

  @ApiProperty()
  atualizadoEm: Date;

  @ApiProperty({ required: false })
  planosVinculados?: number;
}
```

**Step 2: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/dto/
git commit -m "feat(api): adicionar DTOs para plano-aula-periodo

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Service - Criar Período (TDD)

**Files:**
- Create: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`
- Create: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`

**Step 1: Escrever teste que falha**

```typescript
// services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PlanoAulaPeriodoService } from './plano-aula-periodo.service';
import { BadRequestException } from '@nestjs/common';

describe('PlanoAulaPeriodoService', () => {
  let service: PlanoAulaPeriodoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlanoAulaPeriodoService],
    }).compile();

    service = module.get<PlanoAulaPeriodoService>(PlanoAulaPeriodoService);
  });

  describe('criarPeriodo', () => {
    it('deve lançar erro se dataInicio >= dataFim', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-03-15',
        dataFim: '2026-03-10',
        dataMaximaEntrega: '2026-03-12',
      };

      await expect(
        service.criarPeriodo('unidade-id', 'user-id', dto)
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro se dataMaximaEntrega < dataInicio', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-03-10',
        dataFim: '2026-03-15',
        dataMaximaEntrega: '2026-03-05',
      };

      await expect(
        service.criarPeriodo('unidade-id', 'user-id', dto)
      ).rejects.toThrow(BadRequestException);
    });
  });
});
```

**Step 2: Rodar teste para verificar falha**

```bash
cd services/api
pnpm test plano-aula-periodo.service.spec.ts
```

Expected: FAIL - "PlanoAulaPeriodoService is not defined" ou "criarPeriodo is not a function"

**Step 3: Implementação mínima para passar**

```typescript
// services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { CriarPeriodoDto } from './dto/plano-aula-periodo.dto';

@Injectable()
export class PlanoAulaPeriodoService {
  async criarPeriodo(
    unidadeId: string,
    userId: string,
    dto: CriarPeriodoDto
  ) {
    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dto.dataFim);
    const dataMaximaEntrega = new Date(dto.dataMaximaEntrega);

    if (dataInicio >= dataFim) {
      throw new BadRequestException(
        'Data de início deve ser anterior à data de fim'
      );
    }

    if (dataMaximaEntrega < dataInicio) {
      throw new BadRequestException(
        'Data máxima de entrega deve ser posterior à data de início'
      );
    }

    // TODO: Implementar lógica de criação no banco
    return null;
  }
}
```

**Step 4: Rodar teste para verificar passou**

```bash
pnpm test plano-aula-periodo.service.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/
git commit -m "test(api): validação de datas ao criar período

TDD - Red-Green cycle para validações básicas

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Service - Verificar Sobreposição de Datas (TDD)

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`

**Step 1: Adicionar teste de sobreposição**

Adicionar ao final de `plano-aula-periodo.service.spec.ts`:

```typescript
describe('verificarSobreposicao', () => {
  it('deve retornar períodos sobrepostos quando houver conflito', async () => {
    // Mock: assumir que já existe período de 01/03 a 15/03
    jest.spyOn(service as any, 'buscarPeriodosPorEtapa').mockResolvedValue([
      {
        id: 'periodo-1',
        dataInicio: new Date('2026-03-01'),
        dataFim: new Date('2026-03-15'),
      },
    ]);

    const resultado = await service['verificarSobreposicao'](
      'unidade-id',
      'INFANTIL',
      new Date('2026-03-10'),
      new Date('2026-03-20')
    );

    expect(resultado).toHaveLength(1);
  });

  it('deve retornar vazio quando não houver sobreposição', async () => {
    jest.spyOn(service as any, 'buscarPeriodosPorEtapa').mockResolvedValue([
      {
        id: 'periodo-1',
        dataInicio: new Date('2026-03-01'),
        dataFim: new Date('2026-03-15'),
      },
    ]);

    const resultado = await service['verificarSobreposicao'](
      'unidade-id',
      'INFANTIL',
      new Date('2026-03-16'),
      new Date('2026-03-30')
    );

    expect(resultado).toHaveLength(0);
  });
});
```

**Step 2: Rodar teste para verificar falha**

```bash
pnpm test plano-aula-periodo.service.spec.ts
```

Expected: FAIL - "verificarSobreposicao is not a function"

**Step 3: Implementar lógica de sobreposição**

Adicionar em `plano-aula-periodo.service.ts`:

```typescript
private async verificarSobreposicao(
  unidadeId: string,
  etapa: string,
  dataInicio: Date,
  dataFim: Date
) {
  const periodos = await this.buscarPeriodosPorEtapa(unidadeId, etapa);

  return periodos.filter((periodo) => {
    const inicio = new Date(periodo.dataInicio);
    const fim = new Date(periodo.dataFim);

    // Verifica se há sobreposição
    return dataInicio <= fim && dataFim >= inicio;
  });
}

private async buscarPeriodosPorEtapa(unidadeId: string, etapa: string) {
  // TODO: Implementar busca real no banco
  return [];
}
```

**Step 4: Rodar teste**

```bash
pnpm test plano-aula-periodo.service.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/
git commit -m "test(api): validação de sobreposição de períodos

TDD - Previne criação de períodos com datas conflitantes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Service - Cálculo de Número Automático (TDD)

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`

**Step 1: Adicionar teste**

```typescript
describe('calcularProximoNumero', () => {
  it('deve retornar 1 quando não há períodos', async () => {
    jest.spyOn(service as any, 'buscarPeriodosPorEtapa').mockResolvedValue([]);

    const numero = await service['calcularProximoNumero'](
      'unidade-id',
      'INFANTIL',
      new Date('2026-03-01')
    );

    expect(numero).toBe(1);
  });

  it('deve retornar próximo número em ordem cronológica', async () => {
    jest.spyOn(service as any, 'buscarPeriodosPorEtapa').mockResolvedValue([
      { numero: 1, dataInicio: new Date('2026-03-01') },
      { numero: 2, dataInicio: new Date('2026-03-15') },
    ]);

    const numero = await service['calcularProximoNumero'](
      'unidade-id',
      'INFANTIL',
      new Date('2026-03-30')
    );

    expect(numero).toBe(3);
  });

  it('deve inserir no meio quando data está entre períodos existentes', async () => {
    jest.spyOn(service as any, 'buscarPeriodosPorEtapa').mockResolvedValue([
      { numero: 1, dataInicio: new Date('2026-03-01') },
      { numero: 2, dataInicio: new Date('2026-03-20') },
    ]);

    const numero = await service['calcularProximoNumero'](
      'unidade-id',
      'INFANTIL',
      new Date('2026-03-10')
    );

    expect(numero).toBe(2);
  });
});
```

**Step 2: Rodar teste para verificar falha**

```bash
pnpm test plano-aula-periodo.service.spec.ts
```

Expected: FAIL

**Step 3: Implementar cálculo**

```typescript
private async calcularProximoNumero(
  unidadeId: string,
  etapa: string,
  dataInicio: Date
): Promise<number> {
  const periodos = await this.buscarPeriodosPorEtapa(unidadeId, etapa);

  if (periodos.length === 0) {
    return 1;
  }

  // Ordenar por data de início
  const periodosOrdenados = periodos.sort(
    (a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime()
  );

  let posicao = 1;
  for (const periodo of periodosOrdenados) {
    if (dataInicio < new Date(periodo.dataInicio)) {
      break;
    }
    posicao++;
  }

  return posicao;
}
```

**Step 4: Rodar teste**

```bash
pnpm test plano-aula-periodo.service.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/
git commit -m "test(api): cálculo automático de numeração de períodos

TDD - Numeração baseada em ordem cronológica

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 8: Service - Integração com Database (Drizzle)

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`
- Create: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.module.ts`

**Step 1: Implementar métodos de database**

Substituir os métodos mock em `plano-aula-periodo.service.ts`:

```typescript
import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { CriarPeriodoDto, EditarPeriodoDto } from './dto/plano-aula-periodo.dto';
import * as schema from '@essencia/db/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, count, asc } from 'drizzle-orm';

@Injectable()
export class PlanoAulaPeriodoService {
  constructor(
    @Inject('DRIZZLE') private db: NodePgDatabase<typeof schema>
  ) {}

  async criarPeriodo(unidadeId: string, userId: string, dto: CriarPeriodoDto) {
    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dto.dataFim);
    const dataMaximaEntrega = new Date(dto.dataMaximaEntrega);

    // Validações
    if (dataInicio >= dataFim) {
      throw new BadRequestException(
        'Data de início deve ser anterior à data de fim'
      );
    }

    if (dataMaximaEntrega < dataInicio) {
      throw new BadRequestException(
        'Data máxima de entrega deve ser posterior à data de início'
      );
    }

    // Verificar sobreposição
    const sobrepostos = await this.verificarSobreposicao(
      unidadeId,
      dto.etapa,
      dataInicio,
      dataFim
    );

    if (sobrepostos.length > 0) {
      throw new BadRequestException('As datas se sobrepõem a um período existente');
    }

    // Calcular número
    const numero = await this.calcularProximoNumero(unidadeId, dto.etapa, dataInicio);

    // Criar período
    const [periodo] = await this.db
      .insert(schema.planoAulaPeriodo)
      .values({
        unidadeId,
        etapa: dto.etapa,
        numero,
        descricao: dto.descricao,
        dataInicio: dto.dataInicio,
        dataFim: dto.dataFim,
        dataMaximaEntrega: dto.dataMaximaEntrega,
        criadoPor: userId,
      })
      .returning();

    // Renumerar se necessário
    await this.renumerarPeriodosSeNecessario(unidadeId, dto.etapa);

    return periodo;
  }

  private async buscarPeriodosPorEtapa(unidadeId: string, etapa: string) {
    return this.db
      .select()
      .from(schema.planoAulaPeriodo)
      .where(
        and(
          eq(schema.planoAulaPeriodo.unidadeId, unidadeId),
          eq(schema.planoAulaPeriodo.etapa, etapa)
        )
      );
  }

  private async renumerarPeriodosSeNecessario(unidadeId: string, etapa: string) {
    const periodos = await this.db
      .select()
      .from(schema.planoAulaPeriodo)
      .where(
        and(
          eq(schema.planoAulaPeriodo.unidadeId, unidadeId),
          eq(schema.planoAulaPeriodo.etapa, etapa)
        )
      )
      .orderBy(asc(schema.planoAulaPeriodo.dataInicio));

    for (let i = 0; i < periodos.length; i++) {
      const numeroCorreto = i + 1;
      if (periodos[i].numero !== numeroCorreto) {
        await this.db
          .update(schema.planoAulaPeriodo)
          .set({ numero: numeroCorreto, atualizadoEm: new Date() })
          .where(eq(schema.planoAulaPeriodo.id, periodos[i].id));
      }
    }
  }

  // ... métodos privados anteriores (verificarSobreposicao, calcularProximoNumero)
}
```

**Step 2: Criar módulo NestJS**

```typescript
// services/api/src/modules/plano-aula-periodo/plano-aula-periodo.module.ts
import { Module } from '@nestjs/common';
import { PlanoAulaPeriodoService } from './plano-aula-periodo.service';
import { PlanoAulaPeriodoController } from './plano-aula-periodo.controller';

@Module({
  providers: [PlanoAulaPeriodoService],
  controllers: [PlanoAulaPeriodoController],
  exports: [PlanoAulaPeriodoService],
})
export class PlanoAulaPeriodoModule {}
```

**Step 3: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/
git commit -m "feat(api): integração PlanoAulaPeriodoService com Drizzle

Implementa persistência real no PostgreSQL

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 9: Service - Editar Período (TDD)

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`

**Step 1: Adicionar teste**

```typescript
describe('editarPeriodo', () => {
  it('deve permitir editar descrição sempre', async () => {
    const periodoMock = {
      id: 'periodo-id',
      dataMaximaEntrega: new Date('2025-01-01'), // prazo expirado
    };

    jest.spyOn(service, 'buscarPorId').mockResolvedValue(periodoMock as any);
    jest.spyOn(service as any, 'contarPlanosVinculados').mockResolvedValue(5);
    jest.spyOn(service as any, 'db').mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
    });

    await expect(
      service.editarPeriodo('periodo-id', { descricao: 'Nova descrição' })
    ).resolves.not.toThrow();
  });

  it('deve bloquear edição de datas se prazo expirou e há planos vinculados', async () => {
    const periodoMock = {
      id: 'periodo-id',
      dataMaximaEntrega: new Date('2025-01-01'),
    };

    jest.spyOn(service, 'buscarPorId').mockResolvedValue(periodoMock as any);
    jest.spyOn(service as any, 'contarPlanosVinculados').mockResolvedValue(5);

    await expect(
      service.editarPeriodo('periodo-id', { dataInicio: '2026-04-01' })
    ).rejects.toThrow(BadRequestException);
  });
});
```

**Step 2: Rodar teste**

```bash
pnpm test plano-aula-periodo.service.spec.ts
```

Expected: FAIL

**Step 3: Implementar editarPeriodo**

```typescript
async editarPeriodo(periodoId: string, dto: EditarPeriodoDto) {
  const periodo = await this.buscarPorId(periodoId);

  const planosVinculados = await this.contarPlanosVinculados(periodoId);
  const temPlanosVinculados = planosVinculados > 0;

  const agora = new Date();
  const prazoPassou = new Date(periodo.dataMaximaEntrega) < agora;

  if (prazoPassou && temPlanosVinculados) {
    if (dto.dataInicio || dto.dataFim || dto.dataMaximaEntrega) {
      throw new BadRequestException(
        'Não é possível alterar datas de um período com prazo expirado e planos vinculados'
      );
    }
  }

  await this.db
    .update(schema.planoAulaPeriodo)
    .set({ ...dto, atualizadoEm: new Date() })
    .where(eq(schema.planoAulaPeriodo.id, periodoId));
}

async buscarPorId(periodoId: string) {
  const [periodo] = await this.db
    .select()
    .from(schema.planoAulaPeriodo)
    .where(eq(schema.planoAulaPeriodo.id, periodoId));

  if (!periodo) {
    throw new BadRequestException('Período não encontrado');
  }

  return periodo;
}

private async contarPlanosVinculados(periodoId: string): Promise<number> {
  const [result] = await this.db
    .select({ count: count() })
    .from(schema.planoAula)
    .where(eq(schema.planoAula.planoAulaPeriodoId, periodoId));

  return result.count;
}
```

**Step 4: Rodar teste**

```bash
pnpm test plano-aula-periodo.service.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/
git commit -m "test(api): edição controlada de períodos

TDD - Protege datas quando prazo expirou + planos vinculados

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 10: Service - Excluir Período (TDD)

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`

**Step 1: Adicionar teste**

```typescript
describe('excluirPeriodo', () => {
  it('deve bloquear exclusão se houver planos vinculados', async () => {
    jest.spyOn(service as any, 'contarPlanosVinculados').mockResolvedValue(3);

    await expect(service.excluirPeriodo('periodo-id')).rejects.toThrow(
      'Não é possível excluir. 3 professoras já iniciaram este período.'
    );
  });

  it('deve permitir exclusão se não houver planos vinculados', async () => {
    jest.spyOn(service as any, 'contarPlanosVinculados').mockResolvedValue(0);
    jest.spyOn(service, 'buscarPorId').mockResolvedValue({
      id: 'periodo-id',
      unidadeId: 'unidade-id',
      etapa: 'INFANTIL',
    } as any);
    jest.spyOn(service as any, 'renumerarPeriodosSeNecessario').mockResolvedValue(undefined);

    const dbMock = {
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(service as any, 'db', 'get').mockReturnValue(dbMock);

    await expect(service.excluirPeriodo('periodo-id')).resolves.not.toThrow();
  });
});
```

**Step 2: Rodar teste**

```bash
pnpm test plano-aula-periodo.service.spec.ts
```

Expected: FAIL

**Step 3: Implementar excluirPeriodo**

```typescript
async excluirPeriodo(periodoId: string) {
  const planosVinculados = await this.contarPlanosVinculados(periodoId);

  if (planosVinculados > 0) {
    throw new BadRequestException(
      `Não é possível excluir. ${planosVinculados} professoras já iniciaram este período.`
    );
  }

  const periodo = await this.buscarPorId(periodoId);

  await this.db
    .delete(schema.planoAulaPeriodo)
    .where(eq(schema.planoAulaPeriodo.id, periodoId));

  await this.renumerarPeriodosSeNecessario(periodo.unidadeId, periodo.etapa);
}
```

**Step 4: Rodar teste**

```bash
pnpm test plano-aula-periodo.service.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/
git commit -m "test(api): exclusão protegida de períodos

TDD - Bloqueia exclusão quando há planos vinculados

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Fase 3: Backend - Controller Layer

### Task 11: Controller - Criar Período com Guards

**Files:**
- Create: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.ts`
- Create: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.spec.ts`

**Step 1: Escrever teste do controller**

```typescript
// services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PlanoAulaPeriodoController } from './plano-aula-periodo.controller';
import { PlanoAulaPeriodoService } from './plano-aula-periodo.service';
import { ForbiddenException } from '@nestjs/common';

describe('PlanoAulaPeriodoController', () => {
  let controller: PlanoAulaPeriodoController;
  let service: PlanoAulaPeriodoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanoAulaPeriodoController],
      providers: [
        {
          provide: PlanoAulaPeriodoService,
          useValue: {
            criarPeriodo: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PlanoAulaPeriodoController>(PlanoAulaPeriodoController);
    service = module.get<PlanoAulaPeriodoService>(PlanoAulaPeriodoService);
  });

  describe('POST /plano-aula-periodo', () => {
    it('deve bloquear coordenadora_infantil criando período de FUNDAMENTAL_I', async () => {
      const session = { role: 'coordenadora_infantil', unidadeId: 'unidade-id', userId: 'user-id' };
      const dto = { etapa: 'FUNDAMENTAL_I', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-03-13' };

      await expect(controller.criarPeriodo(session, dto)).rejects.toThrow(ForbiddenException);
    });

    it('deve permitir coordenadora_infantil criando período de INFANTIL', async () => {
      const session = { role: 'coordenadora_infantil', unidadeId: 'unidade-id', userId: 'user-id' };
      const dto = { etapa: 'INFANTIL', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-03-13' };

      jest.spyOn(service, 'criarPeriodo').mockResolvedValue({ id: 'periodo-id' } as any);

      await expect(controller.criarPeriodo(session, dto)).resolves.toBeDefined();
    });
  });
});
```

**Step 2: Rodar teste**

```bash
pnpm test plano-aula-periodo.controller.spec.ts
```

Expected: FAIL

**Step 3: Implementar controller**

```typescript
// services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PlanoAulaPeriodoService } from './plano-aula-periodo.service';
import { CriarPeriodoDto, EditarPeriodoDto } from './dto/plano-aula-periodo.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Plano Aula Período')
@Controller('plano-aula-periodo')
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class PlanoAulaPeriodoController {
  constructor(private readonly service: PlanoAulaPeriodoService) {}

  @Post()
  @Roles(
    'diretora_geral',
    'gerente_unidade',
    'coordenadora_geral',
    'coordenadora_infantil',
    'coordenadora_fundamental_i',
    'coordenadora_fundamental_ii',
    'coordenadora_bercario',
    'coordenadora_medio'
  )
  @ApiOperation({ summary: 'Criar novo período de plano de aula' })
  async criarPeriodo(@CurrentUser() session: any, @Body() dto: CriarPeriodoDto) {
    // Validar permissão por etapa
    if (!this.podeEditarEtapa(session.role, dto.etapa)) {
      throw new ForbiddenException('Sem permissão para criar períodos desta etapa');
    }

    return this.service.criarPeriodo(session.unidadeId, session.userId, dto);
  }

  private podeEditarEtapa(role: string, etapa: string): boolean {
    const mapeamento = {
      coordenadora_infantil: ['INFANTIL'],
      coordenadora_fundamental_i: ['FUNDAMENTAL_I'],
      coordenadora_fundamental_ii: ['FUNDAMENTAL_II'],
      coordenadora_bercario: ['BERCARIO'],
      coordenadora_medio: ['MEDIO'],
    };

    // Roles globais podem editar qualquer etapa
    if (['diretora_geral', 'gerente_unidade', 'coordenadora_geral'].includes(role)) {
      return true;
    }

    return mapeamento[role]?.includes(etapa) || false;
  }
}
```

**Step 4: Rodar teste**

```bash
pnpm test plano-aula-periodo.controller.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/
git commit -m "test(api): controller com guards e permissões por etapa

TDD - Coordenadoras só criam períodos da sua etapa

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 12: Controller - Endpoints de Listagem e Busca

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.ts`
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`

**Step 1: Adicionar endpoints no controller**

```typescript
@Get()
@Roles(
  'diretora_geral',
  'gerente_unidade',
  'coordenadora_geral',
  'coordenadora_infantil',
  'coordenadora_fundamental_i',
  'coordenadora_fundamental_ii',
  'coordenadora_bercario',
  'coordenadora_medio',
  'analista_pedagogico',
  'professora'
)
@ApiOperation({ summary: 'Listar períodos da unidade' })
async listarPeriodos(@CurrentUser() session: any) {
  return this.service.listarPorUnidade(session.unidadeId);
}

@Get(':id')
@Roles('diretora_geral', 'gerente_unidade', 'coordenadora_geral', 'coordenadora_infantil', 'professora')
@ApiOperation({ summary: 'Buscar período por ID' })
async buscarPeriodo(@Param('id') id: string) {
  return this.service.buscarPorId(id);
}

@Get('turma/:turmaId')
@Roles('professora', 'coordenadora_geral', 'coordenadora_infantil')
@ApiOperation({ summary: 'Buscar períodos da turma' })
async buscarPeriodosDaTurma(@Param('turmaId') turmaId: string) {
  return this.service.buscarPorTurma(turmaId);
}
```

**Step 2: Implementar métodos no service**

```typescript
async listarPorUnidade(unidadeId: string) {
  return this.db
    .select()
    .from(schema.planoAulaPeriodo)
    .where(eq(schema.planoAulaPeriodo.unidadeId, unidadeId))
    .orderBy(
      asc(schema.planoAulaPeriodo.etapa),
      asc(schema.planoAulaPeriodo.numero)
    );
}

async buscarPorTurma(turmaId: string) {
  // Buscar etapa da turma
  const [turma] = await this.db
    .select()
    .from(schema.turmas)
    .where(eq(schema.turmas.id, turmaId));

  if (!turma) {
    throw new BadRequestException('Turma não encontrada');
  }

  // Buscar períodos da etapa
  return this.db
    .select()
    .from(schema.planoAulaPeriodo)
    .where(
      and(
        eq(schema.planoAulaPeriodo.unidadeId, turma.unidadeId),
        eq(schema.planoAulaPeriodo.etapa, turma.etapa)
      )
    )
    .orderBy(asc(schema.planoAulaPeriodo.numero));
}
```

**Step 3: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/
git commit -m "feat(api): endpoints de listagem de períodos

Listar por unidade e por turma (filtrado por etapa)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 13: Controller - Endpoints de Edição e Exclusão

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.ts`

**Step 1: Adicionar endpoints**

```typescript
@Put(':id')
@Roles(
  'diretora_geral',
  'gerente_unidade',
  'coordenadora_geral',
  'coordenadora_infantil',
  'coordenadora_fundamental_i',
  'coordenadora_fundamental_ii',
  'coordenadora_bercario',
  'coordenadora_medio'
)
@ApiOperation({ summary: 'Editar período' })
async editarPeriodo(
  @CurrentUser() session: any,
  @Param('id') id: string,
  @Body() dto: EditarPeriodoDto
) {
  const periodo = await this.service.buscarPorId(id);

  if (!this.podeEditarEtapa(session.role, periodo.etapa)) {
    throw new ForbiddenException('Sem permissão para editar períodos desta etapa');
  }

  return this.service.editarPeriodo(id, dto);
}

@Delete(':id')
@Roles(
  'diretora_geral',
  'gerente_unidade',
  'coordenadora_geral',
  'coordenadora_infantil',
  'coordenadora_fundamental_i',
  'coordenadora_fundamental_ii',
  'coordenadora_bercario',
  'coordenadora_medio'
)
@ApiOperation({ summary: 'Excluir período' })
async excluirPeriodo(@CurrentUser() session: any, @Param('id') id: string) {
  const periodo = await this.service.buscarPorId(id);

  if (!this.podeEditarEtapa(session.role, periodo.etapa)) {
    throw new ForbiddenException('Sem permissão para excluir períodos desta etapa');
  }

  return this.service.excluirPeriodo(id);
}
```

**Step 2: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/
git commit -m "feat(api): endpoints de edição e exclusão de períodos

Com validação de permissões por etapa

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 14: Registrar Módulo na API Principal

**Files:**
- Modify: `services/api/src/app.module.ts`

**Step 1: Adicionar import e módulo**

Localizar a seção de imports do `AppModule` e adicionar:

```typescript
import { PlanoAulaPeriodoModule } from './modules/plano-aula-periodo/plano-aula-periodo.module';

@Module({
  imports: [
    // ... outros módulos
    PlanoAulaPeriodoModule,
  ],
})
```

**Step 2: Commit**

```bash
git add services/api/src/app.module.ts
git commit -m "feat(api): registrar PlanoAulaPeriodoModule

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Fase 4: Frontend - Interface de Gestão

### Task 15: Hook para Buscar Períodos (Client-Side)

**Files:**
- Create: `apps/planejamento/features/periodos/hooks/use-periodos.ts`

**Step 1: Criar hook**

```typescript
// apps/planejamento/features/periodos/hooks/use-periodos.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientFetch } from '@essencia/shared/fetchers/client';

export interface Periodo {
  id: string;
  unidadeId: string;
  etapa: string;
  numero: number;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
  planosVinculados?: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

export function usePeriodos() {
  const queryClient = useQueryClient();

  const { data: periodos = [], isLoading } = useQuery({
    queryKey: ['periodos'],
    queryFn: async () => {
      const response = await clientFetch('/plano-aula-periodo');
      return response.json() as Promise<Periodo[]>;
    },
  });

  const criarPeriodo = useMutation({
    mutationFn: async (dto: {
      etapa: string;
      descricao?: string;
      dataInicio: string;
      dataFim: string;
      dataMaximaEntrega: string;
    }) => {
      const response = await clientFetch('/plano-aula-periodo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodos'] });
    },
  });

  const editarPeriodo = useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: Partial<{
        descricao: string;
        dataInicio: string;
        dataFim: string;
        dataMaximaEntrega: string;
      }>;
    }) => {
      const response = await clientFetch(`/plano-aula-periodo/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodos'] });
    },
  });

  const excluirPeriodo = useMutation({
    mutationFn: async (id: string) => {
      await clientFetch(`/plano-aula-periodo/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodos'] });
    },
  });

  return {
    periodos,
    isLoading,
    criarPeriodo,
    editarPeriodo,
    excluirPeriodo,
  };
}
```

**Step 2: Commit**

```bash
git add apps/planejamento/features/periodos/
git commit -m "feat(planejamento): hook para gerenciar períodos

React Query com mutations para CRUD

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 16: Componente de Listagem de Períodos

**Files:**
- Create: `apps/planejamento/features/periodos/components/periodos-list.tsx`
- Create: `apps/planejamento/features/periodos/components/periodos-list.test.tsx`

**Step 1: Escrever teste do componente**

```typescript
// apps/planejamento/features/periodos/components/periodos-list.test.tsx
import { render, screen } from '@testing-library/react';
import { PeriodosList } from './periodos-list';
import { describe, it, expect, vi } from 'vitest';

describe('PeriodosList', () => {
  it('deve renderizar lista vazia quando não há períodos', () => {
    render(<PeriodosList periodos={[]} etapa="INFANTIL" onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/nenhum plano de aula/i)).toBeInTheDocument();
  });

  it('deve renderizar períodos da etapa', () => {
    const periodos = [
      {
        id: '1',
        numero: 1,
        etapa: 'INFANTIL',
        descricao: 'Tema: Meio Ambiente',
        dataInicio: '2026-03-01',
        dataFim: '2026-03-15',
        dataMaximaEntrega: '2026-03-13',
      },
    ];

    render(<PeriodosList periodos={periodos} etapa="INFANTIL" onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('1º Plano de Aula')).toBeInTheDocument();
    expect(screen.getByText('Tema: Meio Ambiente')).toBeInTheDocument();
  });
});
```

**Step 2: Rodar teste**

```bash
cd apps/planejamento
pnpm test periodos-list.test.tsx
```

Expected: FAIL

**Step 3: Implementar componente**

```typescript
// apps/planejamento/features/periodos/components/periodos-list.tsx
import { Button } from '@essencia/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@essencia/ui/card';
import { Badge } from '@essencia/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Periodo {
  id: string;
  numero: number;
  etapa: string;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
  planosVinculados?: number;
}

interface PeriodosListProps {
  periodos: Periodo[];
  etapa: string;
  onEdit: (periodo: Periodo) => void;
  onDelete: (id: string) => void;
}

export function PeriodosList({ periodos, etapa, onEdit, onDelete }: PeriodosListProps) {
  const periodosDaEtapa = periodos.filter((p) => p.etapa === etapa);

  if (periodosDaEtapa.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum Plano de Aula configurado para {etapa}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {periodosDaEtapa.map((periodo) => (
        <Card key={periodo.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {periodo.numero}º Plano de Aula
              {periodo.planosVinculados && periodo.planosVinculados > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {periodo.planosVinculados} professoras
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onEdit(periodo)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(periodo.id)}
                disabled={periodo.planosVinculados && periodo.planosVinculados > 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {periodo.descricao && (
              <p className="text-sm text-muted-foreground mb-4">{periodo.descricao}</p>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Período:</span>
                <br />
                {format(new Date(periodo.dataInicio), 'dd/MM/yyyy', { locale: ptBR })} até{' '}
                {format(new Date(periodo.dataFim), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
              <div>
                <span className="font-medium">Prazo de Entrega:</span>
                <br />
                {format(new Date(periodo.dataMaximaEntrega), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 4: Rodar teste**

```bash
pnpm test periodos-list.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/planejamento/features/periodos/components/
git commit -m "test(planejamento): componente de listagem de períodos

TDD - Renderiza períodos por etapa

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 17: Modal de Criação/Edição de Período

**Files:**
- Create: `apps/planejamento/features/periodos/components/periodo-modal.tsx`

**Step 1: Implementar modal**

```typescript
// apps/planejamento/features/periodos/components/periodo-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@essencia/ui/dialog';
import { Button } from '@essencia/ui/button';
import { Input } from '@essencia/ui/input';
import { Textarea } from '@essencia/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@essencia/ui/select';
import { Label } from '@essencia/ui/label';

interface PeriodoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  periodo?: any;
  etapasPermitidas: string[];
}

export function PeriodoModal({ open, onClose, onSubmit, periodo, etapasPermitidas }: PeriodoModalProps) {
  const [etapa, setEtapa] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dataMaximaEntrega, setDataMaximaEntrega] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (periodo) {
      setEtapa(periodo.etapa);
      setDescricao(periodo.descricao || '');
      setDataInicio(periodo.dataInicio);
      setDataFim(periodo.dataFim);
      setDataMaximaEntrega(periodo.dataMaximaEntrega);
    } else {
      setEtapa('');
      setDescricao('');
      setDataInicio('');
      setDataFim('');
      setDataMaximaEntrega('');
    }
  }, [periodo]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({
        etapa,
        descricao: descricao || undefined,
        dataInicio,
        dataFim,
        dataMaximaEntrega,
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar período:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{periodo ? 'Editar Plano de Aula' : 'Novo Plano de Aula'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Etapa</Label>
            <Select value={etapa} onValueChange={setEtapa} disabled={!!periodo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapasPermitidas.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Tema: Meio Ambiente"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Data Máxima de Entrega</Label>
            <Input
              type="date"
              value={dataMaximaEntrega}
              onChange={(e) => setDataMaximaEntrega(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add apps/planejamento/features/periodos/components/periodo-modal.tsx
git commit -m "feat(planejamento): modal de criação/edição de período

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 18: Página de Gestão de Períodos

**Files:**
- Create: `apps/planejamento/app/gestao/periodos/page.tsx`
- Create: `apps/planejamento/app/gestao/periodos/periodos-content.tsx`

**Step 1: Criar página**

```typescript
// apps/planejamento/app/gestao/periodos/page.tsx
import { Metadata } from 'next';
import { PeriodosContent } from './periodos-content';

export const metadata: Metadata = {
  title: 'Gestão de Planos de Aula',
};

export default function PeriodosPage() {
  return <PeriodosContent />;
}
```

**Step 2: Criar content client component**

```typescript
// apps/planejamento/app/gestao/periodos/periodos-content.tsx
'use client';

import { useState } from 'react';
import { Button } from '@essencia/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@essencia/ui/tabs';
import { Plus } from 'lucide-react';
import { usePeriodos } from '../../../features/periodos/hooks/use-periodos';
import { PeriodosList } from '../../../features/periodos/components/periodos-list';
import { PeriodoModal } from '../../../features/periodos/components/periodo-modal';
import { useSession } from '@essencia/shared/hooks/use-session';

const ETAPAS = ['BERCARIO', 'INFANTIL', 'FUNDAMENTAL_I', 'FUNDAMENTAL_II', 'MEDIO'];

export function PeriodosContent() {
  const { session } = useSession();
  const { periodos, isLoading, criarPeriodo, editarPeriodo, excluirPeriodo } = usePeriodos();
  const [modalOpen, setModalOpen] = useState(false);
  const [periodoEditando, setPeriodoEditando] = useState<any>(null);

  const etapasPermitidas = getEtapasPermitidas(session?.role);

  const handleEdit = (periodo: any) => {
    setPeriodoEditando(periodo);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este período?')) {
      await excluirPeriodo.mutateAsync(id);
    }
  };

  const handleSubmit = async (data: any) => {
    if (periodoEditando) {
      await editarPeriodo.mutateAsync({ id: periodoEditando.id, dto: data });
    } else {
      await criarPeriodo.mutateAsync(data);
    }
    setModalOpen(false);
    setPeriodoEditando(null);
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Planos de Aula</h1>
          <p className="text-muted-foreground">Configure períodos de planejamento por etapa</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Plano de Aula
        </Button>
      </div>

      <Tabs defaultValue={ETAPAS[0]}>
        <TabsList>
          {ETAPAS.map((etapa) => (
            <TabsTrigger key={etapa} value={etapa}>
              {etapa}
            </TabsTrigger>
          ))}
        </TabsList>

        {ETAPAS.map((etapa) => (
          <TabsContent key={etapa} value={etapa}>
            <PeriodosList
              periodos={periodos}
              etapa={etapa}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </TabsContent>
        ))}
      </Tabs>

      <PeriodoModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setPeriodoEditando(null);
        }}
        onSubmit={handleSubmit}
        periodo={periodoEditando}
        etapasPermitidas={etapasPermitidas}
      />
    </div>
  );
}

function getEtapasPermitidas(role?: string): string[] {
  const mapeamento: Record<string, string[]> = {
    coordenadora_infantil: ['INFANTIL'],
    coordenadora_fundamental_i: ['FUNDAMENTAL_I'],
    coordenadora_fundamental_ii: ['FUNDAMENTAL_II'],
    coordenadora_bercario: ['BERCARIO'],
    coordenadora_medio: ['MEDIO'],
  };

  if (!role) return [];

  if (['diretora_geral', 'gerente_unidade', 'coordenadora_geral'].includes(role)) {
    return ['BERCARIO', 'INFANTIL', 'FUNDAMENTAL_I', 'FUNDAMENTAL_II', 'MEDIO'];
  }

  return mapeamento[role] || [];
}
```

**Step 3: Commit**

```bash
git add apps/planejamento/app/gestao/periodos/
git commit -m "feat(planejamento): página de gestão de períodos

Interface completa para coordenadoras criarem períodos

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Fase 5: Frontend - Experiência Professora

### Task 19: Hook para Buscar Períodos da Turma

**Files:**
- Modify: `apps/planejamento/features/periodos/hooks/use-periodos.ts`

**Step 1: Adicionar hook específico**

```typescript
export function usePeriodosDaTurma(turmaId: string) {
  return useQuery({
    queryKey: ['periodos', 'turma', turmaId],
    queryFn: async () => {
      const response = await clientFetch(`/plano-aula-periodo/turma/${turmaId}`);
      return response.json() as Promise<Periodo[]>;
    },
    enabled: !!turmaId,
  });
}
```

**Step 2: Commit**

```bash
git add apps/planejamento/features/periodos/hooks/use-periodos.ts
git commit -m "feat(planejamento): hook para buscar períodos da turma

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 20: Componente Empty State (Sem Períodos)

**Files:**
- Create: `apps/planejamento/features/periodos/components/periodos-empty-state.tsx`
- Create: `apps/planejamento/features/periodos/components/periodos-empty-state.test.tsx`

**Step 1: Escrever teste**

```typescript
// apps/planejamento/features/periodos/components/periodos-empty-state.test.tsx
import { render, screen } from '@testing-library/react';
import { PeriodosEmptyState } from './periodos-empty-state';
import { describe, it, expect } from 'vitest';

describe('PeriodosEmptyState', () => {
  it('deve renderizar mensagem quando não há períodos', () => {
    render(<PeriodosEmptyState etapa="INFANTIL" />);
    expect(screen.getByText(/nenhum plano de aula disponível/i)).toBeInTheDocument();
    expect(screen.getByText(/infantil/i)).toBeInTheDocument();
  });
});
```

**Step 2: Rodar teste**

```bash
pnpm test periodos-empty-state.test.tsx
```

Expected: FAIL

**Step 3: Implementar componente**

```typescript
// apps/planejamento/features/periodos/components/periodos-empty-state.tsx
import { CalendarX } from 'lucide-react';
import { Card, CardContent } from '@essencia/ui/card';

interface PeriodosEmptyStateProps {
  etapa: string;
}

export function PeriodosEmptyState({ etapa }: PeriodosEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarX className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">Nenhum Plano de Aula disponível ainda</h3>
        <p className="text-muted-foreground mb-4 max-w-md">
          A coordenação ainda não configurou os períodos de planejamento para sua turma ({etapa}).
        </p>
        <p className="text-sm text-muted-foreground">
          Aguarde a coordenação criar os Planos de Aula. Você será notificada quando estiverem
          disponíveis.
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Rodar teste**

```bash
pnpm test periodos-empty-state.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/planejamento/features/periodos/components/periodos-empty-state*
git commit -m "test(planejamento): empty state para professoras

TDD - Mensagem quando não há períodos configurados

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 21: Componente Card de Período (Professora)

**Files:**
- Create: `apps/planejamento/features/periodos/components/periodo-card-professora.tsx`

**Step 1: Implementar componente**

```typescript
// apps/planejamento/features/periodos/components/periodo-card-professora.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@essencia/ui/card';
import { Button } from '@essencia/ui/button';
import { Badge } from '@essencia/ui/badge';
import { format, isPast, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

interface PeriodoCardProfessoraProps {
  periodo: {
    id: string;
    numero: number;
    descricao?: string;
    dataInicio: string;
    dataFim: string;
    dataMaximaEntrega: string;
  };
  planoExistente?: {
    id: string;
    status: string;
  };
}

export function PeriodoCardProfessora({ periodo, planoExistente }: PeriodoCardProfessoraProps) {
  const router = useRouter();
  const dataMaxima = new Date(periodo.dataMaximaEntrega);
  const prazoExpirado = isPast(dataMaxima);
  const diasRestantes = differenceInDays(dataMaxima, new Date());
  const prazoProximo = diasRestantes <= 3 && diasRestantes > 0;

  const handleClick = () => {
    router.push(`/planejamento/plano-aula/${periodo.id}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {periodo.numero}º Plano de Aula
          {planoExistente && <Badge variant="secondary">{planoExistente.status}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {periodo.descricao && (
          <p className="text-sm text-muted-foreground">{periodo.descricao}</p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Período:</span>
            <br />
            {format(new Date(periodo.dataInicio), 'dd/MM/yyyy', { locale: ptBR })} até{' '}
            {format(new Date(periodo.dataFim), 'dd/MM/yyyy', { locale: ptBR })}
          </div>
          <div>
            <span className="font-medium">Prazo de Entrega:</span>
            <br />
            <div className="flex items-center gap-2">
              {format(dataMaxima, 'dd/MM/yyyy', { locale: ptBR })}
              {prazoProximo && <Badge variant="warning">Prazo próximo</Badge>}
              {prazoExpirado && <Badge variant="destructive">Prazo expirado</Badge>}
            </div>
          </div>
        </div>

        {planoExistente && (
          <div className="text-sm">
            <span className="font-medium">Status:</span> {planoExistente.status}
          </div>
        )}

        <Button onClick={handleClick} className="w-full">
          {planoExistente ? 'Continuar Plano' : 'Iniciar Plano de Aula'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add apps/planejamento/features/periodos/components/periodo-card-professora.tsx
git commit -m "feat(planejamento): card de período para professoras

Exibe status, prazos e botão de ação

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 22: Atualizar Página da Professora

**Files:**
- Modify: `apps/planejamento/app/planejamentos/planejamentos-content.tsx`

**Step 1: Refatorar para usar períodos configuráveis**

Substituir a listagem hardcoded de quinzenas por:

```typescript
'use client';

import { usePeriodosDaTurma } from '../../features/periodos/hooks/use-periodos';
import { PeriodosEmptyState } from '../../features/periodos/components/periodos-empty-state';
import { PeriodoCardProfessora } from '../../features/periodos/components/periodo-card-professora';

export function PlanejamentosContent() {
  const { turma } = useTurma(); // Hook existente
  const { data: periodos = [], isLoading } = usePeriodosDaTurma(turma?.id || '');

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (periodos.length === 0) {
    return <PeriodosEmptyState etapa={turma?.etapa || ''} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meus Planos de Aula</h1>
        <p className="text-muted-foreground">
          Turma: {turma?.nome} • {turma?.etapa}
        </p>
      </div>

      <div className="grid gap-4">
        {periodos.map((periodo) => (
          <PeriodoCardProfessora
            key={periodo.id}
            periodo={periodo}
            planoExistente={undefined} // TODO: Buscar plano existente
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/planejamento/app/planejamentos/planejamentos-content.tsx
git commit -m "refactor(planejamento): usar períodos configuráveis na listagem

Substitui quinzenas hardcoded por períodos da API

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 23: Atualizar Rota do Plano de Aula

**Files:**
- Rename: `apps/planejamento/app/plano-aula/[quinzenaId]/` → Não renomear, apenas atualizar lógica interna
- Modify: `apps/planejamento/app/plano-aula/[quinzenaId]/page.tsx`

**Step 1: Atualizar para aceitar periodoId**

```typescript
// apps/planejamento/app/plano-aula/[quinzenaId]/page.tsx
// Manter nome do arquivo por compatibilidade, mas tratar como periodoId internamente

interface PageProps {
  params: { quinzenaId: string }; // Na verdade é periodoId agora
}

export default function PlanoAulaPage({ params }: PageProps) {
  const periodoId = params.quinzenaId; // Alias para facilitar migração

  return <PlanoContent periodoId={periodoId} />;
}
```

**Step 2: Atualizar lógica de fetch**

Modificar `plano-content.tsx` para buscar por `periodoId` ao invés de `quinzenaNumero`.

**Step 3: Commit**

```bash
git add apps/planejamento/app/plano-aula/
git commit -m "refactor(planejamento): rota de plano usa periodoId

Aceita UUID ao invés de número hardcoded

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Fase 6: Limpeza de Código Legado

### Task 24: Remover Arquivo de Quinzenas Hardcoded

**Files:**
- Delete: `packages/shared/src/config/quinzenas-2026.ts`
- Delete: `packages/shared/src/config/quinzenas-*.ts` (todos os anos)

**Step 1: Deletar arquivos**

```bash
rm packages/shared/src/config/quinzenas-*.ts
```

**Step 2: Verificar se há imports quebrados**

```bash
pnpm turbo typecheck
```

Expected: Erros de import nos arquivos que ainda usam quinzenas hardcoded

**Step 3: Corrigir imports quebrados**

Buscar por imports de `quinzenas-` e remover/refatorar:

```bash
cd /var/www/essencia
grep -r "from.*quinzenas-" --include="*.ts" --include="*.tsx"
```

Refatorar cada ocorrência para usar a API.

**Step 4: Commit**

```bash
git add packages/shared/src/config/
git commit -m "refactor: remover quinzenas hardcoded

BREAKING CHANGE: Arquivos de configuração de quinzenas removidos
Sistema agora usa períodos configuráveis via API

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Fase 7: Scripts de Deploy

### Task 25: Script de Backup Pré-Migração

**Files:**
- Create: `scripts/backup-pre-migracao-periodos.sh`

**Step 1: Criar script**

```bash
#!/bin/bash
# scripts/backup-pre-migracao-periodos.sh

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/pre-migracao-periodos_$TIMESTAMP.sql"

echo "🔒 Criando backup pré-migração..."

mkdir -p $BACKUP_DIR

# Backup completo do banco
docker exec essencia-postgres pg_dump -U essencia -d essencia_db > $BACKUP_FILE

echo "✅ Backup criado: $BACKUP_FILE"
echo "📊 Tamanho: $(du -h $BACKUP_FILE | cut -f1)"

# Backup específico das tabelas afetadas
TABLES_BACKUP="$BACKUP_DIR/tables-afetadas_$TIMESTAMP.sql"
docker exec essencia-postgres pg_dump -U essencia -d essencia_db \
  -t plano_aula \
  -t plano_aula_historico \
  -t plano_aula_comentarios \
  -t quinzena_documents > $TABLES_BACKUP

echo "✅ Backup de tabelas afetadas: $TABLES_BACKUP"
```

**Step 2: Tornar executável**

```bash
chmod +x scripts/backup-pre-migracao-periodos.sh
```

**Step 3: Commit**

```bash
git add scripts/backup-pre-migracao-periodos.sh
git commit -m "feat(scripts): backup pré-migração de períodos

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 26: Script de Deploy

**Files:**
- Create: `scripts/deploy-migracao-periodos.sh`

**Step 1: Criar script**

```bash
#!/bin/bash
# scripts/deploy-migracao-periodos.sh

set -e

echo "🚀 Iniciando deploy da migração de períodos..."

# 1. Backup
echo "📦 1/6 - Criando backup..."
./scripts/backup-pre-migracao-periodos.sh

# 2. Parar containers
echo "⏸️  2/6 - Parando containers..."
docker compose -f docker-compose.prod.yml stop api planejamento

# 3. Aplicar migration
echo "💾 3/6 - Aplicando migration SQL..."
./scripts/migrate.sh

# 4. Rebuild
echo "🔨 4/6 - Rebuild da aplicação..."
docker compose -f docker-compose.prod.yml build --no-cache api planejamento

# 5. Restart
echo "▶️  5/6 - Reiniciando containers..."
docker compose -f docker-compose.prod.yml up -d

# 6. Health check
echo "🏥 6/6 - Verificando saúde..."
sleep 10
./scripts/health-check.sh

echo "✅ Deploy concluído com sucesso!"
```

**Step 2: Tornar executável**

```bash
chmod +x scripts/deploy-migracao-periodos.sh
```

**Step 3: Commit**

```bash
git add scripts/deploy-migracao-periodos.sh
git commit -m "feat(scripts): deploy automatizado da migração

Pipeline completo: backup → migration → rebuild → health check

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 27: Script de Validação Pós-Deploy

**Files:**
- Create: `scripts/validacao-pos-deploy-periodos.sh`

**Step 1: Criar script**

```bash
#!/bin/bash
# scripts/validacao-pos-deploy-periodos.sh

set -e

echo "🔍 Validando deploy da migração de períodos..."

# 1. Verificar tabela criada
echo "✓ Verificando tabela plano_aula_periodo..."
TABELA_EXISTE=$(docker exec essencia-postgres psql -U essencia -d essencia_db -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='plano_aula_periodo';")

if [ "$TABELA_EXISTE" -eq "1" ]; then
  echo "  ✅ Tabela plano_aula_periodo criada"
else
  echo "  ❌ ERRO: Tabela não encontrada"
  exit 1
fi

# 2. Verificar coluna plano_aula_periodo_id
echo "✓ Verificando coluna plano_aula_periodo_id..."
COLUNA_EXISTE=$(docker exec essencia-postgres psql -U essencia -d essencia_db -tAc \
  "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='plano_aula' AND column_name='plano_aula_periodo_id';")

if [ "$COLUNA_EXISTE" -eq "1" ]; then
  echo "  ✅ Coluna adicionada em plano_aula"
else
  echo "  ❌ ERRO: Coluna não encontrada"
  exit 1
fi

# 3. Verificar dados antigos removidos
echo "✓ Verificando limpeza de dados..."
COUNT_PLANOS=$(docker exec essencia-postgres psql -U essencia -d essencia_db -tAc \
  "SELECT COUNT(*) FROM plano_aula;")

if [ "$COUNT_PLANOS" -eq "0" ]; then
  echo "  ✅ Dados antigos removidos (hard reset)"
else
  echo "  ⚠️  Ainda há $COUNT_PLANOS planos no banco (esperado: 0)"
fi

# 4. Verificar API
echo "✓ Verificando endpoint da API..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.portalcef.com.br/api/health)

if [ "$HTTP_CODE" -eq "200" ]; then
  echo "  ✅ API respondendo (HTTP $HTTP_CODE)"
else
  echo "  ❌ ERRO: API não respondendo (HTTP $HTTP_CODE)"
  exit 1
fi

echo ""
echo "✅ Validação concluída com sucesso!"
```

**Step 2: Tornar executável**

```bash
chmod +x scripts/validacao-pos-deploy-periodos.sh
```

**Step 3: Commit**

```bash
git add scripts/validacao-pos-deploy-periodos.sh
git commit -m "feat(scripts): validação pós-deploy

Verifica schema, dados e saúde da API

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 28: Script de Rollback

**Files:**
- Create: `scripts/rollback-migracao-periodos.sh`

**Step 1: Criar script**

```bash
#!/bin/bash
# scripts/rollback-migracao-periodos.sh

set -e

if [ -z "$1" ]; then
  echo "❌ Uso: $0 <caminho-backup.sql>"
  exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Arquivo de backup não encontrado: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  ATENÇÃO: Rollback iniciado"
echo "📁 Backup: $BACKUP_FILE"
echo ""
read -p "Confirma rollback? (digite 'SIM' para continuar): " CONFIRM

if [ "$CONFIRM" != "SIM" ]; then
  echo "❌ Rollback cancelado"
  exit 0
fi

# 1. Parar aplicação
echo "⏸️  1/4 - Parando aplicação..."
docker compose -f docker-compose.prod.yml stop

# 2. Restaurar banco
echo "💾 2/4 - Restaurando banco de dados..."
cat $BACKUP_FILE | docker exec -i essencia-postgres psql -U essencia -d essencia_db

# 3. Checkout versão anterior
echo "🔄 3/4 - Revertendo código..."
COMMIT_ANTERIOR=$(git log --oneline | grep -B 1 "migração de períodos" | tail -1 | cut -d' ' -f1)
git checkout $COMMIT_ANTERIOR

# 4. Rebuild e restart
echo "🔨 4/4 - Rebuild e restart..."
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo "✅ Rollback concluído"
```

**Step 2: Tornar executável**

```bash
chmod +x scripts/rollback-migracao-periodos.sh
```

**Step 3: Commit**

```bash
git add scripts/rollback-migracao-periodos.sh
git commit -m "feat(scripts): rollback de migração

Restaura backup e código anterior

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Fase 8: Documentação

### Task 29: Atualizar API.md

**Files:**
- Modify: `docs/API.md`

**Step 1: Adicionar seção de endpoints**

Adicionar ao final de `docs/API.md`:

```markdown
## Plano Aula Período

### POST /api/plano-aula-periodo

Criar novo período de plano de aula.

**Roles:** diretora_geral, gerente_unidade, coordenadora_geral, coordenadora_*

**Body:**
```json
{
  "etapa": "INFANTIL",
  "descricao": "Tema: Meio Ambiente",
  "dataInicio": "2026-03-01",
  "dataFim": "2026-03-15",
  "dataMaximaEntrega": "2026-03-13"
}
```

**Response:**
```json
{
  "id": "uuid",
  "numero": 1,
  "etapa": "INFANTIL",
  "descricao": "Tema: Meio Ambiente",
  "dataInicio": "2026-03-01",
  "dataFim": "2026-03-15",
  "dataMaximaEntrega": "2026-03-13",
  "criadoEm": "2026-02-01T10:00:00Z"
}
```

### GET /api/plano-aula-periodo

Listar todos os períodos da unidade.

### GET /api/plano-aula-periodo/:id

Buscar período específico.

### GET /api/plano-aula-periodo/turma/:turmaId

Buscar períodos da turma (filtrado por etapa).

### PUT /api/plano-aula-periodo/:id

Editar período (restrições se prazo expirou + planos vinculados).

### DELETE /api/plano-aula-periodo/:id

Excluir período (bloqueia se houver planos vinculados).
```

**Step 2: Commit**

```bash
git add docs/API.md
git commit -m "docs: documentar endpoints de plano-aula-periodo

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 30: Atualizar DATABASE.md

**Files:**
- Modify: `docs/DATABASE.md`

**Step 1: Adicionar schema**

Adicionar seção:

```markdown
## plano_aula_periodo

Configurações de períodos de planejamento criadas pela gestão.

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| unidade_id | UUID | FK unidades, NOT NULL |
| etapa | TEXT | NOT NULL |
| numero | INTEGER | NOT NULL |
| descricao | TEXT | NULL |
| data_inicio | DATE | NOT NULL |
| data_fim | DATE | NOT NULL |
| data_maxima_entrega | DATE | NOT NULL |
| criado_por | UUID | FK usuarios |
| criado_em | TIMESTAMP | DEFAULT NOW() |
| atualizado_em | TIMESTAMP | DEFAULT NOW() |

**Índices:**
- `idx_periodo_numero_etapa_unidade` (UNIQUE): unidade_id, etapa, numero
- `idx_plano_aula_periodo_unidade`: unidade_id
- `idx_plano_aula_periodo_etapa`: etapa
- `idx_plano_aula_periodo_datas`: data_inicio, data_fim

**Relações:**
- unidade → unidades (CASCADE)
- criado_por → usuarios
- Um período pode ter N planos_aula
```

**Step 2: Commit**

```bash
git add docs/DATABASE.md
git commit -m "docs: documentar schema plano_aula_periodo

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Fase 9: Testes End-to-End

### Task 31: Teste E2E - Fluxo Completo da Coordenadora

**Files:**
- Create: `apps/planejamento/e2e/periodos-gestao.spec.ts`

**Step 1: Escrever teste E2E**

```typescript
// apps/planejamento/e2e/periodos-gestao.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Gestão de Períodos - Coordenadora', () => {
  test.beforeEach(async ({ page }) => {
    // Login como coordenadora_infantil
    await page.goto('/login');
    await page.fill('[name="email"]', 'coordenadora.infantil@teste.com');
    await page.fill('[name="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('deve criar período para INFANTIL', async ({ page }) => {
    await page.goto('/planejamento/gestao/periodos');

    // Clicar em "Adicionar Plano de Aula"
    await page.click('text=Adicionar Plano de Aula');

    // Preencher modal
    await page.selectOption('select[name="etapa"]', 'INFANTIL');
    await page.fill('textarea[name="descricao"]', 'Tema: Meio Ambiente');
    await page.fill('input[name="dataInicio"]', '2026-03-01');
    await page.fill('input[name="dataFim"]', '2026-03-15');
    await page.fill('input[name="dataMaximaEntrega"]', '2026-03-13');

    // Salvar
    await page.click('text=Salvar');

    // Verificar sucesso
    await expect(page.locator('text=1º Plano de Aula')).toBeVisible();
    await expect(page.locator('text=Tema: Meio Ambiente')).toBeVisible();
  });

  test('deve bloquear criação de período para FUNDAMENTAL_I', async ({ page }) => {
    await page.goto('/planejamento/gestao/periodos');
    await page.click('text=Adicionar Plano de Aula');

    // Tentar selecionar FUNDAMENTAL_I
    const select = page.locator('select[name="etapa"]');
    const options = await select.locator('option').allTextContents();

    // Coordenadora infantil só vê INFANTIL
    expect(options).toContain('INFANTIL');
    expect(options).not.toContain('FUNDAMENTAL_I');
  });
});
```

**Step 2: Rodar teste**

```bash
cd apps/planejamento
pnpm playwright test periodos-gestao.spec.ts
```

Expected: PASS (se ambiente configurado) ou SKIP (se não há servidor de teste)

**Step 3: Commit**

```bash
git add apps/planejamento/e2e/
git commit -m "test(e2e): fluxo completo de gestão de períodos

Teste end-to-end da coordenadora criando períodos

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 32: Teste E2E - Fluxo da Professora

**Files:**
- Create: `apps/planejamento/e2e/periodos-professora.spec.ts`

**Step 1: Escrever teste**

```typescript
// apps/planejamento/e2e/periodos-professora.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Períodos - Professora', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'professora@teste.com');
    await page.fill('[name="password"]', 'senha123');
    await page.click('button[type="submit"]');
  });

  test('deve exibir empty state quando não há períodos', async ({ page }) => {
    await page.goto('/planejamento/planejamentos');

    await expect(page.locator('text=Nenhum Plano de Aula disponível ainda')).toBeVisible();
    await expect(
      page.locator('text=A coordenação ainda não configurou os períodos')
    ).toBeVisible();
  });

  test('deve exibir lista de períodos disponíveis', async ({ page }) => {
    // Assumindo que coordenadora já criou períodos
    await page.goto('/planejamento/planejamentos');

    await expect(page.locator('text=1º Plano de Aula')).toBeVisible();
    await expect(page.locator('text=Iniciar Plano de Aula')).toBeVisible();
  });

  test('deve navegar para plano ao clicar em "Iniciar"', async ({ page }) => {
    await page.goto('/planejamento/planejamentos');

    await page.click('text=Iniciar Plano de Aula');

    await expect(page).toHaveURL(/\/plano-aula\/[a-f0-9-]+/);
  });
});
```

**Step 2: Commit**

```bash
git add apps/planejamento/e2e/periodos-professora.spec.ts
git commit -m "test(e2e): fluxo da professora com períodos

Testa empty state e listagem de períodos

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Fase 10: Verificação Final e Lint

### Task 33: Rodar Lint e TypeCheck

**Files:**
- N/A (comando)

**Step 1: Executar verificação**

```bash
cd /var/www/essencia
pnpm turbo lint && pnpm turbo typecheck
```

Expected:
- Todos os lints passando
- TypeScript sem erros

**Step 2: Corrigir erros se houver**

Se houver erros, corrigir e commitar:

```bash
git add .
git commit -m "fix: corrigir erros de lint e typecheck

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 34: Rodar Todos os Testes

**Files:**
- N/A (comando)

**Step 1: Executar testes**

```bash
pnpm turbo test
```

Expected: Todos os testes passando

**Step 2: Verificar cobertura**

```bash
pnpm turbo test -- --coverage
```

**Step 3: Commit se houver ajustes**

```bash
git add .
git commit -m "test: garantir 100% dos testes passando

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Conclusão do Plano

**Plano completo e salvo em:** `docs/plans/2026-01-26-refatoracao-plano-aula-periodos-implementation.md`

---

## Duas Opções de Execução

### Opção 1: Subagent-Driven (Nesta Sessão)

**REQUIRED SUB-SKILL:** `superpowers:subagent-driven-development`

- Eu disparo um subagent fresco para cada task
- Você revisa entre tasks
- Iteração rápida
- Você mantém controle total

### Opção 2: Parallel Session (Sessão Separada)

**REQUIRED SUB-SKILL:** `superpowers:executing-plans` (nova sessão)

- Abrir nova sessão no worktree
- Execução em lote com checkpoints humanos
- Menos interrupções
- Revisão em blocos

**Qual abordagem você prefere?**
