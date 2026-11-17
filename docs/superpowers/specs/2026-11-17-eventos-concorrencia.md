# Eventos: capacidade e concorrência

## Objetivo e escopo autorizado
Corrigir os gargalos apontados na avaliação aceita por Renato em 17/11/2026: reservas de lugares independentes devem progredir em paralelo, a espera pela Stripe não deve ocupar transações e as consultas públicas não devem multiplicar tipos de ingressos por assentos. Preservar contratos públicos, preços, pacotes, cupons, expiração e proteção contra venda duplicada.

## Abordagem
Manter PostgreSQL/Drizzle, NestJS e Next.js. Nas reservas, adquirir bloqueios compartilhados nos dados de configuração e exclusivos somente nos registros que mudam, com ordem determinística. No checkout, preparar e persistir os parâmetros imutáveis em uma transação curta, chamar Stripe fora dela e registrar o resultado em outra transação curta. A preparação persistida fornece a mesma chave e parâmetros em retomadas e instâncias diferentes. O prazo inicial de 35 minutos dá margem ao mínimo da Stripe; só uma rejeição explícita de expires_at permite renovar chave e prazo, com uma repetição limitada. A geração acompanha metadata para excluir cancelamentos antigos; liberações devem resolver ou rejeitar uma criação em andamento para não deixar checkout pagável após liberar lugares.

No catálogo, consultar tipos de ingressos separadamente e calcular disponibilidade com EXISTS no banco, sem carregar o inventário completo. Nas sessões, projetar somente uma linha por sessão. Consolidar requisições simultâneas de mapa com cache local curto (1 segundo), sem usar o cache para decidir reservas. Manter dados de pedidos fora do cache.

Alternativas consideradas: apenas aumentar pool/replicar API não elimina bloqueios; manter toda a chamada externa numa transação preserva o gargalo; trava apenas em memória não coordena instâncias. A abordagem acima é a escolha técnica para executar a correção solicitada.

## Verificação
TDD nos comportamentos alterados, integração com PostgreSQL descartável e Stripe simulada, verificando concorrência de assentos iguais/diferentes, falhas e retomada de checkout, ausência de transação durante espera externa, catálogo/preços e invalidação temporal do cache. Medição sintética não equivale a capacidade de usuários em produção. Executar lint e typecheck globais. Sem deploy ou compras reais nesta etapa.
