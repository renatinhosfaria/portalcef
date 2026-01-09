import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TurmasController } from "./turmas.controller";
import { TurmasService } from "./turmas.service";

@Module({
  imports: [AuthModule],
  controllers: [TurmasController],
  providers: [TurmasService],
  exports: [TurmasService],
})
export class TurmasModule {}
