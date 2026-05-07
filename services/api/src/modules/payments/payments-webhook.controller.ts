import {
  Controller,
  Post,
  Req,
  Headers,
  RawBody,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  RawBodyRequest,
} from "@nestjs/common";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { PaymentsService } from "./payments.service";
import { ShopOrdersService } from "../shop/shop-orders.service";
import { getDb, stripeWebhookEvents, eq } from "@essencia/db";

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
   * - URL: https://www.portalcef.com.br/api/payments/webhook
   * - Eventos: checkout.session.completed, checkout.session.async_payment_succeeded,
   *   checkout.session.async_payment_failed, checkout.session.expired,
   *   payment_intent.succeeded, payment_intent.payment_failed,
   *   payment_intent.canceled, charge.refunded
   */
  @Post("webhook")
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @RawBody() rawBody: Buffer | undefined,
    @Headers("stripe-signature") signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException("Missing Stripe signature");
    }

    const payload = rawBody ?? req.rawBody;

    if (!payload) {
      throw new BadRequestException("Missing raw body");
    }

    let event: Stripe.Event;

    try {
      // Validar signature do Stripe
      const stripe = this.paymentsService.getStripeClient();
      event = stripe.webhooks.constructEvent(
        payload,
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
      throw new InternalServerErrorException({
        code: "STRIPE_WEBHOOK_PROCESSING_ERROR",
        message: "Erro ao processar webhook Stripe",
      });
    }
  }

  /**
   * Processa eventos do Stripe
   */
  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    const db = getDb();
    const existingEvent = await db.query.stripeWebhookEvents.findFirst({
      where: eq(stripeWebhookEvents.id, event.id),
    });

    if (existingEvent) {
      this.logger.log(`Webhook duplicado ignorado: ${event.id}`);
      return;
    }

    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "checkout.session.async_payment_succeeded":
        await this.handleCheckoutSessionAsyncPaymentSucceeded(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "checkout.session.async_payment_failed":
        await this.handleCheckoutSessionAsyncPaymentFailed(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "checkout.session.expired":
        await this.handleCheckoutSessionExpired(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

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

    await db.insert(stripeWebhookEvents).values({
      id: event.id,
      type: event.type,
    });
  }

  private getMetadataOrderId(
    metadata?: Stripe.Metadata | null,
  ): string | undefined {
    return metadata?.orderId || undefined;
  }

  private getPaymentIntentId(
    paymentIntent: string | Stripe.PaymentIntent | null,
  ): string | undefined {
    if (!paymentIntent) return undefined;
    return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orderId = this.getMetadataOrderId(session.metadata);

    if (!orderId) {
      this.logger.error(`Checkout Session ${session.id} sem orderId`);
      return;
    }

    if (session.payment_status !== "paid") {
      this.logger.log(
        `Checkout Session ${session.id} concluida sem pagamento final: ${session.payment_status}`,
      );
      return;
    }

    const paymentIntentId = this.getPaymentIntentId(session.payment_intent);

    if (!paymentIntentId) {
      throw new BadRequestException("Checkout pago sem PaymentIntent");
    }

    await this.ordersService.confirmStripePayment({
      orderId,
      paymentIntentId,
      paymentMethod: "CARTAO_CREDITO",
      amount: session.amount_total ?? 0,
    });
  }

  private async handleCheckoutSessionAsyncPaymentSucceeded(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orderId = this.getMetadataOrderId(session.metadata);

    if (!orderId) {
      this.logger.error(`Checkout Session ${session.id} sem orderId`);
      return;
    }

    const paymentIntentId = this.getPaymentIntentId(session.payment_intent);

    if (!paymentIntentId) {
      throw new BadRequestException("Checkout Pix pago sem PaymentIntent");
    }

    await this.ordersService.confirmStripePayment({
      orderId,
      paymentIntentId,
      paymentMethod: "PIX",
      amount: session.amount_total ?? 0,
    });
  }

  private async handleCheckoutSessionAsyncPaymentFailed(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orderId = this.getMetadataOrderId(session.metadata);

    if (!orderId) {
      this.logger.error(`Checkout Session ${session.id} sem orderId`);
      return;
    }

    await this.ordersService.failStripePayment({
      orderId,
      status: "CANCELADO",
      reason: "Pagamento Stripe falhou",
      paymentIntentId: this.getPaymentIntentId(session.payment_intent),
    });
  }

  private async handleCheckoutSessionExpired(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orderId = this.getMetadataOrderId(session.metadata);

    if (!orderId) {
      this.logger.error(`Checkout Session ${session.id} sem orderId`);
      return;
    }

    await this.ordersService.failStripePayment({
      orderId,
      status: "EXPIRADO",
      reason: "Checkout Stripe expirado",
      paymentIntentId: this.getPaymentIntentId(session.payment_intent),
    });
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

    if (!orderId) {
      this.logger.error(
        `PaymentIntent ${paymentIntent.id} sem orderId no metadata`,
      );
      return;
    }

    const paymentMethod = this.extractPaymentMethod(paymentIntent);

    if (!paymentMethod) {
      this.logger.log(
        `PaymentIntent ${paymentIntent.id} com método ambíguo; aguardando evento de Checkout Session`,
      );
      return;
    }

    await this.ordersService.confirmStripePayment({
      orderId,
      paymentIntentId: paymentIntent.id,
      paymentMethod,
      amount: paymentIntent.amount,
    });

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

    if (!orderId) {
      this.logger.error(`PaymentIntent ${paymentIntent.id} sem orderId`);
      return;
    }

    await this.ordersService.failStripePayment({
      orderId,
      status: "CANCELADO",
      reason: `Pagamento falhou: ${paymentIntent.last_payment_error?.message || "Erro desconhecido"}`,
      paymentIntentId: paymentIntent.id,
    });

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

    if (!orderId) {
      this.logger.error(`PaymentIntent ${paymentIntent.id} sem orderId`);
      return;
    }

    await this.ordersService.failStripePayment({
      orderId,
      status: "EXPIRADO",
      reason: "PaymentIntent cancelado no Stripe",
      paymentIntentId: paymentIntent.id,
    });

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
  ): "PIX" | "CARTAO_CREDITO" | undefined {
    // PaymentIntent pode vir expandido ou nao do webhook
    // Quando vem expandido, charges e um objeto, senao e um ID string
    const paymentIntentWithCharges = paymentIntent as Stripe.PaymentIntent & {
      charges?: { data?: Stripe.Charge[] };
    };
    const charges = paymentIntentWithCharges.charges;
    if (!charges?.data?.length) {
      if (paymentIntent.payment_method_types?.length === 1) {
        return paymentIntent.payment_method_types[0] === "pix"
          ? "PIX"
          : "CARTAO_CREDITO";
      }

      return undefined;
    }

    const charge = charges.data[0];
    const paymentMethod = charge.payment_method_details;

    if (!paymentMethod) return "CARTAO_CREDITO";

    switch (paymentMethod.type) {
      case "card":
        return "CARTAO_CREDITO"; // Simplificacao: nao distinguimos credito/debito aqui
      case "pix":
        return "PIX";
      default:
        return "CARTAO_CREDITO";
    }
  }
}
