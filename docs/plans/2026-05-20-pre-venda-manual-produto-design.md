# Design: Pre-venda Manual por Produto

Data: 2026-05-20

## Contexto

A regra atual classifica pre-venda automaticamente pelo estoque da variante:
tamanho com estoque vira pronta entrega; tamanho sem estoque vira pre-venda.
Isso ficou dificil de explicar para o responsavel e para o admin, porque um
produto pode mudar de comportamento apenas por causa do estoque.

A nova regra simplifica o dominio: o admin decide no cadastro do produto se ele
e ou nao de pre-venda. Estoque deixa de ser criterio para colocar um produto na
categoria Pre-venda.

Este desenho substitui a regra automatica descrita em
`docs/plans/2026-05-19-reserva-pre-venda-loja-design.md`.

## Decisoes Aprovadas

- O cadastro do produto tera um checkbox `Produto de pre-venda`.
- Todos os produtos existentes comecam como nao pre-venda.
- Produto marcado como pre-venda entra na categoria Pre-venda.
- Produto marcado como pre-venda tambem aparece em Ver Todos e na categoria
  original dele.
- Produto marcado como pre-venda usa pre-venda para todos os tamanhos
  cadastrados, mesmo se algum tamanho tiver estoque.
- Produto nao marcado como pre-venda e sem estoque aparece como Esgotado.
- Produto nao marcado como pre-venda e sem estoque nao pode ser reservado.
- Pedido de pre-venda continua gerando voucher/reserva e nao movimenta estoque.

## Modelo de Dados

A tabela `shop_products` ganha o campo:

```txt
is_pre_sale boolean not null default false
```

No codigo TypeScript, o campo deve aparecer como `isPreSale`.

O campo pertence ao produto, nao a variante. A categoria original continua sendo
uma das categorias existentes: `UNIFORME_FEMININO`, `UNIFORME_MASCULINO`,
`UNIFORME_UNISSEX` ou `ACESSORIO`. Nao sera criada uma categoria real de
pre-venda no banco.

A migracao deve ser conservadora: todos os registros existentes recebem
`false`. Assim a vitrine de pre-venda fica vazia ate o admin marcar produtos
manualmente.

## Regra de Catalogo

O catalogo publico passa a classificar pelo produto:

```txt
Produto isPreSale = true
  -> todas as variantes ativas retornam modoVenda = PRE_VENDA
  -> aparecem no filtro Pre-venda, Ver Todos e categoria original
  -> podem ser reservadas sem baixar estoque

Produto isPreSale = false
  -> variantes retornam modoVenda = PRONTA_ENTREGA
  -> availableStock controla se pode comprar
  -> availableStock = 0 aparece como Esgotado
  -> nao aparece no filtro Pre-venda
```

O nome `PRONTA_ENTREGA` continua representando o canal normal de venda. Para
produto nao pre-venda sem estoque, a compra fica bloqueada por
`availableStock = 0` e `isAvailable = false`.

## Loja Publica

O menu lateral continua com a opcao Pre-venda. A diferenca e que essa opcao
lista somente produtos marcados pelo admin.

Em Ver Todos e na categoria original, produtos de pre-venda tambem aparecem,
mas sempre com selo `Pre-venda` e acao `Reservar`. Eles nao devem mostrar selo
de estoque, mesmo que exista quantidade cadastrada.

Produtos nao pre-venda sem estoque aparecem como `Esgotado`. No detalhe, seus
tamanhos sem estoque podem ser vistos, mas o botao de compra fica desabilitado.

A rota `/pre-venda` continua existindo e passa a listar apenas produtos com
`isPreSale = true`.

## Checkout e Pedidos

O carrinho continua separando itens por `modoVenda`.

Para item `PRE_VENDA`, o checkout chama o endpoint de pre-venda e cria pedido
com:

```txt
orderSource = PRE_VENDA
status = AGUARDANDO_PAGAMENTO
expiresAt = null
```

Esse fluxo nao altera `quantity`, `reservedQuantity` nem ledger de estoque.

A API deve revalidar o produto no fechamento:

- Se item de pre-venda pertence a produto que nao esta mais marcado como
  pre-venda, bloquear com mensagem clara.
- Se item de pronta entrega ficou sem estoque, bloquear a compra. Nao deve mais
  oferecer conversao automatica para pre-venda.

## Loja-admin

O formulario de produto ganha o checkbox `Produto de pre-venda`, perto de
categoria e preco. Ao editar, o valor salvo deve preencher o checkbox.

A listagem de produtos deve exibir um indicador simples para produtos de
pre-venda, para o admin conseguir revisar a vitrine sem abrir item por item.

As telas de pedidos e relatorios de pre-venda continuam usando
`orderSource = PRE_VENDA`. O que muda e apenas a origem dos itens que chegam ao
fluxo de pre-venda.

Venda presencial deve tratar produto de pre-venda como indisponivel para venda
normal, pois pre-venda gera reserva e nao baixa estoque.

## Testes

Classes impactadas da matriz da loja:

- `LOJA-03`: catalogo publico, filtros e disponibilidade por variante.
- `LOJA-05`: estoque nao deve ser movimentado por pre-venda.
- `LOJA-06`: pedidos de pre-venda continuam com voucher/reserva.
- `LOJA-08`: contrato API/UI para `isPreSale` e `modoVenda`.
- `LOJA-09`: checkout revalida produto, preco e modo de venda.

Testes minimos:

- Produto com `isPreSale = true` aparece no filtro Pre-venda.
- Produto com `isPreSale = true` aparece tambem em Ver Todos e categoria
  original.
- Produto com `isPreSale = true` retorna todas as variantes como `PRE_VENDA`.
- Produto com `isPreSale = false` e estoque zero aparece como Esgotado.
- Produto com `isPreSale = false` e estoque zero nao permite reserva.
- Checkout de pre-venda aceita somente produtos marcados como pre-venda.
- Checkout de pronta entrega sem estoque bloqueia sem converter para pre-venda.
- Loja-admin cria, edita, lista e reabre o checkbox corretamente.
