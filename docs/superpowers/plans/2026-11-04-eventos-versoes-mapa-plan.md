# Versões do mapa — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** cada evento passa a ter um único mapa. Versões publicadas podem ser editadas ou excluídas até a primeira venda com pagamento confirmado, e publicar leva todas as sessões para a versão nova numa operação só.

**Arquitetura:** a API ganha duas peças puras e testáveis:
- `trava-venda.ts` classifica se o evento ainda aceita mudança de mapa;
- `levar-sessoes.ts` move as sessões para uma versão: desliga tentativas encerradas, refaz o inventário e ajusta a capacidade.

`publicar`, `editarVersao`, `excluirVersao` e `importar` usam as duas peças dentro de transações com travas `FOR UPDATE`. As rotas antigas de troca de mapa saem. No painel, a etapa de sessões perde a escolha de mapa e a página do mapa ganha a lista de versões com Editar e Excluir.

**Tecnologias:** NestJS + Fastify, Drizzle/PostgreSQL, Zod (`@essencia/shared`), Next.js 15 + React 19 (`apps/eventos-admin`), Jest (API) e Vitest (shared, components, painel).

**Spec:** [docs/superpowers/specs/2026-11-04-eventos-versoes-mapa-design.md](../specs/2026-11-04-eventos-versoes-mapa-design.md). Quem executa lê a spec e este plano.

## Restrições globais

- **Onde trabalhar:** worktree `/var/www/essencia/.worktrees/eventos-versoes-mapa`, branch `feat/eventos-versoes-mapa`. As dependências já estão instaladas. Push, merge e deploy só com o "sim" explícito do Renato. Nunca rode nada contra a produção (containers `essencia-*`, banco, Redis).
- **Idioma:** português do Brasil em nomes de domínio, comentários, textos e commits.
- **TDD real:** o teste vem antes do código. Se o código de produção foi escrito antes, apague e recomece.
- **Antes de cada commit:** rode `pnpm turbo lint && pnpm turbo typecheck`.
- **Códigos e mensagens exatos da trava** (API e tela usam os mesmos textos):
  - `VENDA_CONFIRMADA` — "Bloqueado: já há lugares vendidos com pagamento confirmado neste evento."
  - `COMPRA_EM_ANDAMENTO` — "Há uma compra em andamento neste evento. Tente de novo em alguns minutos."
  - `OPERACAO_ATIVA` — "Há uma operação administrativa ativa (bloqueio, cortesia ou reserva) neste evento. Cancele-a antes de mudar o mapa."
- **Status de pedido:**
  - pago: `CONFIRMADO`, `USADO`, `NO_SHOW`, `REEMBOLSADO`;
  - aberto: `INICIADO`, `RESERVADO`, `AGUARDANDO_PAGAMENTO`. Conta como compra em andamento se `expiresAt` estiver no futuro, e como tentativa encerrada se `expiresAt` for nulo ou já tiver passado;
  - encerrado: `EXPIRADO`, `CANCELADO`.
- **Ordem das travas `FOR UPDATE`** em toda transação que mexe em mapa: evento → sessões (por `id` asc) → mapas (por `id` asc) → importação → inventário (por `id` asc) → pedidos, itens e reservas (por `id` asc).
- **Sessão sempre aponta para o mapa do evento:** toda sessão guarda `mapId` igual a `eventos.defaultMapId`. `getPublicMap` exige `session.mapId` e não muda.
- **Fora desta branch:** `apps/eventos`, `PublicSeat` e o checkout ficam intocados. Nenhuma migration é esperada; se uma tarefa precisar de uma, pare e reporte.

## Foco da revisão

1. **Compra iniciada entre a abertura da página e o clique:** a API recusa com `COMPRA_EM_ANDAMENTO` sem mudar nada, e a tela mostra a mensagem e recarrega o estado. Teste nas Tarefas 4 e 10.
2. **Arquivo da versão já ausente no storage ao excluir:** a exclusão termina com sucesso. Teste na Tarefa 6.
3. **Sessão criada depois da publicação:** recebe o mapa do evento. Teste na Tarefa 1.
4. **Editar duas vezes, ou com uma conferência já aberta:** sobra só uma versão em conferência, e as anteriores ficam arquivadas. Teste na Tarefa 5.
5. **Pagamento atrasado de um pedido desligado:** o pedido fica `EXPIRADO`, e o `confirmarCheckout` existente recusa o pagamento. Teste na Tarefa 3.

