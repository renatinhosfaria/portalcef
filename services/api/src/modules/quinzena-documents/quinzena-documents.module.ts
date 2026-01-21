import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../../common/storage/storage.module";
import { QuinzenaDocumentsController } from "./quinzena-documents.controller";
import { QuinzenaDocumentsService } from "./quinzena-documents.service";

@Module({
  imports: [AuthModule, StorageModule.forRoot()],
  controllers: [QuinzenaDocumentsController],
  providers: [QuinzenaDocumentsService],
  exports: [QuinzenaDocumentsService],
})
export class QuinzenaDocumentsModule {}
