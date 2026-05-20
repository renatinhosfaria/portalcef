# Matriz Obrigatória de Invariantes e Testes da Loja

Este documento define as invariantes que precisam permanecer verdadeiras no módulo `loja`, `loja-admin` e API de loja. Ele existe para impedir correções pontuais que resolvem um sintoma, mas deixam a mesma classe de falha reaparecer em outro fluxo.

## Regra de Uso

Toda alteração em `services/api/src/modules/shop`, `apps/loja` ou `apps/loja-admin` deve declarar quais classes desta matriz foram impactadas e executar os testes correspondentes.

Quando uma auditoria encontrar um bug novo, a correção não deve criar apenas um teste para o caso específico. Ela deve criar ou atualizar uma regressão da classe inteira.

Critério mínimo antes de considerar a correção pronta:

```bash
pnpm --filter @essencia/api test -- src/modules/shop --runInBand
pnpm --filter @essencia/loja test
pnpm --filter @essencia/loja-admin test
pnpm turbo lint
pnpm turbo typecheck
```

## Classes de Invariantes

| Classe | Área | Objetivo | Teste bloqueante |
| --- | --- | --- | --- |
| `LOJA-01` | Tenant e RBAC admin | Nenhum recurso por ID escapa do escopo da sessão. | API |
| `LOJA-02` | Superfície pública | Rotas públicas validam tenant, UUID, rate limit e anti-enumeração. | API |
| `LOJA-03` | Catálogo público | Payload público não expõe dados internos nem variantes inválidas. | API + loja |
| `LOJA-04` | Produto e imagens | Escritas de produto/imagem são atômicas e conteúdo enviado é seguro. | API + loja-admin |
| `LOJA-05` | Estoque e concorrência | Toda alteração de estoque usa lock correto, transação e ledger válido. | API |
| `LOJA-06` | Pedido e pagamento | Pedido, reserva, baixa, pagamento e retirada são consistentes e conciliados. | API + loja-admin |
| `LOJA-07` | Interesse | Interesse público/admin respeita tenant, valida dados e persiste de forma atômica. | API + loja-admin |
| `LOJA-08` | Contrato API/UI | Telas consomem o shape real da API sem fallback incompatível. | loja + loja-admin |
| `LOJA-09` | Dinheiro e quantidade | Backend usa centavos; carrinho público usa reais; limites não são burláveis. | API + loja |
| `LOJA-10` | Permissões visuais | UI não oferece ações que o backend nega por política. | loja-admin |

## LOJA-01: Tenant e RBAC Admin

Invariantes obrigatórias:

| Invariante | Critério |
| --- | --- |
| Escopo vem da sessão | Rotas admin derivam `ShopTenantScope` exclusivamente de `req.user`; payload não define escopo real. |
| `master` é o único global | Qualquer role não-master sem `schoolId` válido deve ser tratada como fora de escopo. |
| Role de unidade exige `unitId` | `gerente_unidade`, `gerente_financeiro` e `auxiliar_administrativo` não podem cair para escopo de escola inteira. |
| ID fora do escopo retorna 404 | Produtos, variantes, estoque, pedidos, interesses e configurações de outro tenant retornam `NotFoundException`. |
| RBAC não deriva da UI | Controller bloqueia mutações proibidas mesmo que a UI esconda botões. |

Testes obrigatórios:

