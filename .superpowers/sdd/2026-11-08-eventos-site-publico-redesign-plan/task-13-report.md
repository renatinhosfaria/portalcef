# Relatório da Tarefa 13 — página inicial (catálogo)

## Resultado

- A página inicial agora usa `listarEventosPublicosServidor` e exibe o título `Eventos do Colégio Essência Feliz`.
- Um único evento é apresentado em `EventoDestaque`, com arte inteira em `object-contain`, fundo da arte desfocado, data por extenso, local, preço e ação de assentos.
- Dois ou mais eventos formam uma grade de cartões; eventos esgotados permanecem informativos sem link de compra.
- Estados vazio, erro com retry, carregamento e not-found foram adaptados à moldura visual pública.
- `ImagemPublicaEvento` aceita `ajuste="cobrir" | "conter"`.
- Foram adicionados `formatarDataHoraExtenso`, `formatarDataCurta`, `formatarMoeda` e `rotuloCurto`, mantendo os formatadores públicos existentes.

## Evidência TDD

- RED: os testes novos falharam antes da implementação por módulo ausente (`../catalogo/evento-destaque`), página ainda com `Eventos disponíveis` e `app/not-found` inexistente.
- GREEN: `pnpm --filter @essencia/eventos test -- components/__tests__/catalogo-eventos.test.tsx app/publico.test.tsx` — 2 arquivos, 25 testes aprovados.

## Verificações

- `pnpm --filter @essencia/eventos test` — 14 arquivos, 126 testes aprovados.
- `pnpm --filter @essencia/eventos lint` — 0 erros e 0 avisos no app.
- `pnpm --filter @essencia/eventos typecheck` — concluído com exit 0.
- `pnpm turbo lint` — 21/21 tarefas concluídas; avisos existentes em outros pacotes.
- `pnpm turbo typecheck` — 22/22 tarefas concluídas.
- `git diff --check` — sem erros.

## Arquivos principais

- `apps/eventos/app/page.tsx`
- `apps/eventos/app/loading.tsx`
- `apps/eventos/app/not-found.tsx`
- `apps/eventos/components/catalogo/evento-destaque.tsx`
- `apps/eventos/components/base/esqueleto.tsx`
- `apps/eventos/components/catalogo-eventos.tsx`
- `apps/eventos/components/evento-card.tsx`
- `apps/eventos/components/catalogo-estados.tsx`
- `apps/eventos/components/imagem-publica-evento.tsx`
- `apps/eventos/lib/eventos-formatters.ts`
- Testes de catálogo e página pública

## Self-review e preocupações

- A lista pública não fornece horário final no tipo `PublicEventCard`; o destaque usa o horário inicial e o formatador aceita `fim` para os próximos contratos.
- O fallback textual da imagem continua disponível quando a URL está ausente ou falha.
- Classes azuis não foram introduzidas nos arquivos do catálogo; componentes legados de assentos e detalhe permanecem fora do escopo desta tarefa.

Atualizado em: 2026-11-08

## Fix round 1 — ajuste de objeto da imagem pública

### Causa raiz

`ImagemPublicaEvento` interpolava a prop em `object-${ajuste}`, produzindo `object-cobrir` e `object-conter`, classes que não existem no Tailwind. O fallback também não recebia a classe de ajuste.

### Correção

- Mapeamento explícito: `conter` para `object-contain`; qualquer outro valor suportado (`cobrir`) para `object-cover`.
- A classe mapeada é aplicada à imagem otimizada e ao fallback textual.
- Teste de regressão cobre os dois ajustes e o fallback.

### Verificação

- RED: o teste novo falhou com `Expected: "object-contain"` e HTML contendo `object-conter`.
- GREEN: `pnpm --filter @essencia/eventos test -- components/__tests__/catalogo-eventos.test.tsx app/publico.test.tsx` — 2 arquivos, 26 testes aprovados.
- `pnpm --filter @essencia/eventos lint` — 0 erros e 0 avisos no app.
- `pnpm --filter @essencia/eventos typecheck` — exit 0.

Arquivo alterado nesta rodada:

- `apps/eventos/components/imagem-publica-evento.tsx`
- `apps/eventos/components/__tests__/catalogo-eventos.test.tsx`

Atualizado em: 2026-11-08
