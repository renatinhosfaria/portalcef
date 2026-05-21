# Observabilidade Tecnica do Planejamento Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar logs tecnicos em `.jsonl` para rastrear paginas, chamadas, erros, arquivos e lentidao no app `planejamento`, com usuario identificado pela sessao e retencao de 30 dias.

**Architecture:** A API tera um modulo `PlanejamentoObservabilidadeModule` com rota autenticada para eventos do navegador, servico de escrita/sanitizacao/retencao e interceptor para chamadas tecnicas do escopo de planejamento. O app `planejamento` tera uma biblioteca cliente com sessao por aba, captura de erros, medicao de chamadas `/api/*` e eventos explicitos em acoes de documentos. A infraestrutura de producao montara volume persistente para `/var/log/essencia/planejamento`.

**Tech Stack:** NestJS, Fastify, Next.js App Router, React 19, TypeScript, Zod, Jest, Vitest, pnpm, Turborepo, Docker Compose.

---

## Contexto Obrigatorio

Leia antes de executar:

- `AGENTS.md`
- `docs/plans/2026-05-21-observabilidade-planejamento-design.md`
- `services/api/src/app.module.ts`
- `services/api/src/main.ts`
- `services/api/src/common/guards/auth.guard.ts`
- `services/api/src/common/interceptors/logging.interceptor.ts`
- `services/api/src/common/middleware/correlation-id.middleware.ts`
- `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- `services/api/src/modules/prova/prova.controller.ts`
- `apps/planejamento/app/api/[...path]/route.ts`
- `apps/planejamento/app/layout.tsx`
- `apps/planejamento/features/plano-aula/components/documento-list.tsx`
- `apps/planejamento/features/plano-aula/components/documento-editor.tsx`
- `apps/planejamento/features/plano-aula/components/documento-upload.tsx`
- `docker-compose.prod.yml`

Regras de execucao:

- Comunicacao, comentarios, documentacao e commits em Portugues do Brasil.
- Use @superpowers:test-driven-development em cada mudanca de comportamento.
- Nao escreva codigo de producao antes do teste falhar pelo motivo correto.
- Rode `git status --short` antes de editar cada task.
- Esta branch foi criada em `/var/www/essencia/.worktrees/observabilidade-planejamento`.
- O workspace principal tem alteracoes locais fora do escopo em loja, `nginx.conf`, backup e docs. Nao copie nem reverta esses arquivos.
- Faca commits pequenos, stageando apenas os arquivos da task atual.

## Baseline Confirmado

Executado na worktree em 2026-05-21:

```bash
pnpm install
pnpm --filter planejamento typecheck
pnpm --filter planejamento test
pnpm --filter @essencia/db build
pnpm --filter @essencia/shared build
pnpm --filter @essencia/api typecheck
```

Resultado:

- `planejamento typecheck`: passou.
- `planejamento test`: 18 arquivos, 50 testes passando.
- `@essencia/api typecheck`: falhou antes de gerar `@essencia/db` e `@essencia/shared`, passou depois dos builds internos.

## Decisoes Tecnicas

- Diretorio padrao de producao: `/var/log/essencia/planejamento`.
- Diretorio configuravel por env: `PLANEJAMENTO_OBSERVABILIDADE_DIR`.
- Limite inicial de chamada lenta: `2000` ms, configuravel por `PLANEJAMENTO_OBSERVABILIDADE_SLOW_MS`.
- A escrita de log e `best effort`: erro no log nunca quebra resposta da usuaria.
- O navegador nunca envia `usuario` confiavel. A API preenche usuario pela sessao.
- Eventos de navegador aceitam apenas allowlist de campos.
- O app cliente nao usa `localStorage` ou armazenamento persistente; a sessao tecnica e por aba.
- O patch de `window.fetch` ignora `/api/planejamento-observabilidade/eventos` para evitar loop.

## Task 0: Preparar Linha de Base da Worktree

**Files:**
- Read: `package.json`
- Read: `packages/db/package.json`
- Read: `packages/shared/package.json`
- Read: `services/api/package.json`
- Read: `apps/planejamento/package.json`

**Step 1: Conferir estado local**

Run:

```bash
git status --short
```

Expected: worktree limpa antes da task.

**Step 2: Gerar pacotes internos para API**

Run:

```bash
pnpm --filter @essencia/db build
pnpm --filter @essencia/shared build
```

Expected: ambos passam.

**Step 3: Confirmar baseline focado**

Run:

```bash
pnpm --filter planejamento typecheck
pnpm --filter planejamento test
pnpm --filter @essencia/api typecheck
```

Expected: todos passam.

**Step 4: Commit**

Nao commitar nesta task.

## Task 1: Criar Servico de Arquivo JSONL da API

**Files:**
- Create: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.types.ts`
- Create: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.service.ts`
- Create: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.service.spec.ts`

