CREATE TABLE "quinzena_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quinzena_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_key" varchar(255) NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"file_size" integer,
	"file_type" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quinzena_documents" ADD CONSTRAINT "quinzena_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quinzena_documents" ADD CONSTRAINT "quinzena_documents_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quinzena_documents_quinzena_id_idx" ON "quinzena_documents" USING btree ("quinzena_id");--> statement-breakpoint
CREATE INDEX "quinzena_documents_user_id_idx" ON "quinzena_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quinzena_documents_unit_id_idx" ON "quinzena_documents" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "quinzena_documents_created_at_idx" ON "quinzena_documents" USING btree ("created_at");