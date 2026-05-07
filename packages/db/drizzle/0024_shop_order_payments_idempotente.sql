CREATE TABLE IF NOT EXISTS "shop_order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_method" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "shop_order_payments"
		ADD CONSTRAINT "shop_order_payments_order_id_shop_orders_id_fk"
		FOREIGN KEY ("order_id")
		REFERENCES "public"."shop_orders"("id")
		ON DELETE cascade
		ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_order_payments_order_id_idx"
	ON "shop_order_payments" USING btree ("order_id");
