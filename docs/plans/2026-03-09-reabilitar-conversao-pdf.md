# Reabilitar Conversão PDF para Impressão de Documentos — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reabilitar o botão "Imprimir" em documentos Word e JPG/PNG nos planos de aula, convertendo-os para PDF via worker assíncrono, e regerando o PDF após edição via OnlyOffice.

**Architecture:** Três mudanças independentes: (1) `conversor.ts` recebe suporte a imagens via LibreOffice; (2) o controller de upload re-habilita o enfileiramento de conversão; (3) o callback do OnlyOffice reenfileira conversão após salvar edição. O módulo `DocumentosConversaoModule` já está importado — só falta reinjetar o serviço no controller.

**Tech Stack:** TypeScript, NestJS, BullMQ, LibreOffice (soffice), Carbone API, Vitest

---

### Task 1: conversor.ts — suporte a imagens JPG/PNG via LibreOffice

**Files:**
- Modify: `services/worker/src/conversao/conversor.ts`
- Test: `services/worker/src/conversao/conversor.test.ts`

**Context:**
A função `caminhoSaidaPdf()` só remove extensões `.doc`/`.docx`. Para imagens, o regex precisa incluir `.jpg`, `.jpeg`, `.png`. O LibreOffice converte imagem → PDF com o mesmo padrão de comando já usado para DOC → DOCX.

**Step 1: Escrever testes que falham**

Abrir `services/worker/src/conversao/conversor.test.ts` e adicionar ao final do `describe`:

```typescript
  it("gera caminho de saida pdf para imagem jpg", () => {
    expect(caminhoSaidaPdf("/tmp/foto.jpg", "/tmp")).toBe("/tmp/foto.pdf");
  });

  it("gera caminho de saida pdf para imagem jpeg", () => {
    expect(caminhoSaidaPdf("/tmp/foto.jpeg", "/tmp")).toBe("/tmp/foto.pdf");
  });

  it("gera caminho de saida pdf para imagem png", () => {
    expect(caminhoSaidaPdf("/tmp/diagrama.png", "/tmp")).toBe(
      "/tmp/diagrama.pdf",
    );
  });

  it("detecta imagem jpeg como devendo usar LibreOffice para imagem", () => {
    expect(
      deveUsarLibreOfficeParaImagem({ mimeType: "image/jpeg" }),
    ).toBe(true);
  });

  it("detecta imagem jpg como devendo usar LibreOffice para imagem", () => {
    expect(
      deveUsarLibreOfficeParaImagem({ mimeType: "image/jpg" }),
    ).toBe(true);
  });

  it("detecta imagem png como devendo usar LibreOffice para imagem", () => {
    expect(
      deveUsarLibreOfficeParaImagem({ mimeType: "image/png" }),
    ).toBe(true);
  });

  it("nao detecta docx como imagem", () => {
    expect(
      deveUsarLibreOfficeParaImagem({
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe(false);
  });

  it("gera args do LibreOffice para converter imagem em PDF com perfil isolado", () => {
    const args = gerarArgsConversaoImagemParaPdf(
      "/tmp/foto.jpg",
      "/tmp/saida",
      "/tmp/saida/libreoffice-profile",
    );

    expect(args).toContain(
      "-env:UserInstallation=file:///tmp/saida/libreoffice-profile",
    );
    expect(args).toEqual([
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      "/tmp/saida",
      "/tmp/foto.jpg",
      "-env:UserInstallation=file:///tmp/saida/libreoffice-profile",
    ]);
  });
```

Atualizar a linha de imports no topo do arquivo para incluir as novas funções exportadas:

```typescript
import {
  caminhoSaidaDocxIntermediario,
  caminhoSaidaPdf,
  deveUsarLibreOfficeParaDoc,
  deveUsarLibreOfficeParaImagem,
  gerarArgsConversaoDocParaDocx,
  gerarArgsConversaoImagemParaPdf,
  normalizarNomeArquivo,
} from "./conversor";
```

**Step 2: Rodar testes para verificar que falham**

```bash
cd /var/www/essencia/services/worker && npm test
```

