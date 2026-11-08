# Relatório da Tarefa 14 — página do evento

## Resultado

- A página pública de evento foi reorganizada em topo, conteúdo, caixa lateral de compra e barra fixa no celular.
- O topo usa a arte inteira em `object-contain`, fundo desfocado, data por extenso com o horário da primeira sessão vendável, endereço, selos de mapa/meia/oferta e realização do colégio.
- A caixa de compra lista os tipos e preços, mostra o seletor somente quando há duas ou mais sessões vendáveis, atualiza o link conforme a sessão selecionada e exibe as duas mensagens de segurança.
- O corpo ganhou “Sobre o espetáculo”, “Bom saber”, políticas em diálogos com rótulos públicos e “Quem organiza”, sem expor e-mail de contato.
- A página carrega evento, sessões e políticas pelos wrappers de servidor e converte `EventosApiError` 404 em `notFound()`; o loading mantém o formato do topo e da caixa.
- Classes azuis foram removidas dos componentes tocados; `sessaoVendavel` e `hrefSessao` continuam disponíveis para os fluxos existentes.

## Evidência TDD

- RED: o estado anterior não tinha a composição da Tarefa 14 (arte do topo era cortada, não havia caixa/barra/políticas/organizador e a página usava os clientes diretos da API). A suíte legada disponível passou antes da alteração, pois ainda não cobria os cenários novos do brief.
- GREEN: `pnpm --filter @essencia/eventos test -- components/__tests__/detalhe-evento-ingresso.test.tsx app/publico.test.tsx` — 2 arquivos, 22 testes aprovados.

## Verificações

- `pnpm --filter @essencia/eventos test` — 126 testes passaram; 1 teste preexistente de `mapa-assentos.test.tsx` excedeu o timeout de 5 s (`bloqueia o 21º assento...`) sem tocar no mapa nesta tarefa. Os testes focados desta tarefa passaram integralmente.
- `pnpm --filter @essencia/eventos lint` — 0 erros e 0 avisos no app.
- `pnpm --filter @essencia/eventos typecheck` — exit 0.
- `pnpm turbo lint` — 21/21 tarefas concluídas; somente avisos preexistentes em outros pacotes.
- `pnpm turbo typecheck` — 22/22 tarefas concluídas.
- `git diff --check` — sem erros.

## Arquivos

- `apps/eventos/components/evento/topo-evento.tsx`
- `apps/eventos/components/evento/caixa-compra.tsx`
- `apps/eventos/components/evento/barra-compra-celular.tsx`
- `apps/eventos/components/evento/bom-saber.tsx`
- `apps/eventos/components/evento/politicas-resumidas.tsx`
- `apps/eventos/components/evento/quem-organiza.tsx`
- `apps/eventos/lib/politicas.ts`
- `apps/eventos/components/detalhe-evento.tsx`
- `apps/eventos/components/sessoes-evento.tsx`
- `apps/eventos/app/evento/[slug]/page.tsx`
- `apps/eventos/app/evento/[slug]/loading.tsx`

## Self-review e preocupações

- `SessoesEvento` preserva exports legados para não quebrar os testes e consumidores existentes, além dos auxiliares exigidos pelo brief; a página usa `mostrarAcoes={false}` porque a caixa lateral concentra a ação principal.
- A política de fallback usa `event.cancellationPolicy` somente quando a API não retorna políticas.
- O botão da barra móvel leva ao mapa de sessões quando há mais de uma sessão vendável; a caixa lateral permite escolher a sessão e leva diretamente ao mapa correto.
- Não houve alteração de dependências nem deploy.

Atualizado em: 2026-11-08
