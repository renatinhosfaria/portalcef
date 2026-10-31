# Geração automática do inventário ao confirmar o mapa

## Intenção

Eliminar a pendência incorreta em “Mapa e lugares” depois que o mapa é confirmado. Hoje a confirmação grava os assentos estruturados do mapa, mas não cria o inventário das sessões; por isso a prontidão encontra zero assentos vendáveis mesmo quando a revisão do mapa terminou.

## Decisão

Ao confirmar um mapa, a API criará automaticamente o inventário para cada sessão que usa esse mapa, dentro da mesma transação da confirmação:

- assentos com `sellable = true` serão criados como `DISPONIVEL`;
- assentos com `sellable = false` serão criados como `BLOQUEADO`;
- sessões com mapa específico também serão atualizadas quando esse mapa for confirmado;
- sessões que já possuem inventário operacional não terão seus assentos vendidos, reservados ou bloqueados sobrescritos;
- a operação será idempotente para não duplicar inventário em nova tentativa.

A prontidão continuará contando somente `DISPONIVEL` e `LIBERADO` contra a capacidade da sessão. A confirmação do mapa não publicará o evento nem a sessão.

## Alternativas consideradas

- **Ação manual “Gerar inventário”**: daria controle explícito, mas cria uma etapa extra e deixa a interface em estado pendente após uma confirmação que deveria concluir o fluxo operacional.
- **Geração automática na confirmação**: escolhida por reduzir a operação manual e manter mapa e inventário consistentes na mesma transação.

## Escopo

- adaptar o serviço de mapas e os contratos de persistência para gerar inventário automaticamente;
- preservar estados operacionais existentes em reprocessamentos;
- adicionar testes para geração, assentos não vendáveis, idempotência e sessões herdadas;
- atualizar a tela de mapa com uma mensagem clara quando o inventário for criado.

## Fora de escopo

- alterar a capacidade da sessão automaticamente;
- publicar o evento;
- alterar reservas, vendas ou ingressos existentes;
- criar inventário para sessões que não referenciam o mapa confirmado.

Atualizado em: 2026-10-31
