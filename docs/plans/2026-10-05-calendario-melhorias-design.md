# Melhorias do módulo calendário — Design

**Objetivo:** tornar o calendário consistente entre API e interface, preservando eventos em consultas por período e calculando dias letivos a partir dos dados reais da unidade.

## Decisões

1. Datas de eventos são datas civis. A aplicação usará `YYYY-MM-DD` como representação de domínio e converterá para `Date` local somente na camada de apresentação ou nos cálculos de intervalo.
2. Consultas por mês e ano usarão sobreposição de intervalos (`início <= fim do filtro` e `fim >= início do filtro`). Eventos anuais recorrentes serão projetados para o ano consultado.
3. Estatísticas serão calculadas pela mesma regra de dias letivos usada pelas integrações de planejamento: domingos não letivos, sábados letivos somente com evento `SABADO_LETIVO` e eventos não letivos bloqueando a data. Os dias serão deduplicados.
4. Atualizações parciais serão validadas depois de mescladas com o evento existente. A API continuará usando os schemas compartilhados para validar formato.
5. O formulário de evento será resetado quando o evento ou a data padrão mudar e só fechará após a mutação confirmar sucesso. Falhas de busca conservarão a última agenda válida.
6. A validação de quinzena buscará o período configurado por unidade e calculará os dias reais pelo calendário.

## Limites

Esta entrega não altera regras de segurança ou papéis, não cria uma nova visão de calendário e não executa migration de dados. O contrato de estatísticas será corrigido no código compartilhado entre API e app.

## Verificação

Cada comportamento novo começará com um teste que falha, seguido da implementação mínima. Ao final serão executados os testes direcionados, lint e typecheck do app e da API.