---

### Tarefa 1: Sessão sem mapa próprio (schemas e API de sessões)

**Arquivos:**
- Modificar: `packages/shared/src/schemas/eventos.ts`:
  - sai `defaultMapId` de `criarEventoSchema`, o que também tira o campo de `atualizarEventoSchema`;
  - sai `mapId` dos itens de `sessions` em `criarEventoSchema` e de `criarSessaoSchema`.
- Modificar: `services/api/src/modules/eventos/eventos.service.ts`:
  - `criarSessao` grava `mapId: event.defaultMapId ?? null`;
  - `validarReferenciasSessao` perde o bloco `input.mapId`;
  - a auditoria de `atualizar` deixa de olhar `input.defaultMapId` (etapa `"informacoes"`).
- Testes: o spec dos schemas em `packages/shared` (crie `src/schemas/eventos-mapa.test.ts` se não houver um adequado) e `services/api/src/modules/eventos/eventos.service.spec.ts`.

**Interfaces:**
- Produz: `CriarSessaoInput` sem `mapId`. A sessão nova nasce com `mapId = event.defaultMapId`.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
// shared
it("criarSessaoSchema recusa mapId", () => expect(criarSessaoSchema.safeParse({ ...sessaoValida, mapId: UUID }).success).toBe(false));
it("atualizarEventoSchema ignora defaultMapId", () => expect(atualizarEventoSchema.parse({ defaultMapId: UUID })).not.toHaveProperty("defaultMapId"));
// API (banco falso no padrão de eventos.service.spec.ts)
it("criarSessao grava o mapa do evento na sessão", async () => { /* event.defaultMapId = "mapa-1" → insert de eventoSessoes com mapId "mapa-1" */ });
it("criarSessao em evento sem mapa grava mapId null", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comandos: `pnpm --filter @essencia/shared test` e `pnpm --filter @essencia/api test -- src/modules/eventos/eventos.service.spec.ts`.
- [ ] **Passo 3: Implementar.** Ajuste os testes antigos que mandavam `mapId` na sessão ou `defaultMapId` no evento.
- [ ] **Passo 4: Rodar e ver passar**, incluindo a suíte inteira da API e a do shared.
- [ ] **Passo 5: Commit.** `git commit -m "feat: sessao passa a usar sempre o mapa do evento"`

---

### Tarefa 2: Trava de venda

**Arquivos:**
- Criar: `services/api/src/modules/eventos/mapas/trava-venda.ts` e `trava-venda.spec.ts`

**Interfaces:**
- Produz:
  ```ts
  export type TipoTrava = "LIVRE" | "VENDA_CONFIRMADA" | "COMPRA_EM_ANDAMENTO" | "OPERACAO_ATIVA";
  export const MENSAGEM_TRAVA: Record<Exclude<TipoTrava, "LIVRE">, string>; // textos das Restrições globais
  export const STATUS_PEDIDO_PAGO: readonly ["CONFIRMADO", "USADO", "NO_SHOW", "REEMBOLSADO"];
  export const STATUS_PEDIDO_ABERTO: readonly ["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"];
  export function classificarTrava(dados: { pedidos: Array<{ status: string; expiresAt: Date | null }>; ingressos: number; checkins: number; operacoesAtivas: number }, agora: Date): TipoTrava;
  export async function carregarTrava(db: Database, eventId: string, agora: Date, lockRows?: <T>(query: unknown) => Promise<T[]>): Promise<TipoTrava>;
  export function exigirMapaLivre(tipo: TipoTrava): void; // LIVRE não faz nada; os outros lançam BadRequestException({ code: tipo, message: MENSAGEM_TRAVA[tipo] })
  ```
- **Precedência:** `VENDA_CONFIRMADA` > `OPERACAO_ATIVA` > `COMPRA_EM_ANDAMENTO` > `LIVRE`.
- **Venda confirmada:** algum pedido do evento em status pago, ou algum ingresso ou check-in nas sessões do evento.
- **Operação ativa:** alguma linha de `eventoOperacoesAdministrativas` do evento com status `ATIVA`.
- **Leitura dos dados:** `carregarTrava` lê `eventoPedidos` pelo `eventId`, conta `eventoIngressos` e `eventoCheckins` pelas sessões do evento e conta as operações `ATIVA` pelo `eventId`. Quando recebe `lockRows`, usa-o nos pedidos.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
const agora = new Date("2026-11-04T12:00:00Z"); const depois = new Date("2026-11-04T12:10:00Z"); const antes = new Date("2026-11-04T11:50:00Z");
it.each(["CONFIRMADO", "USADO", "NO_SHOW", "REEMBOLSADO"])("pedido %s é venda confirmada", (status) => expect(classificarTrava({ pedidos: [{ status, expiresAt: null }], ingressos: 0, checkins: 0, operacoesAtivas: 0 }, agora)).toBe("VENDA_CONFIRMADA"));
it("ingresso ou check-in é venda confirmada", () => {});
it.each(["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"])("pedido %s ainda no prazo é compra em andamento", (status) => expect(classificarTrava({ pedidos: [{ status, expiresAt: depois }], ingressos: 0, checkins: 0, operacoesAtivas: 0 }, agora)).toBe("COMPRA_EM_ANDAMENTO"));
it("pedido aberto vencido, expirado ou cancelado não trava", () => { /* expiresAt: antes; EXPIRADO; CANCELADO → LIVRE */ });
it("operação ativa trava e venda vence operação e compra em andamento", () => {});
it("exigirMapaLivre lança o código e a mensagem exatos", () => { expect(() => exigirMapaLivre("VENDA_CONFIRMADA")).toThrow(expect.objectContaining({ response: expect.objectContaining({ code: "VENDA_CONFIRMADA", message: "Bloqueado: já há lugares vendidos com pagamento confirmado neste evento." }) })); });
it("carregarTrava lê pedidos, ingressos, check-ins e operações do evento", async () => { /* banco falso */ });
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas/trava-venda.spec.ts`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: classifica a trava de venda para mudar o mapa"`

---

### Tarefa 3: Levar sessões para uma versão

**Arquivos:**
- Criar: `services/api/src/modules/eventos/mapas/levar-sessoes.ts` e `levar-sessoes.spec.ts`

**Interfaces:**
- Consome: `STATUS_PEDIDO_PAGO` e `STATUS_PEDIDO_ABERTO` (Tarefa 2).
- Produz:
  ```ts
  export interface ResultadoLevarSessoes { sessionIds: string[]; inventarioCriado: number; capacidade: number | null; pedidosDesligados: string[] }
  export async function levarSessoesParaVersao(db: Database, entrada: { eventId: string; versaoId: string; agora: Date; sessionIds?: string[]; lockRows: <T>(query: unknown) => Promise<T[]> }): Promise<ResultadoLevarSessoes>;
  ```
- **Pré-condição:** quem chama já travou o evento e chamou `exigirMapaLivre(await carregarTrava(...))` na mesma transação.
- **O que a função faz, na ordem:**
  1. Trava as sessões do evento (todas, ou as de `sessionIds`), por `id` asc.
  2. Lê os lugares da versão. Sem lugares, lança `MAP_EMPTY`.
  3. Trava o inventário dessas sessões, por `id` asc.
  4. Acha os itens e reservas que apontam para esse inventário. Se algum pertence a um pedido pago, lança `VENDA_CONFIRMADA`; é uma defesa extra.
  5. Apaga itens e reservas de tentativas encerradas e marca como `EXPIRADO` os pedidos abertos já vencidos.
  6. Apaga o inventário das sessões e cria o inventário a partir dos lugares da versão. Lugar com `sellable === false` entra como `BLOQUEADO`, com `blockedReason: "MAPA_ASSENTO_NAO_VENDAVEL"`; os demais entram como `DISPONIVEL`.
  7. Grava `mapId = versaoId` e `capacity` = número de lugares vendáveis em cada sessão.
- `capacidade` volta `null` quando não há sessão.

- [ ] **Passo 1: Escrever os testes que falham** (com banco falso em memória)

```ts
it("leva todas as sessões, refaz o inventário e ajusta a capacidade", async () => { /* 2 sessões, versão com 3 lugares (1 não vendável) → 6 linhas de inventário, 2 BLOQUEADO, mapId e capacity 2 nas duas */ });
it("desliga tentativa encerrada e marca o pedido aberto vencido como EXPIRADO", async () => { /* pedido AGUARDANDO_PAGAMENTO com expiresAt passado → itens e reservas apagados, pedido EXPIRADO, pedidosDesligados contém o id */ });
it("mantém o registro do pedido CANCELADO e só apaga itens e reservas", async () => {});
it("recusa com VENDA_CONFIRMADA se um item pertence a pedido pago", async () => {});
it("leva só as sessões pedidas quando sessionIds é informado", async () => {});
it("evento sem sessão devolve capacidade null", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas/levar-sessoes.spec.ts`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: leva sessoes para uma versao do mapa desligando tentativas encerradas"`

---

### Tarefa 4: Publicar leva todas as sessões

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/mapas/mapas.service.ts` (`publicar`, `confirmar`) e `mapas.service.spec.ts`

**Interfaces:**
- Consome: `carregarTrava` e `exigirMapaLivre` (Tarefa 2); `levarSessoesParaVersao` (Tarefa 3).
- Produz: `publicar(eventId, versionId, { revisaoBase, motivo? }, actor): Promise<{ map: EventoMapa; sessionIds: string[]; capacidade: number | null; arquivadas: string[] }>`.
- **O que muda no código:**
  - `confirmar` vira `private async gravarConfirmacao(db, map, entrada: { seats; layout; reason?; actor })`, chamado só pela publicação. Ele deixa de chamar `sincronizarInventarioMapa`; quem faz isso agora é `levarSessoesParaVersao`.
  - A rota do controller não muda: `POST mapas/:versionId/publicar`, com resposta `{ success: true, data }`.
- **Uma transação só:**
  1. Trava o evento e confere a trava com `carregarTrava` e `exigirMapaLivre`.
  2. Trava o mapa (precisa estar `EM_REVISAO`) e a importação. Confere a revisão com `exigirRevisao` e as pendências com `pendenciasPublicacao`.
  3. Chama `gravarConfirmacao`.
  4. Grava `eventos.defaultMapId = versionId`.
  5. Chama `levarSessoesParaVersao`.
  6. Arquiva as demais versões `CONFIRMADO` do evento.
  7. Grava a auditoria `{ action: "publicar", versaoId, sessionIds, capacidade, arquivadas, motivo }`.

- [ ] **Passo 1: Escrever os testes que falham.** Substitua os testes de `publicar` e `confirmar` que esperavam o comportamento antigo.

```ts
it("publicar torna a versão o mapa do evento, leva as sessões e arquiva as anteriores", async () => {});
it("publicar leva também a sessão com exceção antiga (mapa v2) para a versão nova", async () => {});
it("publicar recusa com COMPRA_EM_ANDAMENTO sem gravar nada", async () => {});
it("publicar recusa com VENDA_CONFIRMADA e com OPERACAO_ATIVA", async () => {});
it("publicar duas vezes: a segunda recebe MAP_NOT_IN_REVIEW", async () => {});
it("mantém PROPOSTA_DESATUALIZADA e PROPOSTA_COM_PENDENCIAS", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: publicar leva todas as sessoes para a versao publicada"`

---

### Tarefa 5: Editar uma versão publicada

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/mapas/mapas.service.ts` (com o spec) e `mapas.controller.ts` (com o spec)

**Interfaces:**
- Produz:
  - `editarVersao(eventId, versionId, actor): Promise<{ mapId: string }>`;
  - a rota `POST mapas/:versionId/editar`, com resposta `{ success: true, data: { mapId } }`.
- **Regras:**
  - A trava é conferida primeiro, como em publicar.
  - A versão precisa estar em `CONFIRMADO` ou `ARQUIVADO` e ter proposta. Sem isso, a API recusa com `EDICAO_INDISPONIVEL`: "Esta versão não pode ser editada. Envie a planta em PDF."
- **O que a edição faz:**
  1. Copia o PDF original: `storage.getObject(key)`, depois `Body.transformToByteArray()` e `uploadMapBuffer(buffer, originalFileName, "application/pdf", "eventos/<id>/mapas/originais")`.
  2. Arquiva as outras versões `EM_REVISAO` do evento.
  3. Cria um `evento_mapas` com `version = max + 1` e status `EM_REVISAO`.
  4. Cria o `evento_importacoes_mapa` com `detector: "edicao"`, `detectorVersion: "2"` e `proposta` igual à da versão de origem com `revisao: 0`. A legenda confirmada e os pontos conferidos ficam como estavam.
  5. Grava a auditoria `{ action: "editar_versao", origemMapId }`.
- **Se a transação falhar**, a cópia do PDF é apagada do storage.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it("editarVersao cria versão em conferência com a proposta da origem, revisão 0 e conferências mantidas", async () => {});
it("editarVersao copia o PDF para uma chave nova", async () => {});
it("editarVersao arquiva a conferência que já estava aberta", async () => {});
it("editarVersao recusa versão sem proposta e versão em conferência", async () => {});
it("editarVersao recusa com VENDA_CONFIRMADA sem copiar o arquivo", async () => {});
it("falha no banco apaga a cópia do PDF", async () => {});
// controller
it("POST mapas/:versionId/editar responde { success: true, data: { mapId } }", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: edita versao publicada criando nova conferencia"`

---

### Tarefa 6: Excluir uma versão

**Arquivos:**
- Modificar: `mapas.service.ts` e `mapas.controller.ts`, com os specs

**Interfaces:**
- Produz:
  - `excluirVersao(eventId, versionId, actor): Promise<{ excluida: true; sessionIds: string[] }>`;
  - a rota `DELETE mapas/:versionId`, com resposta `{ success: true, data }`.
- **Regras, na ordem:**
  1. A versão atual (`defaultMapId`) não pode ser excluída. O erro é `MAPA_ATUAL`: "A versão atual não pode ser excluída."
  2. Confere a trava.
  3. Se alguma sessão usa a versão, leva essas sessões para a versão atual com `levarSessoesParaVersao`, usando `sessionIds`. Se o evento não tem versão atual, recusa com `MAPA_ATUAL`.
  4. Apaga a importação explicitamente, porque a coluna `map_id` é `set null`.
  5. Apaga o mapa; os lugares saem pela cascata.
  6. Grava a auditoria `{ action: "excluir_versao", sessionIds }`.
  7. Depois do commit, apaga `originalFileKey` e `previewFileKey` do storage. Arquivo ausente conta como sucesso; outro erro de storage só vai para o log.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it("exclui versão sem sessão: apaga importação, mapa e arquivos", async () => {});
it("exclui versão usada por sessão: leva a sessão para a atual antes", async () => {});
it("recusa a versão atual com MAPA_ATUAL", async () => {});
it("recusa com COMPRA_EM_ANDAMENTO sem apagar nada", async () => {});
it("arquivo já ausente no storage não impede a exclusão", async () => {});
it("exclui uma conferência aberta (EM_REVISAO)", async () => {});
// controller
it("DELETE mapas/:versionId responde { success: true, data }", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: exclui versao do mapa levando sessoes para a atual"`

---

### Tarefa 7: Envio travado e lista de versões com estado

**Arquivos:**
- Modificar: `mapas.service.ts` (`importar` e `listar`), com o spec

**Interfaces:**
- Produz:
  ```ts
  export interface VersaoMapaResumo { id: string; version: number; status: "EM_REVISAO" | "CONFIRMADO" | "ARQUIVADO"; originalFileName: string | null; createdAt: Date; confirmedAt: Date | null; atual: boolean; lugares: number; sessoes: Array<{ id: string; startsAt: Date }>; editavel: boolean }
  listar(eventId, actor): Promise<{ versoes: VersaoMapaResumo[]; trava: { tipo: TipoTrava; mensagem: string | null } }>
  ```
- **Campos de cada versão:**
  - `lugares`: contagem de `evento_mapa_assentos` para versões confirmadas ou arquivadas; para versões `EM_REVISAO`, o tamanho de `proposta.lugares`.
  - `editavel`: status `CONFIRMADO` ou `ARQUIVADO` e proposta presente.
  - `atual`: `id === defaultMapId`.
- **Envio de planta:** `importar` chama `exigirMapaLivre(await carregarTrava(...))` antes de ler o arquivo, então nada vai para o storage se estiver travado.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it("listar devolve versões com atual, lugares, sessões, editavel e a trava LIVRE", async () => {});
it("listar devolve a trava com a mensagem quando há venda confirmada", async () => {});
it("importar recusa com VENDA_CONFIRMADA sem chamar o gerador nem o storage", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: lista versoes com estado de venda e trava o envio de planta"`

---

### Tarefa 8: Fechar as rotas antigas de troca de mapa

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/mapas/mapas.controller.ts`. Saem as rotas `arquivar`, `mapa-padrao/substituir` e `migrar-e-excluir`.
- Modificar: `mapas.service.ts`. Saem `arquivar`, `substituirMapaPadrao`, `migrarSessoesEExcluir`, `recuperarResultadoIdempotente`, `normalizarResultadoArquivamento`, `ajustarCapacidade` (substituída pela Tarefa 3) e os tipos `MapReplacementResult` e `MapMigrationResult`. `sincronizarInventarioMapa` fica, porque a prontidão usa.
- Modificar: `services/api/src/modules/eventos/eventos-admin.controller.ts` (sai `PATCH :id/mapa-padrao`), `eventos.service.ts` (sai `atualizarMapaPadrao`) e `packages/shared/src/schemas/eventos.ts` (sai `atualizarMapaPadraoSchema`, se ficar sem uso).
- Modificar: os specs correspondentes. Saem os testes dessas operações; mantenha os de `sincronizarInventarioMapa`.

**Interfaces:**
- Produz: o controller sem essas rotas. Antes de remover, confirme com `grep -rn "<rota>" apps services` que só a página do mapa do painel as chama; a Tarefa 10 reescreve essa página.

- [ ] **Passo 1: Escrever o teste que falha** (controllers)

```ts
it("não expõe mais arquivar, substituir, migrar-e-excluir nem PATCH mapa-padrao", () => { /* Reflect.getMetadata das rotas */ });
```

- [ ] **Passo 2: Rodar e ver falhar.**
- [ ] **Passo 3: Remover** as rotas, os métodos e os testes antigos.
- [ ] **Passo 4: Rodar a suíte inteira da API.** Esperado: tudo passa.
- [ ] **Passo 5: Commit.** `git commit -m "refactor: fecha rotas antigas de troca de mapa"`

---

### Tarefa 9: Etapa "Sessões e local" sem escolha de mapa

**Arquivos:**
- Modificar em `apps/eventos-admin`:
  - `features/eventos/session-editor.tsx`: sai a seção "Mapa de assentos" (por volta das linhas 224-245) e os campos `mapMode`, `mapId` e `inheritMap`;
  - `features/eventos/session-card-contracts.ts`: saem `mapMode` e a validação `errors.map`;
  - `features/eventos/etapas-contratos.ts`: o DTO de sessão perde `inheritMap` e `mapId`;
  - `features/eventos/sessoes-autosave.ts` e `app/eventos/[id]/sessoes/page.tsx`: saem as comparações e o mapeamento de `mapId` e `inheritMap`;
  - `features/eventos/contracts.ts` (`buildEventoFormDto`): as sessões deixam de enviar `mapId`;
  - `features/eventos/workspace-sessions-integration.ts`: deixa de exigir mapa nas opções;
  - os testes dessas telas.

**Interfaces:**
- Consome: a API da Tarefa 1, que recusa `mapId` na sessão.
- **Regra de prontidão do card:** a sessão continua pronta mesmo quando o evento ainda não tem mapa. A falta de mapa é avisada pela prontidão do evento.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it("o editor de sessão não mostra a seção Mapa de assentos", () => { expect(screen.queryByText("Mapa de assentos")).toBeNull(); expect(screen.queryByText("Escolher outro mapa")).toBeNull(); });
it("o DTO da sessão não envia mapId nem inheritMap", () => {});
it("salvar sessão sem mapa no evento não bloqueia o card", () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/eventos-admin test -- features/eventos app/eventos`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar**, com a suíte do painel e lint/typecheck.
- [ ] **Passo 5: Commit.** `git commit -m "feat: remove a escolha de mapa da etapa de sessoes"`

---

### Tarefa 10: Página do mapa com versões, Editar e Excluir

**Arquivos:**
- Modificar: `apps/eventos-admin/features/eventos/conferencia/api-mapas.ts` (com o teste)
- Criar: `apps/eventos-admin/features/eventos/conferencia/versoes-mapa.tsx` (com o teste)
- Modificar: `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx` e `page.test.ts`
- Apagar: `features/eventos/resultado-publicacao.tsx` e o teste dele

**Interfaces:**
- Consome: `listar`, `editar`, `excluir` e `publicar` (Tarefas 4 a 7).
- Produz:
  ```ts
  // api-mapas.ts
  export function listarMapas(eventoId: string): Promise<{ versoes: VersaoMapaResumo[]; trava: { tipo: string; mensagem: string | null } }>; // tipo espelhado do da API
  export function editarVersao(eventoId: string, mapId: string): Promise<{ mapId: string }>;
  export function excluirVersao(eventoId: string, mapId: string): Promise<{ excluida: true; sessionIds: string[] }>;
  export function publicarMapa(eventoId: string, mapId: string, revisaoBase: number, motivo?: string): Promise<{ sessionIds: string[]; capacidade: number | null; arquivadas: string[] }>;
  // versoes-mapa.tsx
  export function VersoesMapa(props: { versoes: VersaoMapaResumo[]; trava: { tipo: string; mensagem: string | null }; ocupado: boolean; onEditar: (mapId: string) => void; onExcluir: (mapId: string) => void }): JSX.Element;
  ```
- **A lista** mostra:
  - "Versão N", com o arquivo;
  - um selo de situação: "Em conferência", "Atual", "Publicada" ou "Arquivada";
  - o número de lugares;
  - as sessões que usam a versão, pela data.
- **Botões:**
  - Editar aparece só se `editavel`.
  - Excluir não aparece na versão Atual.
  - Com a trava diferente de `LIVRE`, os botões e o "Enviar nova planta" ficam desabilitados, e a mensagem da trava aparece acima da lista.
  - Excluir pede `window.confirm("Excluir a versão N? Esta ação não pode ser desfeita.")`.
- **A página:**
  - Ao carregar, chama só `listarMapas`. A versão `EM_REVISAO` mais nova abre a conferência; sem ela, aparece a vista da Atual com `VersoesMapa`.
  - Saem o `PATCH mapa-padrao`, a substituição, a migração e o `ResultadoPublicacao`.
  - Editar abre a conferência da versão nova.
  - Publicar recarrega a lista e mostra "Publicado: N sessão(ões) levada(s) para a versão V. Capacidade: C lugares."
  - Erros da API com `code` de trava mostram a `message` num `role="alert"` e recarregam a lista.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it("mostra as versões com selo, lugares e sessões", () => {});
it("Editar chama POST editar e abre a conferência da versão nova", async () => {});
it("Excluir confirma, chama DELETE e recarrega a lista", async () => {});
it("com venda confirmada, Editar, Excluir e Enviar nova planta ficam desabilitados com a mensagem", () => {});
it("COMPRA_EM_ANDAMENTO no clique mostra a mensagem e recarrega a lista", async () => {});
it("publicar mostra o resumo com sessões e capacidade e volta para a lista", async () => {});
it("não chama mais mapa-padrao, substituir nem migrar-e-excluir", async () => { /* nenhuma URL com esses trechos no fetch */ });
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/eventos-admin test -- app/eventos features/eventos/conferencia`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar**, com `pnpm --filter @essencia/eventos-admin build`.
- [ ] **Passo 5: Commit.** `git commit -m "feat: lista versoes do mapa com editar e excluir no painel"`

---

### Tarefa 11: Melhorias pequenas na conferência

**Arquivos:**
- Modificar: `apps/eventos-admin/features/eventos/conferencia/painel-lugar.tsx`, `conferencia-mapa.tsx` e `lista-pontos.tsx`, com os testes
- Modificar: `packages/components/src/eventos/mapa-estilo-b.tsx`, com o teste

**Interfaces:**
- **Selecionar fileira inteira:** com pelo menos um lugar selecionado, o botão "Selecionar fileira inteira" no `PainelLugar` chama `onSelecionarFileira(fileira)`. A `ConferenciaMapa` troca a seleção por todos os lugares com a mesma `fileira`; com vários selecionados, usa a fileira do primeiro.
- **Palco sem cobrir lugares:**
  - Considere a faixa vertical que o palco ocupa, entre `elemento.y − 1,5·alturaPalco` e `yBase`.
  - A largura passa a ser `min(0,6 × largura da caixa dos lugares, 2 × (menor distância horizontal do centro do palco até a borda de um lugar dentro dessa faixa) − altura média dos lugares)`, nunca menor que `4 × altura média`.
  - Nenhum centro de lugar pode cair dentro da caixa do palco.
- **Pendências:**
  - Cada item da lista perto de "Publicar mapa" é um botão. Ponto não conferido seleciona o ponto, legenda leva à legenda e lugar seleciona os lugares.
  - O ponto ainda não conferido sempre mostra "Marcar como conferido", sem precisar de um clique antes.
  - O texto do botão concorda em número: "Resolva a 1 pendência para liberar" e "Resolva as N pendências para liberar".

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it("Selecionar fileira inteira seleciona os 34 lugares da fileira X", () => {});
it("o palco não cobre lugares que estão na altura dele", () => { /* lugares nas laterais do palco → nenhum centro dentro da caixa do path */ });
it("clicar na pendência do ponto seleciona o ponto e o botão Marcar como conferido aparece sem clique prévio", () => {});
it("concorda o texto com 1 pendência", () => expect(screen.getByRole("button", { name: /Resolva a 1 pendência para liberar/ })));
```

- [ ] **Passo 2: Rodar e ver falhar.** Comandos: `pnpm --filter @essencia/eventos-admin test -- features/eventos/conferencia` e `pnpm --filter @essencia/components test -- src/eventos`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: seleciona fileira, ajusta palco e torna pendencias acionaveis"`

---

### Tarefa 12: Verificação final, deploy e caso do ballet

- [ ] **Passo 1: Pipeline completo**
  - Comando: `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test --filter=@essencia/api --filter=@essencia/shared --filter=@essencia/components --filter=@essencia/eventos-admin && pnpm --filter @essencia/eventos-admin build`
  - Esperado: tudo verde.
- [ ] **Passo 2: Revisão da branch inteira** com superpowers:requesting-code-review.
- [ ] **Passo 3: Pedir o "sim" do Renato** para merge, push e deploy. Sem resposta, parar aqui.
- [ ] **Passo 4: Merge, push e deploy**
  1. Fazer o merge no `main` e o push.
  2. Rodar `./scripts/deploy.sh` (sem `--migrar`, salvo se alguma tarefa criou migration). Se o build falhar por fonte do Google, confira a conexão e repita.
  3. Conferir o health check e `/api/health`.
- [ ] **Passo 5: Caso do ballet, com o Renato no painel**
  1. Em "Mapa e lugares", clicar em Editar no v4.
  2. Na conferência, selecionar um lugar da fileira X, clicar em "Selecionar fileira inteira" e marcar "Não vender". O resumo deve mostrar 34 lugares em "não vender".
  3. Clicar em Publicar.
     - Se aparecer `COMPRA_EM_ANDAMENTO`, esperar alguns minutos e tentar de novo.
     - Se aparecer `VENDA_CONFIRMADA`, o caso volta para o Renato.
- [ ] **Passo 6: Conferir no mapa público da sessão** com `curl -s https://eventos.portalcef.com.br/api/eventos/public/sessoes/af7b9de9-fabf-44f3-884a-fc42c6b98b1f/map`. Esperado:
  - 786 lugares e nenhuma fileira inventada (R27…, S…Z);
  - 34 lugares `blocked`, todos na fileira X;
  - capacidade 752 na lista de sessões do evento.
- [ ] **Passo 7: Registrar o resultado no ai-memory** em `projetos/portal-cef.md`, lendo a página antes para usar o `expected_page_id`.
