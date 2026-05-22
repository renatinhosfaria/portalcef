ALTER TABLE "plano_documento"
  ADD COLUMN "pdf_status" text DEFAULT 'NAO_APLICAVEL' NOT NULL,
  ADD COLUMN "pdf_error" text,
  ADD COLUMN "pdf_requested_at" timestamp with time zone,
  ADD COLUMN "pdf_generated_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "plano_documento"
SET
  "pdf_status" = 'PRONTO',
  "pdf_requested_at" = "approved_at",
  "pdf_generated_at" = "approved_at"
WHERE "pdf_url" IS NOT NULL;
--> statement-breakpoint
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
