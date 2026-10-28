export type EventoStatus = "RASCUNHO" | "REVISAO" | "PUBLICADO" | "PAUSADO" | "ENCERRADO" | "CANCELADO" | "ARQUIVADO";
export interface EventoActor { userId: string; role: string; schoolId?: string | null; }
export interface EventoResumo { id: string; schoolId: string; slug: string; title: string; status: EventoStatus; publishedAt: Date | null; plannedPublicationAt: Date | null; }
export interface PublicEventCard { id: string; slug: string; title: string; summary: string | null; imageUrl: string | null; category: string | null; startsAt: Date | null; locationName: string | null; fromPriceCents: number | null; availability: "available" | "sold_out" | "unavailable"; }
export interface PublicEventDetail extends PublicEventCard { description: string | null; contactEmail: string | null; contactPhone: string | null; cancellationPolicy: string | null; }
export interface PublicEventSession { id: string; startsAt: Date; endsAt: Date; status: "PUBLICADA"; capacity: number; location: { name: string; address: string; room: string | null; instructions: string | null; accessibility: string | null } | null; mapId: string | null; salesStartsAt: Date | null; salesEndsAt: Date | null; availability: "available" | "sold_out" | "unavailable"; }
export interface PublicSeat { id: string; sessionId: string; rowLabel: string; seatNumber: string; x: number; y: number; width: number; height: number; category: string | null; accessible: boolean; state: "available" | "reserved" | "sold" | "blocked"; }
export interface PublicMap { sessionId: string; mapId: string; seats: PublicSeat[]; }
