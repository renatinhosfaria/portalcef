# Melhorias do Módulo de Tarefas — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir 7 pendências do módulo de tarefas em 4 PRs independentes: seletor de responsável com autocomplete, histórico completo com timeline, filtros avançados com paginação e WebSocket para notificações em tempo real.

**Architecture:** PR 1 extrai formulário compartilhado e adiciona Combobox com busca de usuários filtrada por role. PR 2 cria tabela `tarefa_historico` e grava auditoria dentro das transações existentes. PR 3 expõe filtros da API na UI com painel colapsável e paginação visual. PR 4 instala WebSocket via socket.io no NestJS+Fastify e substitui o polling no frontend.

**Tech Stack:** NestJS 10 + Fastify, Drizzle ORM, Next.js 15 App Router, socket.io 4, shadcn/ui (Combobox, Collapsible), date-fns, Zod, pnpm workspaces + Turborepo.

**Verificação de qualidade:** Sempre executar `pnpm turbo lint && pnpm turbo typecheck` antes de cada commit.

---

## PR 1 — UX Forms: Seletor de Responsável + Formulário Unificado

### Task 1: Backend — busca de usuários por nome e roles

**Files:**
- Modify: `services/api/src/modules/users/users.service.ts`
- Modify: `services/api/src/modules/users/users.controller.ts`

**Step 1: Escrever o teste para o novo método de busca**

Crie o arquivo `services/api/src/modules/users/users.service.spec.ts` (se não existir) e adicione:

```typescript
describe('UsersService.buscarParaAtribuicao', () => {
  it('deve retornar usuários filtrados por busca e roles', async () => {
    // mock db.query.users.findMany retornando lista
    const resultado = await service.buscarParaAtribuicao({
      schoolId: 'school-uuid',
      busca: 'Maria',
      roles: ['professora', 'analista_pedagogico'],
    });
    expect(resultado).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: expect.stringMatching(/professora|analista_pedagogico/) }),
      ])
    );
  });

  it('deve retornar lista vazia se busca não encontrar nada', async () => {
    const resultado = await service.buscarParaAtribuicao({
      schoolId: 'school-uuid',
      busca: 'XxXxX',
      roles: ['professora'],
    });
    expect(resultado).toHaveLength(0);
  });
});
```

**Step 2: Rodar o teste para confirmar que falha**

```bash
cd /var/www/essencia
pnpm turbo test --filter=api -- --testPathPattern="users.service"
```
Esperado: FAIL — `buscarParaAtribuicao is not a function`

**Step 3: Implementar o método no UsersService**

Em `services/api/src/modules/users/users.service.ts`, adicionar após `findAllByTenant`:

```typescript
async buscarParaAtribuicao(params: {
  schoolId: string;
  busca?: string;
  roles?: string[];
}): Promise<{ id: string; nome: string; role: string }[]> {
  const db = getDb();

  const conditions = [eq(usersTable.schoolId, params.schoolId)];

  const resultado = await db.query.users.findMany({
    columns: { id: true, name: true, role: true },
    where: and(...conditions),
    orderBy: [asc(usersTable.name)],
  });

  return resultado
    .filter((u) => {
      const matchRole = !params.roles?.length || params.roles.includes(u.role);
      const matchBusca = !params.busca ||
        u.name.toLowerCase().includes(params.busca.toLowerCase());
      return matchRole && matchBusca;
    })
    .map((u) => ({ id: u.id, nome: u.name, role: u.role }));
}
```

**Step 4: Rodar teste para confirmar que passa**

```bash
pnpm turbo test --filter=api -- --testPathPattern="users.service"
```
Esperado: PASS

**Step 5: Adicionar endpoint GET /api/users/buscar no controller**

Em `services/api/src/modules/users/users.controller.ts`, antes do `@Get(':id')`:

```typescript
@Get('buscar')
@Roles(
  'master', 'diretora_geral', 'gerente_unidade', 'coordenadora_geral',
  'coordenadora_bercario', 'coordenadora_infantil', 'coordenadora_fundamental_i',
  'coordenadora_fundamental_ii', 'coordenadora_medio',
  'analista_pedagogico', 'professora', 'auxiliar_sala',
)
async buscarParaAtribuicao(
  @CurrentUser() currentUser: { userId: string; role: string; schoolId: string; unitId: string; stageId: string | null },
  @Query('busca') busca?: string,
  @Query('roles') rolesParam?: string,
) {
  if (!currentUser.schoolId) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Escola não encontrada' } };
  }
  const roles = rolesParam ? rolesParam.split(',') : undefined;
  const resultado = await this.usersService.buscarParaAtribuicao({
    schoolId: currentUser.schoolId,
    busca,
    roles,
  });
  return { success: true, data: resultado };
}
```

**Step 6: Verificar lint e tipos**

```bash
pnpm turbo lint --filter=api && pnpm turbo typecheck --filter=api
```
Esperado: sem erros

**Step 7: Commit**

```bash
git add services/api/src/modules/users/
git commit -m "feat(api): adicionar endpoint GET /users/buscar com filtro por nome e roles"
```

---

### Task 2: Frontend — hook useUsuariosBusca

**Files:**
- Create: `apps/tarefas/features/criar-tarefa/hooks/use-usuarios-busca.ts`

**Step 1: Criar o hook com debounce**

