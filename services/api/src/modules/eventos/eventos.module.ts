import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../../common/database/database.module";
import { StorageModule } from "../../common/storage/storage.module";
import { EventosAdminController } from "./eventos-admin.controller";
import { EventosPublicController } from "./eventos-public.controller";
import { EventosRulesService } from "./eventos-rules.service";
import { EventosService } from "./eventos.service";
import { MapasController } from "./mapas/mapas.controller";
import { MapasService } from "./mapas/mapas.service";
import { MapDetector } from "./mapas/map-detector";
import { EventosPublicSalesService } from "./eventos-public-sales.service";
@Module({ imports: [AuthModule, DatabaseModule, StorageModule.forRoot()], controllers: [EventosAdminController, EventosPublicController, MapasController], providers: [EventosRulesService, EventosService, EventosPublicSalesService, MapasService, MapDetector], exports: [EventosRulesService, EventosService, EventosPublicSalesService, MapasService] })
export class EventosModule {}
