# Fix: Preservar nome original dos arquivos no download (MinIO Content-Disposition)

> Data: 2026-02-13

## Problema

Quando o usuário baixa um arquivo do sistema (plano de aula, documento da quinzena, etc.), o nome do arquivo baixado é um UUID (ex: `9e367460-d2a7-40e1-90be-702c7bc553e1.pdf`) em vez do nome original (ex: `PROJETO VIRTUDES AMIZADE.docx`).

### Causa raiz

O `StorageService.uploadFile()` salva os arquivos no MinIO com chave UUID, mas não inclui o header `Content-Disposition` com o nome original. Sem esse header, o browser usa o nome da URL (o UUID) ao baixar ou exibir o arquivo.

O atributo HTML5 `download` usado no frontend não resolve porque é ignorado pelo browser quando o servidor não envia `Content-Disposition` adequado.

## Solução

Adicionar `Content-Disposition: inline; filename="nome-original.ext"` em todos os arquivos enviados ao MinIO.

## Mudanças

### 1. `StorageService.uploadFile()` — 1 linha

**Arquivo**: `services/api/src/common/storage/storage.service.ts`

Adicionar `ContentDisposition` no `PutObjectCommand`:

```typescript
await this.s3Client.send(
  new PutObjectCommand({
    Bucket: this.bucketName,
    Key: key,
    Body: buffer,
    ContentType: file.mimetype,
    ContentDisposition: `inline; filename="${file.filename}"`,  // NOVO
  }),
);
```

Isso corrige todos os módulos automaticamente (plano de aula, quinzena, loja) pois todos usam o mesmo service.

### 2. Script de migração — `scripts/fix-minio-filenames.ts`

Corrige os arquivos já existentes no MinIO. Para cada registro com `fileName` no banco:

- `plano_documento`: Atualiza `storageKey` e `previewKey`
- `quinzena_documents`: Atualiza `fileKey`

Usa `CopyObjectCommand` com `MetadataDirective: 'REPLACE'` para copiar o objeto para si mesmo com a nova metadata.

### 3. Worker de conversão (preview PDF)

**Arquivo**: `services/worker/src/conversao/conversor.ts`

Quando o worker converte DOCX → PDF e faz upload do preview, incluir `ContentDisposition` com o nome original (extensão trocada para `.pdf`).

## Tabelas afetadas

| Tabela | Campos de arquivo | Tem fileName? | Migração? |
|--------|-------------------|:---:|:---:|
| `plano_documento` | `storageKey`, `previewKey` | Sim | Sim |
| `quinzena_documents` | `fileKey` | Sim | Sim |
| `shop_products` | `imageUrl` | Não | Não* |
| `shop_product_images` | `imageUrl` | Não | Não* |

*As tabelas da loja não armazenam o fileName original, então não é possível migrar. Novos uploads serão corrigidos automaticamente pela mudança no StorageService.

## Execução

```bash
# 1. Deploy do código atualizado
# 2. Rodar script de migração uma única vez
npx tsx scripts/fix-minio-filenames.ts
```
