import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  eq,
  eventoAuditorias,
  eventoOfertas,
  eventos,
  type Database,
} from "@essencia/db";
import type { AtualizarOfertaInput } from "@essencia/shared/schemas";
import type {
  EventoActor,
  EventoOfertaAdmin,
  OfertaPrecoPublica,
} from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";

@Injectable()
export class EventosOfertasService {
  constructor(private readonly database: DatabaseService) {}

  private get db(): Database {
    return this.database.db;
  }

  private assertSchoolScope(actor: EventoActor, schoolId: string) {
    if (actor.role === "master") return;
    if (!actor.schoolId || actor.schoolId !== schoolId)
      throw new BadRequestException({
        code: "FORBIDDEN",
        message: "Acesso negado",
      });
  }

  private async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    const transaction = (this.db as any).transaction;
    return typeof transaction === "function"
      ? transaction.call(this.db, fn)
      : fn(this.db);
  }

  private async lockRows<T>(query: any): Promise<T> {
    return typeof query?.for === "function" ? query.for("update") : query;
  }

  private async carregarEvento(
    eventId: string,
    actor?: EventoActor,
    db: Database = this.db,
    lock = false,
  ) {
    const query = db.select().from(eventos).where(eq(eventos.id, eventId));
    const rows = await this.lockRows<(typeof eventos.$inferSelect)[]>(
      lock ? query : Promise.resolve(query),
    );
    const event = rows[0] as typeof eventos.$inferSelect | undefined;
    if (!event)
      throw new NotFoundException({
        code: "EVENT_NOT_FOUND",
        message: "Evento não encontrado",
      });
    if (actor) this.assertSchoolScope(actor, event.schoolId);
    return event;
  }

  private resumo(row: typeof eventoOfertas.$inferSelect): EventoOfertaAdmin {
    return {
      id: row.id,
      version: row.version,
      name: row.name,
      minQuantity: row.minQuantity,
      maxQuantity: row.maxQuantity,
      discountPercent: row.discountPercent,
      pricingType: row.pricingType as EventoOfertaAdmin["pricingType"],
      priceCents: row.priceCents,
      compatibleTicketTypeIds: (row.compatibleTicketTypeIds as string[] | null) ?? null,
      active: row.active,
    };
  }

  private validarInput(input: AtualizarOfertaInput) {
    if (!Number.isInteger(input.minQuantity) || input.minQuantity <= 0) {
      throw new BadRequestException({
        code: "INVALID_OFFER_RANGE",
        message: "A quantidade mínima deve ser positiva",
      });
    }
    if (
      input.maxQuantity !== null &&
      input.maxQuantity !== undefined &&
      (!Number.isInteger(input.maxQuantity) ||
        input.maxQuantity < input.minQuantity)
    ) {
      throw new BadRequestException({
        code: "INVALID_OFFER_RANGE",
        message: "A quantidade máxima deve ser maior ou igual à mínima",
      });
    }
    if (input.pricingType === "PERCENTUAL") {
      const discountPercent = input.discountPercent;
      if (
        typeof discountPercent !== "number" ||
        !Number.isInteger(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100
      ) {
        throw new BadRequestException({
          code: "INVALID_DISCOUNT_PERCENT",
          message: "O percentual deve estar entre 0 e 100",
        });
      }
    } else {
      const priceCents = input.priceCents;
      if (
        typeof priceCents !== "number" ||
        !Number.isInteger(priceCents) ||
        priceCents < 0
      ) {
        throw new BadRequestException({
          code: "INVALID_OFFER_PRICE",
          message: "Informe um preço fixo não negativo",
        });
      }
    }
  }

  async listarAdmin(
    eventId: string,
    actor: EventoActor,
  ): Promise<EventoOfertaAdmin[]> {
    await this.carregarEvento(eventId, actor);
    const rows = await this.db
      .select()
      .from(eventoOfertas)
      .where(eq(eventoOfertas.eventId, eventId));
    return (rows as (typeof eventoOfertas.$inferSelect)[]).map((row) =>
      this.resumo(row),
    );
  }

  async atualizar(
    eventId: string,
    inputs: AtualizarOfertaInput[],
    actor: EventoActor,
  ): Promise<EventoOfertaAdmin[]> {
    inputs.forEach((input) => this.validarInput(input));
    const ids = inputs.flatMap((input) => (input.id ? [input.id] : []));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        code: "DUPLICATE_OFFER_ID",
        message: "Não repita o mesmo id de oferta na atualização",
      });
    }
    const ativasSolicitadas = inputs.filter((input) => input.active !== false);
    if (ativasSolicitadas.length > 1) {
      throw new BadRequestException({
        code: "MULTIPLE_ACTIVE_OFFERS",
        message: "Apenas uma oferta ativa é permitida por evento",
      });
    }

    return this.transaction(async (tx) => {
      await this.carregarEvento(eventId, actor, tx, true);
      const existingQuery = tx
        .select()
        .from(eventoOfertas)
        .where(eq(eventoOfertas.eventId, eventId));
      const existingRows =
        await this.lockRows<(typeof eventoOfertas.$inferSelect)[]>(
          existingQuery,
        );
      const existing = existingRows as (typeof eventoOfertas.$inferSelect)[];
      const byId = new Map(existing.map((row) => [row.id, row]));
      for (const input of inputs) {
        if (input.id && !byId.has(input.id)) {
          throw new NotFoundException({
            code: "OFFER_NOT_FOUND",
            message: "Oferta não encontrada",
          });
        }
      }

      if (existing.some((row) => row.active)) {
        await tx
          .update(eventoOfertas)
          .set({ active: false, updatedAt: new Date() })
          .where(
            and(
              eq(eventoOfertas.eventId, eventId),
              eq(eventoOfertas.active, true),
            ),
          );
      }

      const created: EventoOfertaAdmin[] = [];
      for (const input of inputs) {
        const previous = input.id ? byId.get(input.id) : undefined;
        const values = {
          eventId,
          name: input.name.trim(),
          minQuantity: input.minQuantity,
          maxQuantity: input.maxQuantity ?? null,
          pricingType: input.pricingType,
          discountPercent:
            input.pricingType === "PERCENTUAL"
              ? (input.discountPercent ?? null)
              : null,
          priceCents:
            input.pricingType === "VALOR_FIXO"
              ? (input.priceCents ?? null)
              : null,
          compatibleTicketTypeIds:
            input.compatibleTicketTypeIds === undefined
              ? ((previous?.compatibleTicketTypeIds as string[] | null) ?? null)
              : input.compatibleTicketTypeIds,
          version: previous ? previous.version + 1 : 1,
          active: input.active !== false,
        } as const;
        const [row] = await tx.insert(eventoOfertas).values(values).returning();
        if (!row)
          throw new BadRequestException({
            code: "OFFER_CREATE_FAILED",
            message: "Não foi possível salvar a oferta",
          });
        const resumo = this.resumo(row as typeof eventoOfertas.$inferSelect);
        created.push(resumo);
        if (typeof (tx as any).insert === "function") {
          await tx.insert(eventoAuditorias).values({
            eventId,
            actorId: actor.userId,
            actorRole: actor.role,
            action: "ATUALIZADO",
            resourceType: "oferta",
            resourceId: row.id,
            metadata: { version: resumo.version, active: resumo.active },
          });
        }
      }
      return created;
    });
  }

  async listarPublicas(eventId: string): Promise<OfertaPrecoPublica[]> {
    const rows = await this.db
      .select()
      .from(eventoOfertas)
      .where(
        and(eq(eventoOfertas.eventId, eventId), eq(eventoOfertas.active, true)),
      );
    return (rows as (typeof eventoOfertas.$inferSelect)[])
      .filter((row) => row.pricingType === "PERCENTUAL" && row.active)
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
