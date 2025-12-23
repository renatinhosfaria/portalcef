import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { SchoolsModule } from "./modules/schools/schools.module";
import { UnitsModule } from "./modules/units/units.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env.local", ".env"],
    }),
    HealthModule,
    AuthModule,
    SchoolsModule,
    UnitsModule,
    UsersModule,
  ],
})
export class AppModule {}