**Step 1: Escrever teste de sanitizacao que falha**

Crie `planejamento-observabilidade.service.spec.ts` com testes para:

- remover chaves proibidas em qualquer profundidade;
- truncar `erro.mensagem` e `erro.stackResumo`;
- sanitizar rotas com UUID para `:id`;
- preservar campos permitidos de usuario, arquivo, http, pagina e detalhes.

Exemplo inicial:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlanejamentoObservabilidadeService } from "./planejamento-observabilidade.service";

describe("PlanejamentoObservabilidadeService", () => {
  let dir: string;
  let service: PlanejamentoObservabilidadeService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "planejamento-observabilidade-"));
    service = new PlanejamentoObservabilidadeService({
      diretorio: dir,
      ambiente: "test",
      slowMs: 2000,
      retencaoDias: 30,
    });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("remove campos sensiveis e normaliza rotas com UUID", async () => {
    const evento = service.normalizarEvento({
      origem: "browser",
      evento: "api_chamada",
      nivel: "info",
      usuario: { id: "user-1", nome: "Maria", role: "professora" },
      http: {
        metodo: "GET",
        rota:
          "/api/plano-aula/11111111-1111-1111-1111-111111111111/documentos/22222222-2222-2222-2222-222222222222/download",
        status: 200,
        duracaoMs: 120,
      },
      detalhes: {
        token: "segredo",
        aninhado: { cookie: "sid=abc", navegador: "Chrome" },
      },
      erro: {
        mensagem: "x".repeat(2000),
        stackResumo: "y".repeat(5000),
      },
    });

    expect(evento.http?.rota).toBe(
      "/api/plano-aula/:id/documentos/:id/download",
    );
    expect(JSON.stringify(evento)).not.toContain("segredo");
    expect(JSON.stringify(evento)).not.toContain("sid=abc");
    expect(evento.detalhes).toEqual({ aninhado: { navegador: "Chrome" } });
    expect(evento.erro?.mensagem.length).toBeLessThanOrEqual(500);
    expect(evento.erro?.stackResumo?.length).toBeLessThanOrEqual(1000);
  });
});
```

**Step 2: Rodar teste para verificar RED**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/planejamento-observabilidade/planejamento-observabilidade.service.spec.ts --runInBand
```

Expected: FAIL porque o servico ainda nao existe.

**Step 3: Implementar tipos e servico minimo**

Em `planejamento-observabilidade.types.ts`, defina:

