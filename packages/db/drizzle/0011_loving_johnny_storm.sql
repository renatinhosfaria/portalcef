CREATE TABLE "plano_aula_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_name" text NOT NULL,
	"user_role" text NOT NULL,
	"acao" text NOT NULL,
	"status_anterior" text,
	"status_novo" text NOT NULL,
	"detalhes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"unit_id" uuid,
	"titulo" text NOT NULL,
	"descricao" text,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"prioridade" text NOT NULL,
	"prazo" timestamp with time zone NOT NULL,
	"criado_por" uuid NOT NULL,
	"responsavel" uuid NOT NULL,
	"tipo_origem" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tarefa_contextos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"modulo" text NOT NULL,
	"quinzena_id" varchar(10),
	"etapa_id" uuid,
	"turma_id" uuid,
	"professora_id" uuid
);
--> statement-breakpoint
ALTER TABLE "plano_documento" ADD COLUMN "preview_key" varchar(500);--> statement-breakpoint
ALTER TABLE "plano_documento" ADD COLUMN "preview_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "plano_documento" ADD COLUMN "preview_mime_type" varchar(100);--> statement-breakpoint
ALTER TABLE "plano_documento" ADD COLUMN "preview_status" text;--> statement-breakpoint
ALTER TABLE "plano_documento" ADD COLUMN "preview_error" text;--> statement-breakpoint
ALTER TABLE "plano_aula_historico" ADD CONSTRAINT "plano_aula_historico_plano_id_plano_aula_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano_aula"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_aula_historico" ADD CONSTRAINT "plano_aula_historico_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavel_users_id_fk" FOREIGN KEY ("responsavel") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_contextos" ADD CONSTRAINT "tarefa_contextos_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_contextos" ADD CONSTRAINT "tarefa_contextos_etapa_id_education_stages_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."education_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_contextos" ADD CONSTRAINT "tarefa_contextos_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_contextos" ADD CONSTRAINT "tarefa_contextos_professora_id_users_id_fk" FOREIGN KEY ("professora_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_plano_historico_plano_id" ON "plano_aula_historico" USING btree ("plano_id");--> statement-breakpoint
CREATE INDEX "idx_plano_historico_created_at" ON "plano_aula_historico" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_tarefas_responsavel" ON "tarefas" USING btree ("responsavel");--> statement-breakpoint
CREATE INDEX "idx_tarefas_criado_por" ON "tarefas" USING btree ("criado_por");--> statement-breakpoint
CREATE INDEX "idx_tarefas_school_id" ON "tarefas" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_tarefas_unit_id" ON "tarefas" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_tarefas_status" ON "tarefas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tarefas_prazo" ON "tarefas" USING btree ("prazo");--> statement-breakpoint
CREATE INDEX "idx_tarefas_responsavel_status" ON "tarefas" USING btree ("responsavel","status");--> statement-breakpoint
CREATE INDEX "idx_tarefas_responsavel_prazo" ON "tarefas" USING btree ("responsavel","prazo");--> statement-breakpoint
CREATE INDEX "idx_tarefa_contextos_tarefa_id" ON "tarefa_contextos" USING btree ("tarefa_id");--> statement-breakpoint
CREATE INDEX "idx_tarefa_contextos_modulo" ON "tarefa_contextos" USING btree ("modulo");--> statement-breakpoint
CREATE INDEX "idx_tarefa_contextos_quinzena_id" ON "tarefa_contextos" USING btree ("quinzena_id");--> statement-breakpoint
CREATE INDEX "idx_tarefa_contextos_turma_id" ON "tarefa_contextos" USING btree ("turma_id");