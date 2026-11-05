# Versões do mapa: editar, excluir e um mapa por evento — Design

**Data:** 2026-11-04
**Status:** aprovada pelo Renato em 2026-11-04
**Contexto:** continuação do projeto 1 (gerador de mapa e conferência, spec `2026-11-02-eventos-gerador-mapa-design.md`), já em produção desde o deploy `00e65b5`.

## Intenção

Depois de publicado, um mapa não pode ser mudado. A escola precisa corrigir um mapa publicado (por exemplo, não vender a fileira X) e tirar mapas errados do caminho. Isso é seguro enquanto ninguém comprou um lugar; depois da primeira venda, mexer no mapa pode deixar um ingresso pago apontando para um lugar que não existe.

Hoje há também uma armadilha. A etapa "Sessões e local" permite que cada sessão escolha um mapa próprio. Essa troca muda a sessão sem refazer o inventário e pode quebrar a página de compra. Ela também deixou a sessão do ballet presa no mapa antigo: o mapa do evento é o v4, enquanto a sessão de 07/12/2026 ainda usa o v2 (784 lugares, fileiras inventadas). A tela de hoje não oferece como levar a sessão para o v4.

## Estado atual (04/11/2026)

- O evento "Espetáculo de Ballet 2026 — O Chamado do Oceano" tem o mapa padrão "Mapa v4", publicado pelo gerador. A fileira X está à venda e a capacidade é 786.
- A sessão `af7b9de9-…` (07/12/2026, PUBLICADA, capacidade 781) tem a exceção "Mapa v2". Nela, os 784 lugares aparecem disponíveis no mapa público.
- O evento ainda não foi divulgado.

## Objetivos

- **Um mapa por evento.** Todas as sessões usam o mapa do evento, e o mapa só é gerenciado em "Mapa e lugares".
- **Editar** um mapa publicado sem reenviar o PDF.
- **Excluir** versões de mapa que não servem mais.
- **Publicar** passa a levar todas as sessões para a versão publicada, numa operação só.
- **Travar** editar, excluir e enviar nova planta depois da primeira venda com pagamento confirmado.
- Resolver o ballet: publicar uma versão corrigida (fileira X sem venda) e levar a sessão para ela.

## Fora do escopo

- Mudar o mapa depois da primeira venda confirmada, de qualquer forma.
- Bloquear ou liberar lugares por sessão. A tela de inventário continua sem ações.
- Mudanças na tela do comprador (`apps/eventos`), no checkout, no pagamento ou no TTL da reserva.
- O redesenho do site público (projeto 2) e do restante do painel (projeto 3).

## Anti-objetivos

- Um ingresso pago, um ingresso emitido ou um check-in ficar apontando para um lugar que mudou ou sumiu.
- Um Pix ou cartão confirmado no último minuto pagar um lugar de um mapa que já foi trocado.
- Uma sessão ficar num mapa diferente do mapa do evento.
- Apagar dados de compra paga. Tentativas não pagas podem perder o vínculo com o lugar; o pedido continua registrado.

## Regras de venda (decisão do Renato, com detalhamento meu)

**Venda confirmada** trava Editar, Excluir e Enviar nova planta para sempre. Ela existe quando, em qualquer sessão do evento, há:
- um pedido em `CONFIRMADO`, `USADO`, `NO_SHOW` ou `REEMBOLSADO` (o pagamento foi confirmado em algum momento);
- ou um ingresso emitido;
- ou um check-in.

**Compra em andamento** *(decisão minha)* trava as mesmas ações por alguns minutos. Ela existe quando há um pedido em `INICIADO`, `RESERVADO` ou `AGUARDANDO_PAGAMENTO` com `expiresAt` no futuro. O `expiresAt` do pedido já é estendido até o vencimento do checkout do Stripe (`eventos-public-sales.service.ts:96-120`). O motivo: um pagamento confirmado nesse intervalo apontaria para um lugar que deixou de existir. A mensagem é "Há uma compra em andamento neste evento. Tente de novo em alguns minutos."

**Operação administrativa ativa** *(decisão minha, por cautela)* trava enquanto existir. É um bloqueio, uma cortesia ou uma reserva em `eventoOperacoesAdministrativas` com status `ATIVA`. A mensagem cita a operação.

**Tentativa encerrada** não trava nada. São os pedidos `EXPIRADO` ou `CANCELADO`, e os pedidos em `INICIADO`, `RESERVADO` ou `AGUARDANDO_PAGAMENTO` com `expiresAt` no passado. Ao trocar o mapa, os itens e as reservas desses pedidos que apontam para lugares do mapa antigo são desligados. O registro do pedido e do pagamento continua. Pedidos que ainda não estavam `EXPIRADO` ou `CANCELADO` passam para `EXPIRADO`. As chaves estrangeiras de `eventoItensPedido` e `eventoReservas` para o inventário são `restrict` e não aceitam nulo, por isso o desligamento é necessário.

A API aplica essas regras. A tela só mostra o estado e a mensagem.

