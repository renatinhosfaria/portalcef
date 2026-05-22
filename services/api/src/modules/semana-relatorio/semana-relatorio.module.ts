import { Module } from "@nestjs/common";
import { SemanaRelatorioService } from "./semana-relatorio.service";
import { SemanaRelatorioController } from "./semana-relatorio.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [SemanaRelatorioService],
  controllers: [SemanaRelatorioController],
  exports: [SemanaRelatorioService],
})
export class SemanaRelatorioModule {}
