import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

/**
 * PaymentsService
 *
 * Integração com Stripe para processamento de pagamentos
 * - Criação de PaymentIntent (PIX + Cartão)
 * - Parcelamento (até max configurado por unidade)
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
    metadata: {
      orderId: string;
      orderNumber: string;
      schoolId: string;
      unitId: string;
      customerName: string;
      customerPhone: string;
    },
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
        payment_method_types: ["card"], // PIX será adicionado em FASE 4 (requer configuração extra)
        metadata: {
          orderId: metadata.orderId,
          orderNumber: metadata.orderNumber,
          schoolId: metadata.schoolId,
          unitId: metadata.unitId,
          customerName: metadata.customerName,
          customerPhone: metadata.customerPhone,
        },
        description: `Pedido ${metadata.orderNumber} - CEF Shop`,
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
      // Nǜo lan��ar exce��ǜo aqui - cancelamento Ǹ best-effort
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
