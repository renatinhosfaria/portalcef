# Upload de imagem do evento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir selecionar uma imagem no workspace do evento, armazená-la de forma vinculada ao evento e persistir a URL para uso na página pública.

**Architecture:** O controller administrativo receberá multipart em `POST /eventos/admin/:id/imagem`. O `EventosService` validará o escopo, fará upload raster no `StorageService`, atualizará `imageUrl` com controle de versão e removerá o arquivo anterior após sucesso. O painel trocará o campo textual por seletor de arquivo, enviará a imagem e exibirá prévia e estados do upload.

**Tech Stack:** NestJS, Fastify multipart, Drizzle/PostgreSQL, MinIO/S3, Next.js App Router, React, Vitest e Jest.

**Spec:** `docs/superpowers/specs/2026-10-29-evento-imagem-upload-design.md`

## Global Constraints

- Toda comunicação, código de domínio, commits, documentação e comentários devem ser em Português do Brasil.
- Apps não acessam banco diretamente; o painel usa a API HTTP.
- Imagens aceitas: `image/jpeg`, `image/png`, `image/webp` e `image/gif`.
- O upload deve respeitar o escopo escolar do usuário autenticado.
- A árvore deve passar `pnpm turbo lint && pnpm turbo typecheck` antes do commit.
- O deploy de produção, quando autorizado, usa `./scripts/deploy.sh` sem migration.

## Review Focus

- Arquivo que declara MIME de imagem, mas tem conteúdo inválido: deve ser rejeitado antes de persistir a URL (Task 1).
- Storage desabilitado ou indisponível: deve retornar erro claro sem atualizar o evento (Task 2).
- Evento de outra escola: deve ser rejeitado e não deve fazer upload (Task 2).
- Falha ao atualizar o banco depois do upload: o novo arquivo deve ser removido para evitar órfãos (Task 2).
- Seleção repetida ou erro no navegador: o valor anterior e a mensagem de erro devem permanecer compreensíveis (Task 3).

### Task 1: Validar imagens e operações de URL no storage

**Files:**
- Modify: `services/api/src/common/storage/storage.service.ts`
- Test: `services/api/src/common/storage/storage.service.spec.ts`

**Interfaces:**
- Produces `uploadBuffer(buffer, filename, mimetype, prefix, allowedMimeTypes?)` mantendo compatibilidade com as chamadas existentes.
- Produces `deletePublicUrl(url: string): Promise<void>` para remover uma URL pública do bucket configurado.

- [ ] **Step 1: Write the failing tests**
  - Adicionar teste que chama `uploadBuffer` com um buffer JPEG, MIME permitido e prefixo `eventos/event-1/imagem`, esperando uma chave nesse prefixo.
  - Adicionar teste que rejeita conteúdo HTML declarado como `image/jpeg` com `INVALID_FILE_TYPE`.
  - Adicionar teste que converte uma URL pública do bucket em chave e chama `DeleteObjectCommand`.
- [ ] **Step 2: Run tests to verify they fail**
  - Run: `pnpm --filter @essencia/api test -- --runInBand services/api/src/common/storage/storage.service.spec.ts`
  - Expected: FAIL porque o upload ainda não aceita lista de MIME e a remoção por URL não existe.
- [ ] **Step 3: Implement the storage interfaces**
  - Passar a lista opcional para `resolveUploadMimeType` em `uploadBuffer`.
  - Implementar `deletePublicUrl` extraindo o caminho depois de `/<bucket>/`, ignorando URLs externas que não pertençam ao bucket configurado.
