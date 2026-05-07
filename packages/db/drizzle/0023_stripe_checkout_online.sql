ALTER TABLE "shop_orders"
ADD COLUMN "stripe_checkout_session_id" varchar(255);

CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "type" varchar(120) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