| Camada | Arquivo alvo | Casos mínimos |
| --- | --- | --- |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Cross-tenant por `productId`, `variantId`, `inventoryId`, `orderId`, `requestId` e `unitId` retorna 404. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Dashboard com role de unidade sem `unitId` retorna 404 e não amplia para escola inteira. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Metadata de roles mantém `auxiliar_administrativo` com a mesma superfície de `gerente_unidade` nas rotas administrativas e no upload. |
| loja-admin | `apps/loja-admin/__tests__/permissions.test.ts` | Permissões visuais mantêm `auxiliar_administrativo` com as mesmas ações de `gerente_unidade`. |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts --runInBand
pnpm --filter @essencia/loja-admin test -- permissions
```

## LOJA-02: Superfície Pública

Invariantes obrigatórias:

| Invariante | Critério |
| --- | --- |
| UUID público é validado no DTO | `schoolId`, `unitId`, `variantId`, `productId` e identificadores públicos usam validação de UUID quando aplicável. |
| Unidade pertence à escola | Nenhuma rota pública aceita `schoolId` e `unitId` incompatíveis. |
| Rotas sensíveis têm throttle local | Criação de pedido, criação de interesse e consulta pública de pedido possuem rate limit explícito. |
| Lookup não enumera pedido | Pedido inexistente e telefone incorreto retornam a mesma resposta genérica. |
| PII pública é mínima | Respostas públicas não retornam dados administrativos, ledger, reservas internas ou informações de outros tenants. |

Testes obrigatórios:

| Camada | Arquivo alvo | Casos mínimos |
| --- | --- | --- |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Catálogo/detalhe rejeita unidade fora da escola. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | `GET /orders/:orderNumber` retorna resposta genérica para telefone errado. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | `POST /interest` e lookup de pedido possuem `@Throttle`. |
| API | `services/api/src/modules/shop/shop-interest.service.spec.ts` | DTO de interesse rejeita UUID inválido antes de consultar banco. |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-regressions.spec.ts src/modules/shop/shop-interest.service.spec.ts --runInBand
```

## LOJA-03: Catálogo Público

Invariantes obrigatórias:

| Invariante | Critério |
| --- | --- |
| Produto público precisa estar ativo | Produto inativo nunca aparece no catálogo ou detalhe público. |
| Variante pública precisa estar ativa | Variante inativa não aparece e não pode ser selecionada ou vendida. |
| Estoque público é escopado por unidade | Detalhe público mostra apenas disponibilidade da unidade consultada. |
| Campos internos não vazam | Payload público não retorna `quantity`, `reserved`, `reservedQuantity`, `total`, ledger ou estoque de outras unidades. |
| Preço efetivo é único | UI usa o mesmo preço efetivo que o backend recalcula. |

Testes obrigatórios:

| Camada | Arquivo alvo | Casos mínimos |
| --- | --- | --- |
| API | `services/api/src/modules/shop/shop-products.service.spec.ts` | Detalhe público filtra variantes inativas e estoque de outras unidades. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Payload público não contém campos internos de quantidade/reserva. |
| loja | `apps/loja/__tests__/loja.test.ts` | Página de produto envia `schoolId` e `unitId` ao buscar detalhe. |
| loja | `apps/loja/components/__tests__/ProductDetailCarousel.test.tsx` | Variante inativa não fica selecionável. |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-products.service.spec.ts src/modules/shop/shop-regressions.spec.ts --runInBand
pnpm --filter @essencia/loja test -- loja ProductDetailCarousel
```

## LOJA-04: Produto, Imagens e Upload

Invariantes obrigatórias:

| Invariante | Critério |
| --- | --- |
| Produto e imagens são transacionais | Criar/editar produto e imagens ocorre na mesma transação. |
| Falha intermediária não deixa parcial | Erro em imagem não deixa produto criado ou imagens removidas parcialmente. |
| Upload aceita somente conteúdo seguro | Imagens de produto aceitam apenas PNG, JPEG, GIF ou WebP detectados por assinatura real. |
| Conteúdo ativo nunca é servido inline | HTML, SVG, XML e scripts são rejeitados ou forçados como attachment fora do fluxo de imagem. |
| Upload exige role de gestão | Apenas `master`, `diretora_geral`, `gerente_unidade` e `auxiliar_administrativo` podem usar upload da loja. |

Testes obrigatórios:

| Camada | Arquivo alvo | Casos mínimos |
| --- | --- | --- |
| API | `services/api/src/common/storage/storage.service.spec.ts` | HTML disfarçado de imagem é rejeitado. |
| API | `services/api/src/common/storage/storage.service.spec.ts` | MIME real é detectado pelo conteúdo, não pelo header do cliente. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Produto + imagens usam transação em criação e edição. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Controller de storage declara roles de gestão. |
| loja-admin | `apps/loja-admin/__tests__/image-uploader.test.tsx` | Uploader usa `/loja-admin/api/storage/upload`. |
| loja-admin | `apps/loja-admin/__tests__/storage-upload-route.test.ts` | Proxy encaminha para `${API_INTERNAL_URL}/api/storage/upload` com cookies. |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/common/storage/storage.service.spec.ts src/modules/shop/shop-regressions.spec.ts --runInBand
pnpm --filter @essencia/loja-admin test -- image-uploader storage-upload-route
```

