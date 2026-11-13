ALTER TABLE "evento_pedidos" ADD COLUMN "offer_discount_cents" integer DEFAULT 0;
ALTER TABLE "evento_pedidos" ADD COLUMN "coupon_discount_cents" integer DEFAULT 0;
ALTER TABLE "evento_pedidos" ADD COLUMN "applied_coupon_id" uuid;
ALTER TABLE "evento_pedidos" ADD COLUMN "coupon_snapshot" jsonb;
ALTER TABLE "evento_pedidos" ADD CONSTRAINT "evento_pedidos_non_negative_offer_discount" CHECK ("offer_discount_cents" >= 0);
ALTER TABLE "evento_pedidos" ADD CONSTRAINT "evento_pedidos_non_negative_coupon_discount" CHECK ("coupon_discount_cents" >= 0);
CREATE TABLE "evento_cupons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "code" varchar(80) NOT NULL,
  "name" varchar(200),
  "pricing_type" text NOT NULL,
  "discount_percent" integer,
  "discount_cents" integer,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "usage_limit" integer,
  "usage_limit_per_buyer" integer,
  "version" integer DEFAULT 1 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "evento_cupons_valid_pricing_type" CHECK ("pricing_type" IN ('PERCENTUAL', 'VALOR_FIXO')),
  CONSTRAINT "evento_cupons_valid_discount_percent" CHECK ("discount_percent" IS NULL OR ("discount_percent" >= 1 AND "discount_percent" <= 100)),
  CONSTRAINT "evento_cupons_non_negative_discount" CHECK ("discount_cents" IS NULL OR "discount_cents" >= 0),
  CONSTRAINT "evento_cupons_valid_pricing_values" CHECK (("pricing_type" = 'PERCENTUAL' AND "discount_percent" IS NOT NULL) OR ("pricing_type" = 'VALOR_FIXO' AND "discount_cents" IS NOT NULL)),
  CONSTRAINT "evento_cupons_valid_period" CHECK ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at"),
  CONSTRAINT "evento_cupons_positive_limits" CHECK (("usage_limit" IS NULL OR "usage_limit" > 0) AND ("usage_limit_per_buyer" IS NULL OR "usage_limit_per_buyer" > 0))
);
ALTER TABLE "evento_cupons" ADD CONSTRAINT "evento_cupons_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "evento_pedidos" ADD CONSTRAINT "evento_pedidos_applied_coupon_id_evento_cupons_id_fk" FOREIGN KEY ("applied_coupon_id") REFERENCES "public"."evento_cupons"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "idx_evento_cupons_event" ON "evento_cupons" USING btree ("event_id");
CREATE INDEX "idx_evento_cupons_event_active" ON "evento_cupons" USING btree ("event_id", "active");
CREATE UNIQUE INDEX "uq_evento_cupons_event_code" ON "evento_cupons" USING btree ("event_id", "code");
CREATE TABLE "evento_cupom_retencoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coupon_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "status" text DEFAULT 'ATIVA' NOT NULL,
  "buyer_email" varchar(320),
  "buyer_phone" varchar(30),
  "expires_at" timestamp with time zone NOT NULL,
  "converted_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "evento_cupom_retencoes_valid_status" CHECK ("status" IN ('ATIVA', 'CONVERTIDA', 'LIBERADA'))
);
ALTER TABLE "evento_cupom_retencoes" ADD CONSTRAINT "evento_cupom_retencoes_coupon_id_evento_cupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."evento_cupons"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "evento_cupom_retencoes" ADD CONSTRAINT "evento_cupom_retencoes_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE restrict ON UPDATE no action;
CREATE INDEX "idx_evento_cupom_retencoes_coupon" ON "evento_cupom_retencoes" USING btree ("coupon_id", "status");
CREATE INDEX "idx_evento_cupom_retencoes_order" ON "evento_cupom_retencoes" USING btree ("order_id");
CREATE UNIQUE INDEX "uq_evento_cupom_retencoes_coupon_order" ON "evento_cupom_retencoes" USING btree ("coupon_id", "order_id");
CREATE TABLE "evento_cupom_usos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coupon_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "status" text DEFAULT 'CONFIRMADO' NOT NULL,
  "buyer_email" varchar(320),
  "buyer_phone" varchar(30),
  "discount_cents" integer NOT NULL,
  "coupon_snapshot" jsonb NOT NULL,
  "confirmed_at" timestamp with time zone,
  "reverted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "evento_cupom_usos_valid_status" CHECK ("status" IN ('CONFIRMADO', 'REVERTIDO')),
  CONSTRAINT "evento_cupom_usos_non_negative_discount" CHECK ("discount_cents" >= 0)
);
ALTER TABLE "evento_cupom_usos" ADD CONSTRAINT "evento_cupom_usos_coupon_id_evento_cupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."evento_cupons"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "evento_cupom_usos" ADD CONSTRAINT "evento_cupom_usos_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE restrict ON UPDATE no action;
CREATE INDEX "idx_evento_cupom_usos_coupon" ON "evento_cupom_usos" USING btree ("coupon_id", "status");
CREATE INDEX "idx_evento_cupom_usos_order" ON "evento_cupom_usos" USING btree ("order_id");
CREATE UNIQUE INDEX "uq_evento_cupom_usos_coupon_order" ON "evento_cupom_usos" USING btree ("coupon_id", "order_id");
