import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { StorageModule } from "./common/storage/storage.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { HealthModule } from "./modules/health/health.module";
import { PlanningsModule } from "./modules/plannings/plannings.module";
import { SchoolsModule } from "./modules/schools/schools.module";
import { SetupModule } from "./modules/setup/setup.module";
import { ShopModule } from "./modules/shop/shop.module";
import { StagesModule } from "./modules/stages/stages.module";
import { StatsModule } from "./modules/stats/stats.module";
import { TurmasModule } from "./modules/turmas/turmas.module";
import { UnitsModule } from "./modules/units/units.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env.local", ".env"],
    }),
    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60000, // 1 minuto
        limit: 20, // 20 requisições por minuto (padrão global)
      },
      {
        name: "strict",
        ttl: 3600000, // 1 hora
        limit: 5, // 5 requisições por hora (para endpoints críticos)
      },
    ]),
    HealthModule,
    SetupModule,
    AuthModule,
    CalendarModule,
    PlanningsModule,
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
