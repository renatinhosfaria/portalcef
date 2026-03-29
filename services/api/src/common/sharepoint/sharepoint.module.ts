import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { StorageModule } from "../storage/storage.module";
import { SharePointService } from "./sharepoint.service";

@Module({
  imports: [ConfigModule, StorageModule.forRoot()],
  providers: [SharePointService],
  exports: [SharePointService],
})
export class SharePointModule {}
