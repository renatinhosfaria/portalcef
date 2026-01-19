import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { PlanoAulaService } from "./plano-aula.service";

/**
 * PlanoAulaModule
 *
 * Módulo responsável pelo workflow de planos de aula:
 * - Professora cria e submete planos
 * - Analista revisa e aprova/devolve
 * - Coordenadora aprova final ou devolve
 * - Gestão visualiza dashboard e define deadlines
 *
 * Nota: O Controller será criado em uma task posterior.
 * Este módulo exporta o Service para uso por outros módulos.
 */
@Module({
  imports: [AuthModule],
  controllers: [], // Controller será adicionado na Task 2.2
  providers: [PlanoAulaService],
  exports: [PlanoAulaService],
})
export class PlanoAulaModule {}
