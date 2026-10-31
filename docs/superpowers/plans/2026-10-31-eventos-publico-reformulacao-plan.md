# Reconstrução da camada pública de Eventos — Implementation Plan

> **Para agentes de implementação:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`) para acompanhamento.

**Goal:** Reconstruir a experiência pública de `apps/eventos` para descoberta e compra de ingressos, preservando API, painel administrativo, Stripe e regras atuais.

**Architecture:** Manter Next.js 15.5, React 19, TypeScript, Tailwind e as rotas públicas existentes. Usar Server Components para catálogo e detalhe, componentes client isolados para seleção de sessão, mapa, checkout e atualização do pedido, além dos primitives compartilhados de `@essencia/ui`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 3.4, `@essencia/ui`/Radix/shadcn, Lucide, `next/image`, Vitest e Intl com fuso `America/Sao_Paulo`.

**Spec:** `docs/superpowers/specs/2026-10-31-eventos-publico-reformulacao-design.md`

## Global Constraints

- Alterar somente a aplicação pública em `apps/eventos` e seus testes/configurações diretamente necessários.
- Manter backend, `apps/eventos-admin`, banco, Stripe, contratos HTTP, idempotência e regras comerciais atuais.
- Aplicações nunca acessam banco diretamente; toda leitura e escrita continua via API HTTP pública.
- Toda interface e mensagem nova deve estar em Português do Brasil.
- Datas e agrupamento de sessões usam o fuso canônico `America/Sao_Paulo`.
- Somente assentos `available` podem ser selecionados; `reserved`, `sold` e `blocked` permanecem bloqueados.
- O frontend nunca é fonte de verdade para preço, tenant, disponibilidade, elegibilidade comercial ou status do pedido.
- Sessão sem `mapId` será exibida como não vendável nesta versão.
- Hosts de imagens remotas devem estar explicitamente autorizados no `next.config.js`.
- Antes de cada commit, executar pelo menos `pnpm --filter @essencia/eventos lint` e `pnpm --filter @essencia/eventos typecheck`; ao final executar também testes e build.

## Review Focus

- **Catálogo com dados incompletos:** imagem ausente, resumo nulo, preço desconhecido, data nula, disponibilidade esgotada e erro de API devem produzir conteúdo compreensível — cobrir em `catalogo-eventos.test.tsx`.
- **Sessão não vendável e múltiplos ingressos:** sessão sem mapa, sessão esgotada e tipos de ingresso diferentes por assento não podem gerar link ou payload ambíguo — cobrir em `detalhe-evento-ingresso.test.tsx` e nos testes do seletor.
- **Geometria e estados do mapa:** coordenadas, zoom/escala, acessibilidade e estados `reserved`/`sold`/`blocked` devem impedir seleção e permanecer distinguíveis — cobrir em `mapa-assentos.test.tsx`.
- **Serialização e reserva:** assentos e tipos precisam permanecer alinhados na URL/checkout, conflitos devem preservar a seleção e chaves de idempotência não podem ser reutilizadas indevidamente — cobrir em `mapa-assentos.test.tsx`, `formulario-checkout.test.tsx` e `eventos-api.test.ts`.
- **Retorno do pagamento e consulta:** webhook atrasado, polling limitado, rota `/pedido/consulta` e ausência de PII devem produzir um estado seguro e acionável — cobrir em `consulta-pedido.test.tsx` e `pedido-consulta.test.tsx`.

---

## Mapa de arquivos e responsabilidades

### Fundação visual

- Modify: `apps/eventos/package.json` — adicionar os pacotes workspace usados pela fundação visual.
- Modify: `apps/eventos/next.config.js` — transpilar `@essencia/ui` e autorizar hosts públicos de imagens.
- Modify: `apps/eventos/tailwind.config.ts` — usar o preset compartilhado e incluir o código do pacote UI no scan.
- Modify: `apps/eventos/app/globals.css` — tokens, tipografia, superfícies, foco, redução de movimento e estilos globais.
- Modify: `apps/eventos/app/layout.tsx` — shell público, fontes, metadata e viewport.
- Modify: `apps/eventos/app/publico.test.tsx` — contratos do shell e configuração.

### Catálogo e detalhe

- Modify: `apps/eventos/app/page.tsx` — composição de estados e introdução do catálogo.
- Create: `apps/eventos/components/evento-card.tsx` — apresentação de um `PublicEventCard`.
- Modify: `apps/eventos/components/catalogo-eventos.tsx` — grade responsiva e composição dos cards.
- Create: `apps/eventos/components/catalogo-estados.tsx` — estados vazio e erro reutilizáveis.
- Modify: `apps/eventos/components/detalhe-evento.tsx` — hero, metadados, conteúdo e sessões.
- Create: `apps/eventos/components/sessoes-evento.tsx` — agrupamento temporal e ações por sessão.
- Create: `apps/eventos/lib/eventos-formatters.ts` — preço, data, local e disponibilidade em `pt-BR`.
- Modify/Create: `apps/eventos/components/__tests__/catalogo-eventos.test.tsx` e `detalhe-evento-ingresso.test.tsx` — contratos de apresentação.

### Mapa e seleção

- Modify: `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx` — preparar sessão, tipos e estado não vendável.
- Modify: `apps/eventos/components/mapa-assentos.tsx` — planta por geometria e interação client.
- Create: `apps/eventos/components/mapa-assentos-utils.ts` — bounds, estilo de posição, seleção e serialização.
- Create: `apps/eventos/components/resumo-assentos.tsx` — resumo responsivo e tipo de ingresso por assento.
- Create: `apps/eventos/components/__tests__/mapa-assentos.test.tsx` — estados, geometria, seleção e query.

### Checkout e consulta

- Modify: `apps/eventos/app/checkout/page.tsx` — aceitar `ticketTypeIds` alinhados aos assentos.
- Modify: `apps/eventos/components/formulario-checkout.tsx` — resumo visual, tipos por assento e estados de processamento.
- Modify: `apps/eventos/app/pedido/[orderNumber]/page.tsx` — retorno do Stripe e atualização limitada.
- Modify: `apps/eventos/components/consulta-pedido.tsx` — status, polling curto e ação manual.
- Create: `apps/eventos/app/pedido/consulta/page.tsx` — rota canônica sem número.
- Create: `apps/eventos/components/__tests__/pedido-consulta.test.tsx` — rota e estados do pedido.
- Modify: `apps/eventos/components/__tests__/consulta-pedido.test.tsx` e `formulario-checkout.test.tsx` — preservar invariantes existentes e cobrir a nova apresentação.

### Verificação final

- Modify: `apps/eventos/app/publico.test.tsx` — atualizar contratos de rotas, shell, acessibilidade e ausência de superfície administrativa.
- Modify: `apps/eventos/lib/eventos-api.test.ts` — preservar limites de API pública e acrescentar consulta/polling quando houver helper compartilhado.

## Task 1: Criar a fundação visual e o shell público

**Files:**
- Modify: `apps/eventos/package.json`
- Modify: `apps/eventos/next.config.js`
- Modify: `apps/eventos/tailwind.config.ts`
- Modify: `apps/eventos/app/globals.css`
- Modify: `apps/eventos/app/layout.tsx`
- Test: `apps/eventos/app/publico.test.tsx`

**Interfaces:**
- Produces: shell público com `lang="pt-BR"`, metadata, viewport, link de consulta e tokens CSS reutilizáveis.
- Produces: `next.config.js` com `transpilePackages: ["@essencia/ui", "@essencia/shared"]` e remote patterns explícitos para `www.portalcef.com.br/storage/**`, MinIO e desenvolvimento local.

- [ ] **Step 1: Escrever os testes falhando da fundação**

  Em `app/publico.test.tsx`, adicionar casos que leiam os arquivos e exijam:
  - dependências `@essencia/ui` e `@essencia/tailwind-config` no pacote;
  - transpile do pacote UI e remote pattern do storage público;
  - layout com `lang="pt-BR"`, `metadata`, `viewport` e `/pedido/consulta`;
  - ausência de `TenantProvider`, `Shell` e `/api/auth/me`.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- app/publico.test.tsx`

  Expected: FAIL porque o app ainda não usa o pacote UI, não possui a rota de consulta e o layout não declara o novo shell.

- [ ] **Step 3: Implementar a fundação visual**

  Adicionar `@essencia/ui` e `@essencia/tailwind-config` como dependências workspace. Configurar o preset compartilhado e o conteúdo de `packages/ui`. Reescrever `globals.css` com tokens claros, tipografia display/body, superfícies, estados de foco, `prefers-reduced-motion` e classes de largura/conteúdo. Atualizar o layout com as fontes `Outfit` e `DM_Sans`, metadata pública, viewport, header com marca e consulta de pedido, main sem largura fixa inadequada e footer mínimo.

- [ ] **Step 4: Rodar os testes da fundação**

  Run: `pnpm --filter @essencia/eventos test -- app/publico.test.tsx`

  Expected: PASS, sem referências a login ou painel administrativo.

- [ ] **Step 5: Verificar tipos e lint**

  Run: `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck`

  Expected: PASS.

- [ ] **Step 6: Commitar a fundação**

  ```bash
  git add apps/eventos/package.json apps/eventos/next.config.js apps/eventos/tailwind.config.ts apps/eventos/app/globals.css apps/eventos/app/layout.tsx apps/eventos/app/publico.test.tsx pnpm-lock.yaml
  git commit -m "feat: cria base visual da vitrine pública"
  ```

## Task 2: Reformular catálogo, cards e formatação pública

**Files:**
- Create: `apps/eventos/components/evento-card.tsx`
- Create: `apps/eventos/components/catalogo-estados.tsx`
- Create: `apps/eventos/lib/eventos-formatters.ts`
- Modify: `apps/eventos/components/catalogo-eventos.tsx`
- Modify: `apps/eventos/app/page.tsx`
- Test: `apps/eventos/components/__tests__/catalogo-eventos.test.tsx`

**Interfaces:**
- `formatarPrecoPublico(cents: number | null): string`
- `formatarDataPublica(value: Date | string | null, options?: Intl.DateTimeFormatOptions): string`
- `rotuloDisponibilidade(value: PublicEventCard["availability"] | PublicEventSession["availability"]): string`
- `EventoCard({ event }: { event: PublicEventCard }): JSX.Element`
- `CatalogoEstados({ kind }: { kind: "empty" | "error" }): JSX.Element`

- [ ] **Step 1: Escrever testes falhando para os formatadores e cards**

  Criar casos que garantam:
  - preço em reais com vírgula e fallback `Consulte`;
  - data formatada em `America/Sao_Paulo` mesmo quando o valor vem como string ISO;
  - card com `imageUrl` exibindo imagem, alt baseado no título e link `/evento/{slug}`;
  - card sem imagem exibindo fallback, sem quebrar o layout;
  - resumo, categoria, local, data, preço e disponibilidade presentes no HTML;
  - estados `sold_out` e `unavailable` sem CTA de compra enganoso.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/catalogo-eventos.test.tsx`

  Expected: FAIL porque os formatadores, `EventoCard` e os estados ainda não existem.

- [ ] **Step 3: Implementar formatadores, card e estados**

  Usar `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" })` em `formatarDataPublica`. Criar card com `next/image` quando houver URL autorizada e um fallback de marca quando não houver. O CTA deve ser um link para evento disponível e uma indicação textual para estados sem venda. Manter a grade como Server Component.

- [ ] **Step 4: Integrar o catálogo**

  Refatorar `CatalogoEventos` para usar `EventoCard`, ordenar somente pela ordem entregue pela API, e atualizar `app/page.tsx` para ter introdução curta, título, erro separado do vazio e `CatalogoEstados`.

- [ ] **Step 5: Rodar testes e verificação**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/catalogo-eventos.test.tsx app/publico.test.tsx`

  Expected: PASS.

  Run: `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck`

  Expected: PASS.

- [ ] **Step 6: Commitar o catálogo**

  ```bash
  git add apps/eventos/app/page.tsx apps/eventos/components/catalogo-eventos.tsx apps/eventos/components/evento-card.tsx apps/eventos/components/catalogo-estados.tsx apps/eventos/lib/eventos-formatters.ts apps/eventos/components/__tests__/catalogo-eventos.test.tsx
  git commit -m "feat: reformula catálogo público de eventos"
  ```

## Task 3: Organizar detalhe do evento e sessões como horários de cinema

**Files:**
- Create: `apps/eventos/components/sessoes-evento.tsx`
- Modify: `apps/eventos/components/detalhe-evento.tsx`
- Modify: `apps/eventos/app/evento/[slug]/page.tsx`
- Modify: `apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx`

**Interfaces:**
- `agruparSessoesPorDia(sessions: PublicEventSession[]): Array<{ key: string; label: string; sessions: PublicEventSession[] }>`
- `SessoesEvento({ eventSlug, sessions }: { eventSlug: string; sessions: PublicEventSession[] }): JSX.Element`
- `DetalheEvento({ event, sessions }: { event: PublicEventDetail; sessions: PublicEventSession[] }): JSX.Element`

- [ ] **Step 1: Escrever testes falhando para agrupamento e vendabilidade**

  Adicionar casos que garantam:
  - sessões em dias diferentes agrupadas no fuso `America/Sao_Paulo`;
  - sessão `sold_out` sem ação de compra;
  - sessão disponível sem `mapId` com mensagem de sessão não vendável;
  - sessão com um tipo de ingresso oferecendo ação direta;
  - sessão com vários tipos exibindo escolhas inequívocas e preservando cada `ticketTypeId`;
  - local, sala, instruções e acessibilidade apresentados sem inventar informação ausente.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/detalhe-evento-ingresso.test.tsx`

  Expected: FAIL nos casos novos de agrupamento, mapa ausente e estados visuais.

- [ ] **Step 3: Implementar `agruparSessoesPorDia` e `SessoesEvento`**

  Agrupar por chave de calendário calculada com `America/Sao_Paulo`, ordenar cada grupo por `startsAt` e renderizar horário, local, estado e ação. Sessões sem mapa ou sem tipos não devem gerar link de checkout. Para múltiplos tipos, manter links explícitos nesta etapa e preparar o mapa para a seleção por assento.

- [ ] **Step 4: Reescrever `DetalheEvento`**

  Criar abertura com imagem/fallback, título, resumo, metadados de data/local/preço, descrição, blocos de acessibilidade e política de cancelamento. Integrar `SessoesEvento` sem alterar as funções de API ou a rota pública.

- [ ] **Step 5: Rodar testes e verificação**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/detalhe-evento-ingresso.test.tsx components/__tests__/catalogo-eventos.test.tsx`

  Expected: PASS.

  Run: `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck`

  Expected: PASS.

- [ ] **Step 6: Commitar detalhe e sessões**

  ```bash
  git add apps/eventos/app/evento/[slug]/page.tsx apps/eventos/components/detalhe-evento.tsx apps/eventos/components/sessoes-evento.tsx apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx
  git commit -m "feat: organiza detalhe e sessões públicas"
  ```

## Task 4: Reconstruir mapa de assentos e resumo de seleção

**Files:**
- Create: `apps/eventos/components/mapa-assentos-utils.ts`
- Create: `apps/eventos/components/resumo-assentos.tsx`
- Create: `apps/eventos/components/__tests__/mapa-assentos.test.tsx`
- Modify: `apps/eventos/components/mapa-assentos.tsx`
- Modify: `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`
- Modify: `apps/eventos/app/checkout/page.tsx`

**Interfaces:**
- `calcularBoundsMapa(seats: PublicSeat[]): { minX: number; minY: number; width: number; height: number }`
- `estiloAssento(seat: PublicSeat, bounds: Bounds): React.CSSProperties`
- `serializarSelecaoAssentos(selection: Array<{ seatId: string; ticketTypeId: string }>): string`
- `MapaAssentos({ map, checkoutHref, ticketTypes }: { map: PublicMap; checkoutHref: string; ticketTypes: PublicEventTicketType[] }): JSX.Element`
- `ResumoAssentos({ selection, ticketTypes, onChangeTicketType }: Props): JSX.Element`

- [ ] **Step 1: Escrever testes falhando para geometria, estados e query**

  Criar casos que garantam:
  - bounds calculados a partir de `x`, `y`, `width` e `height`;
  - cada assento usa posição proporcional/absoluta estável e mantém seu rótulo;
  - `available` pode ser selecionado e os outros três estados têm `disabled`;
  - assentos acessíveis mantêm indicação textual, não apenas cor;
  - seleção de dois assentos permite tipos de ingresso diferentes;
  - query serializada preserva a ordem de `seatId` e `ticketTypeId` e inclui `sessionId`;
  - seleção vazia não cria link de checkout acionável.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos.test.tsx`

  Expected: FAIL porque o mapa atual usa grade fixa e só aceita um `ticketTypeId` global.

- [ ] **Step 3: Implementar utilitários puros de geometria e serialização**

  Calcular bounds com margem mínima para evitar divisão por zero, produzir estilos posicionados e serializar `assentos`, `ticketTypeIds` e `sessionId` em ordem alinhada. Manter a serialização compatível com a rota de checkout e não incluir preço.

- [ ] **Step 4: Implementar mapa visual e acessível**

  Renderizar a planta em container responsivo com posições derivadas dos dados. Usar `button` apenas para assentos disponíveis, `aria-label` completo para todos, legenda textual, foco visível e uma lista/resumo complementar para leitores de tela. Usar `prefers-reduced-motion` nos estados de seleção; não introduzir dependência de animação adicional.

- [ ] **Step 5: Implementar resumo por assento e integrar a sessão**

  Mostrar assentos selecionados, permitir escolher o tipo de ingresso por assento e construir o link para `/checkout`. Atualizar a página da sessão para não chamar mapa quando não houver sessão vendável, e atualizar o checkout para ler `ticketTypeIds` alinhados com `assentos`.

- [ ] **Step 6: Rodar testes e verificação**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos.test.tsx components/__tests__/formulario-checkout.test.tsx components/__tests__/detalhe-evento-ingresso.test.tsx`

  Expected: PASS, incluindo os invariantes anteriores de assento e checkout.

  Run: `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck`

  Expected: PASS.

- [ ] **Step 7: Commitar mapa e seleção**

  ```bash
  git add apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx apps/eventos/app/checkout/page.tsx apps/eventos/components/mapa-assentos.tsx apps/eventos/components/mapa-assentos-utils.ts apps/eventos/components/resumo-assentos.tsx apps/eventos/components/__tests__/mapa-assentos.test.tsx
  git commit -m "feat: melhora mapa de assentos público"
  ```

## Task 5: Modernizar checkout, retorno do Stripe e consulta de pedido

**Files:**
- Create: `apps/eventos/app/pedido/consulta/page.tsx`
- Create: `apps/eventos/components/__tests__/pedido-consulta.test.tsx`
- Modify: `apps/eventos/app/checkout/page.tsx`
- Modify: `apps/eventos/components/formulario-checkout.tsx`
- Modify: `apps/eventos/components/consulta-pedido.tsx`
- Modify: `apps/eventos/app/pedido/[orderNumber]/page.tsx`
- Modify: `apps/eventos/components/__tests__/formulario-checkout.test.tsx`
- Modify: `apps/eventos/components/__tests__/consulta-pedido.test.tsx`

**Interfaces:**
- `normalizarTiposPorAssento(seatIds: string[], ticketTypeIds: string[]): string[]`
- `ehStatusPendentePedido(status: string): boolean`
- `ConsultaPedido({ initialOrderNumber, initialResult, autoAtualizar, onResult }: Props): JSX.Element`
- `PedidoPublicoStatus({ result, retorno }: Props): JSX.Element`

- [ ] **Step 1: Escrever testes falhando para query, rota e estados**

  Adicionar casos que garantam:
  - `ticketTypeIds` é alinhado ao número de assentos e usa fallback único somente quando permitido;
  - `/pedido/consulta` renderiza formulário sem interpretar `consulta` como número;
  - pedido `INICIADO`, `RESERVADO` ou `AGUARDANDO_PAGAMENTO` é pendente;
  - status conclusivo encerra atualização;
  - polling tem limite de tentativas e não dispara depois do unmount;
  - markup não contém e-mail, telefone ou links administrativos do pedido público.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/pedido-consulta.test.tsx components/__tests__/consulta-pedido.test.tsx components/__tests__/formulario-checkout.test.tsx`

  Expected: FAIL nos casos novos de rota, normalização e polling.

- [ ] **Step 3: Implementar normalização e resumo do checkout**

  Ler `assentos`, `ticketTypeIds` e `sessionId` da URL, rejeitar arrays desalinhados com mensagem clara e mostrar no formulário o resumo de sessão, assentos e tipos. Preservar participantes, políticas, idempotência, tratamento de conflito e redirecionamento para o checkout hospedado do Stripe.

- [ ] **Step 4: Implementar rota canônica de consulta**

  Criar `app/pedido/consulta/page.tsx` com `ConsultaPedido` sem número inicial. Manter `/pedido/[orderNumber]` para o pedido específico e atualizar o link do shell para a nova rota.

- [ ] **Step 5: Implementar status e polling limitado**

  Manter a consulta por `consultarPedido(orderNumber)`. Após retorno `sucesso`, atualizar somente enquanto o pedido estiver em estado pendente, com intervalo curto, limite de tentativas e cancelamento no cleanup. Exibir ação manual após o limite. O polling não deve alterar contratos ou criar endpoints.

- [ ] **Step 6: Rodar testes e verificação**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/pedido-consulta.test.tsx components/__tests__/consulta-pedido.test.tsx components/__tests__/formulario-checkout.test.tsx lib/eventos-api.test.ts`

  Expected: PASS, incluindo os testes existentes de políticas, idempotência, checkoutUrl e PII.

  Run: `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck`

  Expected: PASS.

- [ ] **Step 7: Commitar checkout e consulta**

  ```bash
  git add apps/eventos/app/checkout/page.tsx apps/eventos/app/pedido apps/eventos/components/formulario-checkout.tsx apps/eventos/components/consulta-pedido.tsx apps/eventos/components/__tests__/formulario-checkout.test.tsx apps/eventos/components/__tests__/consulta-pedido.test.tsx apps/eventos/components/__tests__/pedido-consulta.test.tsx
  git commit -m "feat: moderniza checkout e consulta de pedidos"
  ```

## Task 6: Verificar integração, acessibilidade e entrega do app

**Files:**
- Modify: `apps/eventos/app/publico.test.tsx`
- Modify: testes públicos tocados pelas tarefas anteriores

**Interfaces:**
- Produces: cobertura final de que a vitrine é anônima, usa apenas API pública, preserva rotas e não expõe superfície administrativa.

- [ ] **Step 1: Escrever os testes finais de integração**

  Atualizar `app/publico.test.tsx` para verificar layout compartilhado, rota `/pedido/consulta`, ausência de `TenantProvider`/`Shell`, links públicos, estados de assento, uso de `imageUrl` e nenhuma referência pública a `/eventos-admin`.

- [ ] **Step 2: Rodar a suíte completa do app**

  Run: `pnpm --filter @essencia/eventos test`

  Expected: PASS em todos os testes existentes e novos.

- [ ] **Step 3: Rodar lint e typecheck do app**

  Run: `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck`

  Expected: PASS sem warnings novos tratados como erro.

- [ ] **Step 4: Rodar build de produção**

  Run: `pnpm --filter @essencia/eventos build`

  Expected: PASS com todas as rotas públicas compiladas e sem erro de `next/image`, fonte, pacote workspace ou Server/Client Component.

- [ ] **Step 5: Fazer smoke test local**

  Run: `pnpm --filter @essencia/eventos dev` e verificar manualmente em desktop e viewport móvel:
  - catálogo com imagem, fallback, vazio e erro;
  - detalhe com sessões por dia e estados de venda;
  - mapa com assentos em posições diferentes, zoom/escala e resumo fixo;
  - checkout com múltiplos tipos de ingresso;
  - `/pedido/consulta` e pedido pendente/conclusivo;
  - foco de teclado, labels e redução de movimento.

  Expected: nenhuma rota redireciona para login, nenhum assento indisponível é acionável e o layout não cria overflow horizontal inesperado.

- [ ] **Step 6: Commitar os testes finais**

  ```bash
  git add apps/eventos
  git commit -m "test: valida vitrine pública reformulada"
  ```

## Verificação final do plano

- A fundação cobre dependências, tokens, shell, fontes, imagens e metadata.
- O catálogo cobre imagem, fallback, metadados, disponibilidade e estados de
  erro/vazio.
- O detalhe cobre agrupamento por fuso, sessões sem mapa, múltiplos ingressos,
  local, acessibilidade e políticas.
- O mapa cobre geometria real, estados, acessibilidade, tipos por assento,
  serialização e integração com checkout.
- Checkout e pedido preservam idempotência, políticas, Stripe, PII e consulta
  pública, acrescentando apenas apresentação e polling limitado.
- A tarefa final executa testes, lint, typecheck, build e smoke test.

