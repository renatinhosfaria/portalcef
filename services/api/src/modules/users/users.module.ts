import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { SchoolsModule } from "../schools/schools.module";
import { UnitsModule } from "../units/units.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuthModule, SchoolsModule, UnitsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