```typescript
// apps/tarefas/features/criar-tarefa/hooks/use-usuarios-busca.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api";

export interface UsuarioParaAtribuicao {
  id: string;
  nome: string;
  role: string;
}

const ROLES_ELEGIVEIS: Record<string, string[]> = {
  professora: ["professora"],
  auxiliar_sala: ["auxiliar_sala"],
  analista_pedagogico: ["professora", "auxiliar_sala", "analista_pedagogico"],
  coordenadora_bercario: ["professora", "auxiliar_sala", "analista_pedagogico", "coordenadora_bercario", "coordenadora_infantil", "coordenadora_fundamental_i", "coordenadora_fundamental_ii", "coordenadora_medio", "coordenadora_geral"],
  coordenadora_infantil: ["professora", "auxiliar_sala", "analista_pedagogico", "coordenadora_bercario", "coordenadora_infantil", "coordenadora_fundamental_i", "coordenadora_fundamental_ii", "coordenadora_medio", "coordenadora_geral"],
  coordenadora_fundamental_i: ["professora", "auxiliar_sala", "analista_pedagogico", "coordenadora_bercario", "coordenadora_infantil", "coordenadora_fundamental_i", "coordenadora_fundamental_ii", "coordenadora_medio", "coordenadora_geral"],
  coordenadora_fundamental_ii: ["professora", "auxiliar_sala", "analista_pedagogico", "coordenadora_bercario", "coordenadora_infantil", "coordenadora_fundamental_i", "coordenadora_fundamental_ii", "coordenadora_medio", "coordenadora_geral"],
  coordenadora_medio: ["professora", "auxiliar_sala", "analista_pedagogico", "coordenadora_bercario", "coordenadora_infantil", "coordenadora_fundamental_i", "coordenadora_fundamental_ii", "coordenadora_medio", "coordenadora_geral"],
  coordenadora_geral: ["professora", "auxiliar_sala", "analista_pedagogico", "coordenadora_bercario", "coordenadora_infantil", "coordenadora_fundamental_i", "coordenadora_fundamental_ii", "coordenadora_medio", "coordenadora_geral"],
  gerente_unidade: ["professora", "auxiliar_sala", "analista_pedagogico", "coordenadora_bercario", "coordenadora_infantil", "coordenadora_fundamental_i", "coordenadora_fundamental_ii", "coordenadora_medio", "coordenadora_geral", "gerente_unidade"],
  gerente_financeiro: ["professora", "auxiliar_sala", "analista_pedagogico", "coordenadora_bercario", "coordenadora_infantil", "coordenadora_fundamental_i", "coordenadora_fundamental_ii", "coordenadora_medio", "coordenadora_geral", "gerente_unidade", "gerente_financeiro"],
  diretora_geral: ["professora", "auxiliar_sala", "analista_pedagogico", "coordenadora_bercario", "coordenadora_infantil", "coordenadora_fundamental_i", "coordenadora_fundamental_ii", "coordenadora_medio", "coordenadora_geral", "gerente_unidade", "gerente_financeiro", "diretora_geral"],
  master: [],
};

export function getRolesElegiveis(roleAtual: string): string[] {
  return ROLES_ELEGIVEIS[roleAtual] ?? [];
}

export function useUsuariosBusca(roleAtual: string) {
  const [busca, setBusca] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioParaAtribuicao[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const buscarUsuarios = useCallback(async (termo: string) => {
    setIsLoading(true);
    try {
      const roles = getRolesElegiveis(roleAtual);
      const rolesParam = roles.length ? `&roles=${roles.join(",")}` : "";
      const data = await apiGet<{ data: UsuarioParaAtribuicao[] }>(
        `users/buscar?busca=${encodeURIComponent(termo)}${rolesParam}`
      );
      setUsuarios(data.data);
    } catch {
      setUsuarios([]);
    } finally {
      setIsLoading(false);
    }
  }, [roleAtual]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void buscarUsuarios(busca);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, buscarUsuarios]);

  return { busca, setBusca, usuarios, isLoading };
}
```

**Step 2: Verificar tipos**

```bash
pnpm turbo typecheck --filter=tarefas
```
Esperado: sem erros

**Step 3: Commit**

```bash
git add apps/tarefas/features/criar-tarefa/hooks/use-usuarios-busca.ts
git commit -m "feat(tarefas): adicionar hook useUsuariosBusca com debounce e filtro por role"
```

---

### Task 3: Frontend — extrair TarefaFormFields compartilhado

**Files:**
- Create: `apps/tarefas/features/criar-tarefa/components/tarefa-form-fields.tsx`
- Modify: `apps/tarefas/app/criar/criar-form.tsx`
- Modify: `apps/tarefas/app/tarefa-form.tsx`

**Step 1: Criar componente TarefaFormFields**

```typescript
// apps/tarefas/features/criar-tarefa/components/tarefa-form-fields.tsx
"use client";

import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@essencia/ui/components/select";
import { Textarea } from "@essencia/ui/components/textarea";
import { Button } from "@essencia/ui/components/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
} from "@essencia/ui/components/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@essencia/ui/components/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@essencia/ui/lib/utils";
import { useState } from "react";
import { useUsuariosBusca } from "../hooks/use-usuarios-busca";

const ROLE_LABELS: Record<string, string> = {
  professora: "Professora",
  auxiliar_sala: "Auxiliar de Sala",
  analista_pedagogico: "Analista Pedagógica",
  coordenadora_bercario: "Coord. Berçário",
  coordenadora_infantil: "Coord. Infantil",
  coordenadora_fundamental_i: "Coord. Fund. I",
  coordenadora_fundamental_ii: "Coord. Fund. II",
  coordenadora_medio: "Coord. Médio",
  coordenadora_geral: "Coord. Geral",
  gerente_unidade: "Gerente de Unidade",
  diretora_geral: "Diretora Geral",
};

export interface TarefaFormData {
  titulo: string;
  descricao: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  prazo: string;
  responsavel: string;
  responsavelNome?: string;
  quinzenaId: string;
}

interface TarefaFormFieldsProps {
  data: TarefaFormData;
  onChange: (field: keyof TarefaFormData, value: string) => void;
  roleAtual: string;
  userIdAtual: string;
  bloqueadoProfessora?: boolean;
}

export function TarefaFormFields({
  data,
  onChange,
  roleAtual,
  userIdAtual,
  bloqueadoProfessora = false,
}: TarefaFormFieldsProps) {
  const [open, setOpen] = useState(false);
  const { busca, setBusca, usuarios, isLoading } = useUsuariosBusca(roleAtual);

  const responsavelSelecionado = usuarios.find((u) => u.id === data.responsavel);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="titulo">Título *</Label>
        <Input
          id="titulo"
          value={data.titulo}
          onChange={(e) => onChange("titulo", e.target.value)}
          placeholder="Ex: Revisar plano da Turma Infantil II"
          required
        />
      </div>

      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          value={data.descricao}
          onChange={(e) => onChange("descricao", e.target.value)}
          placeholder="Detalhes adicionais sobre a tarefa"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="prioridade">Prioridade *</Label>
        <Select value={data.prioridade} onValueChange={(v) => onChange("prioridade", v)}>
          <SelectTrigger id="prioridade">
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
          value={data.prazo}
          onChange={(e) => onChange("prazo", e.target.value)}
          required
        />
      </div>

      <div>
        <Label>Responsável *</Label>
        {bloqueadoProfessora ? (
          <Input value={data.responsavelNome ?? "Você"} disabled />
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                {responsavelSelecionado
                  ? `${responsavelSelecionado.nome} — ${ROLE_LABELS[responsavelSelecionado.role] ?? responsavelSelecionado.role}`
                  : "Buscar responsável..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Digite o nome..."
                  value={busca}
                  onValueChange={setBusca}
                />
                <CommandEmpty>
                  {isLoading ? "Buscando..." : "Nenhum usuário encontrado"}
                </CommandEmpty>
                <CommandGroup>
                  {usuarios.map((usuario) => (
                    <CommandItem
                      key={usuario.id}
                      value={usuario.id}
                      onSelect={() => {
                        onChange("responsavel", usuario.id);
                        onChange("responsavelNome", usuario.nome);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          data.responsavel === usuario.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div>
                        <span className="font-medium">{usuario.nome}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {ROLE_LABELS[usuario.role] ?? usuario.role}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div>
        <Label htmlFor="quinzenaId">ID da Quinzena</Label>
        <Input
          id="quinzenaId"
          value={data.quinzenaId}
          onChange={(e) => onChange("quinzenaId", e.target.value)}
          placeholder="Quinzena (opcional)"
        />
      </div>
    </div>
  );
}
```