## LOJA-05: Estoque e Concorrência

Invariantes obrigatórias:

| Invariante | Critério |
| --- | --- |
| Toda mutação de estoque usa lock | Reserva, liberação, confirmação, venda presencial, entrada, ajuste e saída manual usam lock por `variantId:unitId`. |
| Lock tem ownership | Redis lock grava token único e libera com compare-and-delete atômico via Lua. |
| Ordem de locks é determinística | Múltiplos itens são bloqueados em ordem estável para reduzir deadlock. |
| Estoque compartilhado é protegido entre pedidos | Confirmação de pedidos diferentes com mesma variante/unidade usa lock de inventário, não apenas lock de pedido. |
| Pré-venda revalida disponibilidade sob lock | Criação de `PRE_VENDA` bloqueia `variantId:unitId` antes de decidir se a variante ainda está sem estoque. |
| Pré-venda não movimenta estoque | Criação, pagamento, retirada, cancelamento e exclusão de `PRE_VENDA` não alteram `quantity`, `reservedQuantity` ou ledger. |
| Ledger usa enum válido | Saída manual usa `AJUSTE` com `quantityChange` negativo e motivo em `notes`. |

Testes obrigatórios:

| Camada | Arquivo alvo | Casos mínimos |
| --- | --- | --- |
| API | `services/api/src/modules/shop/shop-inventory.service.spec.ts` | `withInventoryLocks` usa token e libera via script compare-and-delete. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Lock expirado não permite apagar lock de outro processo. |
| API | `services/api/src/modules/shop/shop-orders.service.spec.ts` | `confirmPayment` adquire locks de inventário dos itens antes de converter reserva. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Pré-venda rejeita produto não marcado como pré-venda com `PRODUCT_NOT_PRE_SALE`. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Fluxos de `PRE_VENDA` não alteram `quantity`, `reservedQuantity` ou ledger. |
| API | `services/api/src/modules/shop/shop-inventory.service.spec.ts` | Saída manual grava `movementType: "AJUSTE"` e motivo em `notes`. |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-inventory.service.spec.ts src/modules/shop/shop-orders.service.spec.ts src/modules/shop/shop-regressions.spec.ts --runInBand
```

## LOJA-06: Pedido e Pagamento

Invariantes obrigatórias:

| Invariante | Critério |
| --- | --- |
| Criação de pedido é atômica | Pedido, itens, reserva e ledger são criados na mesma transação. |
| Falha não deixa reserva órfã | Qualquer erro após reservar desfaz `reservedQuantity`, itens e ledger. |
| Confirmação de pagamento é serializada | Mesmo pedido usa lock de pedido; estoque dos itens usa lock de inventário. |
| Pagamento não baixa estoque duas vezes | Segunda confirmação concorrente recebe erro de status/conflito sem alterar estoque. |
| Pagamentos conciliam o total | Soma de pagamentos deve ser igual a `totalAmount`, inclusive quando houver `BRINDE`. |
| Venda presencial é atômica | Baixa de estoque, pedido, itens, ledger e pagamentos entram ou saem juntos. |
| Pré-venda usa origem e status próprios | Voucher de pré-venda nasce com `orderSource = PRE_VENDA` e `status = AGUARDANDO_PAGAMENTO`. |
| Pré-venda preserva estoque em todo ciclo | Criação, confirmação de pagamento, retirada, cancelamento e exclusão de `PRE_VENDA` não mexem em `quantity` nem `reservedQuantity`. |
| Pré-venda exige flag manual | Apenas produtos com `isPreSale = true` aceitam pedido de pré-venda; produtos sem o flag são recusados com `PRODUCT_NOT_PRE_SALE`. |
| Resumo de pré-venda vem de pedidos | Relatório usa `orders/pre-venda/summary` e agrega quantidades reservadas, pagas e retiradas por produto/tamanho. |
| Status dirige métricas | Retirada pendente usa `PAGO`; vendas usam `paidAt` com status `PAGO` ou `RETIRADO`. |

Testes obrigatórios:

| Camada | Arquivo alvo | Casos mínimos |
| --- | --- | --- |
| API | `services/api/src/modules/shop/shop-orders.service.spec.ts` | Criação rollbacka reserva se insert de pedido/itens falhar. |
| API | `services/api/src/modules/shop/shop-orders.service.spec.ts` | Confirmação concorrente não duplica baixa nem pagamentos. |
| API | `services/api/src/modules/shop/shop-orders.service.spec.ts` | Confirmação de pedidos diferentes com mesmo estoque usa lock de inventário. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | `POST /shop/orders/pre-venda` cria `PRE_VENDA` em `AGUARDANDO_PAGAMENTO` sem reserva de estoque. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Pagamento, retirada, cancelamento e exclusão de `PRE_VENDA` preservam `quantity` e `reservedQuantity`. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Listagem admin aceita `orderSource=PRE_VENDA` e resumo usa `orders/pre-venda/summary`. |
| API | `services/api/src/modules/shop/shop-orders.service.spec.ts` | `BRINDE` não desativa validação da soma dos pagamentos. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Dashboard retorna `data.stats` e `recentOrders` com status corretos. |
| loja-admin | `apps/loja-admin/__tests__/venda-presencial.test.ts` | Venda presencial usa preço efetivo e total em centavos compatível com API. |
| loja-admin | `apps/loja-admin/__tests__/dashboard-source.test.ts` | Dashboard consome `data.stats.salesToday` e `salesWeek` como `{ count, total }`. |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-orders.service.spec.ts src/modules/shop/shop-regressions.spec.ts --runInBand
pnpm --filter @essencia/loja-admin test -- venda-presencial dashboard-source
```

