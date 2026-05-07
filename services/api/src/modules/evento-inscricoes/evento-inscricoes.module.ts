import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../common/database/database.module";
import { AuthModule } from "../auth/auth.module";
import { EventoInscricoesController } from "./evento-inscricoes.controller";
import { EventoInscricoesService } from "./evento-inscricoes.service";

/**
 * EventoInscricoesModule
 *
 * Inscrições para eventos abertos da escola (ex.: "Mãe por Inteiro").
 * - POST /api/eventos/:slug/inscricoes — público (formulário da landing)
 * - GET  /api/eventos/:slug/inscricoes — restrito (Diretora Geral, Gerente Unidade)
 */
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [EventoInscricoesController],
  providers: [EventoInscricoesService],
  exports: [EventoInscricoesService],
})
export class EventoInscricoesModule {}
