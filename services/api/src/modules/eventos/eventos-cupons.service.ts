import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, eventoAuditorias, eventoCupomRetencoes, eventoCupomUsos, eventoCupons, eventoPedidos, eventos, inArray, schema, sql, type Database } from "@essencia/db";

import type { AtualizarCupomInput } from "@essencia/shared/schemas";
import type { CupomAdmin, EventoActor } from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";

const normalizarCodigoCupom = (codigo: string) => codigo.trim().toUpperCase();
const normalizarEmail = (email: string) => email.trim().toLowerCase();
const normalizarTelefone = (phone: string) => phone.replace(/\D/g, "").slice(0, 30);
const eventoCupomRetencoesTabela = (eventoCupomRetencoes as any) ?? (schema as any)?.eventoCupomRetencoes;

type CompradorCupom = { email: string; phone: string };

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

  private async auditoria(db: any, coupon: any, action: string, orderId: string, metadata: Record<string, unknown>) {
    if (typeof db?.insert !== "function" || !coupon?.eventId) return;
    await db.insert(eventoAuditorias).values({ eventId: coupon.eventId, action, resourceType: "cupom", resourceId: coupon.id, metadata: { orderId, ...metadata } });
  }

  private async pedido(orderId: string, db: any) {
    if (typeof db?.select !== "function") return undefined;
    const rows = await db.select().from(eventoPedidos).where(eq(eventoPedidos.id, orderId));
    return (rows as any[]).find((row) => row.id === orderId) ?? rows[0];
  }

  private async cupomDoPedido(order: any, db: any, lock = true) {
    const snapshot = order?.couponSnapshot ?? order?.appliedCoupon ?? null;
    const couponId = order?.appliedCouponId ?? snapshot?.id;
    if (!couponId || typeof db?.select !== "function") return { coupon: undefined, snapshot };
    let query = db.select().from(eventoCupons).where(eq(eventoCupons.id, couponId));
    if (lock) query = this.lock<any>(query);
    const rows = await query;
    const coupon = (rows as any[]).find((row) => row.id === couponId) ?? rows[0];
    return { coupon, snapshot };
  }

  private validarSnapshot(coupon: any, snapshot: any, now: Date) {
    if (!coupon || !snapshot) throw new NotFoundException({ code: "COUPON_NOT_FOUND", message: "Cupom não encontrado" });
    // O snapshot congela preço, código e versão no pedido. A edição administrativa
    // do cupom cria uma nova versão, mas não pode invalidar carrinhos já aplicados.
    // A identidade continua obrigatória para impedir uso de snapshot de outro cupom.
    if (!coupon.id || !snapshot.id || String(coupon.id) !== String(snapshot.id)) {
      throw new ConflictException({ code: "COUPON_CHANGED", message: "O cupom mudou desde a aplicação no pedido" });
    }
    void now;
  }

  private validarVigencia(coupon: any, now: Date) {
    if (!coupon.active) throw new BadRequestException({ code: "COUPON_INACTIVE", message: "Cupom inativo" });
    if (coupon.startsAt && now < coupon.startsAt) throw new BadRequestException({ code: "COUPON_NOT_STARTED", message: "Cupom ainda não está válido" });
    if (coupon.endsAt && now >= coupon.endsAt) throw new BadRequestException({ code: "COUPON_EXPIRED", message: "Cupom expirado" });
  }

  async reterUso(orderId: string, checkoutKey: string, buyer: CompradorCupom, expiresAt: Date, db: Database = this.db): Promise<void> {
    const order = await this.pedido(orderId, db);
    if (!order || !["RESERVADO", "AGUARDANDO_PAGAMENTO"].includes(order.status)) {
      throw new ConflictException({ code: "ORDER_NOT_AVAILABLE", message: "Pedido indisponível para retenção do cupom" });
    }
    const { coupon, snapshot } = await this.cupomDoPedido(order, db, true);
    if (!coupon || !snapshot) return;
    const now = new Date();
    this.validarSnapshot(coupon, snapshot, now);
    const email = normalizarEmail(buyer.email);
    const phone = normalizarTelefone(buyer.phone);
    const retencoesQuery = db.select().from(eventoCupomRetencoesTabela).where(eq(eventoCupomRetencoesTabela.couponId, coupon.id));
    const usosQuery = db.select().from(eventoCupomUsos).where(eq(eventoCupomUsos.couponId, coupon.id));
    const retencoes = (await this.lock<any[]>(retencoesQuery)) as any[];
    const usos = (await this.lock<any[]>(usosQuery)) as any[];
    const own = retencoes.find((row) => row.orderId === orderId);
    if (own?.status === "ATIVA" || own?.status === "CONVERTIDA") {
      // A retenção é idempotente por pedido; a chave só identifica a tentativa
      // de checkout e não pode criar uma segunda retenção para a mesma ordem.
      return;
    }
    for (const row of retencoes.filter((candidate) => candidate.status === "ATIVA" && candidate.expiresAt && new Date(candidate.expiresAt) <= now)) {
      await db.update(eventoCupomRetencoesTabela).set({ status: "LIBERADA", releasedAt: now, updatedAt: now }).where(and(eq(eventoCupomRetencoesTabela.id, row.id), eq(eventoCupomRetencoesTabela.status, "ATIVA"))).returning();
      row.status = "LIBERADA";
    }
    const ativas = retencoes.filter((row) => row.status === "ATIVA" && (!row.expiresAt || new Date(row.expiresAt) > now));
    const confirmados = usos.filter((row) => row.status === "CONFIRMADO");
    if (coupon.usageLimit != null && ativas.length + confirmados.length >= Number(coupon.usageLimit)) throw new BadRequestException({ code: "COUPON_USAGE_LIMIT_REACHED", message: "Limite de uso do cupom esgotado" });
    if (coupon.usageLimitPerBuyer != null) {
      const sameBuyer = [...ativas, ...confirmados].filter((row) => row.orderId !== orderId && ((email && normalizarEmail(String(row.buyerEmail ?? "")) === email) || (phone && normalizarTelefone(String(row.buyerPhone ?? "")) === phone)));
      if (sameBuyer.length >= Number(coupon.usageLimitPerBuyer)) throw new BadRequestException({ code: "COUPON_BUYER_LIMIT_REACHED", message: "Limite de uso por comprador atingido" });
    }
    if (own?.status === "LIBERADA") {
      await db.update(eventoCupomRetencoesTabela).set({ status: "ATIVA", buyerEmail: email, buyerPhone: phone, expiresAt, releasedAt: null, updatedAt: now }).where(eq(eventoCupomRetencoesTabela.id, own.id)).returning();
      await this.auditoria(db, coupon, "RETENCAO_CRIADA", orderId, { checkoutKey, reativada: true });
      return;
    }
    await db.insert(eventoCupomRetencoesTabela).values({ couponId: coupon.id, orderId, status: "ATIVA", buyerEmail: email, buyerPhone: phone, expiresAt }).returning();
    await this.auditoria(db, coupon, "RETENCAO_CRIADA", orderId, { checkoutKey });
  }

  async confirmarUso(orderId: string, db: Database = this.db): Promise<void> {
    const order = await this.pedido(orderId, db);
    if (!order || !["AGUARDANDO_PAGAMENTO", "CONFIRMADO", "USADO"].includes(order.status)) return;
    const { coupon, snapshot } = await this.cupomDoPedido(order, db, true);
    if (!coupon || !snapshot) return;
    const retencoes = (await this.lock<any[]>(db.select().from(eventoCupomRetencoesTabela).where(eq(eventoCupomRetencoesTabela.couponId, coupon.id)))) as any[];
    const own = retencoes.find((row) => row.orderId === orderId);
    const usos = (await this.lock<any[]>(db.select().from(eventoCupomUsos).where(eq(eventoCupomUsos.couponId, coupon.id)))) as any[];
    const uso = usos.find((row) => row.orderId === orderId);
    if (uso?.status === "CONFIRMADO" || uso?.status === "REVERTIDO") return;
    if (!own || own.status !== "ATIVA") return;
    const now = new Date();
    if ((own.expiresAt && new Date(own.expiresAt) <= now) || (order.expiresAt && new Date(order.expiresAt) <= now)) {
      await db.update(eventoCupomRetencoesTabela).set({ status: "LIBERADA", releasedAt: now, updatedAt: now }).where(and(eq(eventoCupomRetencoesTabela.id, own.id), eq(eventoCupomRetencoesTabela.status, "ATIVA"))).returning();
      await this.auditoria(db, coupon, "RETENCAO_LIBERADA", orderId, { motivo: "retencao_expirada" });
      throw new BadRequestException({ code: "COUPON_RETENTION_EXPIRED", message: "A retenção do cupom expirou" });
    }
    this.validarSnapshot(coupon, snapshot, now);
    await db.update(eventoCupomRetencoesTabela).set({ status: "CONVERTIDA", convertedAt: now, updatedAt: now }).where(and(eq(eventoCupomRetencoesTabela.id, own.id), eq(eventoCupomRetencoesTabela.status, "ATIVA"))).returning();
    await db.insert(eventoCupomUsos).values({ couponId: coupon.id, orderId, status: "CONFIRMADO", buyerEmail: own.buyerEmail, buyerPhone: own.buyerPhone, discountCents: Number(order?.couponDiscountCents ?? 0), couponSnapshot: snapshot, confirmedAt: now }).returning();
    await this.auditoria(db, coupon, "USO_CONFIRMADO", orderId, { discountCents: Number(order?.couponDiscountCents ?? 0) });
  }

  async liberarRetencao(orderId: string, motivo: string, db: Database = this.db): Promise<void> {
    const order = await this.pedido(orderId, db);
    const { coupon } = await this.cupomDoPedido(order, db, true);
    if (!coupon) return;
    const retencoes = (await this.lock<any[]>(db.select().from(eventoCupomRetencoesTabela).where(eq(eventoCupomRetencoesTabela.couponId, coupon.id)))) as any[];
    const own = retencoes.find((row) => row.orderId === orderId);
    if (!own || own.status !== "ATIVA") return;
    const now = new Date();
    await db.update(eventoCupomRetencoesTabela).set({ status: "LIBERADA", releasedAt: now, updatedAt: now }).where(and(eq(eventoCupomRetencoesTabela.id, own.id), eq(eventoCupomRetencoesTabela.status, "ATIVA"))).returning();
    await this.auditoria(db, coupon, "RETENCAO_LIBERADA", orderId, { motivo });
  }

  async reverterUso(orderId: string, motivo: string, db: Database = this.db): Promise<void> {
    const order = await this.pedido(orderId, db);
    const { coupon } = await this.cupomDoPedido(order, db, true);
    if (!coupon) return;
    const usos = (await this.lock<any[]>(db.select().from(eventoCupomUsos).where(eq(eventoCupomUsos.couponId, coupon.id)))) as any[];
    const uso = usos.find((row) => row.orderId === orderId);
    if (!uso || uso.status !== "CONFIRMADO") return;
    const now = new Date();
    await db.update(eventoCupomUsos).set({ status: "REVERTIDO", revertedAt: now, updatedAt: now }).where(and(eq(eventoCupomUsos.id, uso.id), eq(eventoCupomUsos.status, "CONFIRMADO"))).returning();
    await this.auditoria(db, coupon, "USO_REVERTIDO", orderId, { motivo });
  }

  async reverterUsoPorPedido(orderId: string, motivo: string, db: Database = this.db): Promise<void> {
    await this.reverterUso(orderId, motivo, db);
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
          const result = await tx.update(eventoCupons).set({ ...values, updatedAt: new Date() }).where(and(eq(eventoCupons.id, previous.id), eq(eventoCupons.eventId, eventId), eq(eventoCupons.version, previous.version))).returning();
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
      const counts = await this.usos(saved, tx);
      return saved.map((summary) => ({ ...summary, confirmedUses: counts.get(summary.id) ?? 0 }));
    });
  }

  async remover(eventId: string, couponId: string, actor: EventoActor): Promise<void> {
    await this.transaction(async (tx) => {
      await this.evento(eventId, actor, tx, true);
      const rows = await this.lock<any[]>(tx.select().from(eventoCupons).where(and(eq(eventoCupons.id, couponId), eq(eventoCupons.eventId, eventId))));
      const coupon = rows[0];
      if (!coupon) throw new NotFoundException({ code: "COUPON_NOT_FOUND", message: "Cupom não encontrado" });
      const counts = await this.usos([coupon], tx);
      if ((counts.get(coupon.id) ?? 0) > 0) throw new ConflictException({ code: "COUPON_IN_USE", message: "Cupom usado não pode ser excluído" });
      await tx.delete(eventoCupons).where(and(eq(eventoCupons.id, couponId), eq(eventoCupons.eventId, eventId)));
      await tx.insert(eventoAuditorias).values({ eventId, actorId: actor.userId, actorRole: actor.role, action: "EXCLUIDO", resourceType: "cupom", resourceId: coupon.id, version: coupon.version, metadata: { code: coupon.code } });
    });
  }
}
