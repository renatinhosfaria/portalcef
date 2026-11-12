import { eq, eventoIngressos, eventoInventarioAssentos, eventoItensPedido, eventoMapaAssentos, eventoParticipantes, eventoTiposIngresso } from "@essencia/db";
import type { IngressoPublico } from "@essencia/shared/types";

export async function montarIngressosDoPedido(db: any, orderId: string): Promise<IngressoPublico[]> {
  const rows = await db
    .select({ ticket: eventoIngressos, item: eventoItensPedido, inventory: eventoInventarioAssentos, seat: eventoMapaAssentos, ticketType: eventoTiposIngresso, participant: eventoParticipantes })
    .from(eventoIngressos)
    .innerJoin(eventoItensPedido, eq(eventoItensPedido.id, eventoIngressos.itemId))
    .innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.id, eventoIngressos.inventorySeatId))
    .innerJoin(eventoMapaAssentos, eq(eventoMapaAssentos.id, eventoInventarioAssentos.seatId))
    .innerJoin(eventoTiposIngresso, eq(eventoTiposIngresso.id, eventoItensPedido.ticketTypeId))
    .innerJoin(eventoParticipantes, eq(eventoParticipantes.id, eventoIngressos.participantId))
    .where(eq(eventoIngressos.orderId, orderId));
  return rows.map((row: any) => ({
    numero: row.ticket?.numero,
    qrPayload: row.ticket?.qrPayload,
    rowLabel: row.seat?.rowLabel ?? row.inventory?.rowLabel ?? "",
    seatNumber: row.seat?.seatNumber ?? row.inventory?.seatNumber ?? "",
    ticketTypeName: row.ticketType?.name ?? row.item?.ticketTypeName ?? "",
    participantName: row.participant?.fullName ?? "",
    status: row.ticket?.status,
  }));
}
