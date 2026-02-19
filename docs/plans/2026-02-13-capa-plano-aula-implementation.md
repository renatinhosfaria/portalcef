# Capa do Plano de Aula — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir UUIDs crus por informações legíveis (professora, turma, etapa, período) em todas as telas de plano de aula.

**Architecture:** Criar hook `usePeriodoData` para fetch client-side de dados do período, e componente `PlanoHeader` reutilizável espelhando o layout da tela da professora. Aplicar nas 3 telas afetadas (revisão analista, lista análise, lista gestão).

**Tech Stack:** React hooks, Next.js client components, API REST existente (`/plano-aula-periodo`, `/stages`), shadcn/ui (Card, Badge).

---

## Task 1: Hook `usePeriodoData`

**Files:**
- Create: `apps/planejamento/features/plano-aula/hooks/use-periodo-data.ts`
- Modify: `apps/planejamento/features/plano-aula/hooks/index.ts`
- Modify: `apps/planejamento/features/plano-aula/index.ts`

**Step 1: Criar o hook**

Criar `apps/planejamento/features/plano-aula/hooks/use-periodo-data.ts`:

```typescript
"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useCallback, useEffect, useState } from "react";

interface PeriodoData {
  id: string;
  numero: number;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
  etapa?: string;
}

interface Stage {
  id: string;
  name: string;
  code: string;
}

interface UsePeriodoDataReturn {
  periodo: PeriodoData | null;
  etapaNome: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para buscar dados de um período específico e sua etapa
 * Usado nas telas de revisão/análise para substituir UUIDs por info legível
 */
export function usePeriodoData(
  periodoId: string | undefined,
): UsePeriodoDataReturn {
  const [periodo, setPeriodo] = useState<PeriodoData | null>(null);
  const [etapaNome, setEtapaNome] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!periodoId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [periodoResult, stages] = await Promise.all([
        api.get<PeriodoData>(`/plano-aula-periodo/${periodoId}`),
        api.get<Stage[]>("/stages"),
      ]);

      setPeriodo(periodoResult);

      if (periodoResult?.etapa && Array.isArray(stages)) {
        const stage = stages.find((s) => s.code === periodoResult.etapa);
        setEtapaNome(stage?.name || periodoResult.etapa);
      }
    } catch (err) {
      console.error("Erro ao buscar dados do período:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao buscar período",
      );
    } finally {
      setIsLoading(false);
    }
  }, [periodoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { periodo, etapaNome, isLoading, error };
}
```

**Step 2: Exportar o hook**

Em `apps/planejamento/features/plano-aula/hooks/index.ts`, adicionar:

```typescript
export { usePeriodoData } from "./use-periodo-data";
```

Em `apps/planejamento/features/plano-aula/index.ts`, adicionar `usePeriodoData` ao bloco de exports de hooks:

```typescript
export {
  usePlanoAula,
  useAnalistaActions,
  useCoordenadoraActions,
  useDashboard,
  useDeadlines,
  usePlanoDetalhe,
  useGestaoPlanos,
  usePeriodoData,
} from "./hooks";
```

**Step 3: Verificar typecheck**

Run: `pnpm turbo typecheck --filter=planejamento`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/planejamento/features/plano-aula/hooks/use-periodo-data.ts \
  apps/planejamento/features/plano-aula/hooks/index.ts \
  apps/planejamento/features/plano-aula/index.ts
git commit -m "feat(plano-aula): adicionar hook usePeriodoData para buscar dados do período"
```

---

## Task 2: Componente `PlanoHeader`

**Files:**
- Create: `apps/planejamento/features/plano-aula/components/plano-header.tsx`
- Modify: `apps/planejamento/features/plano-aula/components/index.ts`
- Modify: `apps/planejamento/features/plano-aula/index.ts`

**Step 1: Criar o componente**

Criar `apps/planejamento/features/plano-aula/components/plano-header.tsx`:

```tsx
"use client";

/**
 * PlanoHeader - Cabeçalho reutilizável para visualização do Plano de Aula
 * Espelha o layout da tela da professora (page.tsx)
 */

