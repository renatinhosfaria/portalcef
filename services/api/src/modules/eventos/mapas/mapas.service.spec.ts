import { BadRequestException } from "@nestjs/common";
jest.mock("@essencia/db", () => ({ eventos: {}, eventoMapas: {}, eventoImportacoesMapa: {}, eventoDeteccoesMapa: {}, eventoMapaAssentos: {}, eventoAuditorias: {}, eq: jest.fn(), and: jest.fn() }));
import { MapasService } from "./mapas.service";

describe("MapasService", () => {
  const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };
  function service() {
    const db: any = {
      select: () => ({ from: () => ({ where: async () => [{ id: "event-1", schoolId: "school-1", status: "EM_REVISAO" }] }) }),
      insert: () => ({ values: () => ({ returning: async () => [{ id: "map-1", eventId: "event-1" }] }) }),
    };
    return new MapasService({ db } as any, { uploadMapBuffer: jest.fn().mockResolvedValue({ key: "private/map.svg" }) } as any, { detect: jest.fn().mockResolvedValue({ detector: "svg-text-v1", seats: [{ rowLabel: "A", seatNumber: "1", x: 1, y: 2, width: 20, height: 20, confidence: 90 }], categories: [], confidence: 90, conflicts: [] }) } as any);
  }
  it("exige revisão humana para toda confirmação estruturada", async () => {
    const result = await service().importar("event-1", { filename: "map.svg", mimetype: "image/svg+xml", toBuffer: jest.fn().mockResolvedValue(Buffer.from("<svg/>")) } as any, actor);
    expect(result.status).toBe("EM_REVISAO");
    expect(result.proposalCount).toBe(1);
  });

  it("rejeita confirmação sem assentos", async () => {
    const db: any = { select: () => ({ from: () => ({ where: async () => [{ id: "event-1", schoolId: "school-1" }] }) }) };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    await expect(maps.confirmar("event-1", "map-1", { seats: [] }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejeita reconfirmação e arquivamento inválido", async () => {
    const db: any = {
      select: () => ({ from: () => ({ where: async () => [{ id: "map-1", eventId: "event-1", schoolId: "school-1", status: "ARQUIVADO" }] }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    await expect(maps.confirmar("event-1", "map-1", { seats: [{ rowLabel: "A", seatNumber: "1", x: 1, y: 1 }] }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(maps.arquivar("event-1", "map-1", actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persiste uma correção de detecção com revisor e motivo", async () => {
    const update = jest.fn(() => ({ set: () => ({ where: async () => undefined }) }));
    const insert = jest.fn(() => ({ values: () => ({ returning: async () => [{ id: "detection-2" }] }) }));
    let call = 0;
    const db: any = { select: () => ({ from: () => ({ where: async () => { call += 1; return call === 1 ? [{ id: "event-1", schoolId: "school-1" }] : call === 2 ? [{ id: "map-1", eventId: "event-1", status: "EM_REVISAO" }] : [{ id: "imp-1" }]; } }) }), update, insert };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    (maps as any).revisao = jest.fn().mockResolvedValue({});
    await maps.atualizarDeteccoes("event-1", "map-1", { reason: "ajuste manual", seats: [{ id: "det-1", rowLabel: "B", seatNumber: "4", x: 20, y: 30 }] }, actor);
    expect(update).toHaveBeenCalled();
  });

  it("não conclui correção quando auditoria transacional falha", async () => {
    const update = jest.fn(() => ({ set: () => ({ where: async () => undefined }) }));
    let call = 0;
    const db: any = { select: () => ({ from: () => ({ where: async () => { call += 1; return call === 1 ? [{ id: "event-1", schoolId: "school-1" }] : call === 2 ? [{ id: "map-1", eventId: "event-1", status: "EM_REVISAO" }] : [{ id: "imp-1" }]; } }) }), update, transaction: async (fn: any) => fn({ update, insert: () => ({ values: async () => { throw new Error("audit failed"); } }) }) };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    await expect(maps.atualizarDeteccoes("event-1", "map-1", { reason: "falha", seats: [{ id: "det-1", rowLabel: "A", seatNumber: "1", x: 1, y: 1 }] }, actor)).rejects.toThrow("audit failed");
  });
});
