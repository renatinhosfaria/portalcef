-- Migration: 0029_users_inativacao.sql
-- Adiciona suporte a inativação reversível de usuários
-- (soft-delete temporal com auditoria de quem fez)

ALTER TABLE "users" ADD COLUMN "inativado_em" TIMESTAMPTZ;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "inativado_por" UUID;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_inativado_por_users_id_fk"
  FOREIGN KEY ("inativado_por") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX "users_inativado_em_idx" ON "users" ("inativado_em")
  WHERE "inativado_em" IS NOT NULL;
