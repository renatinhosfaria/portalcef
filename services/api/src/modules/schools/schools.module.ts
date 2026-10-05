import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { SchoolsController } from "./schools.controller";
import { SchoolsService } from "./schools.service";
import { SchoolsProvisioningService } from "./schools-provisioning.service";

@Module({
  imports: [AuthModule],
  controllers: [SchoolsController],
  providers: [SchoolsService, SchoolsProvisioningService],
  exports: [SchoolsService, SchoolsProvisioningService],
})
export class SchoolsModule {}
