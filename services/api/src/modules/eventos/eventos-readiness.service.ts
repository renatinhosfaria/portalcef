import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, eventoInventarioAssentos, eventoMapas, eventoPoliticas, eventoSessoes, eventoTiposIngresso, eventos } from '@essencia/db';
import type { EventoActor } from '@essencia/shared/types';
import { DatabaseService } from '../../common/database/database.service';

export type ProntidaoItem = { key: string; label: string; state: 'BLOQUEADOR' | 'AVISO' | 'OK'; href?: string; message?: string };
export type ProntidaoResult = { eventId: string; status: string; progress: number; items: ProntidaoItem[] };

@Injectable()
export class EventosReadinessService {
  constructor(private readonly database: DatabaseService) {}
  private get db() { return this.database.db; }
  private async rows(table: any, predicate?: any) { const query = this.db.select().from(table); return predicate === undefined ? query : query.where(predicate); }
  private assertScope(actor: EventoActor, schoolId: string) { if (actor.role !== 'master' && actor.schoolId !== schoolId) throw new BadRequestException({ code: 'FORBIDDEN', message: 'Acesso negado' }); }

  async verificar(eventId: string, actor: EventoActor): Promise<ProntidaoResult> {
    const [event] = await this.rows(eventos, eq(eventos.id, eventId));
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Evento não encontrado' });
    this.assertScope(actor, event.schoolId);
    const sessions: any[] = await this.rows(eventoSessoes, eq(eventoSessoes.eventId, eventId));
    const maps: any[] = await this.rows(eventoMapas, eq(eventoMapas.eventId, eventId));
    const tickets: any[] = await this.rows(eventoTiposIngresso, and(eq(eventoTiposIngresso.eventId, eventId), eq(eventoTiposIngresso.active, true)));
    const policies: any[] = await this.rows(eventoPoliticas, and(eq(eventoPoliticas.eventId, eventId), eq(eventoPoliticas.active, true)));
    const items: ProntidaoItem[] = [];
    const textOk = Boolean(event.title?.trim() && event.description?.trim() && event.cancellationPolicy?.trim() && event.contactEmail?.trim());
    items.push(textOk ? { key: 'TEXTOS_OBRIGATORIOS', label: 'Textos obrigatórios', state: 'OK' } : { key: 'TEXTOS_OBRIGATORIOS', label: 'Textos obrigatórios', state: 'BLOQUEADOR', href: '#informacoes', message: 'Preencha descrição, contato e política de cancelamento' });
    items.push(event.slug?.trim() ? { key: 'SLUG_VALIDO', label: 'Slug válido e único', state: 'OK' } : { key: 'SLUG_VALIDO', label: 'Slug válido e único', state: 'BLOQUEADOR', href: '#informacoes', message: 'Informe um slug válido' });
    const sessionsValid = sessions.length > 0 && sessions.every((session) => session.startsAt < session.endsAt && session.capacity > 0 && (!session.salesStartsAt || !session.salesEndsAt || session.salesStartsAt < session.salesEndsAt));
    items.push(sessionsValid ? { key: 'SESSAO_OBRIGATORIA', label: 'Sessões configuradas', state: 'OK' } : { key: 'SESSAO_OBRIGATORIA', label: 'Sessões configuradas', state: 'BLOQUEADOR', href: '#sessoes', message: sessions.length ? 'Revise horários, capacidade e janela de venda' : 'Crie ao menos uma sessão' });
    const locationOk = sessions.length > 0 && sessions.every((session) => Boolean(session.locationId || event.defaultLocationId));
    items.push(locationOk ? { key: 'LOCAL_SESSOES', label: 'Local das sessões', state: 'OK' } : { key: 'LOCAL_SESSOES', label: 'Local das sessões', state: 'BLOQUEADOR', href: '#sessoes', message: 'Defina um local efetivo para cada sessão' });
    const mapOk = sessionsValid && sessions.every((session) => {
      const effectiveMapId = session.mapId ?? event.defaultMapId;
      return Boolean(effectiveMapId && maps.some((map) => map.id === effectiveMapId && map.status === 'CONFIRMADO'));
    });
    items.push(mapOk ? { key: 'MAPA_CONFIRMADO', label: 'Mapa confirmado', state: 'OK' } : { key: 'MAPA_CONFIRMADO', label: 'Mapa confirmado', state: 'BLOQUEADOR', href: '#mapa', message: 'Confirme o mapa do evento e das sessões' });
    let inventoryOk = sessions.length > 0;
    for (const session of sessions) {
      const inventory: any[] = await this.rows(eventoInventarioAssentos, eq(eventoInventarioAssentos.sessionId, session.id));
      const sellable = inventory.filter((seat) => seat.status === 'DISPONIVEL' || seat.status === 'LIBERADO').length;
      if (sellable < session.capacity) inventoryOk = false;
    }
    items.push(inventoryOk ? { key: 'INVENTARIO_SESSOES', label: 'Inventário vendável', state: 'OK' } : { key: 'INVENTARIO_SESSOES', label: 'Inventário vendável', state: 'BLOQUEADOR', href: '#mapa', message: 'Gere ao menos um assento vendável por unidade de capacidade' });
    const ticketOk = tickets.length > 0 && tickets.every((ticket) => Number.isInteger(ticket.priceCents) && ticket.priceCents >= 0);
    items.push(ticketOk ? { key: 'INGRESSO_OBRIGATORIO', label: 'Ingressos configurados', state: 'OK' } : { key: 'INGRESSO_OBRIGATORIO', label: 'Ingressos configurados', state: 'BLOQUEADOR', href: '#ingressos', message: 'Configure ao menos um ingresso com preço válido' });
    const required = ['PRIVACIDADE', 'COMPRA', 'CANCELAMENTO_REEMBOLSO', 'ACESSIBILIDADE', 'CONTATO'];
    const policyOk = required.every((type) => policies.some((policy) => policy.type === type));
    items.push(policyOk ? { key: 'POLITICAS_OBRIGATORIAS', label: 'Políticas obrigatórias', state: 'OK' } : { key: 'POLITICAS_OBRIGATORIAS', label: 'Políticas obrigatórias', state: 'BLOQUEADOR', href: '#politicas', message: 'Ative as cinco políticas obrigatórias' });
    const statusOk = ['RASCUNHO', 'REVISAO', 'PAUSADO'].includes(event.status);
    items.push(statusOk ? { key: 'ESTADO_NEGOCIO', label: 'Estado do evento', state: 'OK' } : { key: 'ESTADO_NEGOCIO', label: 'Estado do evento', state: 'BLOQUEADOR', message: 'O estado atual não permite publicação' });
    const okCount = items.filter((item) => item.state === 'OK').length;
    return { eventId, status: event.status, progress: Math.round((okCount / items.length) * 100), items };
  }
}