import {
  Card,
  CardHeader,
} from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { Calendar, Clock, User } from "lucide-react";

import type { PlanoAulaStatus } from "../types";

import { PlanoStatusBadge } from "./status-badge";

interface PlanoHeaderProps {
  professorName: string;
  turmaName: string;
  turmaCode?: string;
  periodoNumero?: number;
  periodoDescricao?: string;
  periodoInicio?: string;
  periodoFim?: string;
  prazoEntrega?: string;
  etapaNome?: string;
  status: PlanoAulaStatus;
  submittedAt?: string;
  isLoadingPeriodo?: boolean;
}

/**
 * Formata uma data ISO para exibição em pt-BR (dd/MM/yyyy)
 */
function formatarData(dataIso: string): string {
  return new Date(dataIso).toLocaleDateString("pt-BR");
}

/**
 * Formata o prazo de entrega em formato longo (ex: "20 de fevereiro de 2026")
 */
function formatarPrazo(dataIso: string): string {
  return new Date(dataIso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formata a data de submissão
 */
function formatarDataSubmissao(data: string): string {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlanoHeader({
  professorName,
  turmaName,
  turmaCode,
  periodoNumero,
  periodoDescricao,
  periodoInicio,
  periodoFim,
  prazoEntrega,
  etapaNome,
  status,
  submittedAt,
  isLoadingPeriodo = false,
}: PlanoHeaderProps) {
  const titulo = periodoDescricao || (periodoNumero ? `${periodoNumero}º Plano de Aula` : null);
  const periodoDisplay =
    periodoInicio && periodoFim
      ? `${formatarData(periodoInicio)} - ${formatarData(periodoFim)}`
      : null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            {/* Título do Período */}
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                {isLoadingPeriodo ? (
                  <>
                    <Skeleton className="h-7 w-48 mb-1" />
                    <Skeleton className="h-4 w-36" />
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold tracking-tight">
                      {titulo || "Plano de Aula"}
                    </h1>
                    {periodoDisplay && (
                      <p className="text-sm text-muted-foreground">
                        {periodoDisplay}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Informações da Professora */}
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Professora:{" "}
                <span className="font-medium text-foreground">
                  {professorName}
                </span>
              </p>
              <p>
                Turma:{" "}
                <span className="font-medium text-foreground">
                  {turmaName}
                  {turmaCode && (
                    <span className="text-muted-foreground ml-1">
                      ({turmaCode})
                    </span>
                  )}
                </span>
              </p>
              {etapaNome && (
                <p>
                  Etapa:{" "}
                  <span className="font-medium text-foreground">
                    {etapaNome}
                  </span>
                </p>
              )}
              {submittedAt && (
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Enviado em:{" "}
                  <span className="font-medium text-foreground">
                    {formatarDataSubmissao(submittedAt)}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Lado Direito: Prazo + Status */}
          <div className="flex flex-col gap-3 items-end">
            {/* Status Badge */}
            <PlanoStatusBadge status={status} className="text-sm" />

            {/* Prazo de Entrega */}
            {isLoadingPeriodo ? (
              <Skeleton className="h-14 w-40" />
            ) : (
              prazoEntrega && (
                <div className="rounded-md bg-muted px-4 py-2 text-sm">
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    Prazo de Entrega
                  </span>
                  <span className="font-medium text-foreground">
                    {formatarPrazo(prazoEntrega)}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
```

**Step 2: Exportar o componente**

Em `apps/planejamento/features/plano-aula/components/index.ts`, adicionar:

```typescript
export { PlanoHeader } from "./plano-header";
```

Em `apps/planejamento/features/plano-aula/index.ts`, adicionar ao bloco de Components:

```typescript
export {
  DocumentoUpload,
  DocumentoList,
  DocumentoComentarios,
  PlanoStatusBadge,
  HistoricoTimeline,
  PlanoHeader,
} from "./components";
```

**Step 3: Verificar typecheck**

Run: `pnpm turbo typecheck --filter=planejamento`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/planejamento/features/plano-aula/components/plano-header.tsx \
  apps/planejamento/features/plano-aula/components/index.ts \
  apps/planejamento/features/plano-aula/index.ts
git commit -m "feat(plano-aula): criar componente PlanoHeader reutilizável"
```

---

## Task 3: Atualizar tela de Revisão da Analista

**Files:**
- Modify: `apps/planejamento/app/analise/[planoId]/revisao-content.tsx`

**Step 1: Importar novos módulos**

No topo do arquivo, adicionar `PlanoHeader` e `usePeriodoData` ao import existente de `../../../features/plano-aula`:

```typescript
import {
  DocumentoList,
  DocumentoUpload,
  HistoricoTimeline,
  PlanoHeader,
  PlanoStatusBadge,
  useAnalistaActions,
  usePeriodoData,
  usePlanoAula,
  usePlanoDetalhe,
} from "../../../features/plano-aula";
```

Remover as importações que ficam desnecessárias (não usadas diretamente):
- `Calendar`, `Clock`, `User` do lucide-react (agora dentro do PlanoHeader)
- `CardDescription` do @essencia/ui (não mais usado no header)

**Step 2: Adicionar hook usePeriodoData**

Dentro de `RevisaoContent`, após o `usePlanoDetalhe()`, adicionar:

```typescript
// Buscar dados do período para exibir no header
const { periodo: periodoData, etapaNome, isLoading: isLoadingPeriodo } = usePeriodoData(plano?.quinzenaId);
```

**Step 3: Substituir bloco Header Info**

Substituir o bloco `{/* Header Info */}` (Card com CardHeader, linhas ~422-470) por:

```tsx
{/* Header Info */}
<PlanoHeader
  professorName={plano.professorName}
  turmaName={plano.turmaName}
  turmaCode={plano.turmaCode}
  periodoNumero={periodoData?.numero}
  periodoDescricao={periodoData?.descricao}
  periodoInicio={periodoData?.dataInicio}
  periodoFim={periodoData?.dataFim}
  prazoEntrega={periodoData?.dataMaximaEntrega}
  etapaNome={etapaNome ?? undefined}
  status={plano.status}
  submittedAt={plano.submittedAt}
  isLoadingPeriodo={isLoadingPeriodo}
/>
```

**Step 4: Remover código morto**

- Remover a linha 402-403: `const periodoDisplay = "Periodo nao disponivel";`
- Remover a função `formatarDataSubmissao` (linhas 60-70) — agora dentro do PlanoHeader

**Step 5: Verificar lint e typecheck**

Run: `pnpm turbo lint --filter=planejamento && pnpm turbo typecheck --filter=planejamento`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/planejamento/app/analise/[planoId]/revisao-content.tsx
git commit -m "feat(analise): usar PlanoHeader na tela de revisão da analista"
```

---

## Task 4: Atualizar lista de Análise

**Files:**
- Modify: `apps/planejamento/app/analise/analise-content.tsx`

**Step 1: Importar hook de períodos**

Adicionar import do hook `usePeriodos` no topo:

```typescript
import { usePeriodos, type Periodo } from "../../features/periodos/hooks/use-periodos";
```

**Step 2: Adicionar fetch de períodos no componente**

Dentro de `AnaliseContent`, após o state `segmentoAtivo`, adicionar:

```typescript
// Buscar períodos da unidade para exibir nomes ao invés de UUIDs
const { periodos: todosPeriodos } = usePeriodos();

// Mapa de periodoId -> Periodo para lookup rápido
const periodoMap = useMemo(() => {
  const map = new Map<string, Periodo>();
  for (const periodo of todosPeriodos) {
    map.set(periodo.id, periodo);
  }
  return map;
}, [todosPeriodos]);
```

Adicionar `useMemo` ao import de React (já está importado).

**Step 3: Substituir coluna Quinzena na tabela**

Substituir a célula da coluna "Quinzena" (linha 276):

De:
```tsx
<TableCell>{formatarQuinzena(plano.quinzenaId)}</TableCell>
```

Para:
```tsx
<TableCell>
  {(() => {
    const periodo = periodoMap.get(plano.quinzenaId);
    if (periodo) {
      return (
        <div>
          <span className="font-medium">
            {periodo.descricao || `${periodo.numero}º Plano`}
          </span>
          <span className="text-muted-foreground text-xs block">
            {new Date(periodo.dataInicio).toLocaleDateString("pt-BR")} -{" "}
            {new Date(periodo.dataFim).toLocaleDateString("pt-BR")}
          </span>
        </div>
      );
    }
    return <span className="text-muted-foreground">-</span>;
  })()}
</TableCell>
```

**Step 4: Renomear header da coluna**

Substituir `<TableHead>Quinzena</TableHead>` por `<TableHead>Período</TableHead>`.

**Step 5: Remover função `formatarQuinzena`**

Deletar as linhas 66-72 (função `formatarQuinzena`) que não será mais usada.

**Step 6: Verificar lint e typecheck**

Run: `pnpm turbo lint --filter=planejamento && pnpm turbo typecheck --filter=planejamento`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/planejamento/app/analise/analise-content.tsx
git commit -m "feat(analise): substituir UUID por dados legíveis na lista de análise"
```

---

## Task 5: Atualizar lista de Gestão

**Files:**
- Modify: `apps/planejamento/app/gestao/planos/planos-content.tsx`

**Step 1: Importar hook de períodos**

Adicionar import:

```typescript
import { usePeriodos, type Periodo } from "../../../features/periodos/hooks/use-periodos";
```

**Step 2: Adicionar fetch de períodos e mapa**

Dentro de `PlanosContent`, após o hook `useGestaoPlanos()`, adicionar:

```typescript
// Buscar períodos para exibir nomes ao invés de UUIDs
const { periodos: todosPeriodos } = usePeriodos();

const periodoMap = useMemo(() => {
  const map = new Map<string, Periodo>();
  for (const periodo of todosPeriodos) {
    map.set(periodo.id, periodo);
  }
  return map;
}, [todosPeriodos]);
```

Adicionar `useMemo` ao import de React (já importa `useCallback, useEffect, useState` — adicionar `useMemo`).

**Step 3: Substituir coluna Quinzena na tabela**

Substituir a célula da coluna "Quinzena" (linhas 472-478):

De:
```tsx
<TableCell>
  <div>
    <span className="font-medium">{plano.quinzenaId}</span>
    <span className="text-muted-foreground text-xs block">
      {plano.quinzenaPeriodo}
    </span>
  </div>
</TableCell>
```

Para:
```tsx
<TableCell>
  {(() => {
    const periodo = periodoMap.get(plano.quinzenaId);
    if (periodo) {
      return (
        <div>
          <span className="font-medium">
            {periodo.descricao || `${periodo.numero}º Plano`}
          </span>
          <span className="text-muted-foreground text-xs block">
            {new Date(periodo.dataInicio).toLocaleDateString("pt-BR")} -{" "}
            {new Date(periodo.dataFim).toLocaleDateString("pt-BR")}
          </span>
        </div>
      );
    }
    // Fallback se período não encontrado
    return (
      <div>
        <span className="text-muted-foreground text-xs">
          {plano.quinzenaPeriodo || "-"}
        </span>
      </div>
    );
  })()}
</TableCell>
```

**Step 4: Renomear header da coluna**

Substituir `<TableHead>Quinzena</TableHead>` por `<TableHead>Período</TableHead>`.

**Step 5: Verificar lint e typecheck**

Run: `pnpm turbo lint --filter=planejamento && pnpm turbo typecheck --filter=planejamento`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/planejamento/app/gestao/planos/planos-content.tsx
git commit -m "feat(gestao): substituir UUID por dados legíveis na lista de gestão"
```

---

## Task 6: Verificação Final

**Step 1: Lint + Typecheck completo**

Run: `pnpm turbo lint && pnpm turbo typecheck`
Expected: PASS em todos os apps

**Step 2: Verificar que testes existentes continuam passando**

Run: `pnpm turbo test --filter=planejamento`
Expected: PASS (testes existentes não devem quebrar)

**Step 3: Commit final se houver ajustes**

Caso algum lint/test fix seja necessário.
