CREATE TABLE "plano_aula" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"quinzena_id" varchar(10) NOT NULL,
	"status" text DEFAULT 'RASCUNHO' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plano_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"storage_key" varchar(500),
	"url" varchar(1000),
	"file_name" varchar(255),
	"file_size" integer,
	"mime_type" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documento_comentario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"autor_id" uuid NOT NULL,
	"comentario" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quinzena_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"quinzena_id" varchar(10) NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plano_aula" ADD CONSTRAINT "plano_aula_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_aula" ADD CONSTRAINT "plano_aula_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_aula" ADD CONSTRAINT "plano_aula_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_documento" ADD CONSTRAINT "plano_documento_plano_id_plano_aula_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano_aula"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_comentario" ADD CONSTRAINT "documento_comentario_documento_id_plano_documento_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."plano_documento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_comentario" ADD CONSTRAINT "documento_comentario_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quinzena_config" ADD CONSTRAINT "quinzena_config_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quinzena_config" ADD CONSTRAINT "quinzena_config_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plano_aula_status_idx" ON "plano_aula" USING btree ("status");--> statement-breakpoint
CREATE INDEX "plano_aula_quinzena_id_idx" ON "plano_aula" USING btree ("quinzena_id");--> statement-breakpoint
CREATE INDEX "plano_aula_unit_id_idx" ON "plano_aula" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "plano_aula_user_idx" ON "plano_aula" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plano_aula_user_turma_quinzena_unique" ON "plano_aula" USING btree ("user_id","turma_id","quinzena_id");--> statement-breakpoint
CREATE INDEX "plano_documento_plano_id_idx" ON "plano_documento" USING btree ("plano_id");--> statement-breakpoint
CREATE INDEX "documento_comentario_documento_id_idx" ON "documento_comentario" USING btree ("documento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quinzena_config_unit_quinzena_unique" ON "quinzena_config" USING btree ("unit_id","quinzena_id");