- [ ] **Step 4: Run tests to verify they pass**
  - Run: `pnpm --filter @essencia/api test -- --runInBand services/api/src/common/storage/storage.service.spec.ts`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git add services/api/src/common/storage/storage.service.ts services/api/src/common/storage/storage.service.spec.ts`
  - `git commit -m "feat: prepara storage para imagens de eventos"`

### Task 2: Criar o endpoint específico de imagem do evento

**Files:**
- Modify: `services/api/src/modules/eventos/eventos.service.ts`
- Modify: `services/api/src/modules/eventos/eventos-admin.controller.ts`
- Modify: `services/api/src/modules/eventos/eventos.module.ts`
- Test: `services/api/src/modules/eventos/eventos-admin.controller.spec.ts` (criar se necessário)

**Interfaces:**
- Consumes `StorageService.uploadBuffer(buffer, filename, mimetype, prefix, RASTER_IMAGE_MIME_TYPES)` e `StorageService.deletePublicUrl(url)`.
- Produces `POST /eventos/admin/:id/imagem` multipart com campo `file` e campo opcional `expectedUpdatedAt`.
- Returns `{ success: true, data: { imageUrl, updatedAt } }`.

- [ ] **Step 1: Write the failing tests**
  - Testar sucesso: multipart válido, escopo autorizado, upload no prefixo `eventos/event-1/imagem`, atualização de `imageUrl` e remoção da URL anterior.
  - Testar que evento fora do escopo não chama upload.
  - Testar que storage ausente retorna `STORAGE_UNAVAILABLE` sem atualizar banco.
  - Testar que falha na atualização remove o novo arquivo.
  - Testar conflito quando `expectedUpdatedAt` não corresponde à versão atual.
- [ ] **Step 2: Run tests to verify they fail**
  - Run: `pnpm --filter @essencia/api test -- --runInBand services/api/src/modules/eventos/eventos-admin.controller.spec.ts`
  - Expected: FAIL porque a rota e o método do service ainda não existem.
- [ ] **Step 3: Implement the service and controller**
  - Injetar `StorageService` opcional com `@Optional() @Inject(StorageService)` para manter o módulo inicializável sem MinIO.
  - Ler um único arquivo multipart, rejeitar ausência/arquivo vazio e delegar a validação de conteúdo ao storage.
  - Atualizar apenas `imageUrl` e `updatedAt` com filtro de versão quando informado.
  - Remover o arquivo anterior após atualização; em falha, remover o novo arquivo e propagar o erro.
- [ ] **Step 4: Run tests to verify they pass**
  - Run: `pnpm --filter @essencia/api test -- --runInBand services/api/src/modules/eventos/eventos-admin.controller.spec.ts`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git add services/api/src/modules/eventos/eventos.service.ts services/api/src/modules/eventos/eventos-admin.controller.ts services/api/src/modules/eventos/eventos.module.ts services/api/src/modules/eventos/eventos-admin.controller.spec.ts`
  - `git commit -m "feat: adiciona upload de imagem do evento"`

### Task 3: Integrar o seletor e a prévia no workspace

**Files:**
- Modify: `apps/eventos-admin/app/eventos/[id]/informacoes/page.tsx`
- Test: `apps/eventos-admin/app/eventos/[id]/informacoes/page.test.ts`

**Interfaces:**
- Consumes `POST /eventos-admin/api/eventos/admin/:id/imagem` com `FormData`.
- Produces `imageUrl` local atualizado, estado de envio e `<img>` de prévia quando houver URL.

- [ ] **Step 1: Write the failing tests**
  - Testar que a fonte da página contém input `type="file"` aceitando imagens.
  - Testar que a integração envia `FormData`, lê a URL retornada e mostra a prévia.
  - Testar que erro de upload é exibido e não apaga a imagem já salva.
- [ ] **Step 2: Run tests to verify they fail**
  - Run: `pnpm --filter @essencia/eventos-admin test -- app/eventos/[id]/informacoes/page.test.ts`
  - Expected: FAIL porque o campo ainda é um input textual.
- [ ] **Step 3: Implement the UI**
  - Substituir o input textual de imagem por seletor raster.
  - Enviar o arquivo com `expectedUpdatedAt`, atualizar `value.imageUrl` e `updatedAt` com a resposta, e mostrar prévia com texto alternativo do título.
  - Desabilitar nova seleção durante envio, mostrar erro e preservar o último valor válido.
- [ ] **Step 4: Run tests to verify they pass**
  - Run: `pnpm --filter @essencia/eventos-admin test -- app/eventos/[id]/informacoes/page.test.ts`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git add apps/eventos-admin/app/eventos/[id]/informacoes/page.tsx apps/eventos-admin/app/eventos/[id]/informacoes/page.test.ts`
  - `git commit -m "feat: permite enviar imagem no workspace do evento"`

### Task 4: Verificação integrada

**Files:**
- No production code; verify Tasks 1–3.

- [ ] **Step 1: Run focused suites**
  - `pnpm --filter @essencia/api test`
  - `pnpm --filter @essencia/eventos-admin test`
- [ ] **Step 2: Run required checks**
  - `pnpm turbo lint && pnpm turbo typecheck`
  - `git diff --check`
- [ ] **Step 3: Review the diff and working tree**
  - Confirm no secrets, temporary files, migrations or unrelated edits.
- [ ] **Step 4: Commit any necessary test-only fixes**
  - Use a Portuguese commit message describing the correction.

