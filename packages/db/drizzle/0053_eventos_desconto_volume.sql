ALTER TABLE "evento_ofertas" DROP CONSTRAINT "evento_ofertas_positive_quantity";--> statement-breakpoint
ALTER TABLE "evento_ofertas" DROP CONSTRAINT "evento_ofertas_non_negative_price";--> statement-breakpoint
ALTER TABLE "evento_ofertas" ALTER COLUMN "max_quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evento_ofertas" ALTER COLUMN "price_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evento_ofertas" ADD COLUMN "pricing_type" text DEFAULT 'VALOR_FIXO' NOT NULL;--> statement-breakpoint
ALTER TABLE "evento_ofertas" ADD COLUMN "discount_percent" integer;--> statement-breakpoint
ALTER TABLE "evento_pedidos" ADD COLUMN "subtotal_cents" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "evento_pedidos" ADD COLUMN "discount_cents" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "evento_pedidos" ADD COLUMN "applied_offer_id" uuid;--> statement-breakpoint
UPDATE "evento_pedidos" SET "subtotal_cents" = "total_cents", "discount_cents" = 0;--> statement-breakpoint
ALTER TABLE "evento_pedidos" ADD CONSTRAINT "evento_pedidos_applied_offer_id_evento_ofertas_id_fk" FOREIGN KEY ("applied_offer_id") REFERENCES "public"."evento_ofertas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_ofertas" ADD CONSTRAINT "evento_ofertas_valid_pricing_type" CHECK ("evento_ofertas"."pricing_type" IN ('PERCENTUAL', 'VALOR_FIXO'));--> statement-breakpoint
ALTER TABLE "evento_ofertas" ADD CONSTRAINT "evento_ofertas_valid_discount_percent" CHECK ("evento_ofertas"."discount_percent" IS NULL OR ("evento_ofertas"."discount_percent" >= 0 AND "evento_ofertas"."discount_percent" <= 100));--> statement-breakpoint
ALTER TABLE "evento_ofertas" ADD CONSTRAINT "evento_ofertas_valid_pricing_values" CHECK (("evento_ofertas"."pricing_type" = 'PERCENTUAL' AND "evento_ofertas"."discount_percent" IS NOT NULL) OR ("evento_ofertas"."pricing_type" = 'VALOR_FIXO' AND "evento_ofertas"."price_cents" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "evento_ofertas" ADD CONSTRAINT "evento_ofertas_positive_quantity" CHECK ("evento_ofertas"."min_quantity" > 0 AND ("evento_ofertas"."max_quantity" IS NULL OR "evento_ofertas"."max_quantity" >= "evento_ofertas"."min_quantity"));--> statement-breakpoint
ALTER TABLE "evento_ofertas" ADD CONSTRAINT "evento_ofertas_non_negative_price" CHECK ("evento_ofertas"."price_cents" IS NULL OR "evento_ofertas"."price_cents" >= 0);--> statement-breakpoint
ALTER TABLE "evento_pedidos" ADD CONSTRAINT "evento_pedidos_non_negative_subtotal" CHECK ("evento_pedidos"."subtotal_cents" >= 0);--> statement-breakpoint
ALTER TABLE "evento_pedidos" ADD CONSTRAINT "evento_pedidos_non_negative_discount" CHECK ("evento_pedidos"."discount_cents" >= 0);