```ts
export type PlanejamentoObservabilidadeOrigem =
  | "browser"
  | "proxy"
  | "api"
  | "sharepoint"
  | "storage";

export type PlanejamentoObservabilidadeEvento =
  | "pagina_aberta"
  | "api_chamada"
  | "api_lenta"
  | "arquivo_acao"
  | "erro_navegador"
  | "upload_resultado"
  | "sharepoint_word";

export type PlanejamentoObservabilidadeNivel = "info" | "warn" | "error";

export interface PlanejamentoObservabilidadeUsuario {
  id: string;
  nome?: string | null;
  role: string;
  schoolId?: string | null;
  unitId?: string | null;
}

export interface PlanejamentoObservabilidadeEventoEntrada {
  timestamp?: string;
  ambiente?: string;
  app?: "planejamento";
  origem: PlanejamentoObservabilidadeOrigem;
  evento: PlanejamentoObservabilidadeEvento;
  nivel?: PlanejamentoObservabilidadeNivel;
  correlationId?: string | null;
  sessaoObservabilidadeId?: string | null;
  requestId?: string | null;
  usuario?: PlanejamentoObservabilidadeUsuario | null;
  http?: {
    metodo?: string;
    rota?: string;
    status?: number;
    duracaoMs?: number;
  };
  pagina?: {
    url?: string;
    titulo?: string;
  };
  arquivo?: {
    planoId?: string | null;
    provaId?: string | null;
    documentoId?: string | null;
    nome?: string | null;
    tipo?: string | null;
    tamanhoBytes?: number | null;
  };
  erro?: {
    codigo?: string | null;
    mensagem?: string | null;
    stackResumo?: string | null;
  };
  detalhes?: Record<string, unknown> | null;
}
```

Em `planejamento-observabilidade.service.ts`, implemente:

- construtor aceitando config opcional para testes;
- `normalizarEvento(evento)`;
- `registrarEvento(evento)` que escreve em arquivo diario;
- `limparAntigos()` que remove `planejamento-YYYY-MM-DD.jsonl` mais antigo que `retencaoDias`;
- `obterArquivoDoDia(data = new Date())`;
- sanitizacao recursiva por denylist.

Use `appendFile`, `mkdir`, `readdir`, `rm` de `node:fs/promises`.

**Step 4: Rodar teste para verificar GREEN**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/planejamento-observabilidade/planejamento-observabilidade.service.spec.ts --runInBand
```

Expected: PASS.

**Step 5: Adicionar testes de escrita, best effort e retencao**

No mesmo spec, adicione:

- `registrarEvento` cria `planejamento-YYYY-MM-DD.jsonl` com uma linha JSON valida;
- falha de escrita nao rejeita a promise;
- `limparAntigos` remove arquivo com mais de 30 dias e preserva arquivo recente.

**Step 6: Rodar testes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/planejamento-observabilidade/planejamento-observabilidade.service.spec.ts --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.types.ts \
  services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.service.ts \
  services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.service.spec.ts
git commit -m "feat: adiciona logger jsonl do planejamento"
```

## Task 2: Criar Rota Autenticada Para Eventos do Navegador

**Files:**
- Create: `services/api/src/modules/planejamento-observabilidade/dto/observabilidade-evento.dto.ts`
- Create: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.controller.ts`
- Create: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.controller.spec.ts`
- Create: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.module.ts`
- Modify: `services/api/src/app.module.ts`

**Step 1: Escrever teste de controller que falha**

Crie spec cobrindo:

- `registrarEventos` aceita lote com 1 evento;
- ignora `usuario` enviado pelo navegador;
- usa `req.user` como fonte de verdade;
- retorna `{ success: true }`;
- registra `nivel: "warn"` para `api_lenta` e `nivel: "error"` para `erro_navegador` quando o navegador nao informar nivel.

Exemplo:

```ts
import { PlanejamentoObservabilidadeController } from "./planejamento-observabilidade.controller";

