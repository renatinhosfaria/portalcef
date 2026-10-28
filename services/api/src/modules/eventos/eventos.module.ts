import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../../common/database/database.module";
import { EventosAdminController } from "./eventos-admin.controller";
import { EventosPublicController } from "./eventos-public.controller";
import { EventosRulesService } from "./eventos-rules.service";
import { EventosService } from "./eventos.service";
@Module({ imports: [AuthModule, DatabaseModule], controllers: [EventosAdminController, EventosPublicController], providers: [EventosRulesService, EventosService], exports: [EventosRulesService, EventosService] })
export class EventosModule {}
