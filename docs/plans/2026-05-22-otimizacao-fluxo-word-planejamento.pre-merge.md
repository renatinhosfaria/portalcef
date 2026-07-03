# Otimizacao do Fluxo Word do Planejamento Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduzir a lentidao de edicao/aprovacao de documentos Word no planejamento sem comprometer a fidelidade do documento final impresso.

**Architecture:** A aprovacao de documento deixara de bloquear a usuaria esperando conversao Word->PDF. A API marcara a aprovacao rapidamente, registrara status de PDF no banco e enviara a geracao para uma fila BullMQ em Redis; o worker reutilizara item ativo do SharePoint quando existir, sincronizara alteracoes antes de gerar PDF e continuara usando Microsoft Graph para preservar layout. A tela mostrara o estado do PDF e fara polling leve enquanto houver documento aprovado com PDF pendente.

**Tech Stack:** NestJS, Fastify, Drizzle, PostgreSQL, BullMQ, Redis, Microsoft Graph/SharePoint, MinIO/S3, Next.js App Router, React, TypeScript, Jest, Vitest, pnpm, Turborepo, Docker Compose.

---

## Contexto Obrigatorio

Leia antes de executar:

- `AGENTS.md`
- `docs/plans/2026-05-21-observabilidade-planejamento.md`
- `packages/db/src/schema/plano-aula.ts`
- `services/api/src/modules/plano-aula/plano-aula.service.ts`
- `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- `services/api/src/common/sharepoint/pdf-generator.service.ts`
- `services/api/src/common/sharepoint/sharepoint.service.ts`
- `services/api/src/common/sharepoint/sharepoint-cleanup.service.ts`
- `apps/planejamento/app/analise/[planoId]/revisao-content.tsx`
- `apps/planejamento/features/plano-aula/hooks/use-plano-aula.ts`
- `apps/planejamento/features/plano-aula/components/documento-list.tsx`
- `apps/planejamento/features/plano-aula/types.ts`

## Problemas Confirmados

- Aprovacao de `.docx` bloqueia a usuaria por 4,4s a 10,3s porque `PlanoAulaService.aprovarDocumento` aguarda `PdfGeneratorService.gerarParaImpressao`.
- Abertura do Word leva 2,1s a 4,8s porque a API faz upload para SharePoint e cria link antes de responder.
- O mesmo arquivo pode ser enviado duas vezes ao SharePoint: uma para editar no Word e outra para converter em PDF na aprovacao.
- Nao houve evento de `sincronizar_word` da Patricia Aline; se a pessoa editar no Word e nao sincronizar, a aprovacao pode converter a versao antiga do storage.
- A UI nao tem estado explicito para `PDF em preparacao`, `PDF pronto` ou `erro ao gerar PDF`.

## Regras de Execucao

- Use @superpowers:test-driven-development em toda mudanca de comportamento.
- Nao escreva codigo de producao antes do teste falhar pelo motivo correto.
- Rode `git status --short` antes de cada task.
- Commits em Portugues do Brasil e pequenos, um por task.
- Nao reverta alteracoes locais fora do escopo.
- Preserve Microsoft Graph/SharePoint como mecanismo de conversao para manter fidelidade do `.docx`.

## Decisoes Tecnicas

- Novo status de PDF por documento: `NAO_APLICAVEL`, `PENDENTE`, `GERANDO`, `PRONTO`, `ERRO`.
- A aprovacao de PDF nativo continua rapida e marca `PRONTO` imediatamente, usando `storageKey/url` existentes.
- A aprovacao de Word marca `PENDENTE` e enfileira geracao de PDF.
- A fila BullMQ usara `REDIS_URL` ja existente; nome sugerido: `planejamento-pdf-impressao`.
- `jobId` deve ser deterministico por documento: `plano-documento:<documentoId>`, para evitar duplicidade.
- Concurrency inicial: `1`, configuravel por `PLANEJAMENTO_PDF_CONCURRENCY`.
- O worker deve processar `PENDENTE` e tambem permitir reprocessar `ERRO`.
- A geracao de PDF deve reutilizar `sharepointItemId` ativo quando existir.
- Se existir edicao ativa, o worker deve verificar `foiModificadoApos`; se houve modificacao, baixar do SharePoint e atualizar o storage antes de concluir.
- Ao fim da geracao, limpar item temporario do SharePoint e campos temporarios locais.
- Logs de observabilidade devem registrar duracao por etapa: upload SharePoint, criar link, converter PDF, salvar PDF, remover temporario, sincronizar Word.

## Task 0: Preparar Baseline

**Files:**
- Read: `package.json`
- Read: `services/api/package.json`
- Read: `apps/planejamento/package.json`
- Read: `packages/db/package.json`

**Step 1: Conferir estado local**

Run:

```bash
git status --short
```

Expected: pode haver alteracoes locais fora do escopo; nao tocar nelas.

**Step 2: Confirmar comandos focados**

Run:

```bash
pnpm --filter @essencia/db build
pnpm --filter @essencia/shared build
pnpm --filter @essencia/api typecheck
pnpm --filter planejamento typecheck
```

Expected: todos passam antes de iniciar.

**Step 3: Commit**

Nao commitar nesta task.

## Task 1: Adicionar Status Persistente de PDF no Banco

**Files:**
- Modify: `packages/db/src/schema/plano-aula.ts`
- Create: `packages/db/drizzle/<nova_migration>_pdf_status_planejamento.sql`
- Modify: `apps/planejamento/features/plano-aula/types.ts`
- Test: `apps/planejamento/features/plano-aula/types.test.ts`

**Step 1: Escrever teste de tipo que falha**

Atualize `types.test.ts` para validar os novos campos:

```ts
it("representa status de PDF de impressao", () => {
  const doc: PlanoDocumento = {
    ...mockDocumentoBase,
    pdfStatus: "GERANDO",
    pdfError: null,
    pdfRequestedAt: "2026-05-22T10:00:00.000Z",
    pdfGeneratedAt: null,
  };

  expect(doc.pdfStatus).toBe("GERANDO");
});
```

**Step 2: Rodar teste para verificar RED**

Run:

```bash
pnpm --filter planejamento test -- features/plano-aula/types.test.ts --runInBand
```

Expected: FAIL porque `pdfStatus` ainda nao existe no tipo.

**Step 3: Atualizar schema e tipos**

Em `packages/db/src/schema/plano-aula.ts`, adicionar:

```ts
export const pdfStatusEnum = [
  "NAO_APLICAVEL",
  "PENDENTE",
  "GERANDO",
  "PRONTO",
  "ERRO",
] as const;
export type PdfStatus = (typeof pdfStatusEnum)[number];
```

Na tabela `planoDocumento`, adicionar:

```ts
pdfStatus: text("pdf_status", { enum: pdfStatusEnum })
  .notNull()
  .default("NAO_APLICAVEL"),