describe("PlanejamentoObservabilidadeController", () => {
  it("completa usuario pela sessao e ignora usuario enviado pelo navegador", async () => {
    const service = { registrarEvento: jest.fn().mockResolvedValue(undefined) };
    const controller = new PlanejamentoObservabilidadeController(
      service as never,
    );

    await expect(
      controller.registrarEventos(
        {
          user: {
            userId: "user-real",
            role: "professora",
            schoolId: "school-1",
            unitId: "unit-1",
            stageId: "stage-1",
          },
        },
        {
          eventos: [
            {
              origem: "browser",
              evento: "pagina_aberta",
              usuario: { id: "falso", nome: "Invasor", role: "master" },
              pagina: { url: "/planejamento", titulo: "Inicio" },
            },
          ],
        },
      ),
    ).resolves.toEqual({ success: true });

    expect(service.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario: {
          id: "user-real",
          role: "professora",
          schoolId: "school-1",
          unitId: "unit-1",
        },
      }),
    );
  });
});
```

**Step 2: Rodar teste para verificar RED**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/planejamento-observabilidade/planejamento-observabilidade.controller.spec.ts --runInBand
```

Expected: FAIL porque controller ainda nao existe.

**Step 3: Implementar DTO com Zod**

Em `dto/observabilidade-evento.dto.ts`, use `zod` para validar:

- `eventos`: array de 1 a 25 eventos;
- `origem` apenas `"browser"`;
- `evento` dentro do enum;
- `nivel` opcional;
- campos opcionais dentro de `http`, `pagina`, `arquivo`, `erro`, `detalhes`;
- limite de tamanho para strings como url, titulo, nome, mensagem e stack.

Exporte `observabilidadeEventosSchema` e tipo `ObservabilidadeEventosDto`.

**Step 4: Implementar controller e module**

Controller:

```ts
@Controller("planejamento-observabilidade")
@UseGuards(AuthGuard)
export class PlanejamentoObservabilidadeController {
  constructor(private readonly service: PlanejamentoObservabilidadeService) {}

  @Post("eventos")
  async registrarEventos(
    @Req() req: { user: AuthenticatedRequest["user"] },
    @Body() body: unknown,
  ) {
    const parsed = observabilidadeEventosSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Evento de observabilidade invalido",
        errors: parsed.error.errors,
      });
    }

    await Promise.all(
      parsed.data.eventos.map((evento) =>
        this.service.registrarEvento({
          ...evento,
          usuario: {
            id: req.user.userId,
            role: req.user.role,
            schoolId: req.user.schoolId,
            unitId: req.user.unitId,
          },
        }),
      ),
    );

    return { success: true };
  }
}
```

Module:

- imports: `AuthModule`;
- controllers: `PlanejamentoObservabilidadeController`;
- providers/exports: `PlanejamentoObservabilidadeService`.

Adicione o modulo em `AppModule`.

**Step 5: Rodar testes e typecheck**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/planejamento-observabilidade --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add services/api/src/modules/planejamento-observabilidade services/api/src/app.module.ts
git commit -m "feat: recebe eventos tecnicos do planejamento"
```

## Task 3: Registrar Chamadas de API do Escopo Planejamento

**Files:**
- Create: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.interceptor.ts`
- Create: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.interceptor.spec.ts`
- Modify: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.module.ts`

**Step 1: Escrever testes do interceptor**

Cubra:

- registra `api_chamada` para rotas `/api/plano-aula/...`;
- registra `api_lenta` quando `duracaoMs >= slowMs`;
- nao registra rota `/api/planejamento-observabilidade/eventos`;
- inclui `correlationId`, metodo, rota sanitizada, status, usuario e role;
- em erro 500 registra `nivel: "error"` e erro sanitizado.

