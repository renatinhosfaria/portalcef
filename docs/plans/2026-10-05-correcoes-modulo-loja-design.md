# Correções prioritárias do módulo loja

## Objetivo

Corrigir os problemas que podem induzir decisões operacionais erradas ou permitir pedidos inconsistentes: relatórios fictícios, limite de quantidade aplicado apenas no navegador, links administrativos sem filtro, galeria de imagens perdida no catálogo e configuração de parcelas apresentada como funcional apesar de não participar do checkout.

## Abordagem

A solução mantém a arquitetura atual: apps continuam consumindo a API e o backend permanece como fonte de verdade para preço, estoque e regras de pedido. Relatórios sem endpoint real deixarão de exibir números inventados e passarão a informar indisponibilidade. A regra de duas unidades por produto e aluno será extraída para uma validação reutilizável no serviço de pedidos e aplicada antes da reserva de estoque.

As telas administrativas passarão parâmetros de filtro de forma funcional e os controles sem ação serão removidos ou conectados a ações existentes. O catálogo preservará as imagens retornadas pela API. A configuração de parcelas será apresentada como indisponível no checkout hospedado atual até que exista suporte real de seleção de parcelas, evitando que o operador configure algo sem efeito.

## Tratamento de erros e dados

Falhas de relatório serão visíveis e não serão convertidas em zeros ou dados fictícios. Pedidos que excederem o limite serão rejeitados antes da criação ou reserva. O comportamento de checkout parcial existente será preservado nesta etapa, pois sua correção exige uma API de lote e idempotência próprias; ele ficará documentado como próxima etapa.

## Testes

Cada comportamento novo terá teste escrito antes da implementação: serviço rejeitando excesso em pronta-entrega, relatório sem dados fictícios, filtros do dashboard refletidos nas páginas e imagens preservadas no cartão do catálogo. Depois serão executados testes dos três pacotes, typecheck e lint.