pdfError: text("pdf_error"),
pdfRequestedAt: timestamp("pdf_requested_at", { withTimezone: true }),
pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true }),
```

Em `apps/planejamento/features/plano-aula/types.ts`, adicionar os campos opcionais correspondentes.

**Step 4: Criar migration**

Criar migration SQL com:

```sql
ALTER TABLE "plano_documento"
  ADD COLUMN "pdf_status" text DEFAULT 'NAO_APLICAVEL' NOT NULL,
  ADD COLUMN "pdf_error" text,
  ADD COLUMN "pdf_requested_at" timestamp with time zone,
  ADD COLUMN "pdf_generated_at" timestamp with time zone;

UPDATE "plano_documento"
SET
  "pdf_status" = 'PRONTO',
  "pdf_requested_at" = "approved_at",
  "pdf_generated_at" = "approved_at"
WHERE "pdf_url" IS NOT NULL;

UPDATE "plano_documento"
SET
  "pdf_status" = 'PENDENTE',
  "pdf_requested_at" = "approved_at"
WHERE
  "approved_at" IS NOT NULL
  AND "pdf_url" IS NULL
  AND (
    "mime_type" = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    OR "mime_type" = 'application/msword'
  );
```

**Step 5: Rodar testes e builds**

Run:

```bash
pnpm --filter planejamento test -- features/plano-aula/types.test.ts --runInBand
pnpm --filter @essencia/db build
pnpm --filter planejamento typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/db/src/schema/plano-aula.ts packages/db/drizzle apps/planejamento/features/plano-aula/types.ts apps/planejamento/features/plano-aula/types.test.ts
git commit -m "feat: registra status de PDF dos documentos"
```

## Task 2: Extrair Preparacao Segura do Word para PDF

**Files:**
- Modify: `services/api/src/common/sharepoint/pdf-generator.service.ts`
- Test: `services/api/src/common/sharepoint/pdf-generator.service.spec.ts`
- Modify: `services/api/src/common/sharepoint/sharepoint.service.ts`

**Step 1: Escrever testes que falham**

Criar/atualizar `pdf-generator.service.spec.ts` com cenarios:

- quando documento tem `sharepointItemId` ativo, converte esse item sem novo upload;
- quando item ativo foi modificado, baixa do SharePoint e chama `storageService.replaceFile` antes de salvar PDF;
- quando nao ha item ativo, faz upload do storage para SharePoint;
- sempre remove o item temporario ao final;
- preserva PDF nativo sem chamar SharePoint.

Exemplo de expectativa:

```ts
expect(sharePointService.uploadParaSharePoint).not.toHaveBeenCalled();
expect(sharePointService.converterParaPdf).toHaveBeenCalledWith("item-ativo");
expect(storageService.replaceFile).toHaveBeenCalled();
```

**Step 2: Rodar teste para verificar RED**

Run:

```bash
pnpm --filter @essencia/api test -- src/common/sharepoint/pdf-generator.service.spec.ts --runInBand
```

Expected: FAIL porque o servico ainda nao aceita item SharePoint ativo.

**Step 3: Implementar contrato novo**

Estender `DocumentoParaPdf`:

```ts
sharepointItemId?: string | null;
sharepointEditUrl?: string | null;
editandoDesde?: Date | null;
```

Novo comportamento em `gerarParaImpressao`:

1. Se for PDF nativo, retornar `storageKey/url`.
2. Se nao for Word, retornar `null`.
3. Se tiver `sharepointItemId` e `editandoDesde`, usar esse item.
4. Antes de converter, chamar `foiModificadoApos(itemId, editandoDesde)`.
5. Se modificado, baixar arquivo e atualizar storage com `replaceFile`.
6. Converter item para PDF via Graph.
7. Salvar PDF no storage.
8. Remover item do SharePoint e limpar campos temporarios em task posterior.

**Step 4: Rodar teste**

Run:

```bash
pnpm --filter @essencia/api test -- src/common/sharepoint/pdf-generator.service.spec.ts --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/common/sharepoint/pdf-generator.service.ts services/api/src/common/sharepoint/pdf-generator.service.spec.ts services/api/src/common/sharepoint/sharepoint.service.ts
git commit -m "feat: reutiliza SharePoint ativo ao gerar PDF"
```

## Task 3: Criar Fila de Geracao de PDF de Impressao

**Files:**
- Create: `services/api/src/modules/plano-aula/plano-aula-pdf-queue.service.ts`
- Create: `services/api/src/modules/plano-aula/plano-aula-pdf-queue.service.spec.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.module.ts`

**Step 1: Escrever teste RED**

Testar que `adicionar(documentoId)`:

- cria job BullMQ com fila `planejamento-pdf-impressao`;
- usa `jobId: plano-documento:<documentoId>`;
- usa `attempts: 3`;
- usa backoff exponencial;
- nao quebra a resposta se Redis falhar, apenas registra erro.

**Step 2: Rodar teste**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula-pdf-queue.service.spec.ts --runInBand
```

