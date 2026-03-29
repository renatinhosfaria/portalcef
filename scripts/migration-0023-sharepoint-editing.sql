-- ============================================
-- Migration 0023: Substituir preview por SharePoint
-- ============================================
-- Aplicar ANTES de fazer deploy da nova versão da API.
--
-- OPÇÃO 1 (recomendada): Rodar `pnpm db:generate` interativamente,
--   selecionando "create column" para cada novo campo e confirmando
--   remoção dos campos de preview. Depois rodar `pnpm db:migrate`.
--
-- OPÇÃO 2 (manual): Executar este SQL diretamente no PostgreSQL:
--   cat scripts/migration-0023-sharepoint-editing.sql | docker exec -i essencia-postgres psql -U essencia -d essencia_db
-- ============================================

BEGIN;

-- plano_documento: adicionar campos de edição SharePoint
ALTER TABLE "plano_documento" ADD COLUMN IF NOT EXISTS "sharepoint_item_id" text;
ALTER TABLE "plano_documento" ADD COLUMN IF NOT EXISTS "sharepoint_edit_url" text;
ALTER TABLE "plano_documento" ADD COLUMN IF NOT EXISTS "editando_desde" timestamp with time zone;

-- prova_documento: adicionar campos de edição SharePoint
ALTER TABLE "prova_documento" ADD COLUMN IF NOT EXISTS "sharepoint_item_id" text;
ALTER TABLE "prova_documento" ADD COLUMN IF NOT EXISTS "sharepoint_edit_url" text;
ALTER TABLE "prova_documento" ADD COLUMN IF NOT EXISTS "editando_desde" timestamp with time zone;

-- plano_documento: remover campos de preview (dados serão perdidos)
ALTER TABLE "plano_documento" DROP COLUMN IF EXISTS "preview_key";
ALTER TABLE "plano_documento" DROP COLUMN IF EXISTS "preview_url";
ALTER TABLE "plano_documento" DROP COLUMN IF EXISTS "preview_mime_type";
ALTER TABLE "plano_documento" DROP COLUMN IF EXISTS "preview_status";
ALTER TABLE "plano_documento" DROP COLUMN IF EXISTS "preview_error";

-- prova_documento: remover campos de preview (dados serão perdidos)
ALTER TABLE "prova_documento" DROP COLUMN IF EXISTS "preview_key";
ALTER TABLE "prova_documento" DROP COLUMN IF EXISTS "preview_url";
ALTER TABLE "prova_documento" DROP COLUMN IF EXISTS "preview_mime_type";
ALTER TABLE "prova_documento" DROP COLUMN IF EXISTS "preview_status";
ALTER TABLE "prova_documento" DROP COLUMN IF EXISTS "preview_error";

COMMIT;
