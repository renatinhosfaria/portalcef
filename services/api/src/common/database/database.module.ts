import { Module, Global } from "@nestjs/common";
import { DatabaseService } from "./database.service";

/**
 * DatabaseModule
 *
 * Módulo global que fornece acesso ao banco de dados via DatabaseService.
 * Disponível em toda a aplicação sem necessidade de importação explícita.
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
