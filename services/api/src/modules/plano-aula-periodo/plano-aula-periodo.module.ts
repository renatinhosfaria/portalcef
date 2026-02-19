import { Module } from "@nestjs/common";
import { PlanoAulaPeriodoService } from "./plano-aula-periodo.service";
import { PlanoAulaPeriodoController } from "./plano-aula-periodo.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [PlanoAulaPeriodoService],
  controllers: [PlanoAulaPeriodoController],
  exports: [PlanoAulaPeriodoService],
})
export class PlanoAulaPeriodoModule {}