Expected: FAIL porque o servico ainda nao existe.

**Step 3: Implementar servico minimo**

Use `bullmq` e `ioredis` com `REDIS_URL`.

Contrato:

```ts
async adicionar(documentoId: string): Promise<void>
```

Opcoes do job:

```ts
{
  jobId: `plano-documento:${documentoId}`,
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 1000,
}
```

**Step 4: Rodar teste**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula-pdf-queue.service.spec.ts --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula-pdf-queue.service.ts services/api/src/modules/plano-aula/plano-aula-pdf-queue.service.spec.ts services/api/src/modules/plano-aula/plano-aula.module.ts
git commit -m "feat: cria fila de PDF do planejamento"
```

## Task 4: Tornar Aprovacao de Documento Rapida

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.module.ts`

**Step 1: Escrever testes RED**

Atualizar testes de `aprovarDocumento` para validar:

- Word aprovado recebe `approvedBy`, `approvedAt`, `pdfStatus: "PENDENTE"`, `pdfRequestedAt`;
- Word aprovado chama `planoAulaPdfQueue.adicionar(documentoId)`;
- Word aprovado nao chama `pdfGeneratorService.gerarParaImpressao` de forma sincrona;
- PDF nativo aprovado recebe `pdfStatus: "PRONTO"` e espelha `pdfStorageKey/pdfUrl`;
- link/imagem aprovado recebe `pdfStatus: "NAO_APLICAVEL"`.

