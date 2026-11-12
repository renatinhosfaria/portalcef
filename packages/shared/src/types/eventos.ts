export type EventoStatus = "RASCUNHO" | "REVISAO" | "PUBLICADO" | "PAUSADO" | "ENCERRADO" | "CANCELADO" | "ARQUIVADO";
export interface EventoActor { userId: string; role: string; schoolId?: string | null; }
export interface EventoResumo { id: string; schoolId: string; slug: string; title: string; status: EventoStatus; publishedAt: Date | null; plannedPublicationAt: Date | null; slugSuggestion?: string; }
export interface PublicEventCard { id: string; slug: string; title: string; summary: string | null; imageUrl: string | null; category: string | null; startsAt: Date | null; locationName: string | null; fromPriceCents: number | null; availability: "available" | "sold_out" | "unavailable"; }
export interface PublicEventDetail extends PublicEventCard { description: string | null; contactEmail: string | null; contactPhone: string | null; cancellationPolicy: string | null; }
export interface PublicEventTicketType { id: string; name: string; description: string | null; priceCents: number; maxPerOrder: number | null; eligibility: string | null; }
export interface PublicEventSession { id: string; startsAt: Date; endsAt: Date; status: "PUBLICADA"; capacity: number; location: { name: string; address: string; room: string | null; instructions: string | null; accessibility: string | null } | null; mapId: string | null; salesStartsAt: Date | null; salesEndsAt: Date | null; availability: "available" | "sold_out" | "unavailable"; ticketTypes: PublicEventTicketType[]; offers: OfertaPrecoPublica[]; }
export interface OfertaPrecoPublica { id: string; version: number; name: string; minQuantity: number; maxQuantity: number | null; discountPercent: number | null; }
export interface EventoOfertaAdmin extends OfertaPrecoPublica { pricingType: "PERCENTUAL" | "VALOR_FIXO"; priceCents: number | null; compatibleTicketTypeIds: string[] | null; active: boolean; }
export interface AtualizarOfertaInput { id?: string; version?: number; name: string; pricingType: "PERCENTUAL" | "VALOR_FIXO"; minQuantity: number; maxQuantity?: number | null; priceCents?: number | null; discountPercent?: number | null; compatibleTicketTypeIds?: string[] | null; active?: boolean; }
export interface PublicSeat { id: string; sessionId: string; rowLabel: string; seatNumber: string; x: number; y: number; width: number; height: number; category: string | null; accessible: boolean; state: "available" | "reserved" | "sold" | "blocked"; rotacao?: number; }
export interface PublicMap { sessionId: string; mapId: string; seats: PublicSeat[]; layout?: PublicMapLayout | null; }
export interface PoliticaPublica { type: "PRIVACIDADE" | "COMPRA" | "CANCELAMENTO_REEMBOLSO" | "ACESSIBILIDADE" | "CONTATO"; version: number; content: string; }
export interface ReservaPublicaResult { reservationId: string; orderNumber: string; expiresAt: Date; subtotalCents: number; discountCents: number; totalCents: number; appliedOffer: OfertaPrecoPublica | null; items: Array<{ seatId: string; ticketTypeId: string; unitPriceCents: number; totalPriceCents: number }>; }
export interface PedidoPublicoResult { orderNumber: string; status: string; eventTitle: string; eventSlug: string; sessionId: string; expiresAt: Date | null; session: { startsAt: Date; endsAt: Date }; subtotalCents: number; discountCents: number; totalCents: number; appliedOffer: OfertaPrecoPublica | null; items: ItemPedidoPublico[]; }
export type ConsultaPedidoPublica = PedidoPublicoResult;

export interface PedidoComIngressos extends PedidoPublicoResult {
  buyerName: string | null;
  event: { title: string; slug: string; imageUrl: string | null; locationName: string | null };
  tickets: IngressoPublico[];
}

export interface FinalizacaoPublicaResult { pedido: PedidoPublicoResult; acesso: string; }

export type ProntidaoState = "BLOQUEADOR" | "AVISO" | "OK";
export interface ProntidaoItem { key: string; label: string; state: ProntidaoState; href?: string; message?: string; }
export interface EventoProntidao { eventId: string; status: EventoStatus; progress: number; items: ProntidaoItem[]; }

export interface PublicMapLayout {
  largura: number;
  altura: number;
  rotulos: Array<{ fileira: string; x: number; y: number }>;
  elementos: Array<{ tipo: "PALCO" | "ENTRADA" | "SAIDA"; texto: string; x: number; y: number }>;
}

export interface ItemPedidoPublico {
  seatId: string;
  ticketTypeId: string;
  participantIndex?: number;
  unitPriceCents: number;
  totalPriceCents: number;
  rowLabel: string;
  seatNumber: string;
  ticketTypeName: string;
}

export interface IngressoPublico {
  numero: string;
  qrPayload: string;
  rowLabel: string;
  seatNumber: string;
  ticketTypeName: string;
  participantName: string;
  status: string;
}

export interface PagamentoEmbutidoResult { clientSecret: string; expiresAt: Date; orderNumber: string; }

export interface MeusIngressosResult {
  pedidos: Array<{ orderNumber: string; eventTitle: string; sessionStartsAt: Date; acesso: string }>;
}

export type CortesiaSituacao = "ATIVA" | "USADA" | "CANCELADA";

export interface CortesiaResumo {
  orderId: string;
  orderNumber: string;
  session: { id: string; startsAt: Date };
  rowLabel: string;
  seatNumber: string;
  participantName: string;
  grupo: string;
  motivo: string;
  numero: string;
  situacao: CortesiaSituacao;
  emitidaPor: string;
  emitidaEm: Date;
  canceladaEm: Date | null;
}

export interface ConflitoAssentoCortesia {
  inventorySeatId: string;
  rowLabel: string;
  seatNumber: string;
  motivo: "VENDIDO" | "RESERVADO" | "BLOQUEADO" | "OUTRA_SESSAO" | "INEXISTENTE";
}

/** Mapa da sessão para o painel: `inventarioPorAssento` leva seat.id → inventorySeatId. */
export interface MapaAdminSessao extends PublicMap { inventarioPorAssento: Record<string, string>; }
