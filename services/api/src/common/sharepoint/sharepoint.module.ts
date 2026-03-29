import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { StorageModule } from "../storage/storage.module";
import { SharePointCleanupService } from "./sharepoint-cleanup.service";
import { SharePointWebhookController } from "./sharepoint-webhook.controller";
import { SharePointService } from "./sharepoint.service";

@Module({
  imports: [ConfigModule, StorageModule.forRoot()],
  controllers: [SharePointWebhookController],
  providers: [SharePointService, SharePointCleanupService],
  exports: [SharePointService],
})
export class SharePointModule {}
