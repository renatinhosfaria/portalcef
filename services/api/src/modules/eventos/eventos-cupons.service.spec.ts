import { BadRequestException } from "@nestjs/common";
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