**Step 2: Rodar teste para verificar RED**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/planejamento-observabilidade/planejamento-observabilidade.interceptor.spec.ts --runInBand
```

Expected: FAIL porque interceptor ainda nao existe.

**Step 3: Implementar interceptor**

Use `NestInterceptor`, `tap` e `catchError`.

Escopo de rotas:

```ts
const ROTAS_PLANEJAMENTO = [
  "/api/plano-aula",
  "/api/plano-aula-periodo",
  "/api/plannings",
  "/api/quinzena-documents",
  "/api/prova",
  "/api/prova-ciclo",
];
```

Nao registre:

```ts
"/api/planejamento-observabilidade"
```

No sucesso:

- `origem: "api"`;
- `evento: "api_chamada"`;
- `nivel: "info"`;
- `http.metodo`, `http.rota`, `http.status`, `http.duracaoMs`.

Se lento, registre tambem `api_lenta` com `nivel: "warn"`.

No erro:

- `evento: "api_chamada"`;
- `nivel: "error"`;
- `erro.codigo`;
- `erro.mensagem` sanitizada.

**Step 4: Registrar como APP_INTERCEPTOR**

Em `planejamento-observabilidade.module.ts`:

```ts
providers: [
  PlanejamentoObservabilidadeService,
  {
    provide: APP_INTERCEPTOR,
    useClass: PlanejamentoObservabilidadeInterceptor,
  },
],
```

**Step 5: Rodar verificacoes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/planejamento-observabilidade --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add services/api/src/modules/planejamento-observabilidade
git commit -m "feat: registra chamadas tecnicas do planejamento"
```

## Task 4: Instrumentar Endpoints Criticos de Arquivo na API

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.spec.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.module.ts`
- Modify: `services/api/src/modules/prova/prova.controller.ts`
- Create or Modify: `services/api/src/modules/prova/prova.controller.spec.ts`
- Modify: `services/api/src/modules/prova/prova.module.ts`

**Step 1: Escrever testes que falham para `PlanoAulaController`**

Adicione ao spec:

- `editarWord` registra `sharepoint_word` no sucesso com `documentoId`, `planoId`, nome do arquivo e duracao;
- `visualizarSharePoint` registra `sharepoint_word` quando reenviar item ausente;
- `downloadDocumento` registra `arquivo_acao` com `acao: "download"` e status final;
- falha em `downloadDocumento` registra `nivel: "error"`.

Atualize `criarController()` para injetar `observabilidadeService`.

**Step 2: Rodar teste para verificar RED**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.controller.spec.ts --runInBand
```

Expected: FAIL porque o controller ainda nao chama o servico.

**Step 3: Implementar injecao e chamadas no plano de aula**

Adicione `PlanejamentoObservabilidadeService` ao constructor.

Chame `registrarEvento` em `editarWord`, `visualizarSharePoint`, `sincronizarWord`, `downloadDocumento`, `uploadDocumento` e `atualizarDocumento` com metadados:

```ts
{
  origem: "sharepoint",
  evento: "sharepoint_word",
  nivel: "info",
  correlationId: req.correlationId,
  usuario: this.service.criarUsuarioDoRequest(req.user),
  arquivo: {
    planoId,
    documentoId: docId,
    nome: documento.fileName,
    tipo: documento.mimeType,
    tamanhoBytes: documento.fileSize,
  },
  detalhes: { etapa: "editar_word", duracaoMs }
}
```

Nao registre `storageKey`, URL assinada, link SharePoint, cookie ou payload.

**Step 4: Repetir para `ProvaController`**

Crie `prova.controller.spec.ts` se nao existir. Cubra pelo menos:

- `editarWord` registra `sharepoint_word`;
- `downloadDocumento` registra `arquivo_acao`.

**Step 5: Atualizar modules**

Importe `PlanejamentoObservabilidadeModule` em `PlanoAulaModule` e `ProvaModule`.

