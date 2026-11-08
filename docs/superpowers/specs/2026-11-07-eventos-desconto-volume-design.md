# Desconto automático por volume e seleção de 10 ou mais lugares — Design

**Data:** 2026-11-07  
**Status:** aprovado pelo Renato em 2026-11-07  
**Contexto:** implementação escolhida para o módulo público de eventos após a aprovação da abordagem configurável por evento.

## Intenção

A família deve poder selecionar dez ou mais lugares no mapa da mesma sessão e receber automaticamente 15% de desconto sobre o valor total dos ingressos selecionados. A regra vale para qualquer combinação de tipos de ingresso no pedido. Por exemplo, seis ingressos adultos e quatro infantis também atingem o limite, e o desconto incide sobre o subtotal dos dez ingressos.

O backend será a autoridade do preço. O navegador mostrará uma prévia para orientar a escolha, mas a reserva, o pedido, a sessão de pagamento e a confirmação do Stripe usarão o cálculo feito no servidor.

## Estado atual que a mudança toca

- `apps/eventos` já mantém a seleção de assentos no navegador, permite trocar o tipo de ingresso por lugar e serializa vários lugares para o checkout.
- A reserva pública aceita entre 1 e 20 lugares. Cada lugar corresponde a um item e a um participante.
- `eventoOfertas` já existe no banco, mas guarda apenas uma faixa de quantidade, um preço fixo e tipos compatíveis. Não há configuração de ofertas no painel.
- `EventosPublicSalesService` lê ofertas, porém aplica `priceCents` como se fosse preço unitário de cada lugar. Isso não representa um desconto percentual e poderia multiplicar o valor de um combo.
- `iniciarCheckout` monta as linhas do Stripe a partir dos itens do pedido e usa `eventoPedidos.totalCents` como valor esperado. As linhas precisam somar exatamente o total descontado.

## Objetivos

- Configurar, por evento, uma oferta percentual com quantidade mínima de lugares.
- Aplicar exatamente 15% quando o pedido tiver 10 ou mais lugares da mesma sessão, independentemente do tipo de ingresso.
- Mostrar no mapa e no resumo a quantidade selecionada, o subtotal, a regra atingida, o desconto e o total.
- Persistir o subtotal, o desconto, a oferta aplicada e os preços cobrados por item para auditoria e reprocessamento idempotente.
- Garantir que o valor enviado ao Stripe seja o mesmo valor confirmado pelo webhook.
- Manter a reserva temporária somente no avanço para o checkout, sem criar hold a cada clique no mapa.

## Fora do escopo

- Redesenhar todo o site público ou substituir o mapa SVG já implantado.
- Alterar o gerador de mapas, o inventário por sessão ou o prazo de reserva de 15 minutos.
- Trocar o gateway, criar uma nova forma de pagamento ou implementar o formulário embutido do Stripe nesta entrega.
- Criar cupons digitados pelo comprador, descontos cumulativos ou regras diferentes por sessão.
- Aumentar o limite atual de 20 lugares por pedido.
- Manter o preço fixo de R$ 380,00 como regra. A regra aprovada é percentual: dez ingressos adultos de R$ 45,00 resultam em R$ 382,50.

## Anti-objetivos

- Confiar no subtotal ou no desconto enviados pelo navegador.
- Aplicar o desconto apenas ao tipo adulto quando o pedido tiver outros tipos; a regra aprovada incide sobre o total de todos os ingressos do pedido.
- Criar uma linha de combo sem vínculo individual com cada assento, participante e QR Code.
- Enviar ao Stripe linhas que somem um valor diferente de `eventoPedidos.totalCents`.
- Reservar dez lugares automaticamente no primeiro clique, antes de o comprador decidir continuar.

## Abordagens consideradas

### Regra específica no serviço de vendas

Uma função fixa aplicaria 15% quando a quantidade chegasse a dez, sem alterar o modelo de ofertas. Seria rápida e sem migration, mas não atenderia ao objetivo de configurar campanhas por evento e manteria a tabela existente sem uso coerente.

### Oferta percentual configurável por evento — escolhida

A estrutura `eventoOfertas` será ampliada para representar ofertas percentuais e faixas abertas. A escola poderá cadastrar uma oferta com mínimo de 10 lugares e desconto de 15%; o serviço de vendas aplicará a versão ativa e registrará um snapshot no pedido. Essa abordagem exige migration, contrato administrativo e pequenas mudanças no painel, mas mantém o modelo multi-evento e evita regra escondida no código.

### Tipo de ingresso “Combo 10”

O combo seria vendido como um produto único. Essa alternativa não preserva a relação um ingresso–um assento–um participante e complica a emissão de dez QR Codes, por isso foi descartada.

## Regra comercial