**Step 2: Atualizar criar-form.tsx para usar TarefaFormFields**

Substituir o conteúdo de `apps/tarefas/app/criar/criar-form.tsx`:

```typescript
"use client";

import { Button } from "@essencia/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@essencia/ui/components/card";
import { useState } from "react";
import { useCriarTarefa } from "@/features/criar-tarefa/hooks/use-criar-tarefa";
import {
  TarefaFormFields,
  type TarefaFormData,
} from "@/features/criar-tarefa/components/tarefa-form-fields";

// TODO: obter session do usuário atual (roleAtual, userIdAtual)
const ROLE_ATUAL = "analista_pedagogico";
const USER_ID_ATUAL = "";

export function CriarTarefaForm() {
  const { criar, isLoading, error } = useCriarTarefa();
  const [formData, setFormData] = useState<TarefaFormData>({
    titulo: "",
    descricao: "",
    prioridade: "MEDIA",
    prazo: "",
    responsavel: ROLE_ATUAL === "professora" ? USER_ID_ATUAL : "",
    quinzenaId: "",
  });

  const handleChange = (field: keyof TarefaFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await criar({
        titulo: formData.titulo,
        descricao: formData.descricao,
        prioridade: formData.prioridade,
        prazo: new Date(formData.prazo).toISOString(),
        responsavel: formData.responsavel,
        contextos: formData.quinzenaId
          ? [{ modulo: "PLANEJAMENTO" as const, quinzenaId: formData.quinzenaId }]
          : [],
      });
    } catch (err) {
      console.error("Erro ao criar tarefa:", err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Tarefa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TarefaFormFields
            data={formData}
            onChange={handleChange}
            roleAtual={ROLE_ATUAL}
            userIdAtual={USER_ID_ATUAL}
            bloqueadoProfessora={ROLE_ATUAL === "professora"}
          />
          {error && (
            <div className="text-sm text-destructive">
              Erro: {error.message}
            </div>
          )}
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

**Step 3: Verificar tipos e lint**

```bash
pnpm turbo lint --filter=tarefas && pnpm turbo typecheck --filter=tarefas
```
Esperado: sem erros

**Step 4: Commit**

```bash
git add apps/tarefas/features/criar-tarefa/components/tarefa-form-fields.tsx
git add apps/tarefas/app/criar/criar-form.tsx
git commit -m "feat(tarefas): extrair TarefaFormFields compartilhado com Combobox de responsável"
```

---

## PR 2 — Histórico + Timeline

### Task 4: Database — migration e schema tarefa_historico

**Files:**
- Create: `packages/db/drizzle/XXXX_add_tarefa_historico.sql`
- Modify: `packages/db/src/schema/tarefas.ts`

**Step 1: Descobrir o próximo número de migration**

```bash
ls /var/www/essencia/packages/db/drizzle/*.sql | sort | tail -5
```
Use o próximo número sequencial (ex: se o maior for 0022, use 0023).

**Step 2: Criar migration SQL**

Crie `packages/db/drizzle/XXXX_add_tarefa_historico.sql`:

```sql
-- Migration: XXXX_add_tarefa_historico.sql
-- Adiciona tabela de histórico de ações em tarefas

CREATE TABLE IF NOT EXISTS "tarefa_historico" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tarefa_id"      UUID NOT NULL,
  "user_id"        UUID NOT NULL,
  "user_name"      TEXT NOT NULL,
  "user_role"      TEXT NOT NULL,
  "acao"           TEXT NOT NULL,
  "campo_alterado" TEXT,
  "valor_anterior" TEXT,
  "valor_novo"     TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "fk_tarefa_historico_tarefa"
    FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_tarefa_historico_user"
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "chk_tarefa_historico_acao"
    CHECK ("acao" IN ('CRIADA', 'EDITADA', 'CONCLUIDA', 'CANCELADA'))
);

CREATE INDEX IF NOT EXISTS "idx_tarefa_historico_tarefa_id"
  ON "tarefa_historico"("tarefa_id");
CREATE INDEX IF NOT EXISTS "idx_tarefa_historico_created_at"
  ON "tarefa_historico"("created_at" DESC);
```

**Step 3: Adicionar schema Drizzle ao arquivo tarefas.ts**

Em `packages/db/src/schema/tarefas.ts`, adicionar ao final (antes dos exports Zod):

```typescript
// ============================================
// Table: tarefa_historico
// ============================================
export const tarefaAcaoEnum = ["CRIADA", "EDITADA", "CONCLUIDA", "CANCELADA"] as const;
export type TarefaAcao = (typeof tarefaAcaoEnum)[number];

export const tarefaHistorico = pgTable(
  "tarefa_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tarefaId: uuid("tarefa_id")
      .notNull()
      .references(() => tarefas.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    userName: text("user_name").notNull(),
    userRole: text("user_role").notNull(),
    acao: text("acao", { enum: tarefaAcaoEnum }).notNull(),
    campoAlterado: text("campo_alterado"),
    valorAnterior: text("valor_anterior"),
    valorNovo: text("valor_novo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tarefaIdIdx: index("idx_tarefa_historico_tarefa_id").on(table.tarefaId),
    createdAtIdx: index("idx_tarefa_historico_created_at").on(table.createdAt),
  }),
);

export type TarefaHistorico = typeof tarefaHistorico.$inferSelect;
export type NewTarefaHistorico = typeof tarefaHistorico.$inferInsert;

export const tarefaHistoricoRelations = relations(tarefaHistorico, ({ one }) => ({
  tarefa: one(tarefas, {
    fields: [tarefaHistorico.tarefaId],
    references: [tarefas.id],
  }),
  user: one(users, {
    fields: [tarefaHistorico.userId],
    references: [users.id],
  }),
}));
```

Também adicionar `many(tarefaHistorico)` nas relações de `tarefas`:
```typescript
// Em tarefasRelations, adicionar:
historico: many(tarefaHistorico),
```

**Step 4: Exportar do index do schema**

Em `packages/db/src/schema/index.ts`, garantir que `tarefaHistorico` seja exportado (se o arquivo importa de `tarefas.ts`, já estará incluído automaticamente).

**Step 5: Aplicar migration em desenvolvimento**

```bash
cd /var/www/essencia
pnpm db:migrate
```
Esperado: migration aplicada sem erros

**Step 6: Verificar tipos do pacote db**

```bash
pnpm turbo typecheck --filter=@essencia/db
```
Esperado: sem erros

**Step 7: Commit**

```bash
git add packages/db/drizzle/XXXX_add_tarefa_historico.sql
git add packages/db/src/schema/tarefas.ts
git commit -m "feat(db): adicionar tabela tarefa_historico com schema Drizzle e relações"
```

---

### Task 5: Backend — TarefaHistoricoService

**Files:**
- Create: `services/api/src/modules/tarefas/tarefa-historico.service.ts`
- Modify: `services/api/src/modules/tarefas/tarefas.service.ts`
- Modify: `services/api/src/modules/tarefas/tarefas.module.ts`
- Modify: `services/api/src/modules/tarefas/tarefas.controller.ts`

**Step 1: Escrever teste para TarefaHistoricoService**

Crie `services/api/src/modules/tarefas/tarefa-historico.service.spec.ts`:

```typescript
describe('TarefaHistoricoService', () => {
  it('deve inserir registro de histórico na transação', async () => {
    const txMock = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      }),
    };

    await service.registrar(txMock as any, {
      tarefaId: 'tarefa-uuid',
      userId: 'user-uuid',
      userName: 'Maria',
      userRole: 'professora',
      acao: 'CONCLUIDA',
    });

    expect(txMock.insert).toHaveBeenCalled();
  });

  it('não deve lançar exceção em caso de falha (silent fail)', async () => {
    const txMock = {
      insert: jest.fn().mockImplementation(() => {
        throw new Error('DB error');
      }),
    };

    await expect(
      service.registrar(txMock as any, {
        tarefaId: 'tarefa-uuid',
        userId: 'user-uuid',
        userName: 'Maria',
        userRole: 'professora',
        acao: 'CRIADA',
      })
    ).resolves.not.toThrow();
  });
});
```

**Step 2: Rodar o teste para confirmar que falha**

```bash
pnpm turbo test --filter=api -- --testPathPattern="tarefa-historico"
```
Esperado: FAIL — `service is not defined`

**Step 3: Implementar TarefaHistoricoService**

```typescript
// services/api/src/modules/tarefas/tarefa-historico.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { tarefaHistorico } from "@essencia/db";
import type { TarefaAcao } from "@essencia/db";

export interface RegistrarHistoricoParams {
  tarefaId: string;
  userId: string;
  userName: string;
  userRole: string;
  acao: TarefaAcao;
  campoAlterado?: string;
  valorAnterior?: string;
  valorNovo?: string;
}

@Injectable()
export class TarefaHistoricoService {
  private readonly logger = new Logger(TarefaHistoricoService.name);

  async registrar(tx: any, params: RegistrarHistoricoParams): Promise<void> {
    try {
      await tx.insert(tarefaHistorico).values({
        tarefaId: params.tarefaId,
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        acao: params.acao,
        campoAlterado: params.campoAlterado ?? null,
        valorAnterior: params.valorAnterior ?? null,
        valorNovo: params.valorNovo ?? null,
      });
    } catch (err) {
      // Falha silenciosa — histórico não deve interromper operação principal
      this.logger.error(`Falha ao registrar histórico para tarefa ${params.tarefaId}`, err);
    }
  }
}
```

**Step 4: Rodar o teste para confirmar que passa**

```bash
pnpm turbo test --filter=api -- --testPathPattern="tarefa-historico"
```
Esperado: PASS

**Step 5: Injetar TarefaHistoricoService no TarefasService**

Em `services/api/src/modules/tarefas/tarefas.service.ts`:

```typescript
// Adicionar import
import { TarefaHistoricoService } from "./tarefa-historico.service";

// Adicionar ao constructor
constructor(
  private readonly db: DatabaseService,
  private readonly historicoService: TarefaHistoricoService, // NOVO
) {}
```

Nos métodos do service, dentro das transações existentes, adicionar chamadas ao historico após cada operação bem-sucedida. Exemplos:

Em `create()`, após inserir a tarefa:
```typescript
await this.historicoService.registrar(tx, {
  tarefaId: tarefaCriada.id,
  userId: params.criadoPor,
  userName: "Sistema", // criarAutomatica não tem userName; para criarManual, passar da session
  userRole: "sistema",
  acao: "CRIADA",
});
```

> **Nota:** Para `criarManual`, passar `session.userName` e `session.role`. Adicionar `userName` ao `UserContext` se ainda não existir.

Em `atualizar()`, para cada campo alterado:
```typescript
const camposAlterados: Array<{ campo: string; anterior: string; novo: string }> = [];
if (dto.titulo !== undefined && dto.titulo !== tarefaDb.titulo) {
  camposAlterados.push({ campo: "titulo", anterior: tarefaDb.titulo, novo: dto.titulo });
}
// ... repetir para descricao, prioridade, prazo, responsavel

// Após atualizar, dentro de uma transação:
for (const c of camposAlterados) {
  await this.historicoService.registrar(tx, {
    tarefaId: id, userId, userName: "...", userRole: "...",
    acao: "EDITADA", campoAlterado: c.campo,
    valorAnterior: c.anterior, valorNovo: c.novo,
  });
}
```

Em `concluir()`, após atualizar:
```typescript
await this.historicoService.registrar(tx, {
  tarefaId: tarefaId, userId, userName: "...", userRole: "...", acao: "CONCLUIDA",
});
```

Em `cancelar()`, após atualizar (wrappear em transação se ainda não estiver):
```typescript
await this.historicoService.registrar(tx, {
  tarefaId: tarefaId, userId, userName: "...", userRole: "...", acao: "CANCELADA",
});
```

> **Atenção:** `cancelar()` atualmente não usa transação. Wrappear em `db.transaction()` antes de adicionar o histórico.

**Step 6: Adicionar endpoint GET /tarefas/:id/historico**

Em `tarefas.controller.ts`, após o endpoint `GET :id`:

```typescript
@Get(":id/historico")
@Roles(...VISUALIZAR_ACCESS)
@UseGuards(TarefaAccessGuard)
async getHistorico(@Param("id") id: string) {
  const historico = await this.tarefasService.getHistorico(id);
  return { success: true, data: historico };
}
```

Em `tarefas.service.ts`, adicionar método:

```typescript
async getHistorico(tarefaId: string) {
  const db = this.db.db;
  return await db.query.tarefaHistorico.findMany({
    where: eq(tarefaHistorico.tarefaId, tarefaId),
    orderBy: [desc(tarefaHistorico.createdAt)],
  });
}
```

**Step 7: Registrar no módulo**

Em `services/api/src/modules/tarefas/tarefas.module.ts`, adicionar `TarefaHistoricoService` ao array `providers`.

**Step 8: Verificar lint e tipos**

```bash
pnpm turbo lint --filter=api && pnpm turbo typecheck --filter=api
```

**Step 9: Commit**

```bash
git add services/api/src/modules/tarefas/
git commit -m "feat(api): adicionar TarefaHistoricoService e endpoint GET /tarefas/:id/historico"
```

---

### Task 6: Frontend — hook e componente HistoricoTimeline

**Files:**
- Create: `apps/tarefas/features/tarefa-detalhe/hooks/use-historico-tarefa.ts`
- Create: `apps/tarefas/features/tarefa-detalhe/components/tarefa-historico-timeline.tsx`
- Modify: `apps/tarefas/app/[id]/tarefa-detalhe-content.tsx`

**Step 1: Criar hook useHistoricoTarefa**

```typescript
// apps/tarefas/features/tarefa-detalhe/hooks/use-historico-tarefa.ts
"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";

export interface HistoricoTarefaEntry {
  id: string;
  tarefaId: string;
  userId: string;
  userName: string;
  userRole: string;
  acao: "CRIADA" | "EDITADA" | "CONCLUIDA" | "CANCELADA";
  campoAlterado: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
  createdAt: string;
}

export function useHistoricoTarefa(tarefaId: string) {
  const [historico, setHistorico] = useState<HistoricoTarefaEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistorico = async () => {
      try {
        const data = await apiGet<{ data: HistoricoTarefaEntry[] }>(
          `tarefas/${tarefaId}/historico`
        );
        setHistorico(data.data);
      } catch {
        setHistorico([]);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchHistorico();
  }, [tarefaId]);

  return { historico, isLoading };
}
```

**Step 2: Criar componente TarefaHistoricoTimeline**

```typescript
// apps/tarefas/features/tarefa-detalhe/components/tarefa-historico-timeline.tsx
"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, Edit, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { cn } from "@essencia/ui/lib/utils";
import { useHistoricoTarefa, type HistoricoTarefaEntry } from "../hooks/use-historico-tarefa";

const CAMPO_LABELS: Record<string, string> = {
  titulo: "Título",
  descricao: "Descrição",
  prioridade: "Prioridade",
  prazo: "Prazo",
  responsavel: "Responsável",
};

function getAcaoIcon(acao: HistoricoTarefaEntry["acao"]) {
  switch (acao) {
    case "CRIADA":    return <Plus className="h-4 w-4" />;
    case "EDITADA":   return <Edit className="h-4 w-4" />;
    case "CONCLUIDA": return <CheckCheck className="h-4 w-4" />;
    case "CANCELADA": return <X className="h-4 w-4" />;
  }
}

function getAcaoColor(acao: HistoricoTarefaEntry["acao"]): string {
  switch (acao) {
    case "CRIADA":    return "bg-blue-100 text-blue-600";
    case "EDITADA":   return "bg-yellow-100 text-yellow-600";
    case "CONCLUIDA": return "bg-green-100 text-green-600";
    case "CANCELADA": return "bg-red-100 text-red-600";
  }
}

function getAcaoLabel(entry: HistoricoTarefaEntry): string {
  if (entry.acao === "EDITADA" && entry.campoAlterado) {
    return `${CAMPO_LABELS[entry.campoAlterado] ?? entry.campoAlterado} alterado`;
  }
  const labels: Record<string, string> = {
    CRIADA: "Tarefa criada",
    CONCLUIDA: "Tarefa concluída",
    CANCELADA: "Tarefa cancelada",
  };
  return labels[entry.acao] ?? entry.acao;
}

const ROLE_LABELS: Record<string, string> = {
  professora: "Professora",
  analista_pedagogico: "Analista Pedagógica",
  coordenadora_geral: "Coord. Geral",
  gerente_unidade: "Gerente de Unidade",
  diretora_geral: "Diretora Geral",
  master: "Master",
  sistema: "Sistema",
};

function TimelineItem({ entry }: { entry: HistoricoTarefaEntry }) {
  return (
    <div className="relative flex gap-4">
      <div className={cn(
        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        getAcaoColor(entry.acao),
      )}>
        {getAcaoIcon(entry.acao)}
      </div>
      <div className="flex-1 space-y-1 pb-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{getAcaoLabel(entry)}</p>
          <time className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: ptBR })}
          </time>
        </div>
        <p className="text-sm text-muted-foreground">
          Por <span className="font-medium">{entry.userName}</span>{" "}
          ({ROLE_LABELS[entry.userRole] ?? entry.userRole})
        </p>
        {entry.acao === "EDITADA" && entry.valorAnterior != null && entry.valorNovo != null && (
          <p className="text-xs text-muted-foreground">
            <span className="line-through">{entry.valorAnterior}</span>
            {" → "}
            <span className="font-medium">{entry.valorNovo}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function TarefaHistoricoTimeline({ tarefaId }: { tarefaId: string }) {
  const { historico, isLoading } = useHistoricoTarefa(tarefaId);

  if (isLoading) return <Skeleton className="h-48" />;

  if (historico.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">Nenhuma ação registrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          {historico.map((entry) => (
            <TimelineItem key={entry.id} entry={entry} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Incluir timeline na tela de detalhe**

Em `apps/tarefas/app/[id]/tarefa-detalhe-content.tsx`, adicionar ao final do JSX:

```typescript
import { TarefaHistoricoTimeline } from "@/features/tarefa-detalhe/components/tarefa-historico-timeline";

// Dentro do return, após o card principal:
<TarefaHistoricoTimeline tarefaId={tarefa.id} />
```

**Step 4: Verificar lint e tipos**

```bash
pnpm turbo lint --filter=tarefas && pnpm turbo typecheck --filter=tarefas
```

**Step 5: Commit**

```bash
git add apps/tarefas/features/tarefa-detalhe/
git add apps/tarefas/app/[id]/tarefa-detalhe-content.tsx
git commit -m "feat(tarefas): adicionar TarefaHistoricoTimeline na tela de detalhe"
```

---

## PR 3 — Filtros Avançados & Paginação

### Task 7: Frontend — componente TarefasPaginacao

**Files:**
- Create: `apps/tarefas/features/tarefas-list/components/tarefas-paginacao.tsx`

**Step 1: Criar componente de paginação**

```typescript
// apps/tarefas/features/tarefas-list/components/tarefas-paginacao.tsx
"use client";

import { Button } from "@essencia/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@essencia/ui/lib/utils";

interface TarefasPaginacaoProps {
  paginaAtual: number;
  totalPaginas: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

function gerarPaginas(atual: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas: (number | "...")[] = [1];

  if (atual > 3) paginas.push("...");

  const inicio = Math.max(2, atual - 1);
  const fim = Math.min(total - 1, atual + 1);

  for (let i = inicio; i <= fim; i++) paginas.push(i);

  if (atual < total - 2) paginas.push("...");
  paginas.push(total);

  return paginas;
}

export function TarefasPaginacao({
  paginaAtual, totalPaginas, total, limit, onPageChange,
}: TarefasPaginacaoProps) {
  if (totalPaginas <= 1) return null;

  const inicio = (paginaAtual - 1) * limit + 1;
  const fim = Math.min(paginaAtual * limit, total);
  const paginas = gerarPaginas(paginaAtual, totalPaginas);

  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(paginaAtual - 1)}
          disabled={paginaAtual === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>

        {paginas.map((p, idx) =>
          p === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
          ) : (
            <Button
              key={p}
              variant={p === paginaAtual ? "default" : "outline"}
              size="sm"
              className="w-8 p-0"
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(paginaAtual + 1)}
          disabled={paginaAtual === totalPaginas}
        >
          Próximo
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Mostrando {inicio}–{fim} de {total} tarefas
      </p>
    </div>
  );
}
```

**Step 2: Verificar tipos**

```bash
pnpm turbo typecheck --filter=tarefas
```

**Step 3: Commit**

```bash
git add apps/tarefas/features/tarefas-list/components/tarefas-paginacao.tsx
git commit -m "feat(tarefas): adicionar componente TarefasPaginacao com ellipsis"
```

---

### Task 8: Frontend — painel de filtros e integração com useTarefas

**Files:**
- Create: `apps/tarefas/features/tarefas-list/components/tarefas-filtros.tsx`
- Modify: `apps/tarefas/features/tarefas-list/hooks/use-tarefas.ts`
- Modify: `apps/tarefas/app/dashboard-content.tsx`

**Step 1: Criar componente TarefasFiltros**

```typescript
// apps/tarefas/features/tarefas-list/components/tarefas-filtros.tsx
"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@essencia/ui/components/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@essencia/ui/components/collapsible";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

export interface FiltrosAtivos {
  status?: "PENDENTE" | "CONCLUIDA" | "CANCELADA";
  prioridade?: "ALTA" | "MEDIA" | "BAIXA";
  modulo?: "PLANEJAMENTO" | "CALENDARIO" | "USUARIOS" | "TURMAS" | "LOJA";
}

interface TarefasFiltrosProps {
  filtros: FiltrosAtivos;
  onChange: (filtros: FiltrosAtivos) => void;
}

export function TarefasFiltros({ filtros, onChange }: TarefasFiltrosProps) {
  const [aberto, setAberto] = useState(false);

  const quantidadeAtiva = Object.values(filtros).filter(Boolean).length;

  const handleChange = (campo: keyof FiltrosAtivos, valor: string | undefined) => {
    onChange({ ...filtros, [campo]: valor || undefined });
  };

  const limpar = () => onChange({});

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filtros{quantidadeAtiva > 0 ? ` (${quantidadeAtiva})` : ""}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-wrap gap-4 pt-4 pb-2 border-t mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">Status</span>
            <Select
              value={filtros.status ?? ""}
              onValueChange={(v) => handleChange("status", v)}
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">Prioridade</span>
            <Select
              value={filtros.prioridade ?? ""}
              onValueChange={(v) => handleChange("prioridade", v)}
            >
              <SelectTrigger className="w-36 h-8">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                <SelectItem value="ALTA">Alta</SelectItem>
                <SelectItem value="MEDIA">Média</SelectItem>
                <SelectItem value="BAIXA">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">Módulo</span>
            <Select
              value={filtros.modulo ?? ""}
              onValueChange={(v) => handleChange("modulo", v)}
            >
              <SelectTrigger className="w-44 h-8">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="PLANEJAMENTO">Planejamento</SelectItem>
                <SelectItem value="CALENDARIO">Calendário</SelectItem>
                <SelectItem value="USUARIOS">Usuários</SelectItem>
                <SelectItem value="TURMAS">Turmas</SelectItem>
                <SelectItem value="LOJA">Loja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {quantidadeAtiva > 0 && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={limpar}>
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

**Step 2: Atualizar useTarefas para suportar page e paginação**

Em `apps/tarefas/features/tarefas-list/hooks/use-tarefas.ts`, adicionar `page` e `limit` nos params e retornar `paginacao`:

```typescript
export interface UseTarefasParams {
  status?: TarefaStatus;
  prioridade?: TarefaPrioridade;
  modulo?: string;
  quinzenaId?: string;
  tipo?: "criadas" | "atribuidas" | "todas";
  page?: number;
  limit?: number;
}

export interface Paginacao {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// No hook, trocar o fetch:
const response = await apiGet<{ data: TarefaEnriquecida[]; pagination: Paginacao }>(
  `tarefas?${queryParams.toString()}`,
);
setTarefas(response.data);
setPaginacao(response.pagination); // novo estado

// Adicionar ao params:
if (params.page) queryParams.append("page", String(params.page));
if (params.limit) queryParams.append("limit", String(params.limit));

// Retornar:
return { tarefas, stats, paginacao, isLoading, error, refetch: fetchTarefas, concluir };
```

**Step 3: Atualizar DashboardContent**

Em `apps/tarefas/app/dashboard-content.tsx`:

```typescript
"use client";

import { Button } from "@essencia/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@essencia/ui/components/card";
import { useState } from "react";
import { TarefasGrid } from "@/features/tarefas-list/components/tarefas-grid";
import { TarefasFiltros, type FiltrosAtivos } from "@/features/tarefas-list/components/tarefas-filtros";
import { TarefasPaginacao } from "@/features/tarefas-list/components/tarefas-paginacao";
import { useTarefas } from "@/features/tarefas-list/hooks/use-tarefas";

type TipoFiltro = "atribuidas" | "criadas" | "todas";

export function DashboardContent() {
  const [tipo, setTipo] = useState<TipoFiltro>("todas");
  const [filtros, setFiltros] = useState<FiltrosAtivos>({});
  const [page, setPage] = useState(1);

  const { tarefas, stats, paginacao, isLoading, concluir } = useTarefas({
    tipo,
    page,
    limit: 20,
    ...filtros,
  });

  const handleFiltrosChange = (novosFiltros: FiltrosAtivos) => {
    setFiltros(novosFiltros);
    setPage(1); // resetar página ao filtrar
  };

  const handleTipoChange = (novoTipo: TipoFiltro) => {
    setTipo(novoTipo);
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendentes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Atrasadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.atrasadas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.concluidas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próximas a Vencer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.proximasVencer}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={tipo === "todas" ? "default" : "outline"} size="sm" onClick={() => handleTipoChange("todas")}>Todas</Button>
          <Button variant={tipo === "atribuidas" ? "default" : "outline"} size="sm" onClick={() => handleTipoChange("atribuidas")}>Minhas Tarefas</Button>
          <Button variant={tipo === "criadas" ? "default" : "outline"} size="sm" onClick={() => handleTipoChange("criadas")}>Criadas por Mim</Button>
          <div className="ml-auto">
            <TarefasFiltros filtros={filtros} onChange={handleFiltrosChange} />
          </div>
        </div>
      </div>

      {/* Grid */}
      <TarefasGrid tarefas={tarefas} onConcluir={concluir} />

      {/* Paginação */}
      {paginacao && (
        <TarefasPaginacao
          paginaAtual={paginacao.page}
          totalPaginas={paginacao.totalPages}
          total={paginacao.total}
          limit={paginacao.limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
```

**Step 4: Verificar lint e tipos**

```bash
pnpm turbo lint --filter=tarefas && pnpm turbo typecheck --filter=tarefas
```

**Step 5: Commit**

```bash
git add apps/tarefas/features/tarefas-list/
git add apps/tarefas/app/dashboard-content.tsx
git commit -m "feat(tarefas): adicionar filtros avançados e paginação no dashboard"
```

---

## PR 4 — WebSocket para Notificações em Tempo Real

### Task 9: Backend — instalar dependências e configurar socket.io

**Files:**
- Modify: `services/api/package.json`
- Modify: `services/api/src/main.ts`

**Step 1: Instalar dependências**

```bash
cd /var/www/essencia
pnpm add --filter=api @nestjs/websockets @nestjs/platform-socket.io socket.io
```

**Step 2: Configurar socket.io adapter no main.ts**

> **Atenção:** NestJS com Fastify usa um adapter próprio para WebSocket. O socket.io não funciona com o adapter Fastify nativo — é necessário usar um servidor HTTP separado para o WS ou configurar via `IoAdapter`.

Em `services/api/src/main.ts`, adicionar após criar o app:

```typescript
import { IoAdapter } from "@nestjs/platform-socket.io";

// Após NestFactory.create:
app.useWebSocketAdapter(new IoAdapter(app));
```

**Step 3: Verificar tipos da API**

```bash
pnpm turbo typecheck --filter=api
```

**Step 4: Commit**

```bash
git add services/api/package.json services/api/src/main.ts
git commit -m "feat(api): instalar socket.io e configurar IoAdapter para WebSocket"
```

---

### Task 10: Backend — TarefasGateway

**Files:**
- Create: `services/api/src/modules/tarefas/tarefas.gateway.ts`
- Modify: `services/api/src/modules/tarefas/tarefas.module.ts`
- Modify: `services/api/src/modules/tarefas/tarefas.service.ts`

**Step 1: Escrever teste para o gateway**

Crie `services/api/src/modules/tarefas/tarefas.gateway.spec.ts`:

```typescript
describe('TarefasGateway', () => {
  it('deve desconectar cliente sem sessão válida', async () => {
    const clientMock = {
      handshake: { headers: { cookie: '' } },
      disconnect: jest.fn(),
      join: jest.fn(),
    };
    // mock sessionService retornando null
    await gateway.handleConnection(clientMock as any);
    expect(clientMock.disconnect).toHaveBeenCalled();
  });

  it('deve adicionar cliente à sala do usuário com sessão válida', async () => {
    const clientMock = {
      handshake: { headers: { cookie: 'session=valid-token' } },
      disconnect: jest.fn(),
      join: jest.fn(),
    };
    // mock sessionService retornando { userId: 'uuid', schoolId: 'school-uuid' }
    await gateway.handleConnection(clientMock as any);
    expect(clientMock.join).toHaveBeenCalledWith('usuario:uuid');
    expect(clientMock.disconnect).not.toHaveBeenCalled();
  });
});
```

**Step 2: Rodar o teste para confirmar que falha**

```bash
pnpm turbo test --filter=api -- --testPathPattern="tarefas.gateway"
```
Esperado: FAIL

**Step 3: Implementar TarefasGateway**

```typescript
// services/api/src/modules/tarefas/tarefas.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { SessionService } from "../auth/session.service"; // ajustar path conforme existente

@WebSocketGateway({ namespace: "/tarefas", cors: { origin: "*", credentials: true } })
export class TarefasGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TarefasGateway.name);

  constructor(private readonly sessionService: SessionService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const cookie = client.handshake.headers.cookie ?? "";
      // Extrair valor do cookie 'session'
      const sessionToken = this.extrairCookie(cookie, "session");

      if (!sessionToken) {
        client.disconnect();
        return;
      }

      const sessao = await this.sessionService.findByToken(sessionToken);

      if (!sessao) {
        client.disconnect();
        return;
      }

      await client.join(`usuario:${sessao.userId}`);
      this.logger.debug(`Cliente conectado: usuario:${sessao.userId}`);
    } catch (err) {
      this.logger.error("Erro na conexão WebSocket", err);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Cliente desconectado: ${client.id}`);
  }

  emitirParaUsuario(userId: string, evento: string, payload: unknown): void {
    this.server.to(`usuario:${userId}`).emit(evento, payload);
  }

  private extrairCookie(cookieHeader: string, nome: string): string | null {
    const match = cookieHeader.match(new RegExp(`(?:^|; )${nome}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }
}
```

**Step 4: Rodar o teste para confirmar que passa**

```bash
pnpm turbo test --filter=api -- --testPathPattern="tarefas.gateway"
```
Esperado: PASS

**Step 5: Registrar gateway no módulo e injetar no service**

Em `tarefas.module.ts`, adicionar `TarefasGateway` ao array `providers`.

Em `tarefas.service.ts`, injetar gateway (opcional via `forwardRef` se circular) e chamar `emitirParaUsuario` após cada operação:

```typescript
// Após concluir tarefa com sucesso:
this.gateway.emitirParaUsuario(tarefaDb.responsavel, "tarefa:concluida", { tarefaId });

// Após criar tarefa:
this.gateway.emitirParaUsuario(params.responsavel, "tarefa:criada", {
  tarefaId: tarefaCriada.id,
  titulo: params.titulo,
  prioridade: params.prioridade,
  prazo: params.prazo.toISOString(),
});

// Após atualizar:
this.gateway.emitirParaUsuario(tarefaDb.responsavel, "tarefa:atualizada", { tarefaId: id });

// Após cancelar:
this.gateway.emitirParaUsuario(tarefaDb.responsavel, "tarefa:cancelada", { tarefaId });
```

**Step 6: Verificar lint e tipos**

```bash
pnpm turbo lint --filter=api && pnpm turbo typecheck --filter=api
```

**Step 7: Commit**

```bash
git add services/api/src/modules/tarefas/tarefas.gateway.ts
git add services/api/src/modules/tarefas/tarefas.module.ts
git add services/api/src/modules/tarefas/tarefas.service.ts
git commit -m "feat(api): adicionar TarefasGateway com autenticação e emissão de eventos por usuário"
```

---

### Task 11: Frontend — hook useTarefasSocket e refatorar provider

**Files:**
- Create: `apps/tarefas/features/notificacoes/hooks/use-tarefas-socket.ts`
- Modify: `apps/tarefas/features/notificacoes/tarefa-notificacao-provider.tsx`
- Modify: `apps/tarefas/features/widgets/tarefa-badge.tsx`
- Modify: `apps/tarefas/package.json`

**Step 1: Instalar socket.io-client**

```bash
pnpm add --filter=tarefas socket.io-client
```

**Step 2: Criar hook useTarefasSocket**

```typescript
// apps/tarefas/features/notificacoes/hooks/use-tarefas-socket.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export interface TarefaCriadaPayload {
  tarefaId: string;
  titulo: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  prazo: string;
}