## LOJA-07: Interesse

Invariantes obrigatórias:

| Invariante | Critério |
| --- | --- |
| Interesse público valida tenant | `unitId` precisa pertencer ao `schoolId`; produto e variante precisam pertencer à escola. |
| Lista de itens não é vazia | `items` vazio retorna erro de validação antes de transação. |
| Produto e variante precisam estar ativos | Produto ou variante inativos não podem gerar interesse. |
| `schoolId` é persistido | `shop_interest_requests.schoolId` é obrigatório no insert. |
| Criação é atômica | Requisição e itens são criados na mesma transação. |
| Admin respeita escopo | Listar, marcar contato e consultar interesse respeitam `schoolId` e `unitId`. |

Testes obrigatórios:

| Camada | Arquivo alvo | Casos mínimos |
| --- | --- | --- |
| API | `services/api/src/modules/shop/shop-interest.service.spec.ts` | Interesse válido persiste `schoolId` e itens em transação. |
| API | `services/api/src/modules/shop/shop-interest.service.spec.ts` | Rejeita unidade fora da escola, produto de outra escola, produto inativo e variante inativa. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Interesse admin por ID fora do escopo retorna 404. |
| loja-admin | `apps/loja-admin/__tests__/admin.test.ts` | Marcar como contatado faz PATCH real e não só atualização local. |

Comando mínimo:

```bash
pnpm --filter @essencia/api test -- src/modules/shop/shop-interest.service.spec.ts src/modules/shop/shop-regressions.spec.ts --runInBand
pnpm --filter @essencia/loja-admin test -- admin
```

## LOJA-08: Contrato API/UI

Invariantes obrigatórias:

| Invariante | Critério |
| --- | --- |
| UI consome o shape real | Componentes usam os campos retornados pela API atual, não aliases antigos. |
| Proxy preserva basePath | `loja-admin` chama rotas internas com `/loja-admin` quando necessário. |
| Proxy preserva autenticação | Rotas internas encaminham cookies e usam `API_INTERNAL_URL`. |
| Voucher público usa contrato real | Responsável, telefone e email vêm de `customer.name`, `customer.phone`, `customer.email`. |
| Checkout misto usa contrato real | Itens `PRONTA_ENTREGA` e `PRE_VENDA` geram vouchers separados, fallback de estoque usa o erro da API e pagamento online fica bloqueado com pré-venda. |
| Testes de fonte protegem contratos | Testes podem inspecionar fonte quando renderização completa for cara, desde que validem o contrato real. |