1. A unidade de quantidade é o número de lugares distintos selecionados para uma sessão. Como cada item atual tem quantidade 1, a quantidade de lugares e a quantidade de ingressos coincidem.
2. A oferta é elegível quando `quantity >= minQuantity`. Para a regra inicial, `minQuantity = 10`, `discountPercent = 15` e `maxQuantity = null` (sem limite próprio além do máximo público atual de 20).
3. O subtotal é a soma dos preços persistidos dos tipos de ingresso, em centavos.
4. O desconto é `arredondar(subtotalCents * discountPercent / 100)` para o centavo mais próximo. O total é `subtotalCents - discountCents`.
5. O cálculo considera todos os tipos do pedido. Se houver seis adultos de R$ 45,00 e quatro crianças de R$ 22,50, o subtotal será R$ 360,00, o desconto R$ 54,00 e o total R$ 306,00.
6. Nenhum desconto é aplicado abaixo de dez lugares.
7. Uma única oferta ativa é permitida por evento na primeira entrega. Não haverá empilhamento nem desempate entre campanhas; uma segunda oferta ativa será recusada pela API administrativa.

## Modelo de dados e versionamento

### Ofertas

`eventoOfertas` continuará sendo a fonte de configuração por evento e receberá:

- `pricingType`: `PERCENTUAL` ou `VALOR_FIXO`, preservando compatibilidade conceitual com ofertas antigas;
- `discountPercent`: inteiro entre 0 e 100, obrigatório para `PERCENTUAL`;
- `priceCents`: opcional para `PERCENTUAL` e obrigatório para `VALOR_FIXO`;
- `maxQuantity`: nullable, permitindo faixa aberta;
- `version` e `active`, mantendo histórico em vez de sobrescrever uma regra já usada.

A migration tornará `priceCents` e `maxQuantity` compatíveis com os dois modos, preencherá ofertas existentes como `VALOR_FIXO` e preservará `priceCents` como o preço total da faixa de quantidade, que era a semântica do antigo combo. A configuração administrativa criará uma nova versão, desativará a anterior e registrará auditoria; pedidos já reservados continuarão com o snapshot que receberam. A API rejeitará mais de uma oferta ativa no mesmo evento; prioridade e combinação de campanhas ficam para outra entrega.

### Pedido e itens

`eventoPedidos` receberá `subtotalCents`, `discountCents` e `appliedOfferId` nullable. Pedidos anteriores serão preenchidos com `subtotalCents = totalCents`, `discountCents = 0` e nenhuma oferta.

`eventoItensPedido.unitPriceCents` passará a representar o valor efetivamente cobrado por unidade. `pricingEvidence` preservará, no mínimo, o preço-base, o desconto alocado, o identificador e a versão da oferta, a versão do tipo de ingresso e o índice do participante. Assim, o Stripe, a consulta do pedido e a auditoria usarão o mesmo valor, sem perder o preço original.

O desconto total será distribuído proporcionalmente ao preço-base pelo método do maior resto: calcula-se o valor líquido ideal de cada item, grava-se a parte inteira, e os centavos restantes vão para as maiores frações; empates usam `participantIndex` e depois `seatId` em ordem ascendente. A soma dos `totalPriceCents` será exatamente o total do pedido e nenhum item poderá ficar negativo. O rateio e a ordem canônica ficarão registrados em `pricingEvidence`.

## Contratos da API

### Público

- `PublicEventOffer` expõe somente `id`, versão, nome público, `minQuantity`, `maxQuantity` e `discountPercent`; nenhum campo interno ou preço calculado pelo cliente será confiado pelo servidor.
- `PublicEventSession` inclui as ofertas percentuais ativas do evento para permitir a prévia no mapa e no checkout.
- `ReservaPublicaResult` e `PedidoPublicoResult` passam a retornar `subtotalCents`, `discountCents`, `totalCents` e `appliedOffer` (ou `null`), com id, versão, nome, faixa e percentual, além dos itens atuais.
- `reservaPublicaSchema` continua limitando a seleção a 20 lugares, mas o serviço rejeita lugares duplicados e tipos que não pertencem ao evento antes de alterar o inventário.

### Administrativo

- `GET /eventos/admin/:id/ofertas` lista as versões ativas configuráveis.
- `PATCH /eventos/admin/:id/ofertas` valida e versiona as ofertas do evento, com escopo da escola, auditoria e mensagens de conflito consistentes com as demais etapas do workspace.
- Uma oferta percentual exige nome, mínimo positivo, percentual inteiro entre 0 e 100 e faixa válida; uma oferta de valor fixo exige preço não negativo.
- O endpoint lista as versões do evento com estado `ATIVA` ou `ARQUIVADA`; a vitrine recebe somente a versão ativa.
- A tela de ingressos terá uma seção de descontos/ofertas com quantidade mínima, quantidade máxima opcional, percentual, ativação e resumo da regra. O primeiro release exibirá a configuração percentual necessária sem exigir que a escola compreenda detalhes de arredondamento.

