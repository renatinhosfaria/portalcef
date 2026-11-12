ALTER TABLE "evento_tipos_ingresso" ADD COLUMN "internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "evento_pedidos" ADD COLUMN "origin" text DEFAULT 'VENDA' NOT NULL;--> statement-breakpoint
ALTER TABLE "evento_pedidos" ADD CONSTRAINT "evento_pedidos_valid_origin" CHECK ("evento_pedidos"."origin" IN ('VENDA', 'CORTESIA'));
