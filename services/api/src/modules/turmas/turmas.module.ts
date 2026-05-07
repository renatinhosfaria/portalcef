import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlanoAulaModule } from "../plano-aula/plano-aula.module";
import { TurmasController } from "./turmas.controller";
import { TurmasService } from "./turmas.service";

@Module({
  imports: [AuthModule, PlanoAulaModule],
  controllers: [TurmasController],
  providers: [TurmasService],
  exports: [TurmasService],
})
export class TurmasModule {}
