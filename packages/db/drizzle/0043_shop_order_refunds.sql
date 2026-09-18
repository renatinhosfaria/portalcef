-- Custom SQL migration file, put your code below! --
-- Registra cada tentativa de estorno de um pedido pago.
-- A chave única por pedido e a chave de idempotência do Stripe impedem
-- cobranças duplicadas quando o administrador repete a operação.
CREATE TABLE IF NOT EXISTS "shop_order_refunds" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL REFERENCES "shop_orders"("id") ON DELETE CASCADE,
  "payment_intent_id" VARCHAR(255) NOT NULL,
  "stripe_refund_id" VARCHAR(255),
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "amount" INTEGER NOT NULL,
  "error_message" TEXT,
  "requested_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "shop_order_refunds_status_check"
    CHECK ("status" IN ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_refunds_order_id_unique"
  ON "shop_order_refunds"("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_order_refunds_payment_intent_idx"
  ON "shop_order_refunds"("payment_intent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_order_refunds_status_idx"
  ON "shop_order_refunds"("status");
