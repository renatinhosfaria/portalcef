ALTER TABLE "evento_participantes" ADD COLUMN "student_name" varchar(200);--> statement-breakpoint
CREATE TABLE "evento_juncoes_aluna" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"source_key" varchar(200) NOT NULL,
	"target_key" varchar(200) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_juncoes_aluna_different_keys" CHECK ("evento_juncoes_aluna"."source_key" <> "evento_juncoes_aluna"."target_key")
);--> statement-breakpoint
ALTER TABLE "evento_juncoes_aluna" ADD CONSTRAINT "evento_juncoes_aluna_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_juncoes_aluna" ADD CONSTRAINT "evento_juncoes_aluna_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_juncoes_aluna_event_source" ON "evento_juncoes_aluna" USING btree ("event_id","source_key");