**Step 2: Rodar teste**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts --runInBand
```

Expected: FAIL porque a aprovacao ainda gera PDF sincrono.

**Step 3: Implementar aprovacao rapida**

Em `aprovarDocumento`:

1. Buscar documento e validar unidade como hoje.
2. Definir status:
   - PDF nativo: `PRONTO`, `pdfStorageKey = storageKey`, `pdfUrl = url`.
   - Word: `PENDENTE`, `pdfRequestedAt = now`, `pdfStorageKey = null`, `pdfUrl = null`.
   - Outros: `NAO_APLICAVEL`.
3. Atualizar documento no banco.
4. Se Word, chamar fila best-effort.
5. Retornar documento atualizado.

Nao chamar `gerarParaImpressao` neste metodo.

**Step 4: Rodar teste**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.service.ts services/api/src/modules/plano-aula/plano-aula.service.spec.ts services/api/src/modules/plano-aula/plano-aula.module.ts
git commit -m "feat: aprova documento sem bloquear por PDF"
```

## Task 5: Implementar Worker de PDF com Sincronizacao Segura

**Files:**
- Create: `services/api/src/modules/plano-aula/plano-aula-pdf-worker.service.ts`
- Create: `services/api/src/modules/plano-aula/plano-aula-pdf-worker.service.spec.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.module.ts`

**Step 1: Escrever testes RED**

Testar worker:

- ignora documento inexistente;
- ignora documento nao aprovado;
- marca `GERANDO` antes de chamar conversao;
- passa `sharepointItemId`, `sharepointEditUrl` e `editandoDesde` para `PdfGeneratorService`;
- salva `pdfStorageKey/pdfUrl`, `pdfStatus: "PRONTO"`, `pdfGeneratedAt`;
- em erro, salva `pdfStatus: "ERRO"` e `pdfError` truncado;
- limpa `sharepointItemId`, `sharepointEditUrl`, `editandoDesde` ao final quando havia item ativo.

