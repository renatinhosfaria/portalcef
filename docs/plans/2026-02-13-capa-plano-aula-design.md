# Capa do Plano de Aula — Informações Claras

> Design aprovado em 2026-02-13

## Problema

Na tela de revisão da analista e nas listagens, a identificação do plano de aula mostra o UUID cru do período (ex: `965c6f38-...`) + "Periodo nao disponivel", em vez de informações legíveis como nome da professora, turma, etapa e número do plano.

## Solução

Criar um componente `PlanoHeader` reutilizável com layout idêntico à tela da professora, e um hook `usePeriodoData` para buscar dados do período client-side. Aplicar em todas as telas que exibem plano de aula.

## Decisões de Design

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Onde buscar dados do período? | Client-side fetch | Sem alteração no backend |
| Componente compartilhado? | Sim, `PlanoHeader` | Consistência visual entre telas |
| Layout de referência? | Tela da professora (`page.tsx`) | Já está funcionando bem |
| Backend precisa mudar? | Não | Endpoints existentes são suficientes |

## Componente `PlanoHeader`

**Arquivo:** `apps/planejamento/features/plano-aula/components/plano-header.tsx`

**Props:**
```typescript
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
}
```

**Layout visual:**
```
┌──────────────────────────────────────────────────────────┐
│  📅  1º Plano de Aula                    ┌────────────┐  │
│      01/02/2026 - 15/02/2026             │ Prazo de   │  │
│                                           │ Entrega    │  │
│      Professora: Maria Silva              │ 20 de fev  │  │
│      Turma: Infantil III (INF-3)          │ de 2026    │  │
│      Etapa: Infantil                      └────────────┘  │
│                                           [Aguardando    ]│
│                                           [  Análise     ]│
└──────────────────────────────────────────────────────────┘
```

## Hook `usePeriodoData`

**Arquivo:** `apps/planejamento/features/plano-aula/hooks/use-periodo-data.ts`

- Recebe `periodoId: string | undefined`
- Busca `GET /plano-aula-periodo/{periodoId}` + `GET /stages`
- Retorna `{ periodo, etapaNome, isLoading, error }`

## Alterações por Tela

### 1. Revisão da Analista (`analise/[planoId]/revisao-content.tsx`)

- Usar `usePeriodoData(plano.quinzenaId)` para obter dados do período
- Substituir o bloco header (Card) pelo `<PlanoHeader />`
- Remover TODO hardcoded `"Periodo nao disponivel"` (linha 402-403)

### 2. Lista de Análise (`analise/analise-content.tsx`)

- Buscar todos os períodos da unidade com um único fetch
- Substituir `formatarQuinzena(plano.quinzenaId)` por lookup no mapa de períodos
- Exibir "Xº Plano de Aula" + datas formatadas na coluna Quinzena

### 3. Lista de Gestão (`gestao/planos/planos-content.tsx`)

- Substituir `plano.quinzenaId` na coluna por dados legíveis do período
- Usar mesmo approach: buscar períodos e fazer lookup local

## O que NÃO muda

- Backend / API — zero alterações
- Tela da professora (`plano-aula/[quinzenaId]/page.tsx`) — já funciona
- Schema do banco de dados
- Tipos existentes `PlanoAula`, `PlanoAulaSummary` — sem breaking changes
- Componentes de documentos, upload, histórico
