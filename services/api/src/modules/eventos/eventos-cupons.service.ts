import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, eventoAuditorias, eventoCupomUsos, eventoCupons, eventos, inArray, sql, type Database } from "@essencia/db";

import type { AtualizarCupomInput } from "@essencia/shared/schemas";
import type { CupomAdmin, EventoActor } from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";

const normalizarCodigoCupom = (codigo: string) => codigo.trim().toUpperCase();

@Injectable()
export class EventosCuponsService {
  constructor(private readonly database: DatabaseService) {}
  private get db(): Database { return this.database.db; }
  private async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    const transaction = (this.db as any).transaction;
    return typeof transaction === "function" ? transaction.call(this.db, fn) : fn(this.db);
  }
  private async lock<T>(query: any): Promise<T> { return typeof query?.for === "function" ? query.for("update") : query; }
  private assertScope(actor: EventoActor, schoolId: string) {
    if (actor.role !== "master" && (!actor.schoolId || actor.schoolId !== schoolId)) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });
  }
  private async evento(eventId: string, actor: EventoActor, db: Database = this.db, lock = false) {
    const query = db.select().from(eventos).where(eq(eventos.id, eventId));
    const rows = await this.lock<any[]>(lock ? query : Promise.resolve(query));
    const event = rows[0];
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    this.assertScope(actor, event.schoolId);
    return event;
  }
  private validar(input: AtualizarCupomInput) {
    const code = normalizarCodigoCupom(input.code);
    if (!code) throw new BadRequestException({ code: "INVALID_COUPON_CODE", message: "Informe um código de cupom" });
    if (input.pricingType === "PERCENTUAL" && (input.discountPercent == null || !Number.isInteger(input.discountPercent) || input.discountPercent < 1 || input.discountPercent > 100)) throw new BadRequestException({ code: "INVALID_COUPON_DISCOUNT", message: "Percentual inválido" });
    if (input.pricingType === "VALOR_FIXO" && (input.discountCents == null || !Number.isInteger(input.discountCents) || input.discountCents < 0)) throw new BadRequestException({ code: "INVALID_COUPON_DISCOUNT", message: "Valor do cupom inválido" });
    if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new BadRequestException({ code: "INVALID_COUPON_PERIOD", message: "O fim deve ser posterior ao início" });
    if (input.usageLimit != null && (!Number.isInteger(input.usageLimit) || input.usageLimit <= 0)) throw new BadRequestException({ code: "INVALID_COUPON_LIMIT", message: "Limite de uso inválido" });
    if (input.usageLimitPerBuyer != null && (!Number.isInteger(input.usageLimitPerBuyer) || input.usageLimitPerBuyer <= 0)) throw new BadRequestException({ code: "INVALID_COUPON_LIMIT", message: "Limite por comprador inválido" });
    return code;
  }
  private resumo(row: any, confirmedUses = 0): CupomAdmin {
    return { id: row.id, version: row.version, code: normalizarCodigoCupom(row.code), name: row.name ?? null, pricingType: row.pricingType, discountPercent: row.discountPercent ?? null, discountCents: row.discountCents ?? null, active: row.active, startsAt: row.startsAt ?? null, endsAt: row.endsAt ?? null, usageLimit: row.usageLimit ?? null, usageLimitPerBuyer: row.usageLimitPerBuyer ?? null, confirmedUses };
  }
  private async usos(coupons: any[], db: Database = this.db): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!coupons.length) return counts;
    const ids = coupons.map((row) => row.id);
    const rows = await db.select({ couponId: eventoCupomUsos.couponId, confirmedUses: sql<number>`count(*)::int` }).from(eventoCupomUsos).where(and(inArray(eventoCupomUsos.couponId, ids), eq(eventoCupomUsos.status, "CONFIRMADO"))).groupBy(eventoCupomUsos.couponId);
    for (const row of rows as any[]) counts.set(row.couponId, Number(row.confirmedUses) || 0);
    return counts;
  }
  async listarAdmin(eventId: string, actor: EventoActor): Promise<CupomAdmin[]> {
    await this.evento(eventId, actor);
    const rows = await this.db.select().from(eventoCupons).where(eq(eventoCupons.eventId, eventId));
    const counts = await this.usos(rows as any[]);
    return (rows as any[]).map((row) => this.resumo(row, counts.get(row.id) ?? 0));
  }
  async atualizar(eventId: string, inputs: AtualizarCupomInput[], actor: EventoActor): Promise<CupomAdmin[]> {
    const codes = inputs.map((input) => this.validar(input));
    if (new Set(codes).size !== codes.length) throw new BadRequestException({ code: "DUPLICATE_COUPON_CODE", message: "Não repita o mesmo código de cupom" });
    const ids = inputs.flatMap((input) => input.id ? [input.id] : []);
    if (new Set(ids).size !== ids.length) throw new BadRequestException({ code: "DUPLICATE_COUPON_ID", message: "Não repita o mesmo id de cupom" });
    return this.transaction(async (tx) => {
      await this.evento(eventId, actor, tx, true);
      const existingRows = await this.lock<any[]>(tx.select().from(eventoCupons).where(eq(eventoCupons.eventId, eventId)));
      const existing = existingRows as any[];
      const byId = new Map(existing.map((row) => [row.id, row]));
      for (const input of inputs) {
        if (input.id && !byId.has(input.id)) throw new NotFoundException({ code: "COUPON_NOT_FOUND", message: "Cupom não encontrado" });
        if (input.id && input.version === undefined) throw new BadRequestException({ code: "COUPON_VERSION_REQUIRED", message: "Informe a versão atual do cupom para atualizar" });
        const previous = input.id ? byId.get(input.id) : undefined;
        if (previous && input.version !== previous.version) throw new ConflictException({ code: "VERSION_CONFLICT", message: "O cupom foi alterado por outra pessoa", current: this.resumo(previous) });
        const collision = existing.find((row) => normalizarCodigoCupom(row.code) === codes[inputs.indexOf(input)] && row.id !== input.id);
        if (collision) throw new ConflictException({ code: "DUPLICATE_COUPON_CODE", message: "Já existe um cupom com este código" });
      }
      const saved: any[] = [];
      for (let index = 0; index < inputs.length; index += 1) {
        const input = inputs[index];
        const previous = input.id ? byId.get(input.id) : undefined;
        const values = { eventId, code: codes[index], name: input.name === undefined ? (previous?.name ?? null) : (input.name?.trim() || null), pricingType: input.pricingType, discountPercent: input.pricingType === "PERCENTUAL" ? input.discountPercent : null, discountCents: input.pricingType === "VALOR_FIXO" ? input.discountCents : null, startsAt: input.startsAt === undefined ? (previous?.startsAt ?? null) : input.startsAt, endsAt: input.endsAt === undefined ? (previous?.endsAt ?? null) : input.endsAt, usageLimit: input.usageLimit === undefined ? (previous?.usageLimit ?? null) : input.usageLimit, usageLimitPerBuyer: input.usageLimitPerBuyer === undefined ? (previous?.usageLimitPerBuyer ?? null) : input.usageLimitPerBuyer, version: previous ? previous.version + 1 : 1, active: input.active !== false };
        let row: any;
        if (previous) {
          const updateQuery = tx.update(eventoCupons).set({ ...values, updatedAt: new Date() }).where(and(eq(eventoCupons.id, previous.id), eq(eventoCupons.eventId, eventId), eq(eventoCupons.version, previous.version)));
          const awaitedUpdate = await updateQuery;
          const result = typeof awaitedUpdate?.returning === "function" ? await awaitedUpdate.returning() : (typeof updateQuery?.returning === "function" ? await updateQuery.returning() : awaitedUpdate);
          row = result?.[0];
          if (!row) throw new ConflictException({ code: "VERSION_CONFLICT", message: "O cupom foi alterado por outra pessoa" });
        } else {
          const result = await tx.insert(eventoCupons).values(values).returning();
          row = result[0];
        }
        if (!row) throw new BadRequestException({ code: "COUPON_SAVE_FAILED", message: "Não foi possível salvar o cupom" });
        const summary = this.resumo(row, 0); saved.push(summary);
        await tx.insert(eventoAuditorias).values({ eventId, actorId: actor.userId, actorRole: actor.role, action: "ATUALIZADO", resourceType: "cupom", resourceId: row.id, version: summary.version, metadata: { code: summary.code, active: summary.active } });
      }
      return saved;
    });
  }
}