**Step 2: Rodar teste**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula-pdf-worker.service.spec.ts --runInBand
```

Expected: FAIL porque worker nao existe.

**Step 3: Implementar worker**

Criar `Worker` BullMQ com:

- queue name `planejamento-pdf-impressao`;
- connection `REDIS_URL`;
- concurrency `Number(PLANEJAMENTO_PDF_CONCURRENCY ?? 1)`;
- `OnModuleDestroy` fechando worker e conexao.

Metodo interno:

```ts
async processarDocumento(documentoId: string): Promise<void>
```

Esse metodo deve ser testavel sem Redis.

**Step 4: Adicionar metodos de persistencia no service**

Adicionar ao `PlanoAulaService` metodos pequenos:

```ts
buscarDocumentoParaPdf(documentoId: string)
marcarPdfGerando(documentoId: string)
marcarPdfPronto(documentoId: string, pdf: PdfGerado)
marcarPdfErro(documentoId: string, erro: unknown)
limparEdicaoSharePoint(documentoId: string)
```

**Step 5: Rodar testes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula-pdf-worker.service.spec.ts --runInBand
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula-pdf-worker.service.ts services/api/src/modules/plano-aula/plano-aula-pdf-worker.service.spec.ts services/api/src/modules/plano-aula/plano-aula.service.ts services/api/src/modules/plano-aula/plano-aula.module.ts
git commit -m "feat: processa PDF de documento em segundo plano"
```

## Task 6: Adicionar Endpoint de Reprocessamento de PDF

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.spec.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`

**Step 1: Escrever teste RED**

Criar testes para `POST /plano-aula/documentos/:id/pdf/regerar`:

- apenas `analista_pedagogico`;
- exige documento aprovado;
- exige documento Word;
- marca `PENDENTE`, limpa erro e enfileira;
- retorna sucesso sem gerar PDF sincrono.

**Step 2: Rodar teste**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.controller.spec.ts --runInBand
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts --runInBand
```

Expected: FAIL porque endpoint nao existe.

**Step 3: Implementar endpoint**

Adicionar rota:

```ts
@Post("documentos/:id/pdf/regerar")
@Roles("analista_pedagogico")
async regerarPdfDocumento(...)
```

**Step 4: Rodar testes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.controller.spec.ts --runInBand
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.controller.ts services/api/src/modules/plano-aula/plano-aula.controller.spec.ts services/api/src/modules/plano-aula/plano-aula.service.ts services/api/src/modules/plano-aula/plano-aula.service.spec.ts
git commit -m "feat: permite reprocessar PDF de documento"
```

## Task 7: Atualizar UI para Status de PDF

**Files:**
- Modify: `apps/planejamento/features/plano-aula/components/documento-list.tsx`
- Modify: `apps/planejamento/features/plano-aula/components/documento-list.test.tsx`
- Modify: `apps/planejamento/features/plano-aula/hooks/use-plano-aula.ts`
- Modify: `apps/planejamento/app/analise/[planoId]/revisao-content.tsx`

**Step 1: Escrever testes RED**

Testar:

- documento Word aprovado com `pdfStatus: "PENDENTE"` exibe "PDF em preparacao" e nao mostra imprimir;
- `GERANDO` exibe estado de carregamento;
- `PRONTO` com `pdfUrl` mostra imprimir;
- `ERRO` mostra acao "Tentar gerar PDF novamente";
- aprovacao chama `refetch` e a tela continua usavel.

**Step 2: Rodar teste**

Run:

```bash
pnpm --filter planejamento test -- features/plano-aula/components/documento-list.test.tsx --runInBand
```

Expected: FAIL porque UI ainda nao entende `pdfStatus`.

**Step 3: Implementar UI**

Em `DocumentoList`:

- alterar `obterUrlImprimivel` para exigir `pdfStatus === "PRONTO"` quando for Word;
- mostrar badge discreta:
  - `PENDENTE`: "PDF em fila";
  - `GERANDO`: "Preparando PDF";
  - `ERRO`: "Falha no PDF";
- no erro, renderizar botao com icone para reprocessar.

Em `use-plano-aula.ts`, adicionar:

```ts
regerarPdfDocumento(documentoId: string): Promise<PlanoDocumento>
```

Em `revisao-content.tsx`, passar callback para lista.

**Step 4: Adicionar polling leve**

Em `revisao-content.tsx`, se houver documento aprovado Word com `pdfStatus` `PENDENTE` ou `GERANDO`, chamar `refetch()` a cada 5 segundos. Parar quando nao houver pendencia.

**Step 5: Rodar testes**

Run:

```bash
pnpm --filter planejamento test -- features/plano-aula/components/documento-list.test.tsx --runInBand
pnpm --filter planejamento typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/planejamento/features/plano-aula/components/documento-list.tsx apps/planejamento/features/plano-aula/components/documento-list.test.tsx apps/planejamento/features/plano-aula/hooks/use-plano-aula.ts apps/planejamento/app/analise/[planoId]/revisao-content.tsx
git commit -m "feat: mostra status de PDF no planejamento"
```

## Task 8: Melhorar Observabilidade por Etapa

**Files:**
- Modify: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.types.ts`
- Modify: `services/api/src/common/sharepoint/pdf-generator.service.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula-pdf-worker.service.ts`
- Test: `services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.service.spec.ts`
- Test: `services/api/src/modules/plano-aula/plano-aula-pdf-worker.service.spec.ts`

