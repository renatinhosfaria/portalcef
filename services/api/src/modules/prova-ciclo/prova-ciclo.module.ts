import { Module } from "@nestjs/common";
import { ProvaCicloService } from "./prova-ciclo.service";
import { ProvaCicloController } from "./prova-ciclo.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [ProvaCicloService],
  controllers: [ProvaCicloController],
  exports: [ProvaCicloService],
})
export class ProvaCicloModule {}
