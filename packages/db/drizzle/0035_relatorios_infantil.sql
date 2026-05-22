-- Migration: Cria tabelas do módulo Relatórios para Educação Infantil
-- Gerada manualmente em 2026-05-22

CREATE TABLE "semana_relatorio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unidade_id" uuid NOT NULL,
	"etapa" text NOT NULL,
	"numero" integer NOT NULL,
	"descricao" text,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"data_maxima_entrega" date NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "relatorio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"semana_relatorio_id" uuid,
	"semana_id" uuid NOT NULL,
	"status" text DEFAULT 'RASCUNHO' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "relatorio_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relatorio_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"storage_key" varchar(500),
	"url" varchar(1000),
	"file_name" varchar(255),
	"file_size" integer,
	"mime_type" varchar(100),
	"sharepoint_item_id" text,
	"sharepoint_edit_url" text,
	"editando_desde" timestamp with time zone,
	"pdf_storage_key" varchar(500),
	"pdf_url" varchar(1000),
	"pdf_status" text DEFAULT 'NAO_APLICAVEL' NOT NULL,
	"pdf_error" text,
	"pdf_requested_at" timestamp with time zone,
	"pdf_generated_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"printed_by" uuid,
	"printed_at" timestamp with time zone,
	"tem_comentarios" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "relatorio_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relatorio_id" uuid NOT NULL,
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

ALTER TABLE "semana_relatorio" ADD CONSTRAINT "semana_relatorio_unidade_id_units_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "semana_relatorio" ADD CONSTRAINT "semana_relatorio_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "relatorio" ADD CONSTRAINT "relatorio_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "relatorio" ADD CONSTRAINT "relatorio_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "relatorio" ADD CONSTRAINT "relatorio_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "relatorio" ADD CONSTRAINT "relatorio_semana_relatorio_id_semana_relatorio_id_fk" FOREIGN KEY ("semana_relatorio_id") REFERENCES "public"."semana_relatorio"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "relatorio_documento" ADD CONSTRAINT "relatorio_documento_relatorio_id_relatorio_id_fk" FOREIGN KEY ("relatorio_id") REFERENCES "public"."relatorio"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "relatorio_documento" ADD CONSTRAINT "relatorio_documento_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "relatorio_documento" ADD CONSTRAINT "relatorio_documento_printed_by_users_id_fk" FOREIGN KEY ("printed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "relatorio_historico" ADD CONSTRAINT "relatorio_historico_relatorio_id_relatorio_id_fk" FOREIGN KEY ("relatorio_id") REFERENCES "public"."relatorio"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "relatorio_historico" ADD CONSTRAINT "relatorio_historico_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

CREATE UNIQUE INDEX "semana_relatorio_unidade_etapa_numero_unique" ON "semana_relatorio" USING btree ("unidade_id","etapa","numero");
--> statement-breakpoint

CREATE INDEX "idx_semana_relatorio_unidade" ON "semana_relatorio" USING btree ("unidade_id");
--> statement-breakpoint

CREATE INDEX "idx_semana_relatorio_etapa" ON "semana_relatorio" USING btree ("etapa");
--> statement-breakpoint

CREATE INDEX "idx_semana_relatorio_datas" ON "semana_relatorio" USING btree ("data_inicio","data_fim");
--> statement-breakpoint

CREATE UNIQUE INDEX "relatorio_user_turma_semana_unique" ON "relatorio" USING btree ("user_id","turma_id","semana_id");
--> statement-breakpoint

CREATE INDEX "relatorio_status_idx" ON "relatorio" USING btree ("status");
--> statement-breakpoint

CREATE INDEX "relatorio_semana_id_idx" ON "relatorio" USING btree ("semana_id");
--> statement-breakpoint

CREATE INDEX "relatorio_unit_id_idx" ON "relatorio" USING btree ("unit_id");
--> statement-breakpoint

CREATE INDEX "relatorio_user_idx" ON "relatorio" USING btree ("user_id");
--> statement-breakpoint

CREATE INDEX "relatorio_semana_relatorio_id_idx" ON "relatorio" USING btree ("semana_relatorio_id");
--> statement-breakpoint

CREATE INDEX "relatorio_documento_relatorio_id_idx" ON "relatorio_documento" USING btree ("relatorio_id");
--> statement-breakpoint

CREATE INDEX "idx_relatorio_historico_relatorio_id" ON "relatorio_historico" USING btree ("relatorio_id");
--> statement-breakpoint

CREATE INDEX "idx_relatorio_historico_created_at" ON "relatorio_historico" USING btree ("created_at");
