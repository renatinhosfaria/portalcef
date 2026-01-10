import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PaymentsService } from "./payments.service";
import { PaymentsWebhookController } from "./payments-webhook.controller";
import { ShopModule } from "../shop/shop.module";

/**
 * PaymentsModule
 *
 * Gerencia integração com Stripe:
 * - PaymentIntent creation
 * - Webhooks para confirmação
 * - Refunds
 */
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ShopModule), // forwardRef para evitar dependência circular
  ],
  controllers: [PaymentsWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
