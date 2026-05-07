# Continuidade de Plano de Aula em Trocas de Professora

**Data:** 2026-05-07
**Status:** Design aprovado, aguardando implementação
**Autor:** Renato Faria (com brainstorming assistido)

---

## Contexto e Problema

No Portal Digital Colégio Essência Feliz, todo plano de aula está vinculado a uma professora (`plano_aula.userId`) e a uma turma (`plano_aula.turmaId`). Hoje, uma professora pode sair da escola ou trocar de turma durante o ano letivo. Quando isso acontece, o plano de aula em andamento fica órfão: a sucessora não consegue continuar o trabalho da antecessora porque a constraint UNIQUE atual `(userId, turmaId, quinzenaId)` força a sucessora a criar um plano novo, perdendo continuidade.

A modelagem atual também é semanticamente questionável: pedagogicamente, **uma turma tem um único plano por quinzena**, independentemente de quantas professoras passaram por ela. O `userId` na constraint UNIQUE permite duplicação ilegítima.

## Decisões de Comportamento

Decisões tomadas durante brainstorming:

1. **Planos APROVADOS mantêm autoria original.** Um plano já aprovado não muda de mãos quando a professora sai. O `userId` é registro histórico fiel da autora.
2. **Planos em andamento "mudam de mãos".** Quando há troca, o plano não-aprovado passa para a sucessora atualizando o `userId` no próprio registro. O histórico de auditoria preserva quem fez cada ação antes da transferência.
3. **Gatilho implícito via `turma.professoraId`.** A coordenadora altera a professora titular pela tela existente de turmas; o sistema detecta a mudança e transfere automaticamente os planos pendentes. Não há tela nova de "transferir plano".
4. **Escopo amplo.** Todos os planos da turma com status ≠ APROVADO são transferidos, independentemente da quinzena (incluindo rascunhos órfãos de quinzenas passadas).
5. **Implementação transacional via service.** A atualização de `turmas.professoraId` e a transferência dos planos acontecem na mesma transação Drizzle. Sem domain events, sem trigger de banco — código TS observável e testável.

## Mudanças no Schema

### `plano_aula`

A constraint UNIQUE muda de `(userId, turmaId, quinzenaId)` para `(turmaId, quinzenaId)`. Nenhuma coluna nova. O `userId` continua sendo a "professora atualmente responsável" — para planos APROVADOS, é a autora original; para planos em andamento que sofreram transferência, é a sucessora.

Arquivo afetado: `packages/db/src/schema/plano-aula.ts:93-97`.

### `plano_aula_historico`

Adicionar valor `TRANSFERIDO` ao enum `planoAulaHistoricoAcaoEnum`.

O campo `detalhes` (JSONB já existente) carrega o payload da transferência:

```json
{
  "professoraAnteriorId": "uuid",
  "professoraAnteriorNome": "Maria da Silva",
  "novaProfessoraId": "uuid",
  "novaProfessoraNome": "Joana Souza",
  "motivo": "troca_titular_turma"
}
```

O `motivo` é uma string com vocabulário controlado: por enquanto apenas `troca_titular_turma`. Se no futuro houver outros gatilhos (afastamento de longa duração, transferência manual), o vocabulário expande sem mudar o schema.

Arquivo afetado: `packages/db/src/schema/plano-aula-historico.ts:18-30`.

### Migration

A coluna `status` em `plano_aula` e a coluna `acao` em `plano_aula_historico` são `TEXT` no banco com **CHECK constraint** (não `pg_enum` types) — vide migrations 0011 e 0022. A constraint UNIQUE em `plano_aula` é um índice único nomeado `plano_aula_user_turma_quinzena_unique` (vide 0010_regular_chameleon.sql:58).

