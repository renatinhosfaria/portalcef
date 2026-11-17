# Concorrência e capacidade dos eventos

## Alterações de 17/11/2026

Reservas de lugares independentes podem progredir em paralelo. Evento, sessão e tipos de ingresso usam bloqueios compartilhados durante a validação; assentos e pedidos que mudam continuam com bloqueios exclusivos. A configuração administrativa não pode mudar durante a reserva. Leituras de pedido bloqueiam somente o pedido, sem serializar todas as compras do evento.

O checkout foi separado em preparação transacional, chamada externa e registro transacional. A coluna JSONB `evento_pagamentos.preparacao_checkout` conserva parâmetros, prazo e chave da tentativa. Repetições após timeout e reinício reutilizam esses dados. O prazo inicial é de 35 minutos, incluindo margem para o mínimo de 30 minutos da Stripe. Se a Stripe rejeitar explicitamente `expires_at`, uma nova preparação é criada e há uma repetição limitada; timeout e erro 5xx nunca autorizam trocar a chave. Essa distinção segue o [contrato de idempotência da Stripe](https://docs.stripe.com/api/idempotent_requests) e os [parâmetros de criação do checkout](https://docs.stripe.com/api/checkout/sessions/create).

A geração da preparação acompanha a metadata do Checkout e do PaymentIntent. Um cancelamento atrasado do PaymentIntent anterior não pode cancelar a preparação nova. A confirmação/falha revalida a referência depois de bloquear o pedido. Sessões legadas com IDs Stripe já persistidos permanecem compatíveis. Uma sessão já paga não é recriada enquanto o webhook está chegando.

A liberação de lugares recusa temporariamente uma criação em andamento e revalida a referência antes de cancelar. A tela permite repetir a ação após esse conflito e encaminha pagamentos concluídos aos ingressos.

O catálogo consulta ingressos separadamente e calcula disponibilidade com `EXISTS`, evitando multiplicar todos os assentos por todos os tipos. A consulta de detalhe filtra o slug no banco. Sessões públicas também usam `EXISTS`. O mapa público compartilha leituras simultâneas por até um segundo, com limite de 100 entradas por instância; falhas não são guardadas. Esse cache não decide reservas nem contém pedidos.

## Verificação

- 14 cenários de integração com PostgreSQL 16 descartável, limitado a 1 CPU e 256 MB: lugares distintos/iguais, configuração administrativa bloqueada, ordem inversa de lugares, retomada e expiração concorrentes, Stripe fora de transação, timeout, retomada tardia, duas instâncias, webhook antecipado e cancelamento de geração antiga.
- 50 reservas independentes na mesma sessão foram processadas numa rajada sem perda ou duplicação. A medição é sintética: não inclui HTTP, renderização, rede pública ou Stripe real e não representa um limite de usuários suportados em produção.
- 482 testes dos módulos de eventos e pagamentos passaram; mais 19 testes de PDF passaram em processos separados, totalizando 501.
- 208 testes do aplicativo público de eventos e 19 testes do schema passaram.
- Lint global concluiu sem erros, com avisos; typecheck global e build da API passaram.
- Revisão independente identificou os casos de prazo tardio e cancelamento de geração antiga; ambos tiveram reprodução falhando e correção verificada.

A execução conjunta falhou em `gerar-proposta.spec.ts` e `ler-planta-pdf.spec.ts` com `Test environment has been torn down`, no carregador ESM do pdf.js. Cada arquivo passou em seu próprio processo, sem alteração no gerador de mapas. Use os comandos separados abaixo.

## Reproduzir

```bash
./scripts/testar-concorrencia-eventos.sh

pnpm --filter @essencia/api test -- --config jest.eventos.config.js --runInBand \
  src/modules/eventos src/modules/payments \
  --testPathIgnorePatterns '/mapas/gerador/(gerar-proposta|ler-planta-pdf).spec.ts$'

pnpm --filter @essencia/api test -- --config jest.eventos.config.js --runInBand \
  --runTestsByPath src/modules/eventos/mapas/gerador/gerar-proposta.spec.ts

pnpm --filter @essencia/api test -- --config jest.eventos.config.js --runInBand \
  --runTestsByPath src/modules/eventos/mapas/gerador/ler-planta-pdf.spec.ts

pnpm --filter @essencia/eventos test
pnpm turbo lint --concurrency=2 && pnpm turbo typecheck --concurrency=2
```

O runner cria um container exclusivo com porta aleatória em localhost, banco `eventos_teste` e dados efêmeros. Não usa `.env`, rede, volumes ou credenciais da produção; remove o container ao terminar. Aplica as migrations reais do módulo a partir de 0049 sobre dependências mínimas de escola/usuário. O histórico completo do monorepo não inicializa um banco vazio: a migration legada de `turmas` referencia `units` antes da criação da tabela. Esse problema anterior não foi alterado neste trabalho.

## Publicação posterior

A migration `0060_eventos_preparacao_checkout.sql` adiciona somente uma coluna nullable. Aplicar antes de subir a nova API, usando o fluxo canônico `./scripts/deploy.sh --migrar` depois de integrar a branch e deixar a árvore limpa. A versão anterior da aplicação ignora a coluna, permitindo rollback do código sem remover dados.

Não houve migration, compra real, carga ou deploy em produção neste trabalho. Permanecem uma instância da API, o pool de 10 conexões e os limites por IP. A capacidade HTTP e a experiência em redes com muitos usuários no mesmo IP ainda precisam de medição em homologação com pagamentos de teste antes de anunciar um volume garantido.