Testes obrigatórios:

| Camada | Arquivo alvo | Casos mínimos |
| --- | --- | --- |
| loja | `apps/loja/__tests__/loja.test.ts` | Voucher usa `orderData.customer.name` e `orderData.customer.phone`. |
| loja | `apps/loja/__tests__/carrinho-page.test.tsx` | Total renderizado bate com subtotais. |
| loja | `apps/loja/__tests__/checkout-page.test.tsx` | Checkout cria vouchers separados, converte item sem estoque para pré-venda e bloqueia pagamento online com `PRE_VENDA`. |
| loja-admin | `apps/loja-admin/__tests__/dashboard-source.test.ts` | Dashboard lê `result.data.stats` e `result.data.recentOrders`. |
| loja-admin | `apps/loja-admin/__tests__/pedidos-source.test.ts` | Páginas de pedidos usam contrato real de pedidos e pagamentos. |
| loja-admin | `apps/loja-admin/__tests__/storage-upload-route.test.ts` | Proxy de upload preserva cookies e URL interna. |

Comando mínimo:

```bash
pnpm --filter @essencia/loja test -- loja carrinho-page checkout-page
pnpm --filter @essencia/loja-admin test -- dashboard-source pedidos-source storage-upload-route
```

## LOJA-09: Dinheiro e Quantidade

Invariantes obrigatórias:

| Invariante | Critério |
| --- | --- |
| Backend usa centavos | API recebe, calcula, persiste e retorna valores monetários em centavos. |
| Carrinho público usa reais | Estado do carrinho público mantém `unitPrice` e totais em reais. |
| Não há divisão dupla | UI não divide por 100 valor que já está em reais. |
| Quantidade respeita limite por aluno | `addItem` e `updateQuantity` aplicam `MAX_QUANTITY_PER_STUDENT`. |
| Limite por aluno vale na pré-venda | Backend rejeita pré-venda acima do limite por produto/aluno com `QUANTITY_LIMIT_EXCEEDED`. |
| Quantidade respeita estoque disponível | Botão de incremento e atualização direta não ultrapassam disponibilidade. |
| Preço de variante é efetivo | UI usa `priceOverride ?? product.basePrice`; backend recalcula antes de aceitar venda. |

Testes obrigatórios:

| Camada | Arquivo alvo | Casos mínimos |
| --- | --- | --- |
| loja | `apps/loja/__tests__/use-cart.test.tsx` | `updateQuantity` respeita limite por aluno e estoque. |
| loja | `apps/loja/__tests__/carrinho-page.test.tsx` | Total do carrinho não é dividido por 100 duas vezes. |
| loja-admin | `apps/loja-admin/__tests__/venda-presencial.test.ts` | Preço efetivo de variante é usado no total local. |
| API | `services/api/src/modules/shop/shop-orders.service.spec.ts` | Backend rejeita venda se total pago divergir do total recalculado. |
| API | `services/api/src/modules/shop/shop-regressions.spec.ts` | Pré-venda acima do limite por produto/aluno retorna `QUANTITY_LIMIT_EXCEEDED`. |

Comando mínimo:

```bash
pnpm --filter @essencia/loja test -- use-cart carrinho-page
pnpm --filter @essencia/loja-admin test -- venda-presencial
pnpm --filter @essencia/api test -- src/modules/shop/shop-orders.service.spec.ts src/modules/shop/shop-regressions.spec.ts --runInBand
```

## LOJA-10: Permissões Visuais

Invariantes obrigatórias:

