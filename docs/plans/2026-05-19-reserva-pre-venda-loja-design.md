# Design: Reservas de Pre-venda na Loja

Data: 2026-05-19

## Contexto

A escola quer lancar produtos novos antes de receber o estoque fisico. Os responsaveis ja devem ver valores, escolher tamanho e quantidade, e gerar um voucher com numero de reserva. A compra efetiva acontece apenas na retirada, presencialmente.

Hoje a loja trata esses produtos como produtos comuns. Como o catalogo publico filtra por estoque disponivel, produtos ativos com estoque zero nao aparecem na vitrine. A solucao proposta transforma esse comportamento em um fluxo oficial de reserva de pre-venda, sem depender de texto no nome do produto.

## Regras de Negocio

A pre-venda sera automatica por estoque da variante/tamanho.

- Produto ativo com pelo menos um tamanho com estoque disponivel aparece na categoria normal do produto.
- Produto ativo com pelo menos um tamanho sem estoque aparece tambem na secao Pre-venda.
- O mesmo produto pode aparecer nas duas areas ao mesmo tempo.
- A tela de produto sera unica e exibira todos os tamanhos.
- Tamanho com estoque disponivel segue para pronta entrega.
- Tamanho sem estoque segue para pre-venda.
- O responsavel nao escolhe o tipo de venda; o sistema decide pelo estoque disponivel no momento.

Exemplo:

```txt
Casaco Moletom
Tamanho 2: estoque 3 -> pronta entrega
Tamanho 4: estoque 0 -> pre-venda
Tamanho 6: estoque 0 -> pre-venda
```

Nesse exemplo, o produto aparece na categoria do produto e tambem na secao Pre-venda, mas ambas abrem a mesma tela de produto.

## Carrinhos

Existirao dois carrinhos separados:

- Carrinho de pronta entrega.
- Carrinho de pre-venda.

Ao adicionar um tamanho, o item vai automaticamente para o carrinho correto. Antes da finalizacao, o sistema revalida o estoque:

- Se um item de pre-venda ganhou estoque, ele migra automaticamente para pronta entrega.
- Se um item de pronta entrega perdeu estoque, o sistema avisa que o estoque acabou e pede confirmacao para transformar em pre-venda.

Se houver itens dos dois tipos na finalizacao, o sistema gera dois vouchers diferentes:

- Um pedido/voucher de pronta entrega.
- Um pedido/voucher de pre-venda.

## Fluxo de Pronta Entrega

O fluxo de pronta entrega continua usando o comportamento atual:

1. O sistema valida estoque disponivel.
2. Reserva a quantidade em `reservedQuantity`.
3. Cria pedido com status `AGUARDANDO_PAGAMENTO`.
4. Libera a reserva se o pedido expirar, for cancelado ou excluido antes do pagamento.
5. Ao confirmar pagamento, converte reserva em venda e baixa o estoque.
6. Depois o admin confirma a retirada.

## Fluxo de Pre-venda

O voucher de pre-venda tera numero publico e consulta por telefone, assim como o pedido atual. Ele registra responsavel, aluno, produto, tamanho, quantidade e valor.

Esse fluxo nao deve mexer em estoque fisico em nenhum momento:

- Ao reservar, nao incrementa `reservedQuantity`.
- Ao confirmar pagamento, nao baixa `quantity`.
- Ao marcar como retirado, nao altera estoque.

Quando as unidades chegarem fisicamente, a escola atendera manualmente as reservas. Apenas as pecas que sobrarem e nao tinham sido reservadas serao lancadas no estoque como pronta entrega.

## Status e Origem do Pedido

A API deve diferenciar pedidos de pronta entrega e reservas de pre-venda.

Opcao recomendada:

- Novo `orderSource`: `PRE_VENDA`.
- Novo status inicial: `RESERVADO_PRE_VENDA`.

Transicoes previstas para pre-venda:

