ALTER TABLE "plano_aula" DROP CONSTRAINT IF EXISTS "plano_aula_plano_aula_periodo_id_plano_aula_periodo_id_fk";--> statement-breakpoint
ALTER TABLE "plano_aula" ADD CONSTRAINT "plano_aula_plano_aula_periodo_id_plano_aula_periodo_id_fk" FOREIGN KEY ("plano_aula_periodo_id") REFERENCES "public"."plano_aula_periodo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova" DROP CONSTRAINT IF EXISTS "prova_prova_ciclo_id_prova_ciclo_id_fk";--> statement-breakpoint
ALTER TABLE "prova" ADD CONSTRAINT "prova_prova_ciclo_id_prova_ciclo_id_fk" FOREIGN KEY ("prova_ciclo_id") REFERENCES "public"."prova_ciclo"("id") ON DELETE restrict ON UPDATE no action;
