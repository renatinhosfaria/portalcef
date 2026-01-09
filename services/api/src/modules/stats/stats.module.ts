import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";

@Module({
  imports: [AuthModule],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
