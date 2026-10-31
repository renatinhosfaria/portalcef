# Relatório da Task 6

## Status

Concluída no worktree `eventos-publico`.

## Alterações

- Ampliados os testes públicos para validar shell compartilhado, consulta em `/pedido/consulta`, links públicos, uso de `imageUrl`, estados de assento, endpoints anônimos e ausência de `/eventos-admin`.
- Extraídos `CatalogoPublico` e `normalizarTiposPorAssento` para módulos próprios, removendo exports nomeados das páginas Next.js e permitindo o build de produção.

## Verificações

- `pnpm --filter @essencia/eventos test`: passou — 8 arquivos, 54 testes.
- `pnpm --filter @essencia/eventos lint`: passou com avisos preexistentes sobre `next lint`, múltiplos lockfiles e `<img>` em `components/detalhe-evento.tsx`.
- `pnpm --filter @essencia/eventos typecheck`: passou.
- `pnpm --filter @essencia/eventos build`: passou; todas as rotas públicas foram compiladas.
- Smoke test com `pnpm --filter @essencia/eventos dev`: `/`, `/pedido/consulta` e `/checkout` responderam HTTP 200.

## Rodada de correção (smoke reproduzível)

- O teste de superfície administrativa agora varre recursivamente `app/`, `components/` e `lib/`, ignorando somente arquivos de teste, e confirma a ausência de `/eventos-admin`.
- `pnpm --filter @essencia/eventos test -- app/publico.test.tsx`: passou — 10 testes.
- Suíte completa, lint, typecheck e build foram repetidos; suíte: 54 testes passando; build compilou as 7 rotas públicas.
- Smoke versionado em `apps/eventos/scripts/smoke-publico.mjs`, executável com `node apps/eventos/scripts/smoke-publico.mjs`. O script inicia o Next local e uma API HTTP mockada controlada em `127.0.0.1:4100`, e executa Playwright 1.57.0 em dois viewports (`390x844` e `1440x900`) com `reducedMotion: "reduce"`. O script verificou:
  - catálogo com evento com imagem, fallback sem imagem e link público;
  - detalhe com imagem, sessões agrupadas e sessão esgotada;
  - mapa com assento disponível acionável, estados indisponíveis não acionáveis, resumo, tipos de ingresso e link com `sessionId`;
  - checkout com dois assentos/tipos e labels de comprador;
  - pedido pendente (`AGUARDANDO_PAGAMENTO`) e conclusivo (`CONFIRMADO`);
  - consulta pública, labels de formulário, ausência de overflow horizontal e duração de transição reduzida (`1e-05s`).
- O fixture alterna o catálogo por endpoint de controle interno entre `normal`, `empty` e `error`; o smoke confirma as mensagens distintas de vazio e erro HTTP. Também usa três sessões em dois dias, com horários fora de ordem na fixture, e confirma dois grupos e a ordem `13:00` antes de `15:00`. No mapa, compara bounding boxes de assentos em posições diferentes e dimensões positivas, além do resumo e do `sessionId`.
- Resultado do comando: `mobile: PASS (viewport 390x844, reduced-motion 1e-05s)` e `desktop: PASS (viewport 1440x900, reduced-motion 1e-05s)`. O mock foi usado porque o ambiente não fornece API de eventos/dados reais.

## Preocupações

- O lint/build continua emitindo o aviso de `<img>` em `components/detalhe-evento.tsx`; não alterado nesta tarefa para preservar o escopo visual existente.
- Next.js avisa que detectou múltiplos lockfiles e que `next lint` está deprecated.

## Rodada de correção — 31/10/2026

O smoke falhava na validação do catálogo vazio porque o seletor global `getByRole("alert")` também encontra o anunciador de rota do Next (`#__next-route-announcer__`), que permanece presente mesmo quando o catálogo está vazio. A asserção foi restringida ao elemento de catálogo (`p[role="alert"]`), preservando a distinção entre vazio e erro.

O script agora escolhe portas TCP livres para a API mockada e para o Next, inicia o Next com `next dev --port <porta>`, encerra o grupo de processos (incluindo wrappers do pnpm e filhos do Next) e fecha as conexões da API. Também instala tratamento para SIGINT/SIGTERM. Assim, execuções repetidas não dependem de `3014`/`4100` nem deixam servidor órfão após interrupção.

Comandos executados e resultados:

- `node apps/eventos/scripts/smoke-publico.mjs`: **PASS** — `mobile: PASS (viewport 390x844, reduced-motion 1e-05s)` e `desktop: PASS (viewport 1440x900, reduced-motion 1e-05s)`.
- Três execuções sequenciais do mesmo comando: **3/3 PASS** em mobile e desktop; nenhuma porta ou processo do smoke permaneceu após a conclusão.
- Execução interrompida com `SIGTERM` durante a inicialização: processo terminou com status `143`, e não restaram processos `next dev`, `smoke-publico` nem portas do smoke.
- `pnpm --filter @essencia/eventos test`: **PASS** — 8 arquivos, 54 testes.
- `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck`: **PASS**; permanecem apenas os avisos preexistentes de `next lint`, lockfiles múltiplos e `<img>` em `components/detalhe-evento.tsx`.
- `pnpm --filter @essencia/eventos build`: **PASS** — 7 rotas públicas compiladas; mesmos avisos preexistentes.

## Rodada de correção final

Achados corrigidos nesta rodada:

- Catálogo com estado de erro separado do vazio e botão acessível de tentar novamente que refaz o GET público.
- Imagens de catálogo e detalhe centralizadas em `ImagemPublicaEvento`, usando `next/image`, allowlist existente e fallback em `onError`; o detalhe passou a usar `<article>` e resumo textual quando ausente.
- Sessões exibem a janela `salesStartsAt`/`salesEndsAt` em `America/Sao_Paulo`, além de descrição e elegibilidade dos tipos de ingresso.
- Checkout reconstrói título, data, local, nomes e preços públicos; IDs técnicos não aparecem como único contexto humano disponível.
- Mapa inclui lista semântica de todos os assentos, com estado, categoria, acessibilidade e sincronização da seleção; somente disponíveis permanecem selecionáveis.
- Consulta de pedido traduz estados terminais para rótulos em PT-BR; spec foi marcada como aprovada e o ledger corrigido sem a referência obsoleta.

Validação final executada:

- `pnpm --filter @essencia/eventos test`: **PASS** — 8 arquivos, 57 testes.
- `pnpm --filter @essencia/eventos lint`: **PASS** sem erros ou avisos do ESLint.
- `pnpm --filter @essencia/eventos typecheck`: **PASS**.
- `pnpm --filter @essencia/eventos build`: **PASS** — rotas públicas compiladas.
- `node apps/eventos/scripts/smoke-publico.mjs`: **PASS** em mobile (390x844) e desktop (1440x900).
- `git diff --check`: **PASS**.
