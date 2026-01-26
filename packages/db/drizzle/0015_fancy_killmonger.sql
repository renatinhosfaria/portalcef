-- ============================================
-- Limpeza de dados antigos (hard reset)
-- ============================================
-- AVISO: Esta migration deleta TODOS os planos de aula existentes
-- e dados relacionados. Isso é necessário para migrar do sistema
-- de quinzenas hardcoded para períodos configuráveis.

DELETE FROM plano_aula_historico WHERE plano_aula_id IN (SELECT id FROM plano_aula);
DELETE FROM plano_aula_comentarios WHERE plano_aula_id IN (SELECT id FROM plano_aula);
DELETE FROM quinzena_documents;
DELETE FROM plano_aula;

-- Remover tabelas obsoletas (se existirem)
DROP TABLE IF EXISTS quinzena_config CASCADE;

-- ============================================
-- Criação de nova estrutura
-- ============================================

CREATE TABLE "plano_aula_periodo" (
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
ALTER TABLE "plano_aula" ADD COLUMN "plano_aula_periodo_id" uuid;--> statement-breakpoint
ALTER TABLE "plano_aula_periodo" ADD CONSTRAINT "plano_aula_periodo_unidade_id_units_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_aula_periodo" ADD CONSTRAINT "plano_aula_periodo_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plano_aula_periodo_unidade_etapa_numero_unique" ON "plano_aula_periodo" USING btree ("unidade_id","etapa","numero");--> statement-breakpoint
CREATE INDEX "idx_plano_aula_periodo_unidade" ON "plano_aula_periodo" USING btree ("unidade_id");--> statement-breakpoint
CREATE INDEX "idx_plano_aula_periodo_etapa" ON "plano_aula_periodo" USING btree ("etapa");--> statement-breakpoint
CREATE INDEX "idx_plano_aula_periodo_datas" ON "plano_aula_periodo" USING btree ("data_inicio","data_fim");--> statement-breakpoint
ALTER TABLE "plano_aula" ADD CONSTRAINT "plano_aula_plano_aula_periodo_id_plano_aula_periodo_id_fk" FOREIGN KEY ("plano_aula_periodo_id") REFERENCES "public"."plano_aula_periodo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plano_aula_periodo_id_idx" ON "plano_aula" USING btree ("plano_aula_periodo_id");