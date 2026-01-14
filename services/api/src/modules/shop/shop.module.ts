import { Module, forwardRef } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { ShopPublicController } from "./shop-public.controller";
import { ShopAdminController } from "./shop-admin.controller";
import { ShopProductsService } from "./shop-products.service";
import { ShopInventoryService } from "./shop-inventory.service";
import { ShopOrdersService } from "./shop-orders.service";
import { ShopInterestService } from "./shop-interest.service";
import { ShopLocationsService } from "./shop-locations.service";
import { ShopExpirationJob } from "./jobs/shop-expiration.job";
import { ShopSettingsService } from "./shop-settings.service";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    AuthModule,
    ScheduleModule.forRoot(), // Habilita cron jobs
    forwardRef(() => PaymentsModule), // forwardRef para evitar dependência circular
    StorageModule.forRoot(),
  ],
  controllers: [ShopPublicController, ShopAdminController],
  providers: [
    ShopProductsService,
    ShopInventoryService,
    ShopOrdersService,
    ShopInterestService,
    ShopLocationsService,
    ShopSettingsService,
    ShopExpirationJob,
  ],
  exports: [
    ShopProductsService,
    ShopInventoryService,
    ShopOrdersService,
    ShopInterestService,
    ShopLocationsService,
    ShopSettingsService,
  ],
})
export class ShopModule {}
