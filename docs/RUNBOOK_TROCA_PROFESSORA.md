# Runbook — Troca de Professora Titular de Turma

Procedimento para trocar a professora titular sem retirar os planos de aula da
turma.

## Regra de negócio

O plano de aula pertence à combinação `turma + período`. A professora é a
responsável pelo trabalho naquele momento e aparece como autora das ações no
histórico. Trocar a titularidade da turma não cria, transfere ou remove planos.

Quando a nova professora acessa a turma, ela vê os planos já existentes e pode
continuar o fluxo dos planos ainda editáveis. Os registros antigos de autoria e
aprovação permanecem na timeline.

## Como executar uma troca

Pela UI: painel de turmas → selecionar a turma → alterar professora titular →
escolher a nova professora.

A nova professora precisa ter:

- role `professora`;
- a mesma `unitId` da turma;
- a mesma `stageId` da turma.

Pela API:

```http
PUT /api/turmas/{turmaId}/professora
Content-Type: application/json
Cookie: session=<da coordenadora>

{ "professoraId": "<uuid>" }
```

Roles autorizadas: `master`, `diretora_geral`, `gerente_unidade` e
`coordenadora_geral`.

## Listagem da professora

`GET /api/plano-aula/meus?turmaId=<uuid>` lista os planos da turma informada,
desde que a sessão seja da titular atual. O filtro por `turmaId` evita que
planos de outra turma da mesma professora influenciem status e bloqueios.

## Dados históricos duplicados

Versões antigas do sistema podiam criar dois registros para a mesma turma e
período durante uma troca. A aplicação escolhe primeiro o registro associado à
titular atual e, na ausência dele, o mais recentemente atualizado. Esses dados
não são apagados automaticamente; devem ser revisados com a coordenação antes
de qualquer consolidação.

Para localizar os casos:

```sql
SELECT turma_id, quinzena_id, COUNT(*) AS quantidade
FROM plano_aula
GROUP BY turma_id, quinzena_id
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;
```

A migration `0044_planos_vinculados_turma.sql` remove o índice que usava
`user_id` como parte da identidade e cria um índice de consulta por
`turma_id + quinzena_id`. Ela não exclui documentos nem histórico.

## Referências

- Service: [services/api/src/modules/plano-aula/plano-aula.service.ts](../services/api/src/modules/plano-aula/plano-aula.service.ts)
- Service: [services/api/src/modules/turmas/turmas.service.ts](../services/api/src/modules/turmas/turmas.service.ts)
- Migration: [packages/db/drizzle/0044_planos_vinculados_turma.sql](../packages/db/drizzle/0044_planos_vinculados_turma.sql)