| Invariante | Critério |
| --- | --- |
| UI segue matriz de roles | Ações visíveis são derivadas de helpers de permissão, não de strings soltas por página. |
| Leitura e mutação são separadas | Role com leitura não vê botão de criar, editar, excluir, salvar ou upload. |
| Configurações têm modo leitura | Role sem `canManageShopSettings` vê campos desabilitados e nenhum botão de salvar. |
| Estoque não mostra ação proibida | Role sem gestão de estoque não vê ajuste, entrada, saída ou edição. |
| Produto não mostra ação proibida | Role sem gestão de catálogo não vê criar, editar, excluir ou upload de imagem. |

Testes obrigatórios:

| Camada | Arquivo alvo | Casos mínimos |
| --- | --- | --- |
| loja-admin | `apps/loja-admin/__tests__/permissions.test.ts` | Helpers retornam matriz esperada para cada role da loja. |
| loja-admin | `apps/loja-admin/__tests__/configuracoes.test.tsx` | Configurações fica somente leitura para role sem permissão. |
| loja-admin | `apps/loja-admin/__tests__/inventory.test.ts` | Estoque oculta mutações para role sem permissão. |
| loja-admin | `apps/loja-admin/__tests__/image-uploader.test.tsx` | Upload não aparece ou não dispara para role sem permissão quando o componente receber controle de permissão. |

Comando mínimo:

```bash
pnpm --filter @essencia/loja-admin test -- permissions configuracoes inventory image-uploader
```

## Checklist Obrigatório Para Correção de Achados

Antes de editar produção:

| Passo | Critério |
| --- | --- |
| 1 | Classificar o achado em uma ou mais classes `LOJA-01` a `LOJA-10`. |
| 2 | Escrever teste que falha cobrindo a classe, não só o exemplo pontual. |
| 3 | Executar o teste focado e registrar a falha esperada. |
| 4 | Implementar a menor correção que torna a invariante verdadeira. |
| 5 | Executar o comando mínimo da classe impactada. |
| 6 | Executar as suítes completas de API loja, `loja` e `loja-admin`. |
| 7 | Executar `pnpm turbo lint` e `pnpm turbo typecheck`. |

## Mapeamento Dos Achados Recorrentes

| Achado recorrente | Classe que deve bloquear regressão |
| --- | --- |
| Admin por `:id` acessa outro tenant | `LOJA-01` |
| Dashboard amplia escopo sem `unitId` | `LOJA-01` |
| Interesse público quebra por tenant ou UUID inválido | `LOJA-02`, `LOJA-07` |
| Catálogo aceita school/unit incompatíveis | `LOJA-02`, `LOJA-03` |
| Produto público vaza estoque ou variante inativa | `LOJA-03` |
| Upload aceita conteúdo ativo ou ignora basePath | `LOJA-04`, `LOJA-08` |
| Produto/imagens deixam gravação parcial | `LOJA-04` |
| Lock Redis remove lock de outro processo | `LOJA-05` |
| Confirmação de pagamento corrompe estoque | `LOJA-05`, `LOJA-06` |
| Reserva fica órfã em falha de pedido | `LOJA-06` |
| BRINDE ignora conciliação de pagamento | `LOJA-06`, `LOJA-09` |
| Voucher lê campos errados do pedido | `LOJA-08` |
| Carrinho divide total por 100 duas vezes | `LOJA-09` |
| `updateQuantity` burla limite por aluno | `LOJA-09` |
| UI mostra ação que backend bloqueia | `LOJA-10` |

## Política de Bloqueio

Uma mudança no módulo da loja deve ser bloqueada se qualquer item abaixo for verdadeiro:

| Bloqueio | Motivo |
| --- | --- |
| Não há teste novo ou ajustado para a classe impactada | O bug pode reaparecer em outro endpoint ou tela. |
| Teste novo passa antes da correção | O teste não prova a regressão. |
| Correção depende apenas da UI para segurança | Segurança e tenant precisam existir no backend. |
| Correção depende apenas do `TenantGuard` para rota por ID | Rotas por ID precisam de ownership no service. |
| Operação de estoque/pedido não é transacional | Pode gerar reserva órfã, baixa duplicada ou ledger inconsistente. |
| UI e API discordam sobre centavos/reais | Gera divergência de total, pagamento e relatório. |
| Pipeline mínimo da classe não foi executado | Sem evidência local, a correção não está pronta. |
