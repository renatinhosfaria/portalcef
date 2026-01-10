import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { getDb, shopOrders, shopOrderItems, eq, and, lt } from "@essencia/db";
import { ShopInventoryService } from "../shop-inventory.service";
import { PaymentsService } from "../../payments/payments.service";

type ExpiredOrder = typeof shopOrders.$inferSelect & {
  items: Array<typeof shopOrderItems.$inferSelect>;
};

/**
 * ShopExpirationJob
 *
 * Cron job para expirar pedidos nao pagos apos 15 minutos
 * - Executa a cada minuto
 * - Libera estoque reservado
 * - Atualiza status para EXPIRADO
 * - Cancela PaymentIntent no Stripe (best-effort)
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

    // 1. Liberar reservas de estoque
    for (const item of order.items) {
      await this.inventoryService.releaseReservation(
        item.variantId,
        order.unitId,
        item.quantity,
        order.id,
      );
    }

    // 2. Cancelar PaymentIntent no Stripe (se existir)
    if (order.stripePaymentIntentId) {
      await this.paymentsService.cancelPaymentIntent(
        order.stripePaymentIntentId,
      );
    }

    // 3. Atualizar status do pedido
    await db
      .update(shopOrders)
      .set({
        status: "EXPIRADO",
        cancelledAt: new Date(),
        cancellationReason:
          "Pagamento nao realizado dentro do prazo de 15 minutos",
      })
      .where(eq(shopOrders.id, order.id));

    this.logger.log(`Pedido ${order.orderNumber} expirado com sucesso`);
  }
}
