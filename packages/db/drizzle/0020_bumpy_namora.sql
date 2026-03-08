CREATE TABLE "ordem_servico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" serial NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"descricao" text NOT NULL,
	"categoria" text NOT NULL,
	"status" text DEFAULT 'ABERTA' NOT NULL,
	"criado_por" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"unit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordem_servico_mensagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ordem_servico_id" uuid NOT NULL,
	"conteudo" text,
	"tipo" text DEFAULT 'TEXTO' NOT NULL,
	"arquivo_url" varchar(500),
	"arquivo_nome" varchar(300),
	"criado_por" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_servico_mensagem" ADD CONSTRAINT "ordem_servico_mensagem_ordem_servico_id_ordem_servico_id_fk" FOREIGN KEY ("ordem_servico_id") REFERENCES "public"."ordem_servico"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_servico_mensagem" ADD CONSTRAINT "ordem_servico_mensagem_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_os_criado_por" ON "ordem_servico" USING btree ("criado_por");--> statement-breakpoint
CREATE INDEX "idx_os_school_id" ON "ordem_servico" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_os_status" ON "ordem_servico" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_os_categoria" ON "ordem_servico" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "idx_os_criado_por_status" ON "ordem_servico" USING btree ("criado_por","status");--> statement-breakpoint
CREATE INDEX "idx_os_msg_ordem_servico_id" ON "ordem_servico_mensagem" USING btree ("ordem_servico_id");--> statement-breakpoint
CREATE INDEX "idx_os_msg_criado_por" ON "ordem_servico_mensagem" USING btree ("criado_por");