**Step 1: Escrever testes RED**

Testar que eventos novos aceitam:

- `evento: "pdf_impressao"`;
- `detalhes.etapa`;
- `detalhes.duracaoMs`;
- `arquivo.documentoId`;
- usuario/ambiente quando disponiveis.

**Step 2: Rodar teste**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/planejamento-observabilidade/planejamento-observabilidade.service.spec.ts --runInBand
```

Expected: FAIL enquanto evento nao for aceito.

**Step 3: Instrumentar etapas**

Registrar eventos em:

- inicio/fim da geracao;
- uso de item ativo do SharePoint;
- sincronizacao de Word modificado;
- upload novo ao SharePoint;
- conversao Graph;
- upload PDF ao storage;
- erro.

**Step 4: Rodar testes**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/planejamento-observabilidade/planejamento-observabilidade.service.spec.ts --runInBand
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula-pdf-worker.service.spec.ts --runInBand
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.types.ts services/api/src/common/sharepoint/pdf-generator.service.ts services/api/src/modules/plano-aula/plano-aula-pdf-worker.service.ts services/api/src/modules/planejamento-observabilidade/planejamento-observabilidade.service.spec.ts services/api/src/modules/plano-aula/plano-aula-pdf-worker.service.spec.ts
git commit -m "feat: detalha observabilidade da geracao de PDF"
```

## Task 9: Garantir Paridade com Provas ou Documentar Escopo

**Files:**
- Read: `services/api/src/modules/prova/prova.service.ts`
- Read: `services/api/src/modules/prova/prova.controller.ts`
- Create or Modify: `docs/plans/2026-05-22-otimizacao-fluxo-word-planejamento.md`

**Step 1: Avaliar duplicidade**

O modulo `prova` tem fluxo espelhado de documentos Word. Decidir com base no escopo:

- aplicar a mesma arquitetura em `prova`; ou
- documentar explicitamente que esta entrega corrige apenas `plano-aula`.

**Step 2: Se aplicar em prova, criar task separada**

Nao misturar no mesmo commit da task de planejamento. Repetir testes e implementacao para:

- `services/api/src/modules/prova/prova.service.ts`
- `services/api/src/modules/prova/prova.controller.ts`
- `apps/planejamento/features/prova/*`

**Step 3: Commit**

Se apenas documentar escopo:

```bash
git add docs/plans/2026-05-22-otimizacao-fluxo-word-planejamento.md
git commit -m "docs: delimita escopo da otimizacao Word"
```

## Task 10: Validacao Final Local

**Files:**
- No edits expected.

**Step 1: Rodar testes focados**

Run:

