import { Module } from "@nestjs/common";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";
import { AuthModule } from "../auth/auth.module";
import { TenantScopeModule } from "../../common/tenant/tenant-scope.module";

@Module({
  imports: [AuthModule, TenantScopeModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
