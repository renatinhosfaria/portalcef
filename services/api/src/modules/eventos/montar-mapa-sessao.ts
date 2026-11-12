import { and, eq, eventoInventarioAssentos, eventoMapaAssentos } from "@essencia/db";
import type { PublicMapLayout, PublicSeat } from "@essencia/shared/types";

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

/** Layout público do mapa: só rótulos de fileiras que têm assento e elementos válidos. */
export function montarLayoutPublico(layout: unknown, fileirasComAssento: Set<string>): PublicMapLayout | null {
  if (!layout || typeof layout !== "object") return null;
  const value = layout as Record<string, unknown>;
  const numero = (item: unknown) => typeof item === "number" && Number.isFinite(item);
  if (!numero(value.largura) || !numero(value.altura) || !Array.isArray(value.rotulos) || !Array.isArray(value.elementos)) return null;
  const rotulos = value.rotulos as unknown[];
  const elementos = value.elementos as unknown[];
  if (!rotulos.every((item) => {
    if (!item || typeof item !== "object") return false;
    const rotulo = item as Record<string, unknown>;
    return typeof rotulo.fileira === "string" && numero(rotulo.x) && numero(rotulo.y);
  }) || !elementos.every((item) => {
    if (!item || typeof item !== "object") return false;
    const elemento = item as Record<string, unknown>;
    return (elemento.tipo === "PALCO" || elemento.tipo === "ENTRADA" || elemento.tipo === "SAIDA") && typeof elemento.texto === "string" && numero(elemento.x) && numero(elemento.y);
  })) return null;
  return {
    largura: value.largura as number,
    altura: value.altura as number,
    rotulos: rotulos.filter((item) => fileirasComAssento.has((item as Record<string, unknown>).fileira as string)).map((item) => {
      const rotulo = item as { fileira: string; x: number; y: number };
      return { fileira: rotulo.fileira, x: rotulo.x, y: rotulo.y };
    }),
    elementos: elementos.map((item) => {
      const elemento = item as PublicMapLayout["elementos"][number];
      return { tipo: elemento.tipo, texto: elemento.texto, x: elemento.x, y: elemento.y };
    }),
  };
}