```bash
pnpm --filter @essencia/api test -- src/common/sharepoint/pdf-generator.service.spec.ts --runInBand
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula.service.spec.ts --runInBand
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula-pdf-queue.service.spec.ts --runInBand
pnpm --filter @essencia/api test -- src/modules/plano-aula/plano-aula-pdf-worker.service.spec.ts --runInBand
pnpm --filter planejamento test -- features/plano-aula/components/documento-list.test.tsx --runInBand
```

Expected: PASS.

**Step 2: Rodar qualidade global obrigatoria**

Run:

```bash
pnpm turbo lint
pnpm turbo typecheck
```

Expected: PASS, aceitando apenas warnings existentes que nao sejam introduzidos por esta entrega.

**Step 3: Teste manual em ambiente local ou homologacao**

Fluxo:

1. Abrir plano com documento `.docx`.
2. Clicar em abrir Word.
3. Salvar uma alteracao simples no Word.
4. Voltar ao sistema e aprovar documento.
5. Confirmar que a aprovacao responde rapido.
6. Confirmar que o documento fica com "Preparando PDF".
7. Aguardar o status virar "PDF pronto".
8. Imprimir e comparar visualmente o PDF com o Word esperado.
9. Confirmar logs `pdf_impressao` com etapas e duracoes.

Expected:

- aprovacao nao passa de aproximadamente 1s no servidor;
- PDF preserva layout;
- se houver edicao ativa, arquivo final refletido no PDF e no storage;
- nenhum erro no container `api`.

**Step 4: Commit**

Nao commitar nesta task, salvo ajustes pontuais feitos durante validacao.

## Task 11: Deploy e Verificacao em Producao

**Files:**
- No edits expected.

**Step 1: Aplicar migration**

Run no servidor:

```bash
./scripts/migrate.sh
```

Expected: migration aplicada sem erro.

**Step 2: Build e subida**

Run:

```bash
pnpm turbo lint
pnpm turbo typecheck
docker buildx bake -f docker-bake.hcl
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d
```

Expected: todos os containers healthy.

**Step 3: Verificar Redis/fila**

Run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.docker logs --tail=100 api | grep -i "planejamento-pdf-impressao"
```

Expected: worker inicializado sem erro de Redis.

**Step 4: Verificar fluxo real**

Executar uma aprovacao de documento Word em producao com usuario autorizado e acompanhar:

```bash
tail -f logs/planejamento/planejamento-$(date +%F).jsonl
```

Expected:

- `POST /api/plano-aula/documentos/:id/aprovar` abaixo de 1s;
- eventos `pdf_impressao` aparecem depois;
- status muda para `PRONTO`;
- botao imprimir aparece somente apos `PRONTO`.

## Riscos e Mitigacoes

- **Redis indisponivel:** aprovacao nao deve falhar; documento fica `PENDENTE` e job pode ser reenfileirado pelo endpoint de reprocessamento.
- **Graph lento ou instavel:** usuario nao fica bloqueado; worker marca `ERRO` apos tentativas.
- **Documento editado no Word sem sincronizacao manual:** worker verifica item ativo e sincroniza antes de gerar PDF.
- **Layout alterado:** nao trocar motor de conversao; continuar Microsoft Graph/SharePoint.
- **Jobs duplicados:** usar `jobId` deterministico por documento.
- **Provas com mesmo problema:** avaliar Task 9 antes de considerar a entrega totalmente ampla.

## Criterios de Aceite

- Aprovar Word nao aguarda conversao PDF de forma sincrona.
- PDF continua gerado pelo Microsoft Graph.
- PDF gerado reflete a versao final do Word quando ha edicao ativa.
- UI deixa claro quando o PDF esta pendente, gerando, pronto ou com erro.
- Impressao so fica disponivel quando `pdfStatus === "PRONTO"` e `pdfUrl` existe.
- Logs mostram tempos por etapa para futuras investigacoes.
- `pnpm turbo lint` e `pnpm turbo typecheck` passam.