**Step 6: Rodar verificacoes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.controller.spec.ts src/modules/prova/prova.controller.spec.ts --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add services/api/src/modules/plano-aula services/api/src/modules/prova
git commit -m "feat: registra eventos de arquivos do planejamento"
```

## Task 5: Propagar `x-correlation-id` Pelo Proxy do Planejamento

**Files:**
- Modify: `apps/planejamento/app/api/[...path]/route.ts`
- Modify: `apps/planejamento/app/api/[...path]/route.test.ts`

**Step 1: Escrever teste que falha**

Adicione casos:

- preserva `x-correlation-id` recebido do navegador;
- gera um UUID quando nao houver `x-correlation-id`;
- devolve o `x-correlation-id` no header da resposta;
- mantem resposta binaria intacta.

**Step 2: Rodar teste para verificar RED**

Run:

```bash
pnpm --filter planejamento test -- app/api/[...path]/route.test.ts
```

Expected: FAIL porque o proxy ainda nao encaminha `x-correlation-id`.

**Step 3: Implementar correlacao**

No proxy:

- importe `randomUUID` de `node:crypto`;
- obtenha `correlationId = request.headers.get("x-correlation-id") || randomUUID()`;
- envie `headers["x-correlation-id"] = correlationId`;
- preserve `x-request-id` como hoje;
- defina `nextResponse.headers.set("x-correlation-id", correlationId)` em JSON e binario;
- em erro 502, tambem retorne o header.

**Step 4: Rodar verificacoes**

Run:

```bash
pnpm --filter planejamento test -- app/api/[...path]/route.test.ts
pnpm --filter planejamento typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/planejamento/app/api/[...path]/route.ts apps/planejamento/app/api/[...path]/route.test.ts
git commit -m "feat: propaga correlation id no planejamento"
```

## Task 6: Criar Biblioteca Cliente de Observabilidade

**Files:**
- Create: `apps/planejamento/lib/observabilidade/types.ts`
- Create: `apps/planejamento/lib/observabilidade/cliente.ts`
- Create: `apps/planejamento/lib/observabilidade/cliente.test.ts`
- Create: `apps/planejamento/lib/observabilidade/index.ts`

**Step 1: Escrever testes do cliente**

Cubra:

- gera `sessaoObservabilidadeId` uma vez por aba;
- envia eventos em lote para `/api/planejamento-observabilidade/eventos`;
- remove campos proibidos antes do envio;
- usa `fetch` com `method: "POST"`, JSON e `credentials: "include"`;
- falha de envio nao rejeita para quem chamou;
- nao usa `localStorage`.

**Step 2: Rodar teste para verificar RED**

Run:

```bash
pnpm --filter planejamento test -- lib/observabilidade/cliente.test.ts
```

Expected: FAIL porque a biblioteca ainda nao existe.

**Step 3: Implementar cliente minimo**

Funcoes esperadas:

```ts
export function obterSessaoObservabilidadeId(): string;
export function registrarEventoObservabilidade(
  evento: EventoObservabilidadeCliente,
): void;
export async function enviarEventosPendentes(): Promise<void>;
export async function medirObservabilidade<T>(
  eventoBase: EventoObservabilidadeCliente,
  acao: () => Promise<T>,
): Promise<T>;
```

Regras:

- usar fila em memoria;
- limitar lote a 25 eventos;
- usar timeout curto com `AbortController`;
- ignorar em ambiente sem `window`;
- nunca persistir no navegador.

**Step 4: Rodar verificacoes**

Run:

```bash
pnpm --filter planejamento test -- lib/observabilidade/cliente.test.ts
pnpm --filter planejamento typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/planejamento/lib/observabilidade
git commit -m "feat: adiciona cliente de observabilidade"
```

## Task 7: Capturar Erros Globais, Paginas e Chamadas Fetch no Navegador

**Files:**
- Create: `apps/planejamento/lib/observabilidade/observabilidade-provider.tsx`
- Create: `apps/planejamento/lib/observabilidade/observabilidade-provider.test.tsx`
- Modify: `apps/planejamento/lib/observabilidade/index.ts`
- Modify: `apps/planejamento/app/layout.tsx`

**Step 1: Escrever testes do provider**

Cubra:

- ao montar registra `pagina_aberta`;
- registra `erro_navegador` em `window.error`;
- registra `erro_navegador` em `unhandledrejection`;
- intercepta `window.fetch` para `/api/plano-aula/meus`, adiciona `x-correlation-id`, mede duracao e registra `api_chamada`;
- registra `api_lenta` quando duracao ultrapassa 2000 ms;
- nao intercepta `/api/planejamento-observabilidade/eventos`;
- restaura `window.fetch` ao desmontar.

**Step 2: Rodar teste para verificar RED**

Run:

```bash
pnpm --filter planejamento test -- lib/observabilidade/observabilidade-provider.test.tsx
```

Expected: FAIL porque provider ainda nao existe.

**Step 3: Implementar provider**

Use `"use client"`, `useEffect`, `usePathname` de `next/navigation` e funcoes do cliente.

No patch do fetch:

- preservar headers existentes;
- gerar `x-correlation-id` por chamada quando ausente;
- medir com `performance.now()`;
- registrar status e duracao;
- em erro de rede, registrar `api_chamada` com `nivel: "error"` e `erro.mensagem`.

**Step 4: Inserir no layout**

Em `apps/planejamento/app/layout.tsx`, envolver o conteudo do app:

```tsx
<ObservabilidadeProvider>
  <Shell ...>
    {children}
    <MobileNav />
  </Shell>
