ALTER TABLE "eventos" ADD COLUMN "classificacao_etaria" text;
--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_valid_classificacao_etaria" CHECK ("classificacao_etaria" IS NULL OR "classificacao_etaria" IN ('LIVRE', '10', '12', '14', '16', '18'));
