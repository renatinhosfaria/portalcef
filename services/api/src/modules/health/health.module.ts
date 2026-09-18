import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../common/database/database.module";
import { AuthModule } from "../auth/auth.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
