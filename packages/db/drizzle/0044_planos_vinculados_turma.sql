-- O plano de aula pertence à turma e ao período, independentemente da
-- professora titular atual. O índice antigo incluía user_id e permitia que
-- uma troca de titular criasse dois planos para o mesmo período.
DROP INDEX IF EXISTS "plano_aula_user_turma_quinzena_unique";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plano_aula_turma_quinzena_idx"
  ON "plano_aula" USING btree ("turma_id", "quinzena_id");
