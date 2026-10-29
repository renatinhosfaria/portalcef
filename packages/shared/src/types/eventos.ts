export type EventoStatus = "RASCUNHO" | "REVISAO" | "PUBLICADO" | "PAUSADO" | "ENCERRADO" | "CANCELADO" | "ARQUIVADO";
export interface EventoActor { userId: string; role: string; schoolId?: string | null; }
export interface EventoResumo { id: string; schoolId: string; slug: string; title: string; status: EventoStatus; publishedAt: Date | null; plannedPublicationAt: Date | null; }
export interface PublicEventCard { id: string; slug: string; title: string; summary: string | null; imageUrl: string | null; category: string | null; startsAt: Date | null; locationName: string | null; fromPriceCents: number | null; availability: "available" | "sold_out" | "unavailable"; }
export interface PublicEventDetail extends PublicEventCard { description: string | null; contactEmail: string | null; contactPhone: string | null; cancellationPolicy: string | null; }
export interface PublicEventTicketType { id: string; name: string; description: string | null; priceCents: number; maxPerOrder: number | null; eligibility: string | null; }
export interface PublicEventSession { id: string; startsAt: Date; endsAt: Date; status: "PUBLICADA"; capacity: number; location: { name: string; address: string; room: string | null; instructions: string | null; accessibility: string | null } | null; mapId: string | null; salesStartsAt: Date | null; salesEndsAt: Date | null; availability: "available" | "sold_out" | "unavailable"; ticketTypes: PublicEventTicketType[]; }
export interface PublicSeat { id: string; sessionId: string; rowLabel: string; seatNumber: string; x: number; y: number; width: number; height: number; category: string | null; accessible: boolean; state: "available" | "reserved" | "sold" | "blocked"; }
export interface PublicMap { sessionId: string; mapId: string; seats: PublicSeat[]; }
export interface PoliticaPublica { type: "PRIVACIDADE" | "COMPRA" | "CANCELAMENTO_REEMBOLSO" | "ACESSIBILIDADE" | "CONTATO"; version: number; content: string; }
export interface ReservaPublicaResult { reservationId: string; orderNumber: string; expiresAt: Date; totalCents: number; items: Array<{ seatId: string; ticketTypeId: string; unitPriceCents: number; totalPriceCents: number }>; }
export interface PedidoPublicoResult { orderNumber: string; status: string; eventTitle: string; session: { startsAt: Date; endsAt: Date }; totalCents: number; items: Array<{ seatId: string; ticketTypeId: string; unitPriceCents: number; totalPriceCents: number }>; tickets?: unknown[]; }
export type ConsultaPedidoPublica = PedidoPublicoResult;

export type ProntidaoState = "BLOQUEADOR" | "AVISO" | "OK";
export interface ProntidaoItem { key: string; label: string; state: ProntidaoState; href?: string; message?: string; }
export interface EventoProntidao { eventId: string; status: EventoStatus; progress: number; items: ProntidaoItem[]; }
