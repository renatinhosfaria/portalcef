ALTER TABLE "tarefa_contextos"
  ADD COLUMN "plano_id" uuid REFERENCES "plano_aula"("id") ON DELETE CASCADE;--> statement-breakpoint

CREATE INDEX "idx_tarefa_contextos_plano_id" ON "tarefa_contextos" USING btree ("plano_id");
