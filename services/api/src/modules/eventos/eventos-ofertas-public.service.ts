import { ConflictException, Injectable } from "@nestjs/common";
import { and, eq, eventoOfertas } from "@essencia/db";
import type { OfertaPrecoPublica } from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";

/**
 * Leitor interno do contrato público de ofertas.
 *
 * A configuração administrativa foi removida na Task 2, mas a leitura usada
 * pelo detalhe público permanece até a Task 3 remover seus consumidores.
 */
@Injectable()
export class EventosOfertasPublicService {
  constructor(private readonly database: DatabaseService) {}

  async listarPublicas(eventId: string): Promise<OfertaPrecoPublica[]> {
    const rows = await this.database.db
      .select()
      .from(eventoOfertas)
      .where(and(eq(eventoOfertas.eventId, eventId), eq(eventoOfertas.active, true)));
    const ativas = (rows as (typeof eventoOfertas.$inferSelect)[]).filter((row) => row.active);
    if (ativas.length > 1) {
      throw new ConflictException({
        code: "MULTIPLE_ACTIVE_OFFERS",
        message: "Mais de uma oferta ativa para o evento",
      });
    }
    return ativas
      .filter((row) => row.pricingType === "PERCENTUAL")
      .map((row) => ({
        id: row.id,
        version: row.version,
        name: row.name,
        minQuantity: row.minQuantity,
        maxQuantity: row.maxQuantity,
        discountPercent: row.discountPercent,
      }));
  }
}
