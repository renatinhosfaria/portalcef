-- ============================================
-- Migration 0024: PDF derivado para impressão
-- ============================================
-- Adiciona campos `pdf_storage_key` e `pdf_url` em `plano_documento` e
-- `prova_documento`. O PDF é gerado quando o documento é APROVADO
-- (via Microsoft Graph `GET /drive/items/{id}/content?format=pdf`) e
-- usado pelo frontend para abrir o diálogo nativo de impressão via
-- iframe + print().
--
-- Aplicar ANTES de fazer deploy da nova versão da API.
--
-- Execução manual:
--   cat scripts/migration-0024-pdf-impressao.sql | docker exec -i essencia-postgres psql -U essencia -d essencia_db
-- ============================================

BEGIN;

-- plano_documento: PDF derivado para impressão
ALTER TABLE "plano_documento" ADD COLUMN IF NOT EXISTS "pdf_storage_key" varchar(500);
ALTER TABLE "plano_documento" ADD COLUMN IF NOT EXISTS "pdf_url" varchar(1000);

-- prova_documento: PDF derivado para impressão
ALTER TABLE "prova_documento" ADD COLUMN IF NOT EXISTS "pdf_storage_key" varchar(500);
ALTER TABLE "prova_documento" ADD COLUMN IF NOT EXISTS "pdf_url" varchar(1000);

COMMIT;
