CREATE TABLE "prova_ciclo" (
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
CREATE TABLE "prova" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"prova_ciclo_id" uuid NOT NULL,
	"status" text DEFAULT 'RASCUNHO' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prova_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prova_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"storage_key" varchar(500),
	"url" varchar(1000),
	"file_name" varchar(255),
	"file_size" integer,
	"mime_type" varchar(100),
	"preview_key" varchar(500),
	"preview_url" varchar(1000),
	"preview_mime_type" varchar(100),
	"preview_status" text,
	"preview_error" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"printed_by" uuid,
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tem_comentarios" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prova_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prova_id" uuid NOT NULL,
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
ALTER TABLE "prova_ciclo" ADD CONSTRAINT "prova_ciclo_unidade_id_units_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova_ciclo" ADD CONSTRAINT "prova_ciclo_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova" ADD CONSTRAINT "prova_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova" ADD CONSTRAINT "prova_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova" ADD CONSTRAINT "prova_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova" ADD CONSTRAINT "prova_prova_ciclo_id_prova_ciclo_id_fk" FOREIGN KEY ("prova_ciclo_id") REFERENCES "public"."prova_ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova_documento" ADD CONSTRAINT "prova_documento_prova_id_prova_id_fk" FOREIGN KEY ("prova_id") REFERENCES "public"."prova"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova_documento" ADD CONSTRAINT "prova_documento_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova_documento" ADD CONSTRAINT "prova_documento_printed_by_users_id_fk" FOREIGN KEY ("printed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova_historico" ADD CONSTRAINT "prova_historico_prova_id_prova_id_fk" FOREIGN KEY ("prova_id") REFERENCES "public"."prova"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prova_historico" ADD CONSTRAINT "prova_historico_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prova_ciclo_unidade_etapa_numero_unique" ON "prova_ciclo" USING btree ("unidade_id","etapa","numero");--> statement-breakpoint
CREATE INDEX "idx_prova_ciclo_unidade" ON "prova_ciclo" USING btree ("unidade_id");--> statement-breakpoint
CREATE INDEX "idx_prova_ciclo_etapa" ON "prova_ciclo" USING btree ("etapa");--> statement-breakpoint
CREATE INDEX "idx_prova_ciclo_datas" ON "prova_ciclo" USING btree ("data_inicio","data_fim");--> statement-breakpoint
CREATE INDEX "prova_status_idx" ON "prova" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prova_unit_id_idx" ON "prova" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "prova_user_idx" ON "prova" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "prova_prova_ciclo_id_idx" ON "prova" USING btree ("prova_ciclo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prova_user_turma_ciclo_unique" ON "prova" USING btree ("user_id","turma_id","prova_ciclo_id");--> statement-breakpoint
CREATE INDEX "prova_documento_prova_id_idx" ON "prova_documento" USING btree ("prova_id");--> statement-breakpoint
CREATE INDEX "idx_prova_historico_prova_id" ON "prova_historico" USING btree ("prova_id");--> statement-breakpoint
CREATE INDEX "idx_prova_historico_created_at" ON "prova_historico" USING btree ("created_at");