</ObservabilidadeProvider>
```

Mantenha `TenantProvider` externo.

**Step 5: Rodar verificacoes**

Run:

```bash
pnpm --filter planejamento test -- lib/observabilidade/observabilidade-provider.test.tsx app/shared-provider.test.ts
pnpm --filter planejamento typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/planejamento/lib/observabilidade apps/planejamento/app/layout.tsx
git commit -m "feat: captura eventos tecnicos do navegador"
```

## Task 8: Instrumentar Acoes de Documento no Frontend

**Files:**
- Modify: `apps/planejamento/features/plano-aula/components/documento-list.tsx`
- Modify: `apps/planejamento/features/plano-aula/components/documento-list.test.tsx`
- Modify: `apps/planejamento/features/plano-aula/components/documento-editor.tsx`
- Create or Modify: `apps/planejamento/features/plano-aula/components/documento-editor.test.tsx`
- Modify: `apps/planejamento/features/plano-aula/components/documento-upload.tsx`
- Modify: `apps/planejamento/features/plano-aula/components/documento-upload.test.tsx`

**Step 1: Escrever testes que falham para `DocumentoList`**

Mocke `registrarEventoObservabilidade` e valide eventos:

- clicar em visualizar Word registra `arquivo_acao` com `acao: "visualizar"`;
- clicar em editar no Word registra inicio e sucesso/falha;
- sincronizar Word registra `sharepoint_word`;
- imprimir registra `arquivo_acao` com `acao: "imprimir"`.

**Step 2: Rodar teste para verificar RED**

Run:

```bash
pnpm --filter planejamento test -- features/plano-aula/components/documento-list.test.tsx
```

Expected: FAIL porque componente ainda nao chama observabilidade.

**Step 3: Implementar eventos em `DocumentoList`**

Crie helper local:

```ts
function criarMetadadosArquivo(documento: PlanoDocumento) {
  return {
    planoId: documento.planoId,
    documentoId: documento.id,
    nome: documento.fileName || null,
    tipo: documento.mimeType || null,
    tamanhoBytes: documento.fileSize || null,
  };
}
```

Use `registrarEventoObservabilidade` antes/depois de cada acao critica, sem registrar URL SharePoint ou `storageKey`.

**Step 4: Instrumentar `DocumentoEditor` com teste**

Cubra:

- tentativa SharePoint registra `sharepoint_word`;
- fallback `docx-preview` registra `arquivo_acao` com `acao: "download_preview"`;
- erro final registra `erro_navegador` ou `arquivo_acao` com `nivel: "error"`.

**Step 5: Instrumentar `DocumentoUpload` com teste**

Cubra:

- arquivo rejeitado registra `upload_resultado` com `status: "erro_validacao"`;
- upload com sucesso registra tamanho, MIME, tentativas e duracao;
- upload com erro definitivo registra `nivel: "error"`.

**Step 6: Rodar verificacoes**

Run:

```bash
pnpm --filter planejamento test -- features/plano-aula/components/documento-list.test.tsx features/plano-aula/components/documento-editor.test.tsx features/plano-aula/components/documento-upload.test.tsx
pnpm --filter planejamento typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add apps/planejamento/features/plano-aula/components
git commit -m "feat: registra acoes de documentos no planejamento"
```

## Task 9: Configurar Retencao e Volume de Producao

**Files:**
- Modify: `docker-compose.prod.yml`
- Modify: `.gitignore`
- Modify: `docs/DEPLOYMENT.md`

**Step 1: Escrever verificacao textual que falha**

Se nao houver teste automatizado para compose, use uma verificacao shell simples antes da implementacao:

```bash
grep -n "PLANEJAMENTO_OBSERVABILIDADE_DIR" docker-compose.prod.yml
grep -n "./logs/planejamento:/var/log/essencia/planejamento" docker-compose.prod.yml
grep -n "logs/planejamento" .gitignore
```

Expected: FAIL/sem saida antes da mudanca.

**Step 2: Atualizar compose**

Em `api.environment`, adicione:

```yaml
PLANEJAMENTO_OBSERVABILIDADE_DIR: /var/log/essencia/planejamento
PLANEJAMENTO_OBSERVABILIDADE_SLOW_MS: ${PLANEJAMENTO_OBSERVABILIDADE_SLOW_MS:-2000}
```

Em `api`, adicione:

```yaml
volumes:
  - ./logs/planejamento:/var/log/essencia/planejamento
