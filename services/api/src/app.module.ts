import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { DatabaseModule } from "./common/database/database.module";
import { StorageModule } from "./common/storage/storage.module";
import { DocumentosConversaoModule } from "./common/queues/documentos-conversao.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { HealthModule } from "./modules/health/health.module";
import { PlanoAulaModule } from "./modules/plano-aula/plano-aula.module";
import { PlanningsModule } from "./modules/plannings/plannings.module";
import { SchoolsModule } from "./modules/schools/schools.module";
import { SetupModule } from "./modules/setup/setup.module";
import { ShopModule } from "./modules/shop/shop.module";
import { StagesModule } from "./modules/stages/stages.module";
import { StatsModule } from "./modules/stats/stats.module";
import { TurmasModule } from "./modules/turmas/turmas.module";
import { UnitsModule } from "./modules/units/units.module";
import { UsersModule } from "./modules/users/users.module";
import { QuinzenaDocumentsModule } from "./modules/quinzena-documents/quinzena-documents.module";
import { TarefasModule } from "./modules/tarefas/tarefas.module";
import { SecurityModule } from "./modules/security/security.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env.local", ".env"],
    }),
    // Event Emitter - Sistema de eventos global
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: ".",
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    // Rate Limiting - Desabilitado em dev (limites muito altos)
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60000, // 1 minuto
        limit: 10000, // 10000 requisições por minuto (praticamente desabilitado em dev)
      },
      {
        name: "strict",
        ttl: 3600000, // 1 hora
        limit: 1000, // 1000 requisições por hora (desabilitado em dev)
      },
    ]),
    // Database (global module)
    DatabaseModule,
    // Filas (BullMQ)
    DocumentosConversaoModule,
    HealthModule,
    SecurityModule,
    SetupModule,
    AuthModule,
    CalendarModule,
    PlanningsModule,
    // Novo workflow de Plano de Aula
    PlanoAulaModule,
    SchoolsModule,
    ShopModule,
    StagesModule,
    TurmasModule,
    UnitsModule,
    UsersModule,
    // Dashboard stats
    StatsModule,
    // Storage (conditional - only loads if MinIO is configured)
    StorageModule.forRoot(),
    // Documentos de Quinzena (upload de planos de aula)
    QuinzenaDocumentsModule,
    // Sistema de Tarefas
    TarefasModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplica CorrelationIdMiddleware em todas as rotas
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
