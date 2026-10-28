ALTER TABLE "evento_pedidos" ADD COLUMN "finalization_idempotency_key" varchar(180);
CREATE UNIQUE INDEX "uq_evento_pedidos_finalization_idempotency_key" ON "evento_pedidos" ("finalization_idempotency_key");
