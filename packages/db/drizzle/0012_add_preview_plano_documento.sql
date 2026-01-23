-- Migration: Adicionar campos de preview para conversão assíncrona
-- Permite que documentos DOC/DOCX sejam convertidos para PDF de forma assíncrona

ALTER TABLE "plano_documento" ADD COLUMN "preview_key" varchar(500);
ALTER TABLE "plano_documento" ADD COLUMN "preview_url" varchar(1000);
ALTER TABLE "plano_documento" ADD COLUMN "preview_mime_type" varchar(100);
ALTER TABLE "plano_documento" ADD COLUMN "preview_status" text;
ALTER TABLE "plano_documento" ADD COLUMN "preview_error" text;
