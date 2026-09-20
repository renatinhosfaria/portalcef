import { Module } from "@nestjs/common";

import { TenantScopeModule } from "../../common/tenant/tenant-scope.module";
import { AuthModule } from "../auth/auth.module";
import { UnitsController } from "./units.controller";
import { UnitsService } from "./units.service";

@Module({
  imports: [AuthModule, TenantScopeModule],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
