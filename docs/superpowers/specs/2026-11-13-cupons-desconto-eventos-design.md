# Cupons de desconto nos eventos — desenho

## Intenção

Permitir que a equipe configure vários cupons no workspace de cada evento e que a família informe um código no carrinho/checkout público. O preço exibido, o preço enviado ao Stripe e o preço registrado no pedido devem usar o mesmo cálculo no servidor.

O cupom é uma promoção diferente da oferta automática por quantidade. As duas podem ser usadas no mesmo pedido: a oferta por quantidade é aplicada primeiro e o cupom é aplicado sobre o valor restante.

## Objetivos

- Cadastrar, editar, ativar e desativar cupons dentro do workspace do evento.
- Aceitar cupons percentuais e cupons de valor fixo.
- Configurar início/fim de validade, limite total de usos e limite por comprador.
- Aplicar o cupom a qualquer sessão e tipo de ingresso do evento.
- Mostrar no resumo do carrinho o código aceito, os descontos separados e o total atualizado.
- Validar novamente o cupom antes do pagamento e registrar seu uso somente quando o pagamento for confirmado.
- Preservar no pedido e nos itens a evidência do cálculo usado na compra.
- Auditar alterações administrativas e o consumo confirmado do cupom.

## Fora do escopo

- Restringir cupom a uma sessão, tipo de ingresso ou quantidade específica.
- Permitir mais de um cupom no mesmo pedido.
- Criar campanhas globais entre eventos ou cupons para a loja.
- Alterar a regra existente da oferta automática por quantidade.
- Criar gratuidade genérica fora de cupom: pedidos sem um cupom de 100% continuam fora do escopo.

## Regras de negócio

- O código é obrigatório, único dentro do evento, aparado e normalizado em maiúsculas para comparação.
- Um cupom pode estar ativo ou inativo, ter validade opcional (`início` inclusivo e `fim` exclusivo), limite total opcional e limite por comprador opcional.
- O limite por comprador usa e-mail e telefone normalizados informados no checkout; se qualquer um dos dois já tiver sido usado pelo cupom, uma nova utilização é bloqueada.
- O desconto percentual aceita valores de 1% a 100%; o desconto fixo é informado em centavos e não pode ser negativo.
- A sequência do cálculo é: subtotal dos ingressos → oferta automática por quantidade → cupom sobre o subtotal já reduzido → total. O desconto do cupom é limitado ao valor restante e o total nunca fica negativo.
- O campo público aceita um cupom por pedido. Aplicar outro substitui o anterior; enviar vazio remove o cupom.
- Ao aplicar o cupom, o pedido guarda um snapshot da regra e do desconto. Alterar ou desativar o cadastro não muda carrinhos que já receberam o código; a alteração vale para novas aplicações.
- O cupom é validado com suas regras atuais ao ser aplicado ao pedido reservado. Na finalização e antes do pagamento, um cupom já aplicado usa o snapshot congelado; nessas etapas são revalidados apenas a identidade do comprador, os limites disponíveis, a retenção e a integridade do pedido. Um cupom desativado ou expirado depois da aplicação não quebra esse carrinho, mas deixa de ser aceito em novas aplicações.
- O limite de uso não é consumido quando o carrinho é criado ou abandonado. Na criação do checkout, uma retenção temporária do uso pode ser criada para impedir corrida; ela não conta como uso confirmado e expira junto com o checkout.
- Na confirmação transacional do pagamento, a retenção vira um uso confirmado, sob lock do cupom. Se o pagamento falhar ou expirar, a retenção é liberada sem registrar uso.
- Quando o total for maior que zero, o pagamento segue pelo Stripe. Quando um cupom de 100% reduzir o total a zero, o comprador pula o Stripe e o pedido é confirmado em uma transação gratuita que registra o uso e emite os ingressos.
- Se um pedido confirmado for reembolsado ou cancelado, o uso do cupom volta a ficar disponível; a reversão fica registrada como evento de auditoria e não apaga o histórico.
- Se o limite se esgotar antes da confirmação, o pagamento não deve ser criado para aquele pedido; se a confirmação do gateway chegar depois de uma corrida impossível de evitar, a rotina deve manter a consistência e encaminhar o caso para a política de falha/refund já existente, sem emitir ingresso com preço divergente.
- Cupons usados não são apagados fisicamente; ficam inativos para preservar histórico e auditoria.

