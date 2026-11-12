import { and, eq, eventoInventarioAssentos, eventoMapaAssentos } from "@essencia/db";
import type { PublicSeat } from "@essencia/shared/types";

export type AssentoDaSessao = PublicSeat & { inventorySeatId: string; inventoryStatus: string };

const ESTADO_POR_STATUS: Record<string, PublicSeat["state"]> = {
  VENDIDO: "sold",
  RESERVADO: "reserved",
  BLOQUEADO: "blocked",
};

export async function montarAssentosDaSessao(db: any, sessionId: string, mapId: string): Promise<AssentoDaSessao[]> {
  const rows = await db
    .select({ seat: eventoMapaAssentos, inventory: eventoInventarioAssentos })
    .from(eventoInventarioAssentos)
    .innerJoin(eventoMapaAssentos, eq(eventoMapaAssentos.id, eventoInventarioAssentos.seatId))
    .where(and(eq(eventoInventarioAssentos.sessionId, sessionId), eq(eventoMapaAssentos.mapId, mapId)));
  return rows.map(({ seat, inventory }: any) => {
    let rotacao = 0;
    try {
      const valor = Number(seat.metadata?.rotacao);
      if (Number.isFinite(valor)) rotacao = valor;
    } catch { /* metadata inválido mantém a rotação padrão */ }
    return {
      id: seat.id,
      sessionId,
      rowLabel: seat.rowLabel,
      seatNumber: seat.seatNumber,
      x: seat.x,
      y: seat.y,
      width: seat.width,
      height: seat.height,
      category: seat.category,
      accessible: seat.accessible,
      state: ESTADO_POR_STATUS[inventory.status] ?? "available",
      rotacao,
      inventorySeatId: inventory.id,
      inventoryStatus: inventory.status,
    };
  });
}