## Fluxo público

1. A página da sessão mantém o tipo escolhido como padrão inicial, mas cada assento continua podendo receber outro tipo no resumo.
2. Ao clicar em lugares disponíveis, a seleção local é atualizada. O comprador pode selecionar de 1 a 20 lugares; ao chegar a 10, o resumo recalcula a oferta em tempo real.
3. O resumo fixo do celular e o resumo completo mostram quantidade, subtotal, “15% de desconto a partir de 10 lugares” quando elegível, desconto e total.
4. O botão de checkout permanece bloqueado apenas quando não há assentos ou algum item não tem tipo de ingresso válido; não é necessário atingir dez lugares para comprar.
5. Ao continuar, a reserva envia somente assentos, tipos, participantes e comprador. O servidor recalcula o preço, cria o pedido e devolve o detalhamento autoritativo.
6. O formulário de checkout usa o detalhamento da reserva para manter o resumo coerente. Em caso de `SEAT_UNAVAILABLE`, a seleção local continua sendo reidratada como hoje.

## Pagamento

`iniciarCheckout` usará `eventoItensPedido.unitPriceCents` já distribuído para montar as linhas do Stripe e `eventoPedidos.totalCents` como total esperado. A soma das linhas será validada antes da chamada ao gateway; divergência gera erro interno e não cria uma sessão incorreta.

O registro de `eventoPagamentos.expectedAmountCents` continuará recebendo o total do pedido. A confirmação do cartão ou Pix seguirá validando o valor contra o pedido e emitindo um ingresso por item, sem alteração no fluxo de webhook, QR Code ou expiração. Se o total calculado for inferior a 100 centavos, a reserva será recusada com erro de valor mínimo antes de criar pedido ou alterar inventário, pois o gateway atual não possui fluxo de gratuidade.

## Testes e aceite

- Função de preço: 9 lugares sem desconto; 10 adultos com 15% exatos; 11 lugares; mistura 6 adultos + 4 crianças; centavos que exigem arredondamento; oferta inativa; faixa inválida; duas ofertas ativas recusadas; total abaixo de R$ 1,00.
- Serviço de vendas: preço vem do banco, oferta é aplicada ao pedido, snapshot permanece na repetição idempotente, duplicidade de assento é recusada e nenhuma mutação ocorre quando a validação falha.
- Checkout: linhas do Stripe somam `totalCents`, `expectedAmountCents` recebe o total descontado e confirmação recusa qualquer valor divergente.
- Painel: leitura, validação, versionamento, auditoria e atualização concorrente de ofertas.
- Público: selecionar dez assentos, ver o desconto aparecer, trocar quatro tipos para criança, conferir total, continuar com 20 lugares e manter o comportamento de seleção abaixo do limite.
- Executar os testes específicos dos pacotes alterados e, antes de integrar, `pnpm turbo lint && pnpm turbo typecheck`.

## Implantação e configuração inicial

1. Aplicar a migration do modelo de ofertas e dos campos de preço do pedido.
2. Publicar a API e os apps com a nova lógica, mantendo pedidos existentes compatíveis.
3. No painel, cadastrar para o evento de ballet uma oferta percentual ativa com mínimo 10 e desconto 15% antes de divulgar o evento.
4. Conferir pelo mapa público e por uma reserva de teste que 9 lugares não recebem desconto, 10 lugares recebem 15% e o Stripe recebe exatamente o total calculado.

## Decisões tomadas e chamadas do construtor

**Decisões do Renato:**

- Regra configurável por evento.
- Dez ou mais lugares ativam a regra.
- Desconto de 15% exatos sobre o total, inclusive com tipos mistos.
- O preço fixo de R$ 380,00 não prevalece sobre o percentual.

**Chamadas deste design:**

- Manter o limite público de 20 lugares.
- Arredondar o desconto para o centavo mais próximo.
- Versionar ofertas e congelar o snapshot de cada pedido.
- Tratar `VALOR_FIXO.priceCents` legado como preço total da faixa.
- Permitir uma única oferta ativa por evento na primeira entrega.
- Recusar pedido com total inferior a R$ 1,00, em vez de criar um pagamento gratuito.
- Distribuir o desconto pelo método do maior resto para que as linhas do Stripe fechem com o total.
- Manter o fluxo atual de Stripe e de reserva; esta entrega muda o preço, não o gateway.

## O que fica para o plano de implementação

- Definir o nome exato da migration e o enum usado pelo banco, seguindo as convenções existentes.
- Escolher a forma de compartilhar a função pura de preço entre API e app público sem importar dependências de banco para o frontend.
- Implementar a distribuição determinística de centavos e seus testes de propriedade/limites.
- Integrar os contratos públicos ao componente de mapa e aos dois resumos sem quebrar a reidratação após conflito.
- Confirmar o formato de auditoria e os estados de oferta no workspace administrativo.
