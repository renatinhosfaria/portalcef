ALTER TABLE "tarefa_contextos"
  ALTER COLUMN "quinzena_id" TYPE TEXT
  USING "quinzena_id"::text;--> statement-breakpoint
