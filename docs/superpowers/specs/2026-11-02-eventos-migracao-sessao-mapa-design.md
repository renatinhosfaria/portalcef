# Migração segura de sessões para novo mapa e exclusão do mapa anterior

**Data:** 2026-11-02
**Status:** aguardando aprovação

## Objetivo

Permitir que a equipe troque o mapa de assentos que ainda está referenciado por uma ou mais sessões, depois de confirmar um novo mapa, sem deixar a sessão pública apontando para assentos inexistentes e sem apagar registros que tenham vendas ou operação associada.

O fluxo resolve o caso atual em que a substituição do mapa padrão termina com `MAP_IN_USE`: a sessão é migrada para o novo mapa, o inventário é reconstruído de forma atômica e o mapa antigo é excluído apenas quando nenhuma referência permanecer.

## Limites

- A alteração fica restrita ao domínio de eventos e ao painel administrativo.
- O backend público de compra, o checkout, pagamentos e as regras de venda não mudam.
- O mapa novo precisa estar `CONFIRMADO`, pertencer ao mesmo evento e conter assentos.
- A exclusão é física no banco e remove os arquivos original/preview do armazenamento depois do commit. A auditoria da operação permanece com os IDs e o resumo da migração.
- Não haverá exclusão forçada de um mapa que tenha pedidos, reservas, ingressos, check-ins ou operações administrativas relacionadas à sessão.

## Operação escolhida

Adicionar uma operação administrativa explícita na API:

`POST /eventos/admin/:eventId/mapas/:mapId/migrar-e-excluir`

Corpo:

```json
{
  "targetMapId": "uuid-do-novo-mapa",
  "sessionIds": ["uuid-da-sessao-confirmada"]
}
```

`sessionIds` é opcional para permitir retry idempotente. O servidor calcula todas as sessões impactadas pelo mapa antigo, incluindo sessões com `mapId` explícito e sessões herdadas cujo inventário ainda contém assentos do mapa antigo. Quando o cliente enviar a lista, ela deve conter todas as sessões impactadas; uma seleção incompleta falha sem alterar dados.

A operação executa, em uma única transação e com lock na ordem evento → sessões → mapas:

1. validar autorização, evento, mapa antigo e mapa novo;
2. identificar todas as sessões que ainda apontam para o mapa antigo ou têm inventário baseado nos seus assentos;
3. bloquear a operação se qualquer sessão impactada tiver pedido, reserva, ingresso, check-in ou operação administrativa;
4. trocar o `mapId` das sessões explícitas para o novo mapa;
5. trocar `eventos.defaultMapId` quando o mapa antigo ainda for o padrão;
6. apagar o inventário das sessões impactadas e criar uma linha para cada assento do novo mapa, marcando assentos não vendáveis como `BLOQUEADO`;
7. registrar auditoria com mapa antigo, novo mapa, sessões, quantidade de assentos e motivo da exclusão;
8. excluir o registro do mapa antigo. Os assentos do mapa seguem o cascade existente e importações que apontem para ele recebem `mapId = null` conforme a FK atual.

Depois do commit, os arquivos `originalFileKey` e `previewFileKey` do mapa antigo são removidos do storage em chamadas idempotentes. Uma falha no storage não desfaz a migração confirmada e será registrada em log para limpeza posterior.

Se o retry encontrar o mapa antigo já excluído e o evento/sessões já estiverem no novo mapa, a operação retorna o resultado persistido da auditoria, sem recriar inventário nem repetir a exclusão.

## Guardas de segurança

- `MAP_NOT_FOUND`, `MAP_EVENT_MISMATCH`, `MAP_NOT_CONFIRMED`, `MAP_EMPTY` e `SAME_MAP` impedem referências inválidas.
- `SESSION_SELECTION_INCOMPLETE` impede excluir o mapa quando o cliente não confirma todas as sessões afetadas.
- `SESSION_HAS_DEPENDENCIES` informa que a migração não pode apagar inventário já usado por operação, reserva, ingresso ou check-in.
- `MAP_DELETE_BLOCKED` cobre qualquer referência inesperada que o banco ainda rejeitar; toda a transação é revertida.
- O mapa antigo nunca será apagado antes de o `defaultMapId`, os `evento_sessoes.map_id` e o inventário terem sido migrados.

A resposta de sucesso terá o formato:

```json
{
  "oldMapId": "uuid",
  "targetMapId": "uuid",
  "migratedSessionIds": ["uuid"],
  "inheritedSessionIds": ["uuid"],
  "inventoryCreatedCount": 784,
  "deletedMap": { "deleted": true, "code": "DELETED" }
}
```

## Painel administrativo

Quando a substituição do mapa padrão retornar `MAP_IN_USE`, o painel continuará mostrando as sessões afetadas e exibirá a ação **“Migrar sessões e excluir mapa anterior”**. A ação abrirá uma confirmação clara informando que o inventário dessas sessões será recriado e que o mapa anterior será removido. Após o sucesso, o painel mostrará a quantidade de sessões/assentos migrados e atualizará a revisão; em caso de bloqueio, preservará o estado confirmado e exibirá o código retornado pela API.

O callback usará o `previousMapId` retornado pela substituição e o `targetMapId` confirmado, sem reenviar o arquivo. O retry será seguro contra duplo clique e contra repetição após timeout.

## Compatibilidade e rollout

Não há alteração de schema nem migration. A rota nova será adicionada com os mesmos guards e papéis das demais rotas de mapas. A operação será inicialmente acionada apenas pelo painel; nenhuma chamada pública existente será alterada.

## Testes

- Serviço: mapa confirmado e sessão sem dependências migram, inventário antigo é substituído e o mapa é excluído.
- Serviço: sessão com pedido, reserva, ingresso, check-in ou operação administrativa falha com código estável e mantém mapa/inventário.
- Serviço: múltiplas sessões são identificadas; seleção incompleta falha; sessões herdadas são migradas pelo inventário.
- Serviço: mapa de outro evento, mapa não confirmado, mapa vazio e IDs iguais são rejeitados.
- Serviço: retry idempotente retorna auditoria sem duplicar inventário.
- Controller: valida `targetMapId` e `sessionIds` e repassa o ator.
- Painel: mostra a ação em `MAP_IN_USE`, confirma a operação, envia os IDs corretos e atualiza a mensagem de sucesso/erro.

## Alternativas descartadas

- **Apagar o mapa diretamente:** a FK `evento_sessoes.map_id` e os assentos de inventário impedem a operação ou deixariam a sessão pública inconsistente.
- **Manter o mapa arquivado:** preserva a integridade, mas não atende à necessidade operacional de retirar o mapa antigo após a migração segura.
- **Alterar a sessão fora de transação:** permite que uma compra concorrente observe inventário parcialmente recriado; por isso toda a troca e exclusão ficam no mesmo commit.
