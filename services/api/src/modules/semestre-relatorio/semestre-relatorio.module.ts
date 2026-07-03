import { Module } from "@nestjs/common";
import { SemestreRelatorioService } from "./semestre-relatorio.service";
import { SemestreRelatorioController } from "./semestre-relatorio.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [SemestreRelatorioService],
  controllers: [SemestreRelatorioController],
  exports: [SemestreRelatorioService],
})
export class SemestreRelatorioModule {}
