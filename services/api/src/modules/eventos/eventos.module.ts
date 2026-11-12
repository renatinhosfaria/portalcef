import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../../common/database/database.module";
import { StorageModule } from "../../common/storage/storage.module";
import { EventosAdminController } from "./eventos-admin.controller";
import { EventosPublicController } from "./eventos-public.controller";
import { EventosRulesService } from "./eventos-rules.service";
import { EventosService } from "./eventos.service";
import { EventosReadinessService } from "./eventos-readiness.service";
import { MapasController } from "./mapas/mapas.controller";
import { MapasService } from "./mapas/mapas.service";
import { GeradorMapaPdf } from "./mapas/gerador/gerador-mapa-pdf";
import { EventosPublicSalesService } from "./eventos-public-sales.service";
import { EventosPagamentosService } from "./eventos-pagamentos.service";
import { EventosOfertasService } from "./eventos-ofertas.service";
import { EventosCortesiasController } from "./eventos-cortesias.controller";
import { EventosCortesiasService } from "./eventos-cortesias.service";
import { EventosExpirationJob } from "./jobs/eventos-expiration.job";
import { PaymentsModule } from "../payments/payments.module";
@Module({ imports: [AuthModule, DatabaseModule, StorageModule.forRoot(), forwardRef(() => PaymentsModule)], controllers: [EventosAdminController, EventosPublicController, MapasController, EventosCortesiasController], providers: [EventosRulesService, EventosService, EventosReadinessService, EventosPublicSalesService, EventosPagamentosService, EventosOfertasService, EventosCortesiasService, EventosExpirationJob, MapasService, GeradorMapaPdf], exports: [EventosRulesService, EventosService, EventosPublicSalesService, EventosPagamentosService, EventosOfertasService, MapasService] })
export class EventosModule {}
