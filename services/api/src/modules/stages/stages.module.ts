import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { StagesController } from "./stages.controller";
import { StagesService } from "./stages.service";

@Module({
  imports: [AuthModule],
  controllers: [StagesController],
  providers: [StagesService],
  exports: [StagesService],
})
export class StagesModule {}
