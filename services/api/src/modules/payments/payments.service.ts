import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

type CheckoutSessionItem = {
  name: string;
  unitAmount: number;
  quantity: number;
};

type CreateCheckoutSessionInput = {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  expiresAt: Date;
  items: CheckoutSessionItem[];
};

/**
 * PaymentsService
 *
 * Integração com Stripe para processamento de pagamentos.
 * - Checkout Session hospedada para pagamentos online da loja
 * - PaymentIntent legado para fluxos internos que ainda dependem dele
 * - Refund completo ou parcial
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada no ambiente");
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });

    this.logger.log("Stripe client inicializado com sucesso");
  }

  /**
   * Cria PaymentIntent no Stripe
   *
   * @param amount - Valor em centavos (ex: 5000 = R$ 50,00)
   * @param metadata - Dados do pedido para rastreabilidade
   * @param installments - Número de parcelas (default: 1)
   * @returns clientSecret para frontend + paymentIntentId para armazenar
   */
  async createPaymentIntent(
    amount: number,
    metadata: Partial<{
      orderId: string;
      orderNumber: string;
      schoolId: string;
      unitId: string;
      customerName: string;
      customerPhone: string;
    }>,
    installments: number = 1,
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      this.logger.log(
        `Criando PaymentIntent: R$ ${amount / 100} | Parcelas: ${installments}x | Pedido: ${metadata.orderNumber}`,
      );

      // Validações
      if (amount < 100) {
        throw new BadRequestException({
          code: "INVALID_AMOUNT",
          message: "Valor mínimo para pagamento: R$ 1,00",
        });
      }

      if (installments < 1 || installments > 12) {
        throw new BadRequestException({
          code: "INVALID_INSTALLMENTS",
          message: "Parcelas devem estar entre 1 e 12",
        });
      }

      // Configuração do PaymentIntent
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount,
        currency: "brl",
        payment_method_types: ["card"],
        metadata: metadata as Stripe.MetadataParam,
        description: metadata.orderNumber
          ? `Pedido ${metadata.orderNumber} - CEF Shop`
          : `Pedido Temporário - CEF Shop`,
        receipt_email: undefined, // TODO: adicionar se customer tiver email
      };

      // Configurar parcelamento se > 1
      if (installments > 1) {
        paymentIntentParams.payment_method_options = {
          card: {
            installments: {
              enabled: true,
              plan: {
                count: installments,
                interval: "month",
                type: "fixed_count",
              },
            },
          },
        };
      }

      const paymentIntent =
        await this.stripe.paymentIntents.create(paymentIntentParams);

      this.logger.log(
        `PaymentIntent criado: ${paymentIntent.id} | Status: ${paymentIntent.status}`,
      );

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: unknown) {
      const stripeError =
        error instanceof Stripe.errors.StripeError ? error : null;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Erro ao criar PaymentIntent: ${errorMessage}`,
        errorStack,
      );

      if (stripeError?.type === "StripeCardError") {
        throw new BadRequestException({
          code: "PAYMENT_ERROR",
          message: errorMessage,
        });
      }

      throw new InternalServerErrorException({
        code: "STRIPE_ERROR",
        message: "Erro ao processar pagamento. Tente novamente.",
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }
  }

  /**
   * Cria Checkout Session hospedada para pagamento online da loja.
   */
  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<{
    checkoutSessionId: string;
    checkoutUrl: string;
    paymentIntentId?: string;
  }> {
    try {
      if (input.totalAmount < 100) {
        throw new BadRequestException({
          code: "INVALID_AMOUNT",
          message: "Valor mínimo para pagamento: R$ 1,00",
        });
      }

      if (input.items.length === 0) {
        throw new BadRequestException({
          code: "EMPTY_CHECKOUT",
          message: "Checkout sem itens",
        });
      }

      const lojaPublicUrl =
        this.configService.get<string>("LOJA_PUBLIC_URL") ||
        "https://loja.portalcef.com.br";
      const orderUrl = `${lojaPublicUrl}/pedido/${input.orderNumber}?phone=${input.customerPhone}`;
      const minimumExpiresAtSeconds = Math.floor(Date.now() / 1000) + 30 * 60;
      const requestedExpiresAtSeconds = Math.ceil(
        input.expiresAt.getTime() / 1000,
      );
      const expiresAtSeconds = Math.max(
        requestedExpiresAtSeconds,
        minimumExpiresAtSeconds,
      );
      const metadata = {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
      };

      const session = await this.stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card", "pix"],
        client_reference_id: input.orderNumber,
        customer_email: input.customerEmail,
        line_items: input.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "brl",
            unit_amount: item.unitAmount,
            product_data: {
              name: item.name,
            },
          },
        })),
        metadata,
        payment_intent_data: {
          metadata,
        },
        payment_method_options: {
          pix: {
            expires_after_seconds: 30 * 60,
          },
        },
        success_url: `${orderUrl}&pagamento=sucesso`,
        cancel_url: `${orderUrl}&pagamento=cancelado`,
        expires_at: expiresAtSeconds,
      });

      if (!session.url) {
        throw new InternalServerErrorException({
          code: "CHECKOUT_URL_MISSING",
          message: "Stripe não retornou URL de checkout",
        });
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

      return {
        checkoutSessionId: session.id,
        checkoutUrl: session.url,
        paymentIntentId,
      };
    } catch (error: unknown) {
      const stripeError =
        error instanceof Stripe.errors.StripeError ? error : null;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Erro ao criar Checkout Session: ${errorMessage}`,
        errorStack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (stripeError?.type === "StripeInvalidRequestError") {
        throw new BadRequestException({
          code: "CHECKOUT_ERROR",
          message: errorMessage,
        });
      }

      throw new InternalServerErrorException({
        code: "STRIPE_ERROR",
        message: "Erro ao iniciar pagamento online. Tente novamente.",
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }
  }

  /**
   * Cria refund completo ou parcial
   *
   * @param paymentIntentId - ID do PaymentIntent no Stripe
   * @param amount - Valor a estornar em centavos (opcional, default: total)
   * @param reason - Motivo do estorno
   * @returns refundId do Stripe
   */
  async refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason:
      | "duplicate"
      | "fraudulent"
      | "requested_by_customer" = "requested_by_customer",
  ): Promise<{ refundId: string; status: string; amount: number }> {
    try {
      this.logger.log(
        `Criando refund para PaymentIntent: ${paymentIntentId} | Valor: ${amount ? `R$ ${amount / 100}` : "Total"}`,
      );

      // Buscar PaymentIntent para validar
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        throw new BadRequestException({
          code: "PAYMENT_NOT_SUCCEEDED",
          message: `PaymentIntent não está no status 'succeeded'. Status atual: ${paymentIntent.status}`,
        });
      }

      // Criar refund
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        reason,
      };

      if (amount) {
        refundParams.amount = amount;
      }

      const refund = await this.stripe.refunds.create(refundParams);

      this.logger.log(
        `Refund criado: ${refund.id} | Status: ${refund.status} | Valor: R$ ${refund.amount / 100}`,
      );

      return {
        refundId: refund.id,
        status: refund.status || "pending",
        amount: refund.amount,
      };
    } catch (error: unknown) {
      const stripeError =
        error instanceof Stripe.errors.StripeError ? error : null;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Erro ao criar refund: ${errorMessage}`, errorStack);

      if (stripeError?.type === "StripeInvalidRequestError") {
        throw new BadRequestException({
          code: "INVALID_REFUND",
          message: errorMessage,
        });
      }

      throw new InternalServerErrorException({
        code: "STRIPE_ERROR",
        message: "Erro ao processar estorno. Tente novamente.",
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }
  }

  /**
   * Cancela PaymentIntent (se ainda não foi pago)
   * Útil para expiração de pedidos
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      this.logger.log(`Cancelando PaymentIntent: ${paymentIntentId}`);

      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      // Só cancela se ainda não foi capturado
      if (
        paymentIntent.status === "requires_payment_method" ||
        paymentIntent.status === "requires_confirmation"
      ) {
        await this.stripe.paymentIntents.cancel(paymentIntentId);
        this.logger.log(`PaymentIntent cancelado: ${paymentIntentId}`);
      } else {
        this.logger.warn(
          `PaymentIntent ${paymentIntentId} não pode ser cancelado. Status: ${paymentIntent.status}`,
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Erro ao cancelar PaymentIntent: ${errorMessage}`,
        errorStack,
      );
      // Nao lancar excecao aqui - cancelamento e best-effort.
    }
  }

  /**
   * Expira Checkout Session aberta.
   */
  async expireCheckoutSession(checkoutSessionId: string): Promise<void> {
    try {
      this.logger.log(`Expirando Checkout Session: ${checkoutSessionId}`);

      const session =
        await this.stripe.checkout.sessions.retrieve(checkoutSessionId);

      if (session.status === "open") {
        await this.stripe.checkout.sessions.expire(checkoutSessionId);
        this.logger.log(`Checkout Session expirada: ${checkoutSessionId}`);
      } else {
        this.logger.warn(
          `Checkout Session ${checkoutSessionId} não pode ser expirada. Status: ${session.status}`,
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Erro ao expirar Checkout Session: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Atualiza metadata do PaymentIntent
   */
  async updatePaymentIntent(
    paymentIntentId: string,
    metadata: Stripe.MetadataParam,
  ): Promise<void> {
    try {
      await this.stripe.paymentIntents.update(paymentIntentId, {
        metadata,
        description: metadata.orderNumber
          ? `Pedido ${metadata.orderNumber} - CEF Shop`
          : undefined,
      });
      this.logger.log(
        `PaymentIntent ${paymentIntentId} atualizado com sucesso`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar PaymentIntent ${paymentIntentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Retorna instância do Stripe client
   * Para uso avançado (webhooks, etc.)
   */
  getStripeClient(): Stripe {
    return this.stripe;
  }
}
