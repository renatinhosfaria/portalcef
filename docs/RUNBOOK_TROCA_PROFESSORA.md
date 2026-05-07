# Runbook — Troca de Professora Titular de Turma

Operacional para quem coordena trocas de professora e precisa entender o que acontece com os planos de aula em andamento.

---

## O que a feature faz

Quando a professora titular de uma turma é alterada (via tela de turmas → atribuir professora), o sistema **automaticamente** transfere todos os planos de aula **não-aprovados** daquela turma para a nova professora, dentro da mesma transação que atualiza `turmas.professoraId`.

**O que é transferido:**
- Planos com status `RASCUNHO`, `AGUARDANDO_ANALISTA`, `AGUARDANDO_COORDENADORA`, `DEVOLVIDO_ANALISTA`, `DEVOLVIDO_COORDENADORA`, `REVISAO_ANALISTA`, `RECUPERADO`

**O que NÃO é transferido (preserva autoria histórica):**
- Planos com status `APROVADO`

**Auditoria:**
- Cada plano transferido recebe um registro na timeline com a ação `TRANSFERIDO`, contendo nome da professora anterior, nome da nova, e quem disparou a troca.

---

## Como executar uma troca

### Pela UI

Acessar o painel de turmas → selecionar a turma → "Alterar professora titular" → escolher a nova professora.

A nova professora deve atender:
- Role = `professora`
- Mesma `unitId` da turma
- Mesma `stageId` da turma

Se algum desses não bater, a operação é rejeitada com mensagem clara.

### Pela API (raro, para automação)

```http
PUT /api/turmas/{turmaId}/professora
Content-Type: application/json
Cookie: session=<da coordenadora>

{ "professoraId": "<uuid>" }
```

Roles autorizadas: `master`, `diretora_geral`, `gerente_unidade`, `coordenadora_geral`.

---

## Cenários e comportamento

### Atribuição inicial (turma sem professora anterior)

Sem transferência — a turma ganha titular pela primeira vez. Nenhum histórico de transferência é criado.

### Troca normal (Maria → Joana)

Transferência automática. Joana abre o app, vê os planos pendentes da turma como dela. Timeline de cada plano mostra "Plano transferido de Maria para Joana".

### Mesma professora atribuída de novo (idempotência)

Sem transferência. Operação no-op no banco.

### Remoção de titular (sem substituta)

Endpoint `DELETE /api/turmas/{id}/professora`. **Não dispara transferência** — os planos pendentes ficam com a professora removida até nova titular ser atribuída.

---

## Cenário edge: professora retorna a turma onde já esteve

> Maria foi titular da Turma X, saiu em fevereiro. Joana assumiu em março.
> Em agosto, Maria volta e a coordenadora a atribui de volta à Turma X.

A operação **vai falhar** com erro de constraint. Causa: o índice único atual `plano_aula_user_turma_quinzena_unique (user_id, turma_id, quinzena_id)` permite que coexistam planos da Maria (aprovados, antigos) e da Joana (pendentes, transferidos) na mesma turma/quinzena. Quando o sistema tenta transferir os planos pendentes da Joana de volta para Maria, o índice é violado pelos planos antigos da Maria.

### Como resolver pontualmente

Antes de fazer a re-atribuição, identificar quais planos da Maria conflitariam:

```sql
SELECT p.id, p.user_id, u.name AS professora, p.status, p.quinzena_id
FROM plano_aula p
JOIN users u ON u.id = p.user_id
WHERE p.turma_id = '<turma-id>'
  AND p.user_id = '<maria-id>'
  AND (p.turma_id, p.quinzena_id) IN (
    SELECT turma_id, quinzena_id
    FROM plano_aula
    WHERE turma_id = '<turma-id>' AND user_id = '<joana-id>' AND status != 'APROVADO'
  );
```

Se aparecerem planos APROVADOS da Maria que conflitam, a decisão é pedagógica:
- Manter o aprovado da Maria e descartar o pendente da Joana → DELETAR o pendente da Joana antes de re-atribuir
- Manter o pendente da Joana → arquivar o aprovado da Maria (não recomendado, perde histórico)

Após resolução manual, fazer a re-atribuição normalmente.

---

## Diagnóstico

### Verificar duplicatas em `(turma_id, quinzena_id)`

```sql
SELECT turma_id, quinzena_id, COUNT(*) AS qtd
FROM plano_aula
GROUP BY turma_id, quinzena_id
HAVING COUNT(*) > 1
ORDER BY qtd DESC;
```

Se aparecerem grupos, são casos como o descrito acima — coexistência de planos de professoras diferentes na mesma turma/quinzena. **Não é um bug** com o índice atual, mas é fragilidade para futuras trocas envolvendo essas professoras.

### Inspecionar a timeline de transferências

```sql
SELECT
  h.created_at,
  h.user_name AS quem_disparou,
  h.detalhes->>'professoraAnteriorNome' AS de,
  h.detalhes->>'novaProfessoraNome' AS para,
  p.turma_id,
  p.quinzena_id
FROM plano_aula_historico h
JOIN plano_aula p ON p.id = h.plano_id
WHERE h.acao = 'TRANSFERIDO'
ORDER BY h.created_at DESC
LIMIT 20;
```

### Falha em troca: erro 500 com constraint violation

Mensagem típica: `duplicate key value violates unique constraint "plano_aula_user_turma_quinzena_unique"`.

Significa: a nova professora já tem plano(s) daquela turma/quinzena. Ver "Cenário edge" acima.

A transação aborta limpa — `turmas.professoraId` não é alterado, planos não são tocados. Recuperação: identificar e resolver o conflito, tentar novamente.

---

## Migrations relacionadas

- `packages/db/drizzle/0028_historico_acao_transferido.sql` — adiciona valor `TRANSFERIDO` ao CHECK constraint de `plano_aula_historico.acao`. **Aplicada em produção em 2026-05-07.**

A migration 0029 (que tornaria o índice único `(turma_id, quinzena_id)`, eliminando o cenário edge acima) foi descartada por decisão pedagógica de preservar a coexistência histórica de planos de professoras diferentes para a mesma turma/quinzena. Se essa decisão mudar no futuro, recriar a migration e resolver as duplicatas pré-existentes antes de aplicar.

---

## Referências de código

- Service: [services/api/src/modules/plano-aula/plano-aula.service.ts](../services/api/src/modules/plano-aula/plano-aula.service.ts) — método `transferirPlanosPendentes`
- Service: [services/api/src/modules/turmas/turmas.service.ts](../services/api/src/modules/turmas/turmas.service.ts) — método `assignProfessora`
- Spec: [docs/superpowers/specs/2026-05-07-continuidade-plano-aula-troca-professora-design.md](./superpowers/specs/2026-05-07-continuidade-plano-aula-troca-professora-design.md)