```

**Step 3: Ignorar logs locais**

Em `.gitignore`, adicione:

```gitignore
logs/planejamento/
```

**Step 4: Documentar operacao**

Em `docs/DEPLOYMENT.md`, adicione secao curta:

- onde ficam logs;
- como consultar por usuario/evento/documento;
- retencao de 30 dias;
- alerta de privacidade.

**Step 5: Rodar verificacoes**

Run:

```bash
grep -n "PLANEJAMENTO_OBSERVABILIDADE_DIR" docker-compose.prod.yml
grep -n "./logs/planejamento:/var/log/essencia/planejamento" docker-compose.prod.yml
grep -n "logs/planejamento" .gitignore
pnpm --filter @essencia/api typecheck
```

Expected: PASS/saida encontrada.

**Step 6: Commit**

```bash
git add docker-compose.prod.yml .gitignore docs/DEPLOYMENT.md
git commit -m "chore: configura logs do planejamento em producao"
```

## Task 10: Verificacao Final Integrada

**Files:**
- Read all modified files

**Step 1: Rodar testes focados**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/planejamento-observabilidade src/modules/plano-aula/plano-aula.controller.spec.ts src/modules/prova/prova.controller.spec.ts --runInBand
pnpm --filter planejamento test -- lib/observabilidade app/api/[...path]/route.test.ts features/plano-aula/components/documento-list.test.tsx features/plano-aula/components/documento-editor.test.tsx features/plano-aula/components/documento-upload.test.tsx
```

Expected: PASS.

**Step 2: Rodar qualidade obrigatoria**

Run:

```bash
pnpm turbo lint
pnpm turbo typecheck
```

Expected: PASS. Se houver falha preexistente, documente exatamente e rode comandos filtrados relevantes que passam.

**Step 3: Verificar conteudo sensivel**

Run:

```bash
rg -n "cookie|authorization|token|password|senha|body|payload|conteudo|html" \
  services/api/src/modules/planejamento-observabilidade \
  apps/planejamento/lib/observabilidade \
  apps/planejamento/features/plano-aula/components
```

Expected: ocorrencias apenas em denylist, testes de sanitizacao ou comentarios explicativos.

**Step 4: Confirmar status**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: worktree limpa e commits pequenos da feature.

**Step 5: Handoff**

Informe:

- caminho da worktree;
- branch;
- comandos executados;
- qualquer risco residual;
- como consultar um log por usuario/data.
