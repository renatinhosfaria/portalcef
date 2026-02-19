ALTER TABLE "plano_documento" ADD COLUMN "printed_by" uuid;--> statement-breakpoint
ALTER TABLE "plano_documento" ADD COLUMN "printed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plano_documento" ADD CONSTRAINT "plano_documento_printed_by_users_id_fk" FOREIGN KEY ("printed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;