## Um mapa por evento

- O mapa do evento é o `defaultMapId`. Todas as sessões guardam `mapId` igual ao mapa do evento, explicitamente. O mapa público (`getPublicMap`, em `eventos.service.ts:~286`) exige `session.mapId`, então ele fica como está.
- A seção "Mapa de assentos" ("Usar mapa padrão" / "Escolher outro mapa") sai da etapa "Sessões e local" (`apps/eventos-admin/features/eventos/session-editor.tsx:~224-245`), e o formulário deixa de enviar `mapId` e `inheritMap`.
- A API deixa de aceitar `mapId` na criação e na edição de sessão *(decisão minha)*. Ele sai de `criarSessaoSchema` e do schema de criação de evento (`packages/shared/src/schemas/eventos.ts`), e o `.strict()` passa a recusar o campo. A sessão nova recebe o mapa do evento (`event.defaultMapId`, que pode ser nulo se o evento ainda não tiver mapa). O inventário dela continua sendo inicializado pelo fluxo atual.
- Exceções antigas, como a do ballet, se resolvem na próxima publicação, que leva todas as sessões para a versão publicada.

## Versões do mapa (página "Mapa e lugares")

Uma lista "Versões do mapa" mostra, da mais nova para a mais antiga:
- a versão e o nome do arquivo;
- a situação: Em conferência, **Atual**, Publicada (não atual) ou Arquivada;
- o número de lugares;
- as sessões que usam a versão.

Cada linha tem os botões que se aplicam a ela. Quando há venda confirmada, os botões aparecem desabilitados com a frase "Bloqueado: já há lugares vendidos com pagamento confirmado neste evento."

### Editar

- Vale para a versão **Atual** e, *por decisão minha*, para qualquer versão publicada ou arquivada que ainda tenha proposta. Mapas antigos, de antes do gerador, não têm proposta e não podem ser editados.
- Cria uma versão nova `EM_REVISAO` a partir da proposta da versão escolhida:
  - mantém a legenda confirmada e os pontos conferidos;
  - reinicia a `revisao` em 0;
  - copia o arquivo original no storage, para cada versão ter o seu e a exclusão de uma nunca apagar o arquivo de outra.
- A página abre a mesma tela de conferência. Publicar segue as regras da seção "Publicar".
- Se já existir uma versão em conferência, Editar a substitui, arquivando a anterior, como faz o envio de outra planta.

### Excluir

- Vale para qualquer versão que **não** seja a Atual *(decisão minha: o evento nunca fica sem mapa por exclusão)*. Inclui uma versão em conferência, o que equivale a descartar a conferência.
- Se nenhuma sessão usa a versão, apaga o mapa e os lugares (pela cascata existente), a importação e a proposta e os arquivos da versão no storage. A importação (`evento_importacoes_mapa`) tem `map_id` com `set null` e não `cascade`, então precisa ser apagada explicitamente.
- Se alguma sessão usa a versão, por ser uma exceção antiga, leva primeiro a sessão para a versão Atual, com as mesmas regras de venda, e depois apaga.
- Pede confirmação: "Excluir a versão N? Esta ação não pode ser desfeita."

### Publicar (muda)

Publicar uma versão em conferência faz, numa transação só:
1. Confere as regras de venda. Se houver venda confirmada, compra em andamento ou operação ativa, recusa e não muda nada.
2. Confirma a versão, como hoje: lugares, layout e status `CONFIRMADO`.
3. Torna a versão o mapa do evento.
4. Leva **todas** as sessões do evento para a versão:
   - desliga as tentativas encerradas;
   - apaga o inventário antigo;
   - cria o inventário novo a partir dos lugares, respeitando "não vender";
   - grava `mapId` em cada sessão;
   - ajusta a capacidade para o número de lugares vendáveis.
5. Arquiva as versões anteriores que ficaram sem sessão. Elas continuam na lista e podem ser excluídas.

A tela deixa de mostrar o passo separado "Migrar sessões e excluir mapa anterior". Como o evento não tem venda confirmada no momento da publicação, o fluxo de substituição antigo, que preserva lugares vendidos, não é mais necessário nesta tela.

### Enviar nova planta

Fica travado pelas mesmas regras de venda *(decisão minha, coerente com "nada muda após a primeira venda")*.

### Rotas antigas que trocam o mapa (fechadas)

Hoje há rotas que trocam o mapa do evento ou de uma sessão sem passar pelas regras acima *(decisão minha: fechá-las, para não sobrar caminho que deixe uma sessão num mapa diferente do evento)*.

**Saem:**
- `PATCH :id` deixa de aceitar `defaultMapId`;
- `PATCH :id/mapa-padrao` (a página atual chama essa rota ao carregar);
- `POST :id/mapa-padrao/substituir`;
- `POST mapas/:versionId/migrar-e-excluir`;
- `POST mapas/:versionId/arquivar`.

**Também na página:** o carregamento deixa de chamar `PATCH mapa-padrao`, e somem o `ResultadoPublicacao` e os botões "Substituir mapa padrão novamente" e "Migrar sessões e excluir mapa anterior".

O código interno dessas operações pode ser reaproveitado pela rotina nova. Antes de remover cada rota, quem construir confere com `grep` que nenhum outro app a chama.

### Pagamento atrasado (já coberto)

Um Pix pode ser pago até cerca de 30 minutos depois do `expiresAt` do pedido. O sistema atual já cobre isso: o job que roda a cada minuto marca o pedido como `EXPIRADO`, e `confirmarCheckout` recusa o pagamento de pedido expirado. Por isso a regra de "compra em andamento" pelo `expiresAt` do pedido basta. Os testes da rotina nova devem incluir um pedido expirado cujo pagamento chega depois da troca do mapa: ele precisa ser recusado, como hoje.

## Pequenas melhorias na conferência (decisão minha; servem ao caso do ballet)

- **Selecionar fileira.** Com um lugar selecionado, o botão "Selecionar fileira inteira" seleciona todos os lugares com a mesma fileira. Bloquear a fileira X passa a levar dois cliques, não 34.
- **Palco.** O desenho do palco no `MapaEstiloB` não pode cobrir lugares. A largura e a curva devem caber acima da primeira fileira; hoje o palco cobre os camarotes da fileira X.
- **Pendências.** Cada pendência perto de "Publicar mapa" leva ao ponto ou ao lugar correspondente e diz o que fazer. O ponto para conferir mostra o botão "Marcar como conferido" sem exigir um clique antes. O texto de contagem concorda no singular ("Resolva a 1 pendência para liberar").

## O caso do ballet (depois do deploy)

1. Em "Mapa e lugares", clicar em **Editar** no v4. A conferência abre já conferida.
2. Selecionar um lugar da fileira X, clicar em **Selecionar fileira inteira** e marcar **Não vender**. O resumo deve mostrar 34 em "não vender" e 752 lugares vendáveis.
3. Clicar em **Publicar**. A sessão de 07/12 sai do v2 e vai para a versão nova, com capacidade 752. O v2 e o v4 ficam arquivados.
4. Excluir o v2, o v4 e outras versões arquivadas é opcional.
5. Se Publicar recusar por compra em andamento, esperar alguns minutos. Se recusar por venda confirmada, o caso volta ao Renato.
6. Conferir pelo mapa público da sessão: 786 lugares, 34 bloqueados na fileira X e nenhum lugar do v2.

## Decisões tomadas

**Pelo Renato:**
- Editar e excluir só são possíveis enquanto nenhuma cadeira tiver sido vendida. Depois da primeira venda, os botões ficam bloqueados.
- "Venda" é pagamento confirmado.
- O mapa sai da etapa "Sessões e local" e fica só em "Mapa e lugares".

**Minhas (marcadas no texto, podem ser revistas):**
- Compra em andamento trava por alguns minutos. Operação administrativa ativa também trava.
- `REEMBOLSADO` conta como venda, porque o pagamento foi confirmado em algum momento.
- Tentativas encerradas são desligadas dos lugares antigos e o pedido continua registrado.
- Editar cria uma versão nova, com cópia do PDF e conferências mantidas.
- A versão Atual não pode ser excluída.
- Publicar leva todas as sessões e arquiva as versões anteriores.
- Enviar nova planta também trava após a primeira venda.
- A API deixa de aceitar `mapId` nas sessões. A sessão sempre guarda o mapa do evento.
- Fechar as rotas antigas de troca de mapa (`PATCH :id` com `defaultMapId`, `mapa-padrao`, `substituir`, `migrar-e-excluir`, `arquivar`).
- As três melhorias pequenas da conferência.

## O que fica com quem construir

- **Reaproveitamento do código existente.** Decidir como reaproveitar `migrarSessoesEExcluir`, `substituirMapaPadrao`, `sincronizarInventarioMapa` e `ajustarCapacidade` (em `services/api/src/modules/eventos/mapas/mapas.service.ts`) numa rotina única de "levar sessões para a versão". A rotina precisa manter as travas `FOR UPDATE` na mesma ordem (evento, sessões, mapas, inventário) para não criar deadlock.
- **Desligamento das tentativas encerradas.** Como desligar com segurança: apagar itens e reservas daquele pedido, com auditoria do que foi desligado.
- **Rotas e formato das respostas**, sugeridas:
  - `POST mapas/:versionId/editar`;
  - `DELETE mapas/:versionId`;
  - `GET mapas`, que passa a trazer o estado de venda do evento e as sessões por versão.
- **Exclusão no storage.** Tratar arquivo já ausente como sucesso.
- **Testes:**
  - cada regra de venda (confirmada, em andamento, encerrada, operação ativa);
  - publicar com exceção antiga;
  - excluir com e sem sessão;
  - editar mantendo conferências;
  - API recusando `mapId` na sessão;
  - tela de sessões sem a seção de mapa;
  - botões desabilitados com a frase.
- **Migration.** Avaliar se precisa de uma; a expectativa é que não.
