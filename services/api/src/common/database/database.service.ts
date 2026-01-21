import { Injectable } from "@nestjs/common";
import { getDb, type Database } from "@essencia/db";

/**
 * DatabaseService
 *
 * Service wrapper para acesso ao banco de dados via Drizzle ORM.
 * Fornece instância do banco para uso nos módulos.
 */
@Injectable()
export class DatabaseService {
  private readonly _db: Database;

  constructor() {
    this._db = getDb();
  }

  /**
   * Retorna instância do Drizzle DB
   */
  get db(): Database {
    return this._db;
  }
}