interface UseTarefasSocketOptions {
  onTarefaCriada?: (payload: TarefaCriadaPayload) => void;
  onTarefaAtualizada?: (payload: { tarefaId: string }) => void;
  onTarefaConcluida?: (payload: { tarefaId: string }) => void;
  onTarefaCancelada?: (payload: { tarefaId: string }) => void;
}

export function useTarefasSocket(options: UseTarefasSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io("/tarefas", {
      withCredentials: true,
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    if (options.onTarefaCriada) {
      socket.on("tarefa:criada", options.onTarefaCriada);
    }
    if (options.onTarefaAtualizada) {
      socket.on("tarefa:atualizada", options.onTarefaAtualizada);
    }
    if (options.onTarefaConcluida) {
      socket.on("tarefa:concluida", options.onTarefaConcluida);
    }
    if (options.onTarefaCancelada) {
      socket.on("tarefa:cancelada", options.onTarefaCancelada);
    }

    return () => {
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Conecta apenas uma vez na montagem

  return { isConnected };
}
```

**Step 3: Refatorar TarefaNotificacaoProvider**

Substituir o conteúdo de `tarefa-notificacao-provider.tsx`:

```typescript
"use client";

import { type PropsWithChildren, useCallback } from "react";
import { toast } from "@essencia/ui/components/toaster";
import { useTarefasSocket } from "./hooks/use-tarefas-socket";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";

export function TarefaNotificacaoProvider({ children }: PropsWithChildren) {
  const { refetch } = useTarefas({ status: "PENDENTE" });

  const { isConnected } = useTarefasSocket({
    onTarefaCriada: useCallback((payload) => {
      const prazo = new Date(payload.prazo);
      const atrasada = prazo < new Date();
      const urgente = payload.prioridade === "ALTA" || atrasada;

      if (urgente) {
        toast.error("Nova tarefa urgente", { description: payload.titulo });
      } else {
        toast.info("Nova tarefa atribuída", { description: payload.titulo });
      }
      void refetch();
    }, [refetch]),

    onTarefaAtualizada: useCallback(() => {
      void refetch();
    }, [refetch]),

    onTarefaConcluida: useCallback(() => {
      void refetch();
    }, [refetch]),

    onTarefaCancelada: useCallback(() => {
      void refetch();
    }, [refetch]),
  });

  // Expor isConnected via context se necessário para o badge
  return <>{children}</>;
}
```

**Step 4: Verificar lint e tipos**

```bash
pnpm turbo lint --filter=tarefas && pnpm turbo typecheck --filter=tarefas
```

**Step 5: Commit**

```bash
git add apps/tarefas/features/notificacoes/
git add apps/tarefas/package.json
git commit -m "feat(tarefas): substituir polling por WebSocket no TarefaNotificacaoProvider"
```

---

## Checklist Final por PR

### PR 1 — UX Forms
- [ ] Task 1: Endpoint `GET /api/users/buscar` implementado e testado
- [ ] Task 2: Hook `useUsuariosBusca` com debounce 300ms
- [ ] Task 3: `TarefaFormFields` com Combobox, `criar-form.tsx` refatorado

### PR 2 — Histórico
- [ ] Task 4: Migration `tarefa_historico` aplicada, schema Drizzle atualizado
- [ ] Task 5: `TarefaHistoricoService` injetado e chamado em todos os métodos do service
- [ ] Task 6: Timeline visual na tela de detalhe `/tarefas/:id`

### PR 3 — Filtros & Paginação
- [ ] Task 7: Componente `TarefasPaginacao` com ellipsis
- [ ] Task 8: Painel `TarefasFiltros` colapsável + `useTarefas` com page/limit

### PR 4 — WebSocket
- [ ] Task 9: Dependências instaladas, `IoAdapter` configurado
- [ ] Task 10: `TarefasGateway` com autenticação e emissão de eventos
- [ ] Task 11: `useTarefasSocket` + provider refatorado sem `setInterval`

### Verificação Final
```bash
pnpm turbo lint && pnpm turbo typecheck
```
