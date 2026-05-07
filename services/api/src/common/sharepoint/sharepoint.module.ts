import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { StorageModule } from "../storage/storage.module";
import { PdfGeneratorService } from "./pdf-generator.service";
import { SharePointCleanupService } from "./sharepoint-cleanup.service";
import { SharePointService } from "./sharepoint.service";

@Module({
  imports: [ConfigModule, StorageModule.forRoot()],
  providers: [SharePointService, SharePointCleanupService, PdfGeneratorService],
  exports: [SharePointService, PdfGeneratorService],
})
export class SharePointModule {}
