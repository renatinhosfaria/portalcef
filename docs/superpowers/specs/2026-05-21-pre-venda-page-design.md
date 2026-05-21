# Spec: Página de Pré-venda (loja-admin)

**Data:** 2026-05-21  
**Escopo:** `apps/loja-admin/app/interesse/page.tsx` e navegação relacionada

---

## Contexto

A página `/interesse` exibia uma lista de interesse (CRM de clientes que queriam produtos sem estoque). Ela será completamente substituída por uma página dedicada de gestão operacional de pré-vendas.

A funcionalidade de interesse permanece no backend mas não terá mais tela dedicada por ora.

---

## Objetivo

Substituir o conteúdo da rota `/interesse` por um painel operacional de pré-vendas que permita ao admin:

1. Ver em um relance o estado geral das pré-vendas (quantas aguardam pagamento, quantas estão pagas, quantas foram retiradas).
2. Ver a demanda agrupada por produto/tamanho (quais itens têm mais pedidos pendentes).
3. Gerenciar os pedidos individuais de pré-venda com as mesmas ações da página Pedidos (confirmar pagamento, registrar retirada, excluir).

---

## Arquitetura

### Arquivo alterado

- `apps/loja-admin/app/interesse/page.tsx` — conteúdo completamente substituído (rota mantida)

### Arquivo a renomear no menu

- `apps/loja-admin/app/layout.tsx` — alterar label do link "Interesse" para "Pré-venda"

### APIs usadas (todas já existem)

| Endpoint | Método | Uso |
|---|---|---|
| `/api/shop/admin/orders/pre-venda/summary` | GET | KPIs + tabela por produto |
| `/api/shop/admin/orders?orderSource=PRE_VENDA` | GET | Lista de pedidos individuais |
| `/api/shop/admin/orders/:id/confirm-payment` | PATCH | Confirmar pagamento |
| `/api/shop/admin/orders/:id/pickup` | PATCH | Registrar retirada |
| `/api/shop/admin/orders/:id` | DELETE | Excluir pedido |

O parâmetro `orderSource=PRE_VENDA` é fixo e nunca exposto como filtro ao usuário — a página só mostra pré-vendas.

---

## Layout da Página

### Seção 1 — Header

- Título: `Pré-venda`
- Subtítulo: `Pedidos de produtos sob encomenda`
- Botão de refresh manual (ícone de reload, chama `loadAll()`)

### Seção 2 — Cards de KPI (4 cards em grid)

Calculados somando os campos de todas as variantes retornadas pelo endpoint `summary`:

| Card | Campo | Cor |
|---|---|---|
| Aguardando Pagamento | `sum(reservedQuantity)` | Âmbar |
| Pago / Aguardando Retirada | `sum(paidQuantity)` | Azul |
| Retirado | `sum(pickedUpQuantity)` | Verde |
| Total | `sum(totalQuantity)` | Cinza |

Os cards são **somente informativos** — não funcionam como filtro de status.

### Seção 3 — Demanda por Produto (tabela)

Título: `Demanda por produto`

Dados: array retornado por `/pre-venda/summary`, ordenado por `totalQuantity` descrescente (já vem ordenado do backend).

Colunas:
- Produto (nome + SKU se houver)
- Tamanho
- Reservado (âmbar)
- Pago (azul)
- Retirado (verde)
- Total (negrito)
- Clientes (primeiros 3 nomes+telefone; "+N clientes" se houver mais)

Se não houver dados: estado vazio com ícone e mensagem `Nenhuma demanda de pré-venda.`

### Seção 4 — Lista de Pedidos Individuais

#### Filtros
- Campo de busca por texto (nome do responsável, telefone) — debounce 300ms
- Select de status: `Todos os status | Aguardando Pagamento | Pago | Retirado | Cancelado`

#### Tabela

Colunas: `Pedido | Responsável | Telefone | Total | Status | Data | Ações`

Linhas expandíveis (clique no número do pedido) mostram os itens do pedido em cards (produto, tamanho, aluno, quantidade, valor).

Ações por status:
- `AGUARDANDO_PAGAMENTO`: botão `Pagamento` (abre modal), botão `Excluir` (abre modal de confirmação)
- `PAGO`: botão `Retirar` (confirma com `window.confirm`)
- `CANCELADO` / `EXPIRADO`: botão `Excluir`

#### Paginação

Rodapé com `Página X de Y • Total: N pedidos` e botões Anterior/Próximo + números de página. Limit fixo: 30 pedidos por página.

#### Modal de Confirmação de Pagamento

Reutiliza a lógica completa da página Pedidos:
- Exibe número e valor total do pedido
- Suporte a múltiplas formas de pagamento (Dinheiro, PIX, Cartão Crédito, Cartão Débito, Brinde)
- Validação: soma dos pagamentos deve ser igual ao total antes de habilitar o botão confirmar
- Remove pagamentos individualmente da lista antes de confirmar

#### Modal de Exclusão

- Aviso de ação irreversível
- Confirmação com botão vermelho `Sim, Excluir`

---

## Estado do Componente

```typescript
// Dados do summary (KPIs + tabela por produto)
summaryItems: PreSaleSummaryItem[]   // array vazio inicialmente
summaryLoading: boolean

// Dados da lista de pedidos
orders: Order[]
ordersLoading: boolean
search: string
statusFilter: string                 // '' | 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'RETIRADO' | 'CANCELADO'
currentPage: number
totalPages: number
totalOrders: number
expandedOrder: string | null

// Modal de pagamento (idêntico à página Pedidos)
confirmPaymentModal: { open: boolean; orderId: string; orderNumber: string; totalAmount: number } | null
modalPayments: Array<{ method: string; amount: number }>
confirmingPayment: boolean

// Modal de exclusão
deleteOrderModal: { open: boolean; orderId: string; orderNumber: string } | null
deletingOrder: boolean
```

---

## Tipos (interfaces TypeScript)

Reutilizar os mesmos tipos da página Pedidos (`Order`, `OrderItem`, `PaymentMethod`). Adicionar:

```typescript
interface PreSaleSummaryItem {
  productId: string
  variantId: string
  productName: string
  variantSize: string
  variantSku: string | null
  reservedQuantity: number
  paidQuantity: number
  pickedUpQuantity: number
  totalQuantity: number
  customers: Array<{ name: string; phone: string }>
}
```

---

## Carregamento de Dados

`loadAll()` dispara em paralelo:
- `loadSummary()` → GET `/api/shop/admin/orders/pre-venda/summary`
- `loadOrders(page)` → GET `/api/shop/admin/orders?orderSource=PRE_VENDA&...`

`loadOrders` é também chamado isoladamente quando mudam `search`, `statusFilter` ou `currentPage`. A busca usa debounce de 300ms igual à página Pedidos.

---

## Navegação (layout.tsx)

O link da sidebar que aponta para `/interesse` tem seu label alterado de `"Interesse"` para `"Pré-venda"`. O ícone atual (se for genérico) pode ser mantido ou trocado por `ShoppingBag`.

---

## Fora de Escopo

- Remoção da aba Pré-venda na página Relatórios (escopo separado, não altera)
- Migração da rota `/interesse` para `/pre-venda` (mantém URL atual para não quebrar bookmarks)
- Backend: nenhuma alteração necessária
