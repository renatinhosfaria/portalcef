ALTER TABLE "evento_tipos_ingresso" ADD COLUMN "lugares_por_pacote" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "evento_tipos_ingresso" ADD CONSTRAINT "evento_tipos_ingresso_positive_package_size" CHECK ("lugares_por_pacote" > 0);