```sql
-- Migration: <NUMERO>_continuidade_plano_aula_troca_professora.sql

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

-- 2. Substituir índice único
DROP INDEX "plano_aula_user_turma_quinzena_unique";
CREATE UNIQUE INDEX "plano_aula_turma_quinzena_unique" ON "plano_aula" USING btree ("turma_id","quinzena_id");

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

A migration é manual (não gerada via `pnpm db:generate`) — o padrão do projeto coloca `chk_*` constraints e índices únicos manualmente, conforme migration `0022_update_historico_acao_constraint.sql`.

O schema TS dos pacotes Drizzle também precisa ser atualizado para refletir o novo valor do enum (`planoAulaHistoricoAcaoEnum`) e o nome do índice único (`plano_aula_turma_quinzena_unique` ao invés de `plano_aula_user_turma_quinzena_unique`). Sem essas mudanças, drizzle-zod e queries com tipagem ficam inconsistentes.

## Fluxo da Transferência

### 1. `TurmasService.assignProfessora`

Local: `services/api/src/modules/turmas/turmas.service.ts:256-305`.

`TurmasService.update` (linha 159) **não modifica `professoraId`** — esse campo é gerenciado por endpoints dedicados (`assignProfessora`, `removeProfessora`). O ponto de interceptação correto é `assignProfessora`, que é chamado tanto na atribuição inicial quanto na troca de titular (sobrescreve sem checar valor anterior).

Mudanças no método (mantém validações atuais de unitId/stageId/role):

1. Busca turma atual (linha 263, já existe).
2. Captura `professoraAnteriorId = turma.professoraId`.
3. Se `professoraAnteriorId !== null && professoraAnteriorId !== professoraId` (é uma troca real, não primeira atribuição):
   - Abre `db.transaction(async (tx) => { ... })`.
   - Dentro da transação:
     - `UPDATE turmas SET professoraId = nova` (comportamento atual, só passa a usar `tx`).
     - Chama `planoAulaService.transferirPlanosPendentes(tx, turmaId, professoraAnteriorId, professoraId, atorSession)`.
4. Se for atribuição inicial (`professoraAnteriorId === null`) ou mesma professora, o caminho permanece o atual (sem transação extra). Atribuição inicial não precisa transferir porque não há planos prévios — `userId` é NOT NULL na tabela.

`TurmasService.removeProfessora` (linha 311) **não dispara transferência** — ao remover (sem nova substituição), planos pendentes ficam com a professora anterior. Eles serão transferidos quando uma nova professora for atribuída via `assignProfessora`.

Para receber o `atorSession`, a assinatura de `assignProfessora` muda para aceitar um terceiro parâmetro `ator: UserContext`. O controller (`turmas.controller.ts`) passa `req.user`. Esse refactor é necessário porque o histórico precisa registrar quem disparou a troca.

### 2. `PlanoAulaService.transferirPlanosPendentes` (novo método)

Local: `services/api/src/modules/plano-aula/plano-aula.service.ts` (novo método).

Assinatura:

```typescript
async transferirPlanosPendentes(
  tx: DbTransaction,
  turmaId: string,
  professoraAnteriorId: string,
  novaProfessoraId: string,
  ator: { userId: string; userName: string; userRole: string }
): Promise<{ planosTransferidos: string[] }>
```

Comportamento:

1. `SELECT id, status FROM plano_aula WHERE turmaId = $1 AND status != 'APROVADO'` — captura planos a transferir. Inclui RASCUNHO, AGUARDANDO_ANALISTA, AGUARDANDO_COORDENADORA, DEVOLVIDO_ANALISTA, DEVOLVIDO_COORDENADORA, REVISAO_ANALISTA e RECUPERADO. (RECUPERADO é status intermediário, conforme `packages/db/src/schema/plano-aula.ts:31`.)
2. Se a lista estiver vazia, retorna `{ planosTransferidos: [] }` sem inserir histórico.
3. `UPDATE plano_aula SET userId = $novaProfessoraId, updatedAt = now() WHERE id IN (...)`.
4. Busca nomes das professoras (anterior e nova) via `users` para popular `detalhes`.
5. Para cada plano transferido, insere uma linha em `plano_aula_historico`:
   - `planoId` = id do plano
   - `userId` = `ator.userId` (quem disparou a troca, normalmente a coordenadora)
   - `userName`, `userRole` = do ator
   - `acao` = `TRANSFERIDO`
   - `statusAnterior` = `statusNovo` = status atual do plano (transferência não muda status)
   - `detalhes` = JSONB com payload descrito acima
6. Retorna `{ planosTransferidos: [id1, id2, ...] }`.

Toda a operação acontece dentro da `tx` recebida — se qualquer passo falhar, a transação reverte e a alteração de `professoraId` na turma também é desfeita.

### 3. Edge cases

- **Nova professora é null:** a transferência não acontece. Planos pendentes ficam com a professora anterior até nova titular ser definida. Evita planos órfãos com `userId = null` (que quebraria a FK).
- **Professora anterior é null** (turma estava sem titular e ganhou uma): nada a transferir, só atualiza `professoraId`.
- **Mesma professora trocada para si mesma:** detecção de mudança real (`if (anterior !== nova)`) evita operação redundante.
- **Turma sem nenhum plano pendente:** retorna lista vazia, sem dispatchar histórico vazio.
- **Permissões:** o controle de quem pode editar `turma.professoraId` já é responsabilidade dos guards do módulo de turmas; este design não mexe nisso.
- **Reversibilidade manual:** se a coordenadora trocou por engano, ela pode trocar de volta — a operação inversa transfere novamente, gerando uma nova linha TRANSFERIDO no histórico (com motivo igual). O timeline preserva a sequência completa de transferências.
- **Duplicatas pré-existentes:** se a constraint atual `(userId, turmaId, quinzenaId)` permitiu duplicatas (improvável, mas possível em ambientes onde dados foram inseridos fora do app), a migration aborta com erro claro e exige correção manual antes de aplicar.

## Impacto na UI

Nenhuma mudança obrigatória de UI nesta entrega. A sucessora ao abrir o app vê os planos da turma normalmente porque `userId` foi atualizado.

Pequeno ajuste recomendado, não bloqueante para a entrega:

- O componente de timeline (`apps/planejamento/features/plano-aula/components/historico-timeline`) deve renderizar a nova ação `TRANSFERIDO` com label tipo "Plano transferido de Maria da Silva para Joana Souza" — sem isso, a linha aparece com label genérico ou em branco.

## Testes

### Unitários (vitest + mocks Drizzle, padrão do projeto)

`TurmasService.assignProfessora`:
- Quando turma já tinha professora anterior diferente da nova, chama `planoAulaService.transferirPlanosPendentes` com argumentos corretos, dentro de transação.
- NÃO chama `transferirPlanosPendentes` quando turma não tinha professora anterior (atribuição inicial).
- NÃO chama `transferirPlanosPendentes` quando a professora atribuída é a mesma já presente.
- Mantém validações atuais (unitId, stageId, role).

`TurmasService.removeProfessora`:
- NÃO dispara transferência (planos pendentes permanecem com a professora removida).

Atomicidade da transação (UPDATE turma + transferência ou nada) é garantida pelo uso de `db.transaction` — coberta por teste de integração se houver suite, ou por inspeção de código no PR review (não viável testar via mocks unitários do padrão atual).

`PlanoAulaService.transferirPlanosPendentes`:
- Filtra apenas planos com status ≠ APROVADO.
- Atualiza `userId` em todos os planos selecionados.
- Insere uma linha em `plano_aula_historico` para cada plano, com `acao='TRANSFERIDO'` e `detalhes` populado corretamente.
- Retorna lista de IDs transferidos.
- Turma sem planos pendentes → retorna `[]`, não chama insert no histórico.

### Integração (se houver suite e2e da API)

- `PUT /turmas/:id/professora` (endpoint que aciona `assignProfessora`) com nova professora em turma que já tinha titular resulta em:
  - Planos com status ≠ APROVADO da turma têm novo `userId`.
  - Planos APROVADOS permanecem com `userId` original.
  - Existe linha `TRANSFERIDO` em `plano_aula_historico` para cada plano transferido.
  - Tabela `turmas` reflete novo `professoraId`.

## Decisões Não-Tomadas (por design)

- **Notificações para a nova professora.** Não há notificação automática nesta entrega. Se for necessário, vira escopo separado.
- **Notificação para o analista/coordenadora** quando um plano em revisão muda de mãos. Idem.
- **Tela explícita de transferência.** Rejeitada — a coordenadora trabalha pela tela de turmas, padrão único de fluxo.
- **Versionamento do plano antes da transferência.** Não há snapshot — o histórico é o suficiente. Quem precisar saber "o que tinha no plano antes da Joana editar" pode usar o histórico ou os arquivos versionados (caso aplicável ao módulo de documento).
- **Casos de afastamento temporário** (Maria volta em 30 dias). Modelo atual assume que afastamento curto NÃO troca `professoraId`. Se trocar, transfere. Se for necessário tratar afastamento sem transferência, é escopo futuro.

## Arquivos Afetados (resumo)

- `packages/db/src/schema/plano-aula.ts` — constraint UNIQUE
- `packages/db/src/schema/plano-aula-historico.ts` — enum
- `packages/db/migrations/<nova>.sql` — migration manual com bloco de verificação
- `services/api/src/modules/turmas/turmas.service.ts` — `assignProfessora` recebe ator, detecta troca real e abre transação
- `services/api/src/modules/turmas/turmas.controller.ts` — passa `req.user` para `assignProfessora`
- `services/api/src/modules/plano-aula/plano-aula.service.ts` — novo método `transferirPlanosPendentes`
- `services/api/src/modules/plano-aula/plano-aula.module.ts` — exportar service para uso pelo `TurmasModule`
- `services/api/src/modules/turmas/turmas.module.ts` — importar `PlanoAulaModule`
- `services/api/src/modules/turmas/turmas.service.spec.ts` — novos casos
- `services/api/src/modules/plano-aula/plano-aula.service.spec.ts` — novos casos
- `apps/planejamento/features/plano-aula/components/historico-timeline.tsx` — label da ação `TRANSFERIDO` (não bloqueante)