## Modelo de dados proposto

Criar `evento_cupons` com `eventId`, `code`, `name` opcional, `pricingType`, `discountPercent`, `discountCents`, `startsAt`, `endsAt`, `usageLimit`, `usageLimitPerBuyer`, `active`, `version` e timestamps. Um índice único garante que o código normalizado não se repita dentro do evento.

Adicionar ao pedido o vínculo do cupom aplicado, o código/snapshot da regra e o `couponDiscountCents`, mantendo `discountCents` como a soma da oferta e do cupom. Os itens continuam guardando a alocação final em `pricingEvidence`, com evidência separada de oferta e cupom.

Criar uma tabela de usos confirmados, ligada ao cupom e ao pedido, com unicidade por cupom/pedido e data de confirmação. Criar uma tabela de retenções temporárias ligada ao cupom, pedido e checkout, com expiração e unicidade que impeça duas retenções para o mesmo pedido.

## Contratos e fluxo

- Administração: `GET /eventos/admin/:id/cupons` e `PATCH /eventos/admin/:id/cupons`, seguindo o autosave, versionamento otimista e auditoria já usados por ofertas.
- Público: `POST /eventos/public/pedidos/:orderNumber/cupom` recebe o código, recalcula o pedido reservado e devolve o resumo atualizado; código vazio remove o cupom.
- `ReservaPublicaResult` e `PedidoPublicoResult` passam a expor `coupon`, `couponDiscountCents` e os descontos separados, sem expor dados de uso internos.
- `iniciarCheckout` revalida validade, limite e comprador, cria a retenção temporária e usa o total recalculado para o `expectedAmountCents` do pagamento; ele recusa total entre 1 e 99 centavos e só é chamado quando o total é maior que zero.
- A finalização do pedido, depois de coletar comprador, participantes e aceites, segue para a confirmação gratuita quando o total é zero; essa confirmação usa a mesma emissão de ingressos e a mesma auditoria da confirmação paga, sem criar registro de pagamento Stripe.
- `EventosPagamentosService.confirmarCheckout` converte a retenção em uso confirmado na mesma transação que muda o pedido para `CONFIRMADO` e emite os ingressos.
- A função compartilhada de preço recebe a oferta e o cupom como entradas distintas e retorna o subtotal, desconto da oferta, desconto do cupom, desconto total, total e itens com preço unitário final.

## Interface administrativa

Na etapa **Ingressos**, manter a seção existente de oferta automática e adicionar **Cupons de desconto**. A tela mostra uma lista de cupons com código, tipo/valor, vigência, uso confirmado/limite e situação; permite adicionar e editar cartões de cupom, ativar/desativar e acompanhar conflitos de versão. O histórico de cupons inativos permanece visível.

## Interface pública

No resumo do pedido, exibir um campo “Cupom de desconto”, botão “Aplicar” e opção “Remover” quando houver cupom. O estado de carregamento e as mensagens de código inválido, expirado, inativo ou sem usos disponíveis devem ficar próximos ao campo. O resumo mostra separadamente a oferta por quantidade e o cupom, além do total final.

## Abordagens consideradas

1. Reutilizar `eventoOfertas` com campos de cupom: menor alteração inicial, mas mistura oferta única por quantidade com vários códigos e torna o limite de uso e a auditoria ambíguos.
2. Criar entidade e fluxo próprios de cupons, reutilizando o motor de preços e os contratos de pedido: mantém as invariantes atuais, suporta concorrência e deixa cada regra explícita. **Abordagem escolhida.**
3. Reestruturar ofertas e cupons em um motor geral de promoções: mais flexível para o futuro, mas amplia o risco e o escopo desta entrega.

## Decisões deixadas ao implementador

- Escolher os nomes exatos das colunas e tabelas conforme as convenções Drizzle existentes.
- Definir a representação de datas na tela administrativa, mantendo timestamps com fuso no banco.
- Reutilizar os componentes de autosave, validação, auditoria e formatação de moeda já presentes.
- Cobrir com testes unitários de preço, serviço/API, concorrência de uso, contratos do workspace e fluxo público do cupom.

Atualizado em: 2026-11-13
