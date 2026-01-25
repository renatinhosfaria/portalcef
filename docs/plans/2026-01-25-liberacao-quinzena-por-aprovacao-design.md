# Design: Liberação de Quinzena por Aprovação

> **Data:** 2026-01-25
> **Status:** Aprovado
> **Autor:** Claude + Usuário

## Problema

Atualmente, a liberação de quinzenas é baseada apenas em datas. A professora Aline Cristina teve o plano da Q01 aprovado, mas a Q02 não foi liberada porque a data atual ainda não entrou no período da Q02.

**Comportamento desejado:** A aprovação da quinzena anterior deve liberar a próxima quinzena para edição, independente da data.

## Regra de Negócio

### Regra Principal

- **Q01:** Sempre liberada para qualquer turma (sem pré-requisito)
- **Q02 em diante:** Liberada para uma turma específica somente se a quinzena anterior (N-1) dessa mesma turma tiver status `APROVADO`

### Escopo

- A liberação é **por turma**, não por professora
- Se a professora tem múltiplas turmas, cada turma tem sua própria progressão

### Exemplo

```
Professora: Aline Cristina

Turma A - Q01: APROVADO    → Q02 liberada ✓
Turma A - Q02: RASCUNHO    → Q03 bloqueada ✗

Turma B - Q01: RASCUNHO    → Q02 bloqueada ✗
Turma B - Q01: APROVADO    → Q02 liberada ✓
```

## Solução Técnica

### API (Backend)

**Endpoint:** `GET /plannings/quinzenas`

**Parâmetro:** `userId` (obrigatório para professoras)

**Resposta atualizada:**
```typescript
{
  id: "2026-Q02",
  label: "2ª Quinzena (16/02 a 01/03)",
  isCurrent: boolean,
  startDate: string,
  endDate: string,
  deadline: string,
  semester: 1 | 2,
  // NOVO
  unlockedTurmaIds: ["turma-uuid-1", "turma-uuid-3"]
}
```

**Lógica no service:**
```typescript
// Para Q01: todas as turmas do usuário
// Para QN (N > 1): buscar planos APROVADO da Q(N-1) do usuário
const planosAprovados = await db.query.planoAula.findMany({
  where: and(
    eq(planoAula.userId, userId),
    eq(planoAula.quinzenaId, quinzenaAnteriorId),
    eq(planoAula.status, "APROVADO")
  )
});
const unlockedTurmaIds = planosAprovados.map(p => p.turmaId);
```

### Frontend

**Arquivo:** `planejamentos-content.tsx`

**Mudança na lógica de status:**
```typescript
function getQuinzenaStatus(quinzena: ApiQuinzena, turmaId: string): QuinzenaStatus {
  const now = new Date();
  const endDate = new Date(quinzena.endDate);

  if (now > endDate) return "completed";

  // Q01 sempre liberada, QN precisa turma na lista
  const isUnlocked = quinzena.number === 1
    || quinzena.unlockedTurmaIds?.includes(turmaId);

  return isUnlocked ? "unlocked" : "locked";
}
```

**Componente QuinzenaCard:**
- Se bloqueada, mostrar tooltip: "Aprove a quinzena anterior desta turma"
- Link desabilitado para a página de criação

## Arquivos Afetados

| Local | Arquivo | Mudança |
|-------|---------|---------|
| API | `services/api/src/modules/plannings/plannings.service.ts` | Adicionar `unlockedTurmaIds` em `getQuinzenas()` |
| Frontend | `apps/planejamento/app/planejamentos/planejamentos-content.tsx` | Usar `unlockedTurmaIds` para determinar status |
| Frontend | `apps/planejamento/features/planejamentos/components/quinzena-card.tsx` | Tooltip explicativo quando bloqueada |

## Complexidade

**Baixa** - Apenas lógica condicional, sem mudanças de schema no banco de dados.