Esperado: falhas em todos os novos testes (`deveUsarLibreOfficeParaImagem is not a function`, etc.)

**Step 3: Implementar as mudanças em `conversor.ts`**

**3a. Atualizar `caminhoSaidaPdf`** — ampliar o regex para cobrir extensões de imagem:

```typescript
export function caminhoSaidaPdf(entrada: string, pastaSaida: string) {
  const nomeBase = basename(entrada).replace(/\.(doc|docx|jpg|jpeg|png)$/i, ".pdf");
  return join(pastaSaida, nomeBase);
}
```

**3b. Adicionar constantes e tipos de imagem** — logo após as constantes existentes (linha 8):

```typescript
const MIME_TYPES_IMAGEM = ["image/jpeg", "image/jpg", "image/png"] as const;

interface ConversaoImagemOptions {
  mimeType?: string;
}
```

**3c. Adicionar função `deveUsarLibreOfficeParaImagem`** — após `deveUsarLibreOfficeParaDoc`:

```typescript
export function deveUsarLibreOfficeParaImagem(
  options: ConversaoImagemOptions,
): boolean {
  return MIME_TYPES_IMAGEM.includes(
    options.mimeType?.toLowerCase() as (typeof MIME_TYPES_IMAGEM)[number],
  );
}
```

**3d. Adicionar função `gerarArgsConversaoImagemParaPdf`** — após `gerarArgsConversaoDocParaDocx`:

