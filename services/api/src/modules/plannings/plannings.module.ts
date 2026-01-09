import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { PlanningsController } from "./plannings.controller";
import { PlanningsService } from "./plannings.service";

@Module({
  imports: [AuthModule],
  controllers: [PlanningsController],
  providers: [PlanningsService],
  exports: [PlanningsService],
})
export class PlanningsModule {}
