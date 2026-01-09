-- Schema completo do Portal Essência Feliz

CREATE TABLE IF NOT EXISTS "schools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "schools_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "education_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "education_stages_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "name" text NOT NULL,
  "role" text DEFAULT 'auxiliar_administrativo' NOT NULL,
  "school_id" uuid,
  "unit_id" uuid,
  "stage_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "turmas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "unit_id" uuid NOT NULL,
  "stage_id" uuid NOT NULL,
  "professora_id" uuid,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "year" integer NOT NULL,
  "shift" text,
  "capacity" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "unit_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "unit_id" uuid NOT NULL,
  "stage_id" uuid NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "plannings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "stage_id" uuid,
  "turma_id" text NOT NULL,
  "quinzena" text NOT NULL,
  "status" text DEFAULT 'RASCUNHO' NOT NULL,
  "review_cycles" integer DEFAULT 0 NOT NULL,
  "first_pass_yield" boolean,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "submitted_at" timestamp with time zone,
  "approved_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "planning_contents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "planning_id" uuid NOT NULL,
  "objetivos" text,
  "metodologia" text,
  "recursos" text,
  "atividades" text,
  "materia" text,
  "tema" text,
  "habilidades" text,
  "conteudos" text,
  "avaliacao" text,
  "reforco" text,
  "anexos" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "planning_contents_planning_id_unique" UNIQUE("planning_id")
);

CREATE TABLE IF NOT EXISTS "planning_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "planning_id" uuid NOT NULL,
  "reviewer_id" uuid NOT NULL,
  "status" text NOT NULL,
  "comentario" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "role_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "role_groups_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "role_group_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "role" text NOT NULL,
  "group_id" uuid NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "role_group_mappings_role_unique" UNIQUE("role")
);

-- Foreign Keys
ALTER TABLE "units" ADD CONSTRAINT "units_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_stage_id_education_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."education_stages"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_stage_id_education_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."education_stages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_professora_id_users_id_fk" FOREIGN KEY ("professora_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "unit_stages" ADD CONSTRAINT "unit_stages_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "unit_stages" ADD CONSTRAINT "unit_stages_stage_id_education_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."education_stages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_stage_id_education_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."education_stages"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "planning_contents" ADD CONSTRAINT "planning_contents_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "planning_reviews" ADD CONSTRAINT "planning_reviews_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "planning_reviews" ADD CONSTRAINT "planning_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "role_group_mappings" ADD CONSTRAINT "role_group_mappings_group_id_role_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."role_groups"("id") ON DELETE cascade ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS "plannings_status_idx" ON "plannings" USING btree ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "plannings_user_turma_quinzena_unique" ON "plannings" USING btree ("user_id","turma_id","quinzena");
CREATE INDEX IF NOT EXISTS "role_group_mappings_group_id_idx" ON "role_group_mappings" USING btree ("group_id");
CREATE UNIQUE INDEX IF NOT EXISTS "turmas_unit_code_year_unique" ON "turmas" USING btree ("unit_id","code","year");
CREATE UNIQUE INDEX IF NOT EXISTS "unit_stages_unit_stage_unique" ON "unit_stages" USING btree ("unit_id","stage_id");
CREATE INDEX IF NOT EXISTS "unit_stages_unit_id_idx" ON "unit_stages" USING btree ("unit_id");
CREATE INDEX IF NOT EXISTS "unit_stages_stage_id_idx" ON "unit_stages" USING btree ("stage_id");
