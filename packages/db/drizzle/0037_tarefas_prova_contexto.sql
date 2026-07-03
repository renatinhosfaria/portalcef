ALTER TABLE "tarefa_contextos" ADD COLUMN "prova_id" uuid;--> statement-breakpoint
ALTER TABLE "tarefa_contextos" ADD CONSTRAINT "tarefa_contextos_prova_id_prova_id_fk" FOREIGN KEY ("prova_id") REFERENCES "public"."prova"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tarefa_contextos_prova_id" ON "tarefa_contextos" USING btree ("prova_id");
