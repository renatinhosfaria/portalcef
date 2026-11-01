# Substituição segura do mapa de assentos — Design

## Intenção

Permitir que a equipe substitua o mapa de assentos atualmente associado a um evento publicado ou em configuração sem apagar prematuramente a versão que ainda pode estar referenciada por sessões. O fluxo deve preservar o histórico, manter a integridade do inventário e oferecer uma nova versão somente depois de upload, revisão e confirmação.

## Contexto atual

O painel em `apps/eventos-admin` já envia arquivos para `POST /eventos/admin/:id/mapas/import`, revisa detecções, confirma a versão e atualiza o mapa padrão por `PATCH /eventos/admin/:id/mapa-padrao`. A API também possui `POST /eventos/admin/:id/mapas/:versionId/arquivar`, mas a operação é separada e não é exposta pelo painel.

A troca do mapa padrão bloqueia os lugares disponíveis ou liberados das sessões que herdavam o mapa do evento e cria o inventário do novo mapa. Sessões com `mapId` explícito continuam apontando para seu mapa próprio. Um mapa não pode ser arquivado enquanto for o mapa padrão ou estiver referenciado diretamente por uma sessão.

## Objetivos

- Reutilizar o upload, a detecção, a revisão e a confirmação já existentes.
- Adicionar uma operação administrativa única para trocar o mapa padrão usando somente uma versão `CONFIRMADO` do mesmo evento.
- Executar a troca do mapa padrão, a atualização do inventário herdado e o arquivamento protegido do mapa anterior em uma transação de domínio.
- Preservar o mapa anterior quando uma sessão ainda apontar para ele, retornando um resultado explícito para o painel.
- Exibir no painel se o mapa anterior foi arquivado ou permaneceu preservado por referência ativa.
- Manter auditoria da substituição e não alterar regras públicas de compra, pagamentos ou contratos do mapa público.

## Fora do escopo

- Excluir fisicamente o arquivo original do mapa ou apagar o histórico de versões.
- Alterar sessões que possuem `mapId` explícito.
- Migrar reservas, pedidos, ingressos ou assentos vendidos para outra geometria.
- Criar uma nova tela de edição de assentos.
- Alterar a seleção pública de assentos ou o fluxo de checkout.

## Anti-objetivos

- Não deixar o evento apontando para um mapa em revisão.
- Não arquivar um mapa ainda referenciado por uma sessão.
- Não liberar automaticamente lugares que foram bloqueados pela troca do mapa.
- Não confirmar um mapa vazio, de outro evento ou com status diferente de `CONFIRMADO`.
- Não mascarar uma falha de inventário como se a substituição tivesse sido concluída.

## Abordagens consideradas

### 1. Operação transacional de substituição — escolhida

Adicionar uma rota administrativa específica para substituir o mapa padrão por um mapa confirmado. A operação valida a versão, troca o mapa do evento, bloqueia o inventário herdado, sincroniza os assentos do novo mapa e arquiva o mapa anterior apenas quando não houver referências diretas.

Vantagens: mantém a troca segura, reduz estados intermediários no painel e deixa o resultado de arquivamento explícito. O custo é criar um contrato de operação e cobrir o fluxo com testes.

### 2. Manter operações independentes

O painel continuaria chamando separadamente `PATCH /mapa-padrao` e `POST /arquivar`. É a menor alteração, mas uma falha entre as chamadas pode deixar a troca concluída com o mapa anterior não arquivado ou apresentar um estado incompleto ao operador.

### 3. Exclusão destrutiva do mapa atual

A rota limparia o `defaultMapId` e tentaria apagar a versão atual antes do novo upload. Essa alternativa quebra referências de sessões e elimina a recuperação de uma versão usada, por isso não atende ao histórico e à segurança exigidos.

## Decisões de contrato

- Nova rota: `POST /eventos/admin/:id/mapa-padrao/substituir`.
- Corpo: `{ "mapId": "uuid-do-mapa-confirmado" }`.
- A rota exige autenticação e os mesmos papéis administrativos já usados no módulo.
- O `mapId` deve pertencer ao evento e ter status `CONFIRMADO`.
- Se o `mapId` já for o mapa padrão, a operação será idempotente e retornará o estado atual sem recriar inventário.
- A resposta terá o novo mapa padrão, as sessões herdadas afetadas, os IDs de inventário sincronizados, a quantidade criada e o resultado do arquivamento anterior:
  - `archived: true` quando o mapa anterior foi arquivado;
  - `archived: false` com `code: "MAP_IN_USE"` e os IDs das sessões quando ainda houver referência direta;
  - `archived: false` com `code: "NO_PREVIOUS_MAP"` quando não havia mapa anterior.
- A troca do `defaultMapId`, o bloqueio do inventário herdado, a sincronização do novo inventário, a auditoria e a mudança de status do mapa anterior serão uma única transação de banco. A remoção do preview do storage ocorrerá depois do commit e não desfará a troca se falhar.
- O painel usará a nova rota após confirmar a nova versão e apresentará o resultado do arquivamento, com retry da substituição quando a operação de troca falhar.

## Segurança do inventário

- Sessões com `mapId` nulo herdam o novo mapa e terão assentos `DISPONIVEL`/`LIBERADO` do inventário anterior bloqueados com motivo `MAPA_PADRAO_ALTERADO`.
- Sessões com `mapId` explícito não serão alteradas; essa referência impede o arquivamento do mapa antigo.
- Assentos reservados, vendidos ou com histórico não serão apagados nem transferidos.
- O novo mapa só poderá ser usado publicamente depois de confirmado e associado ao evento.

## Critérios de aceite

- Um upload confirmado pode substituir o mapa padrão sem apagar a versão anterior durante a revisão.
- A rota rejeita mapa inexistente, mapa de outro evento, mapa em revisão e mapa vazio.
- A rota atualiza o mapa padrão e sincroniza o inventário das sessões herdadas.
- A rota arquiva o mapa anterior quando não há referências diretas.
- A rota preserva o mapa anterior e informa as sessões que o referenciam quando o arquivamento é protegido.
- Uma falha na transação não altera o mapa padrão nem o inventário.
- O painel apresenta sucesso da substituição, sessões afetadas, quantidade de inventário criado e estado do arquivamento anterior.
- Testes da API, testes do painel, lint, typecheck e build passam.

## Arquivos previstos

- `services/api/src/modules/eventos/mapas/mapas.controller.ts`: nova rota administrativa.
- `services/api/src/modules/eventos/mapas/mapas.service.ts`: validação, transação, auditoria e resultado do arquivamento.
- `services/api/src/modules/eventos/eventos-admin.controller.spec.ts` ou testes de mapas: contrato da rota.
- `services/api/src/modules/eventos/mapas/mapas.service.spec.ts`: cenários de troca, idempotência, referências e rollback.
- `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx`: usar a operação de substituição após confirmação e retry.
- `apps/eventos-admin/features/eventos/map-review.tsx`: exibir resultado do arquivamento e sessões afetadas.
- `apps/eventos-admin/features/eventos/map-review.test.ts`: cobertura do novo contrato visual.