```txt
RESERVADO_PRE_VENDA -> PAGO -> RETIRADO
RESERVADO_PRE_VENDA -> CANCELADO
```

As acoes de confirmar pagamento e retirada continuam separadas.

Para `orderSource = PRE_VENDA`, confirmar pagamento deve registrar pagamentos e mudar status para `PAGO`, mas nao deve chamar baixa de estoque. Marcar como retirado deve mudar status para `RETIRADO`, sem alterar estoque.

## Loja Publica

A loja publica deve ter uma secao clara de Pre-venda, separada das categorias normais. O produto pode aparecer:

- Na categoria normal, quando tiver algum tamanho com estoque.
- Na secao Pre-venda, quando tiver algum tamanho sem estoque.

Os cards podem mostrar selo contextual:

- `Disponivel`, quando exibido na categoria normal.
- `Pre-venda`, quando exibido na secao Pre-venda.

A tela de produto deve mostrar todos os tamanhos, indicando o estado de cada um. O botao de adicionar usa o tamanho escolhido para enviar o item ao carrinho correto.

## Loja-admin

O admin deve conseguir:

- Ver pedidos de pre-venda separados dos pedidos de pronta entrega.
- Filtrar por `PRE_VENDA`.
- Confirmar pagamento.
- Confirmar retirada.
- Cancelar reserva.
- Consultar demanda por produto e tamanho.

A direcao precisa de um resumo de pre-venda com:

- Produto.
- Tamanho.
- Quantidade reservada.
- Quantidade paga.
- Quantidade retirada.
- Responsaveis vinculados.

Esse relatorio substitui o uso informal da lista de interesse para produtos novos que serao tratados como reserva garantida.

## API e Dados

O catalogo publico deve centralizar a regra de classificacao para evitar divergencia no frontend:

- Variante com `availableStock > 0`: `modoVenda = "PRONTA_ENTREGA"`.
- Variante com `availableStock = 0`: `modoVenda = "PRE_VENDA"`.

A listagem por categoria normal deve incluir produtos com alguma variante em pronta entrega.

A listagem de pre-venda deve incluir produtos com alguma variante em pre-venda.

A criacao de pedido deve separar os itens por modo de venda. Se a finalizacao tiver itens dos dois tipos, deve criar dois pedidos e retornar os dois numeros de voucher.

## Tratamento de Erros

Antes de finalizar, a API deve revalidar estoque e modo de venda de cada variante.

Casos esperados:

- Item de pre-venda agora tem estoque: migrar para pronta entrega.
- Item de pronta entrega ficou sem estoque: retornar erro recuperavel pedindo confirmacao para transformar em pre-venda.
- Produto ou variante inativa: bloquear finalizacao com mensagem clara.
- Mistura de itens pronta entrega e pre-venda: criar pedidos separados.

## Testes

Classes impactadas da matriz da loja:

- `LOJA-03`: catalogo publico e disponibilidade por variante.
- `LOJA-05`: estoque e concorrencia, garantindo que pre-venda nao mexe no estoque.
- `LOJA-06`: pedidos, pagamento e retirada com nova origem `PRE_VENDA`.
- `LOJA-08`: contrato API/UI para os novos campos de modo de venda e retorno de dois vouchers.
- `LOJA-09`: quantidade e preco recalculados no backend.

Testes minimos esperados:

- Produto com tamanho em estoque aparece na categoria normal.
- Produto com tamanho sem estoque aparece na secao Pre-venda.
- Produto com tamanhos mistos aparece nas duas areas.
- Tamanho com estoque entra no carrinho de pronta entrega.
- Tamanho sem estoque entra no carrinho de pre-venda.
- Pre-venda cria pedido com numero e sem alterar `reservedQuantity`.
- Confirmar pagamento de pre-venda nao baixa `quantity`.
- Confirmar retirada de pre-venda nao baixa `quantity`.
- Finalizacao com itens mistos gera dois vouchers.
- Revalidacao avisa quando item de pronta entrega ficou sem estoque.
