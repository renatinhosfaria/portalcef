import {
  Controller,
  Post,
  Req,
  Headers,
  Logger,
  BadRequestException,
  RawBodyRequest,
} from "@nestjs/common";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { PaymentsService } from "./payments.service";
import { ShopOrdersService } from "../shop/shop-orders.service";
import { ShopInventoryService } from "../shop/shop-inventory.service";
import { getDb, shopOrders, eq } from "@essencia/db";

/**
 * PaymentsWebhookController
 *
 * Recebe webhooks do Stripe para confirmar/falhar pagamentos
 *
 * IMPORTANTE:
 * - Endpoint PUBLICO (sem guards)
 * - Validacao via signature Stripe
 * - Idempotencia obrigatoria (Stripe pode reenviar eventos)
 */
@Controller("payments")
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private configService: ConfigService,
    private paymentsService: PaymentsService,
    private ordersService: ShopOrdersService,
    private inventoryService: ShopInventoryService,
  ) {
    this.webhookSecret =
      this.configService.get<string>("STRIPE_WEBHOOK_SECRET") || "";

    if (!this.webhookSecret) {
      this.logger.warn(
        "STRIPE_WEBHOOK_SECRET nao configurada - webhooks nao funcionarao!",
      );
    }
  }

  /**
   * POST /payments/webhook
   *
   * Recebe eventos do Stripe (payment_intent.*, charge.refunded, etc.)
   *
   * Configuracao necessaria no Stripe Dashboard:
   * - URL: https://api.essencia.edu.br/payments/webhook
   * - Eventos: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, charge.refunded
   */
  @Post("webhook")
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException("Missing Stripe signature");
    }

    let event: Stripe.Event;

    try {
      // Validar signature do Stripe
      const stripe = this.paymentsService.getStripeClient();
      event = stripe.webhooks.constructEvent(
        req.rawBody!,
        signature,
        this.webhookSecret,
      );

      this.logger.log(`Webhook recebido: ${event.type} | ID: ${event.id}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Webhook signature invalida: ${errorMessage}`);
      throw new BadRequestException("Invalid signature");
    }

    // Processar evento
    try {
      await this.processWebhookEvent(event);
      return { received: true, eventId: event.id };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Erro ao processar webhook ${event.type}: ${errorMessage}`,
        errorStack,
      );
      // Retornar 200 mesmo com erro interno para evitar retry infinito do Stripe
      // Erro sera logado para investigacao manual
      return { received: true, eventId: event.id, error: errorMessage };
    }
  }

  /**
   * Processa eventos do Stripe
   */
  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "payment_intent.succeeded":
        await this.handlePaymentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case "payment_intent.payment_failed":
        await this.handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case "payment_intent.canceled":
        await this.handlePaymentCanceled(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case "charge.refunded":
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        this.logger.log(`Evento nao tratado: ${event.type}`);
    }
  }

  /**
   * payment_intent.succeeded
   *
   * Pagamento confirmado -> Converter reserva em venda
   */
  private async handlePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    const orderNumber = paymentIntent.metadata.orderNumber;

    this.logger.log(
      `Pagamento confirmado: ${paymentIntent.id} | Pedido: ${orderNumber}`,
    );

    const db = getDb();

    // Buscar pedido
    const order = await db.query.shopOrders.findFirst({
      where: eq(shopOrders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      this.logger.error(
        `Pedido ${orderId} nao encontrado para PaymentIntent ${paymentIntent.id}`,
      );
      return;
    }

    // Validar idempotencia: se ja esta PAGO, nao processar novamente
    if (order.status === "PAGO" || order.status === "RETIRADO") {
      this.logger.log(
        `Pedido ${orderNumber} ja esta no status ${order.status} - ignorando webhook duplicado`,
      );
      return;
    }

    // Converter reservas em vendas (decrementa quantity real)
    for (const item of order.items) {
      await this.inventoryService.confirmSale(
        item.variantId,
        order.unitId,
        item.quantity,
        order.id,
      );
    }

    // Atualizar pedido
    await db
      .update(shopOrders)
      .set({
        status: "PAGO",
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntent.id,
        paymentMethod: this.extractPaymentMethod(paymentIntent),
      })
      .where(eq(shopOrders.id, orderId));

    this.logger.log(`Pedido ${orderNumber} confirmado como PAGO`);
  }

  /**
   * payment_intent.payment_failed
   *
   * Pagamento falhou -> Liberar reserva
   */
  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    const orderNumber = paymentIntent.metadata.orderNumber;

    this.logger.log(
      `Pagamento falhou: ${paymentIntent.id} | Pedido: ${orderNumber}`,
    );

    const db = getDb();

    const order = await db.query.shopOrders.findFirst({
      where: eq(shopOrders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      this.logger.error(`Pedido ${orderId} nao encontrado`);
      return;
    }

    // Validar idempotencia
    if (order.status === "CANCELADO" || order.status === "EXPIRADO") {
      this.logger.log(
        `Pedido ${orderNumber} ja esta ${order.status} - ignorando webhook`,
      );
      return;
    }

    // Liberar reservas
    for (const item of order.items) {
      await this.inventoryService.releaseReservation(
        item.variantId,
        order.unitId,
        item.quantity,
        order.id,
      );
    }

    // Atualizar pedido
    await db
      .update(shopOrders)
      .set({
        status: "CANCELADO",
        cancelledAt: new Date(),
        cancellationReason: `Pagamento falhou: ${paymentIntent.last_payment_error?.message || "Erro desconhecido"}`,
      })
      .where(eq(shopOrders.id, orderId));

    this.logger.log(`Pedido ${orderNumber} cancelado (pagamento falhou)`);
  }

  /**
   * payment_intent.canceled
   *
   * PaymentIntent cancelado (manual ou timeout) -> Liberar reserva
   */
  private async handlePaymentCanceled(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    const orderNumber = paymentIntent.metadata.orderNumber;

    this.logger.log(
      `PaymentIntent cancelado: ${paymentIntent.id} | Pedido: ${orderNumber}`,
    );

    const db = getDb();

    const order = await db.query.shopOrders.findFirst({
      where: eq(shopOrders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      this.logger.error(`Pedido ${orderId} nao encontrado`);
      return;
    }

    // Validar idempotencia
    if (order.status === "CANCELADO" || order.status === "EXPIRADO") {
      this.logger.log(`Pedido ${orderNumber} ja esta ${order.status}`);
      return;
    }

    // Liberar reservas
    for (const item of order.items) {
      await this.inventoryService.releaseReservation(
        item.variantId,
        order.unitId,
        item.quantity,
        order.id,
      );
    }

    // Atualizar pedido
    await db
      .update(shopOrders)
      .set({
        status: "EXPIRADO",
        cancelledAt: new Date(),
        cancellationReason: "PaymentIntent cancelado no Stripe",
      })
      .where(eq(shopOrders.id, orderId));

    this.logger.log(`Pedido ${orderNumber} expirado (PaymentIntent cancelado)`);
  }

  /**
   * charge.refunded
   *
   * Estorno processado -> Log para auditoria
   */
  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    this.logger.log(
      `Charge estornado: ${charge.id} | Valor: R$ ${charge.amount_refunded / 100}`,
    );

    // TODO: Se necessario, atualizar registro no banco para auditoria
    // Por ora, o cancelamento ja foi tratado pelo admin via cancelOrder()
  }

  /**
   * Extrai metodo de pagamento do PaymentIntent
   */
  private extractPaymentMethod(
    paymentIntent: Stripe.PaymentIntent,
  ): string | null {
    // PaymentIntent pode vir expandido ou nao do webhook
    // Quando vem expandido, charges e um objeto, senao e um ID string
    const paymentIntentWithCharges = paymentIntent as Stripe.PaymentIntent & {
      charges?: { data?: Stripe.Charge[] };
    };
    const charges = paymentIntentWithCharges.charges;
    if (!charges?.data?.length) return null;

    const charge = charges.data[0];
    const paymentMethod = charge.payment_method_details;

    if (!paymentMethod) return null;

    switch (paymentMethod.type) {
      case "card":
        return "CARTAO_CREDITO"; // Simplificacao: nao distinguimos credito/debito aqui
      case "pix":
        return "PIX";
      default:
        return paymentMethod.type.toUpperCase();
    }
  }
}
