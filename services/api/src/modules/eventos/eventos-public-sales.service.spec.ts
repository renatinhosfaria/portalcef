import { BadRequestException } from "@nestjs/common";
import { EventosPublicSalesService } from "./eventos-public-sales.service";

describe("EventosPublicSalesService", () => {
  it("calcula total usando o preco persistido e ignora preco e schoolId do cliente", async () => {
    const db = fakeDb({ event: { id: "e1", schoolId: "real", status: "PUBLICADO" }, session: { id: "s1", eventId: "e1", status: "PUBLICADA" }, inventory: { id: "i1", sessionId: "s1", seatId: "seat1", status: "DISPONIVEL" }, ticket: { id: "t1", eventId: "e1", priceCents: 1250, active: true } });
    const service = new EventosPublicSalesService({ db } as any);
    const result = await service.reservarAssentos({ sessionId: "s1", schoolId: "attacker", seats: [{ seatId: "seat1", ticketTypeId: "t1", participantIndex: 0, priceCents: 1 }], buyer: { name: "Ana", email: "ANA@EXAMPLE.COM", phone: "(11) 99999-9999" }, idempotencyKey: "idem-1" } as any);
    expect(result.totalCents).toBe(1250);
    expect(db.insertedOrder.totalCents).toBe(1250);
  });

  it("rejeita sessao nao publicada", async () => {
    const db = fakeDb({ event: { id: "e1", status: "PUBLICADO" }, session: { id: "s1", eventId: "e1", status: "RASCUNHO" } });
    const service = new EventosPublicSalesService({ db } as any);
    await expect(service.reservarAssentos({ sessionId: "s1", seats: [{ seatId: "seat1", ticketTypeId: "t1", participantIndex: 0 }], buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" }, idempotencyKey: "idem" } as any)).rejects.toMatchObject({ response: { code: "EVENT_NOT_FOUND" } });
  });
});

function fakeDb(data: any) {
  const state: any = { insertedOrder: null };
  const db: any = {
    transaction: async (fn: any) => fn(db),
    select: () => ({ from: () => ({ where: async () => data.event ? [data.event] : [] }) }),
    insert: (table: any) => ({ values: (value: any) => ({ returning: async () => { state.insertedOrder = value; return [{ ...value, id: "order1", orderNumber: "ABC123DEF456" }]; } }) }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
  };
  Object.defineProperty(db, "insertedOrder", { get: () => state.insertedOrder });
  return db;
}
