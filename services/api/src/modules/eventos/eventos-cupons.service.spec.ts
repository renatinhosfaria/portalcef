import { BadRequestException } from "@nestjs/common";
import { eventoAuditorias, eventoCupons, eventoCupomRetencoes, eventoCupomUsos, eventoPedidos } from "@essencia/db";
import type { EventoActor } from "@essencia/shared/types";
import { EventosCuponsService } from "./eventos-cupons.service";
import { EventosAdminController } from "./eventos-admin.controller";
import { EVENTOS_ADMIN_ROLES } from "./eventos.constants";
import { EXACT_ROLES_KEY, ROLES_KEY } from "../../common/decorators/roles.decorator";

const actor: EventoActor = { userId: "u1", role: "diretora_geral", schoolId: "s1" };
const evento = (extra: Record<string, unknown> = {}) => ({ id: "e1", schoolId: "s1", ...extra });
const cupom = (extra: Record<string, unknown> = {}) => ({ id: "c1", eventId: "e1", code: "DEZ", name: "Dez por cento", pricingType: "PERCENTUAL", discountPercent: 10, discountCents: null, startsAt: null, endsAt: null, usageLimit: 10, usageLimitPerBuyer: 1, version: 1, active: true, ...extra });

describe("EventosCuponsService", () => {
  it("expõe as rotas administrativas de cupons com o contrato de proteção", () => {
    const proto = EventosAdminController.prototype as any;
    expect(typeof proto.coupons).toBe("function");
    expect(typeof proto.updateCoupons).toBe("function");
    expect(Reflect.getMetadata(ROLES_KEY, EventosAdminController)).toEqual(EVENTOS_ADMIN_ROLES);
    expect(Reflect.getMetadata(EXACT_ROLES_KEY, EventosAdminController)).toBe(true);
  });

  it("recusa evento fora do escopo da escola", async () => {
    await expect(service(fakeDb({ selects: [[evento({ schoolId: "s2" })]] })).listarAdmin("e1", actor)).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
  });

  it("normaliza código, cria vários cupons e resume usos confirmados", async () => {
    const inserted: any[] = [];
    const db = fakeDb({ selects: [[evento()], []], insert: (values) => { inserted.push(values); return [{ id: `c${inserted.length}`, ...values }]; } });
    const result = await service(db).atualizar("e1", [
      { code: " dez ", name: " Dez ", pricingType: "PERCENTUAL", discountPercent: 10 },
      { code: "fixo", pricingType: "VALOR_FIXO", discountCents: 500, active: false },
    ] as any, actor);
    expect(inserted).toEqual(expect.arrayContaining([expect.objectContaining({ code: "DEZ", name: "Dez" }), expect.objectContaining({ code: "FIXO", active: false })]));
    expect(result).toHaveLength(2);
  });

  it("recusa código duplicado normalizado, datas e limites inválidos", async () => {
    const db = fakeDb({ selects: [[evento()], []] });
    await expect(service(db).atualizar("e1", [{ code: " dez ", pricingType: "PERCENTUAL", discountPercent: 10 }, { code: "DEZ", pricingType: "PERCENTUAL", discountPercent: 20 }] as any, actor)).rejects.toMatchObject({ response: { code: "DUPLICATE_COUPON_CODE" } });
    await expect(service(db).atualizar("e1", [{ code: "x", pricingType: "PERCENTUAL", discountPercent: 10, startsAt: new Date("2026-02-02"), endsAt: new Date("2026-02-01") }] as any, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service(db).atualizar("e1", [{ code: "x", pricingType: "PERCENTUAL", discountPercent: 10, usageLimit: 0 }] as any, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("versiona edição, permite desativar, não apaga e audita", async () => {
    const updated: any[] = [];
    const db = fakeDb({ selects: [[evento()], [cupom()], [{ couponId: "c1", confirmedUses: 3 }]], update: (values) => { updated.push(values); return [{ ...cupom(), ...values, version: 2 }]; } });
    const result = await service(db).atualizar("e1", [{ id: "c1", version: 1, code: "dez", pricingType: "PERCENTUAL", discountPercent: 20, active: false }] as any, actor);
    expect(result[0]).toMatchObject({ id: "c1", code: "DEZ", version: 2, active: false, discountPercent: 20, confirmedUses: 3 });
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ version: 2, active: false });
    expect(db.audit).toEqual(expect.arrayContaining([expect.objectContaining({ resourceType: "cupom", action: "ATUALIZADO", version: 2 })]));
  });

  it("lista usos confirmados sem expor retenções", async () => {
    const db = fakeDb({ selects: [[evento()], [cupom(), cupom({ id: "c2", code: "FIXO" })], [{ couponId: "c1", confirmedUses: 4 }]] });
    await expect(service(db).listarAdmin("e1", actor)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: "c1", confirmedUses: 4 }), expect.objectContaining({ id: "c2", confirmedUses: 0 })]));
  });

  it("recusa versão obsoleta antes de atualizar", async () => {
    const db = fakeDb({ selects: [[evento()], [cupom({ version: 3 })]], update: () => { throw new Error("não deveria atualizar"); } });
    await expect(service(db).atualizar("e1", [{ id: "c1", version: 2, code: "dez", pricingType: "PERCENTUAL", discountPercent: 20 }] as any, actor)).rejects.toMatchObject({ response: { code: "VERSION_CONFLICT" } });
  });

  it("retém uso com contatos normalizados e converte a retenção uma única vez", async () => {
    const db = cupomUsoDb({
      order: { id: "order-1", appliedCouponId: "coupon-1", couponSnapshot: { id: "coupon-1", code: "DEZ", version: 1, pricingType: "PERCENTUAL", discountPercent: 10 } },
      coupon: { id: "coupon-1", eventId: "event-1", code: "DEZ", version: 1, pricingType: "PERCENTUAL", discountPercent: 10, active: true, usageLimit: 2, usageLimitPerBuyer: 1, startsAt: null, endsAt: null },
    });
    const expiresAt = new Date("2026-11-13T15:00:00Z");
    const cupons = service(db);

    await cupons.reterUso("order-1", "checkout-1", { email: " Ana@EXAMPLE.com ", phone: "+55 (11) 99999-9999" }, expiresAt, db as any);
    await cupons.reterUso("order-1", "checkout-1", { email: "outra@example.com", phone: "11988888888" }, expiresAt, db as any);

    expect(db.retencoes).toHaveLength(1);
    expect(db.retencoes[0]).toMatchObject({ status: "ATIVA", buyerEmail: "ana@example.com", buyerPhone: "5511999999999", expiresAt });

    await cupons.confirmarUso("order-1", db as any);
    await cupons.confirmarUso("order-1", db as any);
    expect(db.usos).toHaveLength(1);
    expect(db.usos[0]).toMatchObject({ couponId: "coupon-1", orderId: "order-1", status: "CONFIRMADO", buyerEmail: "ana@example.com", buyerPhone: "5511999999999" });
    expect(db.retencoes[0].status).toBe("CONVERTIDA");
  });

  it("considera retenções ativas e usos confirmados no limite total", async () => {
    const db = cupomUsoDb({
      order: { id: "order-3", appliedCouponId: "coupon-1", couponSnapshot: { id: "coupon-1", code: "DEZ", version: 1, pricingType: "PERCENTUAL", discountPercent: 10 } },
      coupon: { id: "coupon-1", eventId: "event-1", code: "DEZ", version: 1, pricingType: "PERCENTUAL", discountPercent: 10, active: true, usageLimit: 2, usageLimitPerBuyer: null, startsAt: null, endsAt: null },
      retencoes: [{ id: "ret-1", couponId: "coupon-1", orderId: "order-2", status: "ATIVA", buyerEmail: "a@example.com", buyerPhone: "5511999999999", expiresAt: new Date("2026-11-14T16:00:00Z") }],
      usos: [{ id: "use-1", couponId: "coupon-1", orderId: "order-confirmado", status: "CONFIRMADO", buyerEmail: "b@example.com", buyerPhone: "5511888888888", discountCents: 100, couponSnapshot: {} }],
    });

    await expect(service(db).reterUso("order-3", "checkout-3", { email: "c@example.com", phone: "5511777777777" }, new Date("2026-11-14T16:00:00Z"), db as any)).rejects.toMatchObject({ response: { code: "COUPON_USAGE_LIMIT_REACHED" } });
    expect(db.retencoes).toHaveLength(1);
  });

  it("aplica limite por e-mail ou telefone e libera retenção sem duplicar auditoria", async () => {
    const db = cupomUsoDb({
      order: { id: "order-4", appliedCouponId: "coupon-1", couponSnapshot: { id: "coupon-1", code: "DEZ", version: 1, pricingType: "PERCENTUAL", discountPercent: 10 } },
      coupon: { id: "coupon-1", eventId: "event-1", code: "DEZ", version: 1, pricingType: "PERCENTUAL", discountPercent: 10, active: true, usageLimit: null, usageLimitPerBuyer: 1, startsAt: null, endsAt: null },
      usos: [{ id: "use-1", couponId: "coupon-1", orderId: "order-confirmado", status: "CONFIRMADO", buyerEmail: "outro@example.com", buyerPhone: "5511999999999", discountCents: 100, couponSnapshot: {} }],
    });
    const cupons = service(db);
    await expect(cupons.reterUso("order-4", "checkout-4", { email: "novo@example.com", phone: "+55 11 99999-9999" }, new Date("2026-11-14T16:00:00Z"), db as any)).rejects.toMatchObject({ response: { code: "COUPON_BUYER_LIMIT_REACHED" } });

    db.usos[0].buyerPhone = "5511666666666";
    await cupons.reterUso("order-4", "checkout-4", { email: "novo@example.com", phone: "+55 11 99999-9999" }, new Date("2026-11-14T16:00:00Z"), db as any);
    await cupons.liberarRetencao("order-4", "checkout_failed", db as any);
    await cupons.liberarRetencao("order-4", "checkout_failed", db as any);
    expect(db.retencoes[0]).toMatchObject({ status: "LIBERADA", releasedAt: expect.any(Date) });
    expect(db.audit.filter((entry: any) => entry.action === "RETENCAO_LIBERADA")).toHaveLength(1);
  });

  it("reverte uso confirmado de forma idempotente", async () => {
    const db = cupomUsoDb({
      order: { id: "order-5", appliedCouponId: "coupon-1", couponSnapshot: { id: "coupon-1", code: "DEZ", version: 1, pricingType: "PERCENTUAL", discountPercent: 10 } },
      coupon: { id: "coupon-1", eventId: "event-1", code: "DEZ", version: 1, pricingType: "PERCENTUAL", discountPercent: 10, active: true, usageLimit: null, usageLimitPerBuyer: null, startsAt: null, endsAt: null },
      usos: [{ id: "use-5", couponId: "coupon-1", orderId: "order-5", status: "CONFIRMADO", buyerEmail: "a@example.com", buyerPhone: "5511999999999", discountCents: 100, couponSnapshot: {} }],
    });
    const cupons = service(db);
    await cupons.reverterUso("order-5", "reembolso", db as any);
    await cupons.reverterUso("order-5", "reembolso", db as any);
    expect(db.usos[0]).toMatchObject({ status: "REVERTIDO", revertedAt: expect.any(Date) });
    expect(db.audit.filter((entry: any) => entry.action === "USO_REVERTIDO")).toHaveLength(1);
  });
});

