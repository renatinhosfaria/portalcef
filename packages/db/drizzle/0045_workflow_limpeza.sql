CREATE TABLE IF NOT EXISTS "workflow_limpeza" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "storage_key" varchar(500) NOT NULL,
  "tentativas" integer DEFAULT 0 NOT NULL,
  "ultimo_erro" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_limpeza_storage_key_unique"
  ON "workflow_limpeza" USING btree ("storage_key");
