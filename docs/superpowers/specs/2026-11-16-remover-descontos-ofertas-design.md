# Remoção de descontos por quantidade dos eventos

## Intenção

Remover do workspace administrativo a seção “Descontos e ofertas” e deixar os cupons como o único mecanismo de desconto configurável para novos pedidos públicos de eventos.

A mudança deve arquivar as ofertas existentes sem apagar o histórico financeiro. Pedidos já criados que receberam uma oferta continuam exibindo e cobrando os valores registrados no pedido, inclusive quando forem consultados ou tiverem um cupom aplicado posteriormente. O design foi aprovado em 16/11/2026.

## Objetivos

- Arquivar todas as ofertas ativas existentes por meio de migration reversível na prática, preservando as linhas históricas.
- Remover o editor, o carregamento e o autosave de ofertas da aba administrativa de ingressos.
- Impedir a criação ou edição de novas ofertas pelo fluxo administrativo.
- Fazer novas reservas calcularem o preço a partir do ingresso e do cupom, sempre com `offerDiscountCents = 0` e `appliedOffer = null`.
- Manter cupons, retenções, limites, pedidos gratuitos e a ordem de aplicação dos cupons funcionando.
- Preservar `offerDiscountCents`, `appliedOfferId` e os snapshots de ofertas em pedidos antigos.

## Fora do escopo

- Remover tabelas, colunas ou snapshots históricos do banco.
- Alterar o comportamento ou os contratos dos cupons.
- Recalcular pedidos confirmados, usados, cancelados ou reembolsados.
- Criar um novo mecanismo de descontos por quantidade.

## Critérios de segurança

- A migration não pode apagar ofertas nem pedidos.
- Novas reservas e a aplicação de cupons não podem ler uma oferta ativa para alterar o preço.
- Um pedido existente com snapshot de oferta deve manter a oferta histórica quando for consultado ou receber/remover cupom; apenas o desconto do cupom pode variar.
- A API pública deve deixar de anunciar ofertas para sessões novas. Para preservar compatibilidade de clientes, o campo existente `offers` pode continuar presente como lista vazia.
- Os campos de oferta nos resultados de pedidos continuam disponíveis para representar o histórico.

## Abordagens consideradas

### 1. Ignorar ofertas somente no cálculo

Remover a seção visual e fazer os serviços públicos sempre passarem uma lista vazia para o cálculo, mantendo rotas administrativas e possibilidade de novas ofertas no banco. É a menor alteração, mas deixa um caminho administrativo morto e permite que dados incompatíveis continuem sendo criados.

### 2. Arquivar ofertas e retirar o fluxo novo (escolhida)

Arquivar as ofertas ativas em migration, remover a seção e as rotas administrativas de ofertas, e retirar a leitura de ofertas do cálculo de novas reservas. A tabela e os campos permanecem para preservar pedidos históricos. Pedidos existentes reutilizam o snapshot já gravado quando forem recalculados por causa de cupons. Essa abordagem elimina o comportamento e a configuração que não serão mais usados sem destruir evidências financeiras.

### 3. Remoção estrutural completa

Excluir tabela, colunas, tipos, endpoints e snapshots de ofertas. Isso simplificaria o código futuro, mas exigiria transformar ou perder histórico de pedidos e aumentaria o risco de migration e rollback; não atende à necessidade de preservar os valores antigos.

## Decisões de implementação

- Criar uma migration nova que marque ofertas ativas como inativas e registre a operação no histórico disponível, sem `DELETE`.
- Retirar da página de ingressos os estados, effects, autosave, editor e histórico de ofertas; manter somente a seção de cupons.
- Remover do controller/módulo os endpoints administrativos que permitiam criar, atualizar ou listar ofertas para configuração futura. O serviço e os tipos só permanecem se forem necessários para leitura histórica ou compatibilidade interna.
- Em `EventosPublicSalesService.reservarAssentos`, calcular novas reservas com `offers: []`.
- Em `aplicarCupom`, usar o snapshot da oferta armazenado nos itens/pedido apenas quando o pedido já tiver sido criado com uma oferta; novos pedidos não terão snapshot.
- Em `EventosService.listarSessoesPublicas`, retornar `offers: []` para não anunciar campanhas desativadas.
- Atualizar contratos, testes, fixtures e documentação para refletir que `offerDiscountCents` só é histórico em novos pedidos.
- Manter `appliedOffer` e `offerDiscountCents` nas respostas para que consultas de pedidos antigos não percam informação.

## Resoluções da checagem do builder

- **Oferta histórica:** o preço líquido já gravado em cada item é preservado literalmente. Um cupom novo incide sobre esse líquido; não se reconstrói uma oferta percentual ou fixa antiga. Quando faltar snapshot, o valor armazenado no item é a referência; na primeira alteração com cupom, a base anterior ao cupom deve ser registrada para permitir remoção posterior.
- **Fonte canônica:** `pricingEvidence` de cada item é a fonte do recálculo histórico. `appliedOfferId` permanece como vínculo de rastreabilidade e não substitui os valores dos itens. Snapshots divergentes não serão unificados nem usados para inventar uma nova oferta; cada item conserva seu próprio valor histórico.
- **Migration e rollback:** a migration marca somente ofertas atualmente ativas como inativas e não insere auditorias artificiais. Ela não apaga dados. O backup criado pelo fluxo de migration é a forma de rollback; não haverá tentativa automática de reativar ofertas que já estavam inativas.

## Validação esperada

- A tela de ingressos não exibe “Descontos e ofertas” e continua exibindo/criando cupons.
- Uma nova reserva sem cupom tem subtotal igual ao total e nenhum desconto de oferta.
- Uma nova reserva com cupom aplica o cupom diretamente sobre o subtotal.
- Um pedido antigo com oferta mantém o desconto histórico ao ser consultado e ao receber/remover cupom.
- A API pública não devolve ofertas ativas em sessões.
- A migration é idempotente no ambiente de teste e não remove pedidos, ofertas ou snapshots.
- Lint, typecheck, testes focados, migration e health check de produção passam antes do deploy.