function service(db: any) { return new EventosCuponsService({ db } as any); }
function fakeDb(options: { selects?: unknown[][]; insert?: (values: any) => any[]; update?: (values: any) => any[] } = {}) {
  let selectIndex = 0;
  const db: any = { audit: [] };
  db.select = () => ({ from: () => ({ where: () => { const rows = options.selects?.[selectIndex++] ?? []; const query: any = Promise.resolve(rows); query.for = () => query; query.groupBy = () => query; return query; } }) });
  db.insert = (table: unknown) => ({ values: (values: any) => { if (table) db.audit.push(values); return { returning: async () => options.insert?.(values) ?? [] }; } });
  db.update = () => ({ set: (values: any) => ({ where: () => ({ returning: async () => options.update?.(values) ?? [] }) }) });
  db.transaction = async (callback: (tx: any) => Promise<unknown>) => callback(db);
  return db;
}

function cupomUsoDb(config: { order: any; coupon: any; retencoes?: any[]; usos?: any[] }) {
  const db: any = { order: config.order, coupon: config.coupon, retencoes: config.retencoes ?? [], usos: config.usos ?? [], audit: [] };
  db.transaction = async (callback: (tx: any) => Promise<unknown>) => callback(db);
  db.select = () => {
    let table: unknown;
    const chain: any = {
      from: (value: unknown) => { table = value; return chain; },
      where: () => {
        if (table === eventoCupons) return Promise.resolve([db.coupon]);
        if (table === eventoCupomRetencoes) return Promise.resolve(db.retencoes);
        if (table === eventoCupomUsos) return Promise.resolve(db.usos);
        if (table === eventoPedidos) return Promise.resolve([db.order]);
        return Promise.resolve([]);
      },
      for: () => chain,
    };
    return chain;
  };
  db.insert = (table: unknown) => ({ values: (values: any) => { if (table === eventoAuditorias) db.audit.push(values); return { returning: async () => {
    if (table === eventoCupomRetencoes) { const row = { id: `ret-${db.retencoes.length + 1}`, ...values }; db.retencoes.push(row); return [row]; }
    if (table === eventoCupomUsos) { const row = { id: `use-${db.usos.length + 1}`, ...values }; db.usos.push(row); return [row]; }
    if (table === eventoAuditorias) return [values];
    return [values];
  } }; } });
  db.update = (table: unknown) => ({ set: (values: any) => ({ where: () => ({ returning: async () => {
    const rows = table === eventoCupomRetencoes ? db.retencoes : table === eventoCupomUsos ? db.usos : [];
    rows.forEach((row: any) => { if (row.status === "ATIVA" || row.status === "CONFIRMADO") Object.assign(row, values); });
    return rows;
  } }) }) });
  return db;
}
