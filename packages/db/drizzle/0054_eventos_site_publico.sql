ALTER TABLE "evento_pedidos" ALTER COLUMN "buyer_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evento_pedidos" ALTER COLUMN "buyer_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evento_pedidos" ALTER COLUMN "buyer_phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evento_ingressos" ADD COLUMN "numero" varchar(8);--> statement-breakpoint
UPDATE "evento_ingressos" AS ingresso SET "numero" = (
  SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  FROM generate_series(1, 8) WHERE ingresso."id" IS NOT NULL
) WHERE ingresso."numero" IS NULL;--> statement-breakpoint
ALTER TABLE "evento_ingressos" ALTER COLUMN "numero" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_ingressos_numero" ON "evento_ingressos" USING btree ("numero");