```typescript
export function gerarArgsConversaoImagemParaPdf(
  entrada: string,
  pastaSaida: string,
  pastaPerfilLibreOffice: string,
) {
  return [
    "--headless",
    "--convert-to",
    "pdf",
    "--outdir",
    pastaSaida,
    entrada,
    `-env:UserInstallation=file://${pastaPerfilLibreOffice}`,
  ];
}
```

**3e. Adicionar função privada `converterImagemParaPdfComLibreOffice`** — após `converterDocParaDocxComLibreOffice`:

```typescript
async function converterImagemParaPdfComLibreOffice(
  entrada: string,
  pastaSaida: string,
): Promise<string> {
  const caminhoPdf = caminhoSaidaPdf(entrada, pastaSaida);

  const pastaPerfilLibreOffice = join(
    pastaSaida,
    `libreoffice-profile-${randomUUID()}`,
  );
  await mkdir(pastaPerfilLibreOffice, { recursive: true });

  const args = gerarArgsConversaoImagemParaPdf(
    entrada,
    pastaSaida,
    pastaPerfilLibreOffice,
  );
  const comandoLibreOffice = process.env.LIBREOFFICE_BIN || "soffice";

  try {
    await execFileAsync(comandoLibreOffice, args);
    await access(caminhoPdf);
    return caminhoPdf;
  } catch (error) {
    const erroExec = error as { stderr?: string; stdout?: string; message?: string };
    const detalhes = erroExec.stderr || erroExec.stdout || erroExec.message || String(error);
    throw new Error(
      `Falha na conversao imagem -> PDF via LibreOffice (${comandoLibreOffice}): ${detalhes}`,
    );
  }
}
```

**3f. Atualizar `converterDocParaPdf`** — adicionar branch de imagem antes do bloco existente:

```typescript
export async function converterDocParaPdf(
  entrada: string,
  pastaSaida: string,
  options: ConverterDocParaPdfOptions = {},
): Promise<string> {
  const caminhoPdf = caminhoSaidaPdf(entrada, pastaSaida);

  try {
    if (deveUsarLibreOfficeParaImagem({ mimeType: options.mimeType })) {
      return converterImagemParaPdfComLibreOffice(entrada, pastaSaida);
    }

    if (
      deveUsarLibreOfficeParaDoc({
        caminhoEntrada: entrada,
        mimeType: options.mimeType,
        nomeArquivoOriginal: options.nomeArquivoOriginal,
      })
    ) {
      const caminhoDocxIntermediario = await converterDocParaDocxComLibreOffice(
        entrada,
        pastaSaida,
      );
      return converterDocxParaPdfComCarbone(caminhoDocxIntermediario, caminhoPdf);
    }

    return converterDocxParaPdfComCarbone(entrada, caminhoPdf);
  } catch (error) {
    throw new Error(
      `Erro ao converter documento: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
```

**Step 4: Rodar testes para verificar que passam**

```bash
cd /var/www/essencia/services/worker && npm test
```

Esperado: todos os testes passam (incluindo os pré-existentes).

**Step 5: Commit**

```bash
cd /var/www/essencia
git add services/worker/src/conversao/conversor.ts services/worker/src/conversao/conversor.test.ts
git commit -m "feat(worker): adicionar suporte a conversão de imagens JPG/PNG para PDF via LibreOffice"
```

---

### Task 2: plano-aula.service.ts — expandir `atualizarDocumento` para aceitar `previewStatus`

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts:1554-1563`

**Context:**
O método `atualizarDocumento` (linha 1554) atualmente só aceita `fileSize` e `updatedAt`. O callback do OnlyOffice (Task 3) precisará resetar `previewStatus` via esse método.

**Step 1: Atualizar a assinatura e o corpo de `atualizarDocumento`**

Localizar o método `atualizarDocumento` (linha ~1554) e substituir:

```typescript
  async atualizarDocumento(
    documentoId: string,
    dados: { fileSize?: number; updatedAt?: Date },
  ) {
    const db = getDb();
    await db
      .update(planoDocumento)
      .set(dados)
      .where(eq(planoDocumento.id, documentoId));
  }
```

Por:

```typescript
  async atualizarDocumento(
    documentoId: string,
    dados: {
      fileSize?: number;
      updatedAt?: Date;
      previewStatus?: "PENDENTE" | "PRONTO" | "ERRO" | null;
    },
  ) {
    const db = getDb();
    await db
      .update(planoDocumento)
      .set(dados)
      .where(eq(planoDocumento.id, documentoId));
  }
```

**Step 2: Verificar que o build compila sem erros**

```bash
cd /var/www/essencia/services/api && npx tsc --noEmit
```

Esperado: sem erros de tipo.

**Step 3: Commit**

```bash
cd /var/www/essencia
git add services/api/src/modules/plano-aula/plano-aula.service.ts
git commit -m "feat(api): expandir atualizarDocumento para aceitar previewStatus"
```

---

### Task 3: plano-aula.controller.ts — re-habilitar conversão no upload

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts`

**Context:**
O `DocumentosConversaoModule` já está importado em `plano-aula.module.ts` e o `DocumentosConversaoQueueService` já é exportado por ele — basta injetar no constructor do controller. A lógica de conversão foi removida quando o OnlyOffice foi adotado; precisa ser restaurada.

**Step 1: Injetar `DocumentosConversaoQueueService` no controller**

Adicionar o import no topo do arquivo (junto com os outros imports de `../../common/`):

```typescript
import { DocumentosConversaoQueueService } from "../../common/queues/documentos-conversao.queue";
```

Atualizar o constructor (linhas 100-105):

```typescript
  constructor(
    private readonly planoAulaService: PlanoAulaService,
    private readonly storageService: StorageService,
    private readonly historicoService: PlanoAulaHistoricoService,
    private readonly configService: ConfigService,
    private readonly documentosConversaoQueue: DocumentosConversaoQueueService,
  ) {}
```

**Step 2: Restaurar a lógica de conversão no endpoint de upload**

Substituir o bloco do `try` no endpoint `uploadDocumento` (linhas 305-335) — a parte que salva o documento e retorna — por:

```typescript
    try {
      // Upload para MinIO
      const uploadResult = await this.storageService.uploadFile(data);

      // Tipos que precisam de conversão para PDF (exceto PDF nativo)
      const precisaConverter = [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
        "image/jpg",
      ].includes(data.mimetype);

      // Salvar documento no banco via service
      const documento = await this.planoAulaService.adicionarDocumentoUpload(
        planoId,
        {
          tipo: "UPLOAD",
          fileName: uploadResult.name,
          fileKey: uploadResult.key,
          fileUrl: uploadResult.url,
          fileSize: buffer.length,
          mimeType: data.mimetype,
          ...(precisaConverter && { previewStatus: "PENDENTE" }),
        },
      );

      // Enfileirar conversão assíncrona para PDF
      if (precisaConverter) {
        await this.documentosConversaoQueue.enfileirar({
          documentoId: documento.id,
          planoId,
          storageKey: uploadResult.key,
          mimeType: data.mimetype,
          fileName: uploadResult.name,
        });
      }

      return {
        success: true,
        data: documento,
      };
    } catch (error) {
      this.logger.error(
        `Erro ao fazer upload: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException({
        code: "UPLOAD_FAILED",
        message: "Erro ao fazer upload do arquivo",
      });
    }
```

**Step 3: Verificar que o build compila sem erros**

```bash
cd /var/www/essencia/services/api && npx tsc --noEmit
```

Esperado: sem erros de tipo.

**Step 4: Commit**

```bash
cd /var/www/essencia
git add services/api/src/modules/plano-aula/plano-aula.controller.ts
git commit -m "feat(api): reabilitar conversão PDF no upload de documentos do plano de aula"
```

---

### Task 4: plano-aula.controller.ts — re-disparar conversão no callback do OnlyOffice

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts:535-538`

**Context:**
Quando o OnlyOffice salva (status=2 ou status=6), o arquivo original é atualizado no MinIO. Após isso, o PDF preview está desatualizado. Precisamos resetar `previewStatus = "PENDENTE"` e reenfileirar a conversão — mas apenas para tipos que precisam de conversão (DOC/DOCX/imagens). PDF nativo não muda de conteúdo via OnlyOffice (OnlyOffice não edita PDFs nativos).

**Step 1: Localizar o bloco de `atualizarDocumento` no callback OnlyOffice**

Encontrar (linha ~535):

```typescript
        await this.planoAulaService.atualizarDocumento(docId, {
          fileSize: buffer.length,
          updatedAt: new Date(),
        });

        this.logger.log(`Documento ${docId} atualizado via OnlyOffice`);
```

**Step 2: Substituir pelo bloco com re-enfileiramento**

```typescript
        const precisaReconverter = [
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "image/png",
          "image/jpeg",
          "image/jpg",
        ].includes(documento.mimeType || "");

        await this.planoAulaService.atualizarDocumento(docId, {
          fileSize: buffer.length,
          updatedAt: new Date(),
          ...(precisaReconverter && { previewStatus: "PENDENTE" }),
        });

        // Re-enfileirar conversão para PDF se o documento for editável via OnlyOffice
        if (precisaReconverter) {
          await this.documentosConversaoQueue.enfileirar({
            documentoId: docId,
            planoId,
            storageKey: documento.storageKey!,
            mimeType: documento.mimeType || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            fileName: documento.fileName || "documento.docx",
          });
        }

        this.logger.log(`Documento ${docId} atualizado via OnlyOffice`);
```

**Step 3: Verificar que o build compila sem erros**

```bash
cd /var/www/essencia/services/api && npx tsc --noEmit
```

Esperado: sem erros de tipo.

**Step 4: Commit**

```bash
cd /var/www/essencia
git add services/api/src/modules/plano-aula/plano-aula.controller.ts
git commit -m "feat(api): re-disparar conversão PDF após edição de documento via OnlyOffice"
```

---

## Verificação Final

Após todas as tasks, verificar:

1. Testes do worker passam:
```bash
cd /var/www/essencia/services/worker && npm test
```

2. API compila sem erros:
```bash
cd /var/www/essencia/services/api && npx tsc --noEmit
```

3. Fluxo esperado:
   - Upload de DOCX → `previewStatus="PENDENTE"` no banco, job na fila Redis
   - Upload de JPG → `previewStatus="PENDENTE"` no banco, job na fila Redis
   - Upload de PDF → sem `previewStatus`, botão de impressão usa `fileUrl` diretamente
   - Worker processa DOCX → Carbone → `previewStatus="PRONTO"`, botão habilitado
   - Worker processa JPG → LibreOffice → `previewStatus="PRONTO"`, botão habilitado
   - Edição via OnlyOffice → `previewStatus="PENDENTE"` resetado, novo job enfileirado
