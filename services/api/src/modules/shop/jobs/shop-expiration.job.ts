import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { getDb, shopOrders, shopOrderItems, eq, and, lt } from "@essencia/db";
import { ShopInventoryService } from "../shop-inventory.service";
import { PaymentsService } from "../../payments/payments.service";

type ExpiredOrder = typeof shopOrders.$inferSelect & {
  items: Array<typeof shopOrderItems.$inferSelect>;
};
type Db = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Db["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

/**
 * ShopExpirationJob
 *
 * Cron job para expirar pedidos/vouchers nao pagos apos 7 dias
 * - Executa a cada minuto
 * - Libera estoque reservado
 * - Atualiza status para EXPIRADO
 * - Cancela PaymentIntent no Stripe se existir (best-effort)
 *
 * Sistema de Voucher:
 * Cliente gera voucher online e tem 7 dias para pagar presencialmente na escola
 */
@Injectable()
export class ShopExpirationJob {
  private readonly logger = new Logger(ShopExpirationJob.name);

  constructor(
    private inventoryService: ShopInventoryService,
    private paymentsService: PaymentsService,
  ) {}

  /**
   * Executa a cada minuto
   * Busca pedidos AGUARDANDO_PAGAMENTO com expires_at < now
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredOrders() {
    this.logger.log("Verificando pedidos expirados...");

    const db = getDb();
    const now = new Date();

    try {
      // Buscar pedidos expirados
      const expiredOrders = await db.query.shopOrders.findMany({
        where: and(
          eq(shopOrders.status, "AGUARDANDO_PAGAMENTO"),
          lt(shopOrders.expiresAt, now),
        ),
        with: { items: true },
        limit: 50, // Processar no maximo 50 por vez para evitar timeout
      });

      if (expiredOrders.length === 0) {
        this.logger.log("Nenhum pedido expirado encontrado");
        return;
      }

      this.logger.log(`Encontrados ${expiredOrders.length} pedidos expirados`);

      for (const order of expiredOrders) {
        try {
          await this.expireOrder(order);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            `Erro ao expirar pedido ${order.orderNumber}: ${errorMessage}`,
            errorStack,
          );
          // Continuar processando outros pedidos
        }
      }

      this.logger.log(
        `Processamento de expiracao concluido: ${expiredOrders.length} pedidos`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Erro no job de expiracao: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Expira um pedido individual
   */
  private async expireOrder(order: ExpiredOrder): Promise<void> {
    const db = getDb();

    this.logger.log(
      `Expirando pedido: ${order.orderNumber} (${order.items.length} itens)`,
    );

    await this.inventoryService.withOrderLock(order.id, async () => {
      const currentOrder = await db.query.shopOrders.findFirst({
        where: and(
          eq(shopOrders.id, order.id),
          eq(shopOrders.status, "AGUARDANDO_PAGAMENTO"),
        ),
        with: { items: true },
      });

      if (!currentOrder) {
        this.logger.warn(
          `Pedido ${order.orderNumber} não está mais aguardando pagamento`,
        );
        return;
      }

      const lockTargets = currentOrder.items.map(
        (item: ExpiredOrder["items"][number]) => ({
          variantId: item.variantId,
          unitId: currentOrder.unitId,
        }),
      );
      const cancellationReason = currentOrder.stripeCheckoutSessionId
        ? "Checkout Stripe expirado - pagamento online nao finalizado dentro do prazo de 30 minutos"
        : "Voucher expirado - pagamento nao realizado dentro do prazo de 7 dias";

      await this.inventoryService.withInventoryLocks(lockTargets, async () =>
        db.transaction(async (tx: DbTransaction) => {
          for (const item of currentOrder.items) {
            await this.inventoryService.releaseReservationInTransaction(
              item.variantId,
              currentOrder.unitId,
              item.quantity,
              currentOrder.id,
              tx,
            );
          }

          await tx
            .update(shopOrders)
            .set({
              status: "EXPIRADO",
              cancelledAt: new Date(),
              cancellationReason,
            })
            .where(eq(shopOrders.id, currentOrder.id));
        }),
      );
    });

    if (order.stripePaymentIntentId) {
      await this.paymentsService.cancelPaymentIntent(order.stripePaymentIntentId);
    }

    if (order.stripeCheckoutSessionId) {
      await this.paymentsService.expireCheckoutSession(
        order.stripeCheckoutSessionId,
      );
    }

    this.logger.log(`Pedido ${order.orderNumber} expirado com sucesso`);
  }
}
