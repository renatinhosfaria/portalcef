# Plano de implementação — combos de ingressos

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: usar `superpowers:subagent-driven-development` ou `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam caixas de seleção para registrar o progresso. A execução ainda depende da escolha de método pelo Renato.

**Objetivo:** vender pacotes opcionais com quantidade de lugares configurável, combináveis com avulsos, sem teto global de assentos e com um ingresso e QR Code para cada lugar.

**Arquitetura:** manter um item de pedido e um participante por assento. Identificar o pacote em cada assento da requisição, validar grupos completos e ratear seu preço numa função compartilhada; a API grava o resultado e as evidências históricas na transação existente. Usar rascunhos em `sessionStorage` para retorno ao mapa, preservando os URLs antigos de avulsos; o checkout continua recebendo apenas a referência curta ao pedido.

**Stack:** TypeScript, Next.js, React, NestJS/Fastify, Drizzle/PostgreSQL, Zod, Vitest e Jest; aproveitar as dependências existentes.

**Spec aprovada:** [2026-11-16-combos-ingressos-design.md](../specs/2026-11-16-combos-ingressos-design.md).

## Restrições globais

- “Não haverá limite global de assentos por pedido”; “Não substituir esse teto por outro número fixo”. Remover também truncamentos de restauração, não apenas o bloqueio visual.
- “O preço cadastrado representa o pacote completo.” “Cada assento gera um ingresso individual com seu próprio QR Code.”
- “Combos não aparecem como tipos avulsos na escolha de cada lugar e nunca são selecionados automaticamente”.
- “Pedidos existentes permanecem com seus valores originais”; a migração atribui quantidade 1 aos tipos existentes e não infere comportamento pelo nome.
- “Aplicações continuam acessando dados exclusivamente pela API e mantendo o contexto de autorização existente.”
- “Manter o valor mínimo de pagamento já existente, sem criar um mínimo por assento”. Cupons continuam seguindo as regras atuais, inclusive gratuidade quando já suportada.
- Comunicação, domínio novo, comentários, documentação e commits em PT-BR. Preservar nomes técnicos existentes.
- TDD: escrever testes de comportamento, observar a falha, implementar e observar o sucesso. Falha de configuração de teste não conta como RED.
- Executar `pnpm turbo lint && pnpm turbo typecheck` antes de **cada** commit. Este requisito também vale para commits de documentação.
- Produção não é ambiente de teste: não aplicar migration, configurar o ingresso existente nem executar deploy durante este plano.

## Foco da revisão

1. PATCH de cliente antigo que omite quantidade: preservar um combo já configurado, sem transformá-lo silenciosamente em avulso; teste na tarefa 3.
2. Mesmo pedido repetido com outros UUIDs de pacote ou assentos reordenados: reconhecer a composição equivalente e preservar centavos; testes nas tarefas 2 e 4.
3. Armazenamento do navegador indisponível ou rascunho de outra sessão: não liberar a reserva antes de garantir a recuperação, nem restaurar estado estranho; testes na tarefa 7.
4. Atualização ao vivo perde um assento no meio de dois combos: desfazer só o grupo afetado e não preencher seus sobreviventes com avulsos automaticamente; teste na tarefa 6.
5. Confirmação repetida de pagamento de pacote: continuar emitindo exatamente um QR por item, sem duplicar nem compartilhar identidade; teste na tarefa 9.

## Mapa dos arquivos e decisões de contrato

Os caminhos abaixo são relativos à raiz do repositório. Arquivos novos são explicitamente indicados nas tarefas. Evoluir arquivos existentes sem refatorar módulos alheios à funcionalidade.

| Unidade | Arquivos principais | Responsabilidade |
|---|---|---|
| Contratos e banco | `packages/db/src/schema/eventos.ts`, `packages/db/drizzle/0059_eventos_pacotes_ingressos.sql`, `packages/shared/src/schemas/eventos.ts`, `packages/shared/src/types/eventos.ts` | Quantidade configurável, entrada por assento e evidência retornada |
| Regra compartilhada | Novo `packages/shared/src/eventos/pacotes.ts` | Validar grupos, ratear preço e comparar composições |
| Cadastro | `services/api/src/modules/eventos/eventos.service.ts`, `eventos-admin.controller.ts`, `eventos-rules.service.ts`; `apps/eventos-admin/features/eventos/etapas-contratos.ts` e página de ingressos | Persistir configuração e expor campo no autosave |
| Reserva e consulta | `services/api/src/modules/eventos/eventos-public-sales.service.ts` | Autoridade sobre preço, transação, idempotência e evidência |
| Seleção | Novo `apps/eventos/lib/composicao-pacotes.ts`; componentes em `apps/eventos/components/escolha/` | Agrupar, desfazer e escolher avulsos sem sobreposição |
| Navegação | Novo `apps/eventos/lib/rascunho-selecao.ts`; `checkout-utils.ts`, páginas e `fluxo-checkout.tsx` | Referência curta, recuperação e liberação segura |
| Apresentação | `eventos-formatters.ts`, `evento/caixa-compra.tsx`, `checkout/resumo-pedido.tsx` | Preço por pacote, preço principal avulso e resumo |
| Emissão | `eventos-confirmacao.service.ts`, `montar-pedido-ingressos.ts` e respectivos testes | Um ingresso por item, com identidade individual |

**Contrato exato entre tarefas:**

- Campo novo: `lugaresPorPacote` em TypeScript, coluna `lugares_por_pacote` inteira, `NOT NULL DEFAULT 1`, com `CHECK > 0`. Não usar `rules` para codificar a quantidade.
- Quantidade ausente em tipos públicos antigos é normalizada para 1. A API nova sempre a retorna. Nos tipos públicos, `lugaresPorPacote?: number` permite a transição sem quebrar consumidores antigos.
- Cada entrada de `ReservaPublicaInput.seats` ganha `pacoteId?: string` (UUID). Cada pacote tem um UUID distinto e só contém assentos do mesmo tipo, na mesma sessão. Avulsos não têm `pacoteId`.
- Evidência nova, definida em `packages/shared/src/types/eventos.ts` na tarefa 1 e reexportada por `pacotes.ts` na tarefa 2: `EvidenciaPacote = { id: string; lugaresPorPacote: number; precoPacoteCentavos: number; versaoTipo: number; nomeTipo: string }`. Cada item do grupo grava o mesmo objeto em `pricingEvidence.pacote`. O contrato não depende de arquivo que só existirá em tarefa posterior.
- Itens de reserva/consulta recebem `pacote?: EvidenciaPacote | null`; ausência significa avulso/legado. `ItemPedidoPublico` mantém seus demais campos e a associação `participantIndex` existente.
- Preço total do grupo antes do cupom fica na evidência; valores base rateados continuam em `baseUnitPriceCents`. Não trocar o significado dos campos de desconto existentes.

## Preparação da execução

- [ ] Ler a spec e este plano; confirmar `git status --short` e instruções locais. A spec ainda está sem commit no checkout no momento do planejamento; preservar os dois documentos na área de execução.
- [ ] Usar `superpowers:using-git-worktrees` se houver necessidade de isolamento; reutilizar checkout adequado ou criar worktree com a ferramenta nativa, sem copiar alterações alheias.
- [ ] Registrar a linha de base: `pnpm --filter @essencia/db test`, `pnpm --filter @essencia/shared test`, `pnpm --filter @essencia/api test --runInBand --testPathPattern=modules/eventos`, `pnpm --filter @essencia/eventos test`, `pnpm --filter @essencia/eventos-admin test`. Separar falhas existentes das introduzidas.
- [ ] Antes de testes da API que dependam de tipos emitidos, executar `pnpm --filter @essencia/db build` e `pnpm --filter @essencia/shared build`; o Jest usa shims para schemas e banco, mas o typecheck também consome `dist`.

### Tarefa 1 — Quantidade persistida e contratos compatíveis

**Arquivos:** modificar `packages/db/src/schema/eventos.ts`, `packages/db/src/schema/eventos.test.ts`, `packages/db/drizzle/meta/_journal.json`, `packages/shared/src/schemas/eventos.ts`, `packages/shared/src/types/eventos.ts`, `packages/shared/src/schemas/eventos-publico.test.ts`; criar `packages/db/drizzle/0059_eventos_pacotes_ingressos.sql`. Se houver migration posterior na execução, usar o próximo número livre e ajustar o journal sem reescrever migrations existentes.

**Interfaces:** produz os campos descritos no contrato; exporta `tipoIngressoAdminSchema` para PATCH, com `id` opcional e `lugaresPorPacote` opcional, e seu tipo inferido `TipoIngressoAdminInput`. A criação de evento usa a mesma estrutura sem `id`, com quantidade padrão 1. Não adicionar teto de assentos nos arrays.

- [ ] **RED:** adicionar testes `aceita_reserva_e_finalizacao_com_30_assentos`, `valida_quantidade_do_pacote` e `preserva_contrato_avulso_legado`. Asserções: reserva com 30 UUIDs válidos e finalização com 30 participantes são aceitas; pacote 30 é válido; quantidade 0, negativa, fracionária e `null` é rejeitada; criar tipo sem quantidade resulta em 1; PATCH sem quantidade continua sem a propriedade. Testar também formato UUID de `pacoteId` e rejeição de campos extras na reserva.
- [ ] **RED:** no teste do banco, `assert.equal(eventoTiposIngresso.lugaresPorPacote.default, 1)` e `.notNull === true`, mais presença do CHECK de positividade via `getTableConfig`. Executar `pnpm --filter @essencia/db test` e `pnpm --filter @essencia/shared test src/schemas/eventos-publico.test.ts`; observar falha dos comportamentos novos.
- [ ] **Implementar:** coluna, migration aditiva e journal; schemas administrativos e campos públicos. Remover `.max(20)` somente de `reservaPublicaSchema.seats` e `finalizarPedidoSchema.participants`, mantendo `.min(1)`, índices, UUIDs e os cinco aceites. Não alterar rate limits HTTP, tamanhos de nomes nem limites de cortesia que também usem o número 20.
- [ ] **GREEN:** repetir os dois comandos, construir banco/shared e conferir a migration: só nova coluna, default e constraint; nenhuma alteração de pedidos, preços, limites por tipo ou dados pessoais. Não executar `db:migrate` contra o servidor. Se gerar SQL com Drizzle, construir o banco antes porque a configuração lê `dist/schema/index.js`, e revisar a saída gerada para não incluir alterações antigas de snapshot.
- [ ] **Commit:** pipeline global obrigatório; adicionar somente os arquivos desta tarefa e os documentos aprovados; `git commit -m "feat(eventos): definir quantidade de lugares por pacote"`.

### Tarefa 2 — Validação de grupos, rateio e assinatura compartilhados

**Arquivos:** criar `packages/shared/src/eventos/pacotes.ts` e `pacotes.test.ts`; modificar `packages/shared/package.json`. Importar e reexportar `EvidenciaPacote` do contrato da tarefa 1, sem criar uma segunda definição ou ciclo de imports em tempo de execução.

**Interfaces produzidas em `@essencia/shared/eventos/pacotes`:**

```ts
type AssentoPacote = { seatId: string; ticketTypeId: string; participantIndex: number; pacoteId?: string };
type TipoIngressoPacote = { id: string; name: string; priceCents: number; lugaresPorPacote?: number; version?: number };
type ItemPrecoPacote = ItemPreco & { pacote?: EvidenciaPacote };
function validarComposicaoPacotes(assentos: AssentoPacote[], tipos: TipoIngressoPacote[]): void;
function montarItensPrecoPacotes(assentos: AssentoPacote[], tipos: TipoIngressoPacote[]): ItemPrecoPacote[];
function assinaturaComposicaoPacotes(sessionId: string, assentos: AssentoPacote[]): string;
```

`ItemPreco` é o tipo existente em `precos.ts`. Reexportar `EvidenciaPacote` com a estrutura do contrato. Validação lança `ErroComposicaoPacotes` com `codigo: "PACOTE_INCOMPLETO" | "PACOTE_INVALIDO"`; a API traduz o erro sem expor internals. Duplicidade de assento também é inválida, independentemente dos grupos.

- [ ] **RED:** escrever casos `rateia_cada_pacote_sem_perder_centavos`, `recusa_grupos_parciais_mistos_e_sobrepostos` e `assinatura_independe_dos_ids_transitorios`. Exemplos: `expect(valores.sort()).toEqual([3333, 3334, 3334])` para pacote de 10001/3; dois desses pacotes somam 20002, preservando o conjunto por grupo; 38000/10 produz dez bases de 3800. Reordenar assentos mantém cada base associada ao mesmo `seatId`; mudar só os UUIDs de grupo mantém a assinatura; trocar membros entre dois grupos muda a assinatura.
- [ ] **RED:** testar avulso com quantidade ausente, combo sem grupo, avulso com grupo, grupo com tipos diferentes, tipo inexistente, dez lugares repartidos em dois grupos incompletos e preço menor que quantidade. Este último permite bases zero e conserva a soma; não confundir piso do pedido com piso por item. Executar `pnpm --filter @essencia/shared test src/eventos/pacotes.test.ts` e confirmar a falha.
- [ ] **Implementar:** agrupar por `pacoteId`, exigir tamanho igual à configuração e unicidade global de assentos. Para cada grupo, ordenar `seatId`, distribuir quociente/resto, preservar a ordem e `participantIndex` da entrada no retorno. A assinatura canoniza grupos pelo conjunto de membros, não pelo UUID, e inclui sessão/tipo/índice; não usa preços nem configuração atual para comparar reservas históricas. Completar export map com entradas `types`, `import`, `require`, `default`, seguindo os módulos vizinhos.
- [ ] **GREEN:** repetir teste, rodar `pnpm --filter @essencia/shared test src/eventos/precos.test.ts` e construir shared para validar o novo subpath.
- [ ] **Commit:** pipeline global; `git commit -m "feat(eventos): validar e ratear pacotes de ingressos"`.

### Tarefa 3 — Cadastro administrativo completo

**Arquivos:** modificar `services/api/src/modules/eventos/eventos-admin.controller.ts`, `eventos.service.ts`, `eventos-rules.service.ts`, `eventos.service.spec.ts`, `eventos-rules.service.spec.ts`, `eventos.controller.spec.ts`; `apps/eventos-admin/features/eventos/etapas-contratos.ts`, `etapas-contratos.test.ts`, `evento-form.tsx`, `contracts.ts`; `apps/eventos-admin/app/eventos/[id]/ingressos/page.tsx`. Criar `apps/eventos-admin/app/eventos/[id]/ingressos/page.test.tsx` para comportamento do campo, mantendo o teste estático existente `page.test.ts`.

**Interfaces:** consome `TipoIngressoAdminInput` e `tipoIngressoAdminSchema`; mantém nomes dos métodos existentes `criar`, `atualizarIngressos`, `listarSessoesPublicas`. `IngressoValue`, DTO do formulário inicial e payload passam a transportar `lugaresPorPacote`; criação padrão 1 e PATCH omisso preserva o valor atual.

- [ ] **RED:** testar criação e atualização com tamanho 10/30, retorno administrativo/público, rejeição de 0 e fração e PATCH legado sobre combo 10 (`expect(tipoAtualizado.lugaresPorPacote).toBe(10)`). Verificar que outra escola não pode atualizar o tipo e tipo interno não entra na lista pública; usar as fixtures de autorização existentes.
- [ ] **RED:** no formulário, preencher “Lugares por pacote” com 10, aguardar autosave e conferir `expect(payload.lugaresPorPacote).toBe(10)`. Campo inválido bloqueia autosave; carregar tipo legado mostra 1. Limite opcional menor que pacote exibe aviso, e vazio serializa `maxPerOrder: null` para poder remover um limite existente. Executar `pnpm --filter @essencia/api test --runInBand --testPathPattern='eventos\.(controller|service)|eventos-rules'` e `pnpm --filter @essencia/eventos-admin test features/eventos/etapas-contratos.test.ts 'app/eventos/[id]/ingressos/page.test.tsx'`.
- [ ] **Implementar:** usar schema compartilhado no PATCH e validar também no serviço; salvar quantidade em todos os caminhos de criação/atualização, incrementar versão como hoje e expor a quantidade no contrato público. Campo com `min=1`, `step=1`, sem `max=20`. Explicar “Preço total do pacote” para quantidade >1 e “Limite de lugares deste tipo por pedido (opcional)” para `maxPerOrder`, sem preencher limite automaticamente. Não bloquear configuração só porque seu pacote excede a capacidade atual; a compra verifica disponibilidade.
- [ ] **GREEN:** repetir testes e incluir `pnpm --filter @essencia/eventos-admin test features/eventos/contracts.test.ts features/eventos/evento-form.test.ts` para o caminho inicial de criação.
- [ ] **Commit:** pipeline global; `git commit -m "feat(eventos): configurar pacotes no cadastro de ingressos"`.

### Tarefa 4 — Reserva transacional e consulta com pacotes

**Arquivos:** modificar `services/api/src/modules/eventos/eventos-public-sales.service.ts`, `eventos-public-sales.service.spec.ts`, `eventos-public.controller.spec.ts`; ampliar as fixtures existentes `criarBancoReserva`/`entradaReserva` para tipos, grupos e evidências, preservando os testes legados.

**Interfaces:** consome `montarItensPrecoPacotes` e `assinaturaComposicaoPacotes`; mantém `reservarAssentos(raw: unknown): Promise<ReservaPublicaResult>`. `reservaResult` e `pedidoResult` passam a devolver `pacote` dos itens gravados. Não depender de configuração atual para construir respostas de reservas existentes.

- [ ] **RED:** reservar 10 lugares de combo por 38000; 11 com avulso de 4500 por 42500; 30 com três combos por 114000. Asserções: número de itens/reservas igual ao número de assentos; `quantity === 1`; base por lugar 3800; evidência do grupo presente; subtotal soma uma cobrança por pacote.
- [ ] **RED:** recusar 9 membros, grupos de tipos mistos, assento duplicado, tipo interno/inativo/de outro evento, limite por tipo 9 para combo 10 e pedido acima do limite configurado. Sem `maxPerOrder`, permitir 30. Em erro não persistir pedido/grupo parcial. Idempotência: mesma composição com outros UUIDs devolve o mesmo pedido; mudança de composição com chave antiga retorna `IDEMPOTENCY_CONFLICT`. Repetir após mudar preço/tamanho do cadastro devolve preços e grupos históricos.
- [ ] **Executar RED:** `pnpm --filter @essencia/api test --runInBand --testPathPattern='eventos-public-sales.service|eventos-public.controller'`.
- [ ] **Implementar:** depois de carregar e bloquear os tipos válidos, gerar itens base pelo módulo compartilhado; passar ao calculador existente com `offers: []`, manter mínimo de R$ 1,00 na reserva como hoje e persistir a evidência adicional. Manter limites opcionais contados por assento, locks ordenados, takeover e tratamento de colisão de chave. Na comparação idempotente, reconstruir grupos de `pricingEvidence` e canonizar; não revalidar o tamanho histórico contra o cadastro atual. Retornar `pacote` tanto na reserva nova como na repetida e na consulta.
- [ ] **GREEN:** repetir comando e conferir que continuam passando os testes de takeover, colisão, limite por tipo e liberação. Composição inválida vira erro 400 com código do módulo e mensagem PT-BR, não erro interno.
- [ ] **Commit:** pipeline global; `git commit -m "feat(eventos): reservar pacotes completos com preço por grupo"`.

### Tarefa 5 — Cupons e preços históricos dos itens

**Arquivos:** modificar `services/api/src/modules/eventos/eventos-public-sales.service.ts`, `eventos-public-sales.service.spec.ts`; testar também `packages/shared/src/eventos/precos.test.ts`. Evitar alterar `eventos-cupons.service.ts` se sua regra de elegibilidade não precisar mudar.

**Interfaces:** mantém `aplicarCupom` e `precoBaseHistorico` existentes; o recálculo consome a base rateada gravada, não `ticket.priceCents`. `pricingEvidence.pacote` sobrevive a todas as atualizações de desconto.

- [ ] **RED:** combo de 38000 + avulso 4500, subtotal 42500, cupom 10% resulta em desconto 4250 e total 38250. Trocar cupom e removê-lo volta a 42500; soma dos itens acompanha total. Asserções: evidência de cada grupo preservada, bases históricas não mudam e não se aplica o preço 38000 dez vezes. Testar pacote com resto em centavos, cupom fixo, cupom 100% pelo fluxo já permitido e mudança de cadastro depois da reserva.
- [ ] **Executar RED:** `pnpm --filter @essencia/api test --runInBand --testPathPattern=eventos-public-sales.service`.
- [ ] **Implementar:** preservar evidências via merge, usar bases rateadas como origem e manter semântica de cupom, piso, retenção e gratuidade existentes. Não criar oferta automática nem reaplicar ofertas antigas em reservas novas; pedidos legados com evidências de oferta mantêm sua lógica atual.
- [ ] **GREEN:** repetir comando e `pnpm --filter @essencia/shared test src/eventos/precos.test.ts`, incluindo regressões legadas de cupons.
- [ ] **Commit:** pipeline global; `git commit -m "fix(eventos): preservar bases dos pacotes ao aplicar cupons"`.

### Tarefa 6 — Composição de pacotes na seleção de lugares

**Arquivos:** criar `apps/eventos/lib/composicao-pacotes.ts`, `lib/__tests__/composicao-pacotes.test.ts` e `components/escolha/seletor-pacotes.tsx`; modificar `components/assentos-types.ts`, `lib/selecao-lugares.ts`, `lib/__tests__/selecao-lugares.test.ts`, `components/escolha/escolha-lugares.tsx`, `resumo-lugares.tsx` e testes `components/__tests__/escolha-lugares.test.tsx`, `escolha-lugares-retry.test.tsx`, `disponibilidade-ao-vivo.test.tsx`.

**Interfaces:** `AssentoSelecionado` ganha `pacoteId?: string`. Em `composicao-pacotes.ts`, produzir funções puras:

```ts
function adicionarPacote(selecao: AssentoSelecionado[], tipos: PublicEventTicketType[], tipoId: string, pacoteId: string): AssentoSelecionado[];
function desfazerPacote(selecao: AssentoSelecionado[], pacoteId: string): AssentoSelecionado[];
function removerAssentos(selecao: AssentoSelecionado[], seatIds: string[]): AssentoSelecionado[];
function selecaoCompleta(selecao: AssentoSelecionado[], tipos: PublicEventTicketType[]): boolean;
```

`adicionarPacote` escolhe primeiro lugares sem classificação e depois avulsos, preservando ordem em cada conjunto; quantidade insuficiente ou limite excedido mantém seleção original. `desfazerPacote` limpa tipo/grupo dos sobreviventes. `removerAssentos` desfaz grupos afetados antes de retirar lugares. `selecaoCompleta` exige seleção não vazia e composição validada, incluindo limites opcionais. `calcularPrecoSelecao` usa os itens base da tarefa 2 e o calculador atual; enquanto houver lugares sem classificação, calcular apenas a parte válida da seleção e indicar que o total está incompleto. Tipos de pacote sem grupo completo não entram como avulsos no subtotal. Na reserva a validação sempre abrange a seleção inteira.

- [ ] **RED:** testar adicionar um combo após 10 avulsos automáticos; 9 não permite; 11 mantém um avulso; 20 permite dois ou um + dez avulsos; 30 permite três; misturar pacote de 3 com pacote de 10. `expect(new Set(idsDeTodosOsGrupos).size).toBe(totalDeLugaresEmGrupos)` e `expect(selecaoCompleta(...)).toBe(false)` após desfazer um grupo.
- [ ] **RED:** sessão só com combo não autoatribui tipo e exige múltiplos completos. Ao perder ao vivo um lugar de um entre dois combos, nove sobreviventes ficam sem tipo, o segundo grupo permanece e não aparece cobrança automática de avulsos. Restaurar/selecionar 30 lugares não trunca. Reserva enviada leva os `pacoteId` corretos, `participantIndex` único e sequencial; falha recuperável preserva seleção.
- [ ] **Executar RED:** `pnpm --filter @essencia/eventos test lib/__tests__/composicao-pacotes.test.ts lib/__tests__/selecao-lugares.test.ts components/__tests__/escolha-lugares.test.tsx components/__tests__/escolha-lugares-retry.test.tsx components/__tests__/disponibilidade-ao-vivo.test.tsx`.
- [ ] **Implementar:** usar as funções puras no clique, na remoção manual, na atualização ao vivo e na recuperação. Retirar `LIMITE_LUGARES`, `.slice(0, LIMITE_LUGARES)`, `limitReached` e aviso de máximo 20. O seletor mostra tipos de pacote, preço total, quantidade coberta e ações “Adicionar pacote”/“Desfazer pacote”; radios por lugar mostram apenas avulsos fora de pacote. Novos lugares podem receber automaticamente o único avulso; lugares devolvidos por desfazer não passam por esse preenchimento. Adaptar mensagens “Escolha o ingresso dos lugares restantes” e estados bloqueados no celular/computador.
- [ ] **GREEN:** repetir comando. Verificar via asserções de UI que o total corresponde ao conjunto completo de escolhas e que ambos os botões Continuar bloqueiam a mesma composição inválida.
- [ ] **Commit:** pipeline global; `git commit -m "feat(eventos): compor combos e avulsos na seleção de lugares"`.

### Tarefa 7 — Navegação curta e recuperação de seleções grandes

**Arquivos:** criar `apps/eventos/lib/rascunho-selecao.ts`, `lib/__tests__/rascunho-selecao.test.ts`; modificar `lib/checkout-utils.ts`, `lib/__tests__/checkout-utils.test.ts`, `lib/eventos-api.ts`, `lib/eventos-api.test.ts`, `components/escolha/escolha-lugares.tsx`, `components/checkout/fluxo-checkout.tsx`, `app/evento/[slug]/sessao/[sessionId]/page.tsx`, `app/sessao-page.test.tsx`, `components/__tests__/checkout.test.tsx`.

**Interfaces:** `RascunhoSelecao = { versao: 1; sessionId: string; assentos: AssentoSelecionado[] }`; `salvarRascunhoSelecao(valor: RascunhoSelecao, idExistente?: string): string` gera UUID ou reutiliza o informado e grava em `eventos:selecao:<uuid>`; `lerRascunhoSelecao(id: string, sessionId: string): RascunhoSelecao | null` valida JSON/versão/sessão e retorna `null` em inválido/ausente. Falha ao gravar lança erro recuperável; não usar URL extensa como fallback. Armazenar somente seleção de lugares, sem comprador, participantes ou tokens de acesso.

`montarHrefRetornoMapa` ganha a alternativa `{ slug; sessionId; rascunhoId; motivo? }`, mantendo a assinatura legada com listas para compatibilidade. Links novos usam `?selecao=<uuid>`, mais `conflito=disponibilidade` quando necessário. Checkout inicial continua `?pedido=...&slug=...&sessionId=...`. A identidade de reserva em `eventos-api.ts` passa a usar `assinaturaComposicaoPacotes` da tarefa 2.

- [ ] **RED:** round-trip de 300 assentos com grupos completos, `expect(href.length).toBeLessThan(250)` e todos os 300 recuperados; a asserção é sobre tamanho constante do link, não limite de assentos. JSON corrompido, outra sessão, versão desconhecida e armazenamento indisponível não restauram dados parcialmente; erro de gravação não dispara `liberarPedido` nem navegação. Browser back/refresh restaura grupos antes de habilitar Continuar. URL avulsa antiga continua funcionando e não infere grupo de combo.
- [ ] **RED:** editar lugares a partir do checkout grava o rascunho do pedido persistido **antes** de liberar; só navega após liberação confirmada. Conflito de pagamento concluído mantém redirecionamento existente aos ingressos. Repetição da reserva com grupo renomeado mantém chave; mudança de membros gera nova identidade. Executar `pnpm --filter @essencia/eventos test lib/__tests__/rascunho-selecao.test.ts lib/__tests__/checkout-utils.test.ts lib/eventos-api.test.ts components/__tests__/checkout.test.tsx app/sessao-page.test.tsx`.
- [ ] **Implementar:** salvar seleção antes de reservar e também ao editar; atualizar o mesmo rascunho durante a edição sem gerar um por clique. Restaurar no cliente após hidratação; a página SSR passa `rascunhoId` e mantém parser legado. Validar os lugares contra o mapa atual e tratar perdas com `removerAssentos`. No retorno do checkout, construir seleção a partir de `pedido.items[].pacote` e `participantIndex`, não da configuração atual dos tipos. Recuperação volta a exigir validação atual numa nova reserva. Em erro de storage, manter a tela e explicar a impossibilidade de guardar a seleção; permitir tentar novamente sem liberar lugares. Não abrir uma nova API pública de rascunhos.
- [ ] **GREEN:** repetir comando e testes de seleção da tarefa 6; conferir ausência de novas listas completas em `router.push`, links e conteúdo oculto criado apenas para serializar a seleção.
- [ ] **Commit:** pipeline global; `git commit -m "feat(eventos): recuperar seleção por referência curta"`.

### Tarefa 8 — Preço público e resumo de pacotes no checkout

**Arquivos:** modificar `services/api/src/modules/eventos/eventos.service.ts`, `eventos.service.spec.ts`, `apps/eventos/lib/eventos-formatters.ts`, `components/evento/caixa-compra.tsx`, `components/checkout/resumo-pedido.tsx`, `components/checkout/__tests__/resumo-pedido.test.tsx`, `components/__tests__/detalhe-evento-ingresso.test.tsx`; criar `apps/eventos/lib/__tests__/eventos-formatters.test.ts`. Testes de cupom da UI permanecem em `components/checkout/__tests__/cupom-pedido.test.tsx`.

**Interfaces:** `precoPrincipalPublico` consome também `lugaresPorPacote` e filtra avulsos antes de aplicar a regra de preço principal existente. A API faz o mesmo na agregação `listarPublicados`. Se só houver combos, `fromPriceCents` é `null` e a tela indica “Consulte os pacotes”, enquanto a caixa lista seus preços totais e quantidades. Essa escolha evita apresentar um preço de pacote como se fosse de uma pessoa.

- [ ] **RED:** com inteira 4500 e “Combo inteira 10” 38000, preço principal é 4500; mesmo se pacote tiver total menor, ele não entra nesse preço. Só combos: preço principal nulo e listagem “Pacote de 10 lugares” por R$ 380,00. No checkout, 2 pacotes somam R$ 760,00, mostram 20 assentos e não apresentam 20 ofertas avulsas a R$ 38,00. Cupom atualiza totais sem apagar grupos nem detalhes dos lugares.
- [ ] **Executar RED:** `pnpm --filter @essencia/eventos test lib/__tests__/eventos-formatters.test.ts components/__tests__/detalhe-evento-ingresso.test.tsx components/checkout/__tests__/resumo-pedido.test.tsx components/checkout/__tests__/cupom-pedido.test.tsx` e `pnpm --filter @essencia/api test --runInBand --testPathPattern=eventos.service`.
- [ ] **Implementar:** filtrar combos na agregação e no helper, identificar preços de pacotes na caixa pública e agrupar resumo por evidência histórica. Exibir quantidade de pacotes, seus lugares e subtotal; manter detalhe individual do assento sem rotular o rateio como oferta avulsa. Preços atuais do cadastro nunca substituem a evidência do pedido. Manter cupom e totais visíveis no celular como hoje.
- [ ] **GREEN:** repetir comandos e testar pedido legado sem campo `pacote`; aparência e valores individuais continuam corretos.
- [ ] **Commit:** pipeline global; `git commit -m "feat(eventos): identificar preços e resumos dos pacotes"`.

### Tarefa 9 — Emissão individual e verificação integrada

**Arquivos:** ampliar `services/api/src/modules/eventos/eventos-confirmacao.service.spec.ts`, `eventos-pagamentos.service.spec.ts`, `eventos-public-sales.service.spec.ts`, `eventos-cortesias.service.spec.ts`; criar `services/api/src/modules/eventos/montar-pedido-ingressos.spec.ts`. Modificar `eventos-confirmacao.service.ts` e `montar-pedido-ingressos.ts` somente se os novos testes demonstrarem necessidade. Consolidar fixtures de pacote nos testes existentes, sem criar cópia da lógica de produção.

**Interfaces:** manter `confirmarPedido(orderId, origem, db)` e `montarIngressosDoPedido(db, orderId)`; cada ingresso continua referenciando `itemId`, `inventorySeatId` e participante próprios. Nenhum QR deve conter só o identificador do grupo.

- [ ] **RED/Caracterização:** testar confirmação de pacote 10: `expect(ingressos).toHaveLength(10)`, `new Set(qrPayloads).size === 10`, dez `itemId`/assentos distintos, participantes corretos e retorno público com dez ingressos. Confirmar outra vez não cria mais dez. Simular alteração do status de um ingresso na fixture e conferir retorno dos demais com status independente; preservar testes de assinatura de token existentes. Regressão de cortesia segue emissão individual. Se o fluxo existente já satisfizer esses casos, são testes de caracterização: não fabricar falha nem modificar produção só para satisfazer TDD.
- [ ] **Verificação do fluxo completo:** numa fixture transacional, reservar 30 assentos com três combos, finalizar com 30 participantes e cinco aceites, aplicar o fluxo de confirmação já existente e consultar 30 QR Codes individuais. Acrescentar caso com cupom e pedido histórico sem evidência. Comandos: `pnpm --filter @essencia/api test --runInBand --testPathPattern='eventos-confirmacao|eventos-pagamentos|eventos-public-sales|montar-pedido-ingressos|eventos-cortesias'`.
- [ ] **Implementar apenas lacunas demonstradas:** preservar emissão por item e identidade por QR; não agrupar os registros de ingresso por `pacoteId`. Se necessário para nomes históricos de combo, preferir `pricingEvidence.pacote.nomeTipo` ao nome atual do cadastro em `montarIngressosDoPedido`.
- [ ] **Verificação final:** executar uma vez os cinco conjuntos de testes da preparação e `pnpm turbo lint && pnpm turbo typecheck`, após reconstruir shared/db quando necessário. Testes novos devem ser encontrados e executados; `--passWithNoTests` não é evidência. Registrar resultados e falhas externas sem declará-las resolvidas.
- [ ] **Commit:** após verificações globais; `git commit -m "test(eventos): verificar emissão individual de pacotes"`. Revisar diff completo, migração, contratos e ausência de mudanças fora do escopo antes de apresentar o resultado.

## Limitação confirmada do check-in e entrega

A página `apps/eventos-admin/app/eventos/[id]/check-in/page.tsx` é provisória e informa que depende de uma próxima API; não foi encontrado um serviço operacional de leitura/consumo de QR neste módulo. Este plano garante identidade e status individuais dos ingressos e não implementa uma portaria nova. Testar leitura real de um QR consumindo somente seu ingresso dependerá desse fluxo quando existir; não declarar esse teste executado nesta entrega.

O resultado desta execução será código revisável, testes e migration versionada. Configurar o ingresso “Combo 10 ingressos” com quantidade 10 e publicar a migration ficam para a etapa de produção autorizada separadamente. O roteiro dessa etapa deve usar `./scripts/deploy.sh --migrar`, sem comandos alternativos improvisados, e validar a configuração explícita do tipo após a migration.

## Conferência do plano contra a spec

- Configuração e compatibilidade: tarefas 1 e 3; grupos, preço e centavos: tarefas 2, 4 e 5.
- Combos opcionais, avulsos e desfazimento: tarefa 6; disponibilidade/concorrência: tarefas 4 e 6.
- Remoção do teto e restauração sem truncamento: tarefas 1, 6 e 7; limites opcionais por tipo: tarefas 3, 4 e 6.
- Checkout, rascunhos, consulta, preços e cupons: tarefas 4, 5, 7 e 8.
- QR Code por assento e regressões de cortesia: tarefa 9; consumo operacional de QR tem a limitação explicitada acima.
- As cinco condições do foco de revisão têm casos de teste nas tarefas indicadas. Não há implementação autorizada por este documento sozinho: Renato pediu a preparação do plano e escolherá a execução após lê-lo.
