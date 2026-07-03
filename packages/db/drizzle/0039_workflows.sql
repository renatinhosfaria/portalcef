CREATE TABLE "workflow_categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"nome" varchar(120) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "workflow_modelos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"nome" varchar(180) NOT NULL,
	"descricao_curta" varchar(300) NOT NULL,
	"status" text DEFAULT 'RASCUNHO' NOT NULL,
	"criado_por" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "workflow_orientacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modelo_id" uuid NOT NULL,
	"titulo" varchar(140) NOT NULL,
	"conteudo" text NOT NULL,
	"ordem" integer NOT NULL
);

--> statement-breakpoint
CREATE TABLE "workflow_fases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modelo_id" uuid NOT NULL,
	"nome" varchar(140) NOT NULL,
	"ordem" integer NOT NULL
);

--> statement-breakpoint
CREATE TABLE "workflow_etapas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fase_id" uuid NOT NULL,
	"titulo" varchar(180) NOT NULL,
	"instrucao" text,
	"ordem" integer NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "workflow_execucoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"modelo_id" uuid NOT NULL,
	"titulo" varchar(220) NOT NULL,
	"status" text DEFAULT 'EM_ANDAMENTO' NOT NULL,
	"teste" boolean DEFAULT false NOT NULL,
	"modelo_atualizado" boolean DEFAULT false NOT NULL,
	"iniciado_por" uuid NOT NULL,
	"concluido_at" timestamp with time zone,
	"cancelado_at" timestamp with time zone,
	"motivo_cancelamento" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "workflow_etapa_progresso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execucao_id" uuid NOT NULL,
	"etapa_id" uuid NOT NULL,
	"etapa_versao" integer DEFAULT 1 NOT NULL,
	"concluida" boolean DEFAULT false NOT NULL,
	"observacao" text,
	"concluida_por" uuid,
	"concluida_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "workflow_anexos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execucao_id" uuid NOT NULL,
	"nome_original" varchar(255) NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"url" varchar(1000) NOT NULL,
	"mime_type" varchar(160) NOT NULL,
	"tamanho_bytes" integer NOT NULL,
	"enviado_por" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "workflow_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execucao_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"descricao" text NOT NULL,
	"motivo" text,
	"metadata" text,
	"autor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "workflow_categorias" ADD CONSTRAINT "workflow_categorias_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_categorias" ADD CONSTRAINT "workflow_categorias_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_modelos" ADD CONSTRAINT "workflow_modelos_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_modelos" ADD CONSTRAINT "workflow_modelos_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_modelos" ADD CONSTRAINT "workflow_modelos_categoria_id_workflow_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."workflow_categorias"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_modelos" ADD CONSTRAINT "workflow_modelos_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_orientacoes" ADD CONSTRAINT "workflow_orientacoes_modelo_id_workflow_modelos_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."workflow_modelos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_fases" ADD CONSTRAINT "workflow_fases_modelo_id_workflow_modelos_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."workflow_modelos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_etapas" ADD CONSTRAINT "workflow_etapas_fase_id_workflow_fases_id_fk" FOREIGN KEY ("fase_id") REFERENCES "public"."workflow_fases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_execucoes" ADD CONSTRAINT "workflow_execucoes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_execucoes" ADD CONSTRAINT "workflow_execucoes_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_execucoes" ADD CONSTRAINT "workflow_execucoes_modelo_id_workflow_modelos_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."workflow_modelos"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_execucoes" ADD CONSTRAINT "workflow_execucoes_iniciado_por_users_id_fk" FOREIGN KEY ("iniciado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_etapa_progresso" ADD CONSTRAINT "workflow_etapa_progresso_execucao_id_workflow_execucoes_id_fk" FOREIGN KEY ("execucao_id") REFERENCES "public"."workflow_execucoes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_etapa_progresso" ADD CONSTRAINT "workflow_etapa_progresso_etapa_id_workflow_etapas_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."workflow_etapas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_etapa_progresso" ADD CONSTRAINT "workflow_etapa_progresso_concluida_por_users_id_fk" FOREIGN KEY ("concluida_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_anexos" ADD CONSTRAINT "workflow_anexos_execucao_id_workflow_execucoes_id_fk" FOREIGN KEY ("execucao_id") REFERENCES "public"."workflow_execucoes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_anexos" ADD CONSTRAINT "workflow_anexos_enviado_por_users_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_historico" ADD CONSTRAINT "workflow_historico_execucao_id_workflow_execucoes_id_fk" FOREIGN KEY ("execucao_id") REFERENCES "public"."workflow_execucoes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_historico" ADD CONSTRAINT "workflow_historico_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_workflow_categorias_unidade_ordem" ON "workflow_categorias" USING btree ("unit_id","ordem");
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_categorias_unit_nome_unique" ON "workflow_categorias" USING btree ("unit_id","nome");
--> statement-breakpoint
CREATE INDEX "idx_workflow_modelos_unidade_status" ON "workflow_modelos" USING btree ("unit_id","status");
--> statement-breakpoint
CREATE INDEX "idx_workflow_modelos_categoria" ON "workflow_modelos" USING btree ("categoria_id");
--> statement-breakpoint
CREATE INDEX "idx_workflow_orientacoes_modelo_ordem" ON "workflow_orientacoes" USING btree ("modelo_id","ordem");
--> statement-breakpoint
CREATE INDEX "idx_workflow_fases_modelo_ordem" ON "workflow_fases" USING btree ("modelo_id","ordem");
--> statement-breakpoint
CREATE INDEX "idx_workflow_etapas_fase_ordem" ON "workflow_etapas" USING btree ("fase_id","ordem");
--> statement-breakpoint
CREATE INDEX "idx_workflow_execucoes_unidade_status" ON "workflow_execucoes" USING btree ("unit_id","status");
--> statement-breakpoint
CREATE INDEX "idx_workflow_execucoes_iniciado_por" ON "workflow_execucoes" USING btree ("iniciado_por");
--> statement-breakpoint
CREATE INDEX "idx_workflow_execucoes_modelo" ON "workflow_execucoes" USING btree ("modelo_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_progresso_execucao_etapa_unique" ON "workflow_etapa_progresso" USING btree ("execucao_id","etapa_id");
--> statement-breakpoint
CREATE INDEX "idx_workflow_progresso_execucao" ON "workflow_etapa_progresso" USING btree ("execucao_id");
--> statement-breakpoint
CREATE INDEX "idx_workflow_anexos_execucao" ON "workflow_anexos" USING btree ("execucao_id");
--> statement-breakpoint
CREATE INDEX "idx_workflow_historico_execucao" ON "workflow_historico" USING btree ("execucao_id");
--> statement-breakpoint
CREATE INDEX "idx_workflow_historico_tipo" ON "workflow_historico" USING btree ("tipo");