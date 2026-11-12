import { eventoTiposIngresso } from '@essencia/db';
import { avaliarPredicado } from './avaliar-predicado.spec-helper';
import { EventosReadinessService } from './eventos-readiness.service';

describe('EventosReadinessService', () => {
  it('retorna bloqueadores para um rascunho incompleto', async () => {
    const db = fakeDb([
      [{ id: 'e1', schoolId: 's1', title: 'Evento', slug: 'evento', status: 'RASCUNHO', description: null, cancellationPolicy: null, contactEmail: null, defaultMapId: null }],
      [], [], [], [],
    ]);
    const result = await new EventosReadinessService({ db } as any).verificar('e1', { userId: 'u1', role: 'diretora_geral', schoolId: 's1' });
    expect(result.eventId).toBe('e1');
    expect(result.items.filter((item) => item.state === 'BLOQUEADOR').map((item) => item.key)).toEqual(expect.arrayContaining(['TEXTOS_OBRIGATORIOS', 'SESSAO_OBRIGATORIA', 'MAPA_CONFIRMADO', 'INGRESSO_OBRIGATORIO', 'POLITICAS_OBRIGATORIAS']));
  });

  it('conta assentos vendidos, reservados e liberados: venda não deixa o checklist pendente', async () => {
    const db = fakeDb([
      [{ id: 'e1', schoolId: 's1', title: 'Evento', slug: 'evento', status: 'PUBLICADO', description: 'x', cancellationPolicy: 'x', contactEmail: 'a@b.com', defaultMapId: 'm1' }],
      [{ id: 'sess1', eventId: 'e1', startsAt: new Date('2026-11-01T10:00:00Z'), endsAt: new Date('2026-11-01T11:00:00Z'), capacity: 4, locationId: 'l1', mapId: 'm1', salesStartsAt: null, salesEndsAt: null }],
      [{ id: 'm1', eventId: 'e1', status: 'CONFIRMADO' }],
      // ordem das consultas: evento, sessões, mapas, ingressos, políticas, inventário
      [{ eventId: 'e1', active: true, priceCents: 100 }],
      [{ eventId: 'e1', active: true, type: 'PRIVACIDADE' }, { eventId: 'e1', active: true, type: 'COMPRA' }, { eventId: 'e1', active: true, type: 'CANCELAMENTO_REEMBOLSO' }, { eventId: 'e1', active: true, type: 'ACESSIBILIDADE' }, { eventId: 'e1', active: true, type: 'CONTATO' }],
      [{ sessionId: 'sess1', status: 'DISPONIVEL' }, { sessionId: 'sess1', status: 'LIBERADO' }, { sessionId: 'sess1', status: 'RESERVADO' }, { sessionId: 'sess1', status: 'VENDIDO' }],
    ]);
    const result = await new EventosReadinessService({ db } as any).verificar('e1', { userId: 'u1', role: 'diretora_geral', schoolId: 's1' });
    expect(result.items.find((item) => item.key === 'INVENTARIO_SESSOES')).toMatchObject({ state: 'OK' });
  });

  it('não conta assento bloqueado na capacidade', async () => {
    const db = fakeDb([
      [{ id: 'e1', schoolId: 's1', title: 'Evento', slug: 'evento', status: 'RASCUNHO', description: 'x', cancellationPolicy: 'x', contactEmail: 'a@b.com', defaultMapId: 'm1' }],
      [{ id: 'sess1', eventId: 'e1', startsAt: new Date('2026-11-01T10:00:00Z'), endsAt: new Date('2026-11-01T11:00:00Z'), capacity: 2, locationId: 'l1', mapId: 'm1', salesStartsAt: null, salesEndsAt: null }],
      [{ id: 'm1', eventId: 'e1', status: 'CONFIRMADO' }],
      // ordem das consultas: evento, sessões, mapas, ingressos, políticas, inventário
      [{ eventId: 'e1', active: true, priceCents: 100 }],
      [{ eventId: 'e1', active: true, type: 'PRIVACIDADE' }, { eventId: 'e1', active: true, type: 'COMPRA' }, { eventId: 'e1', active: true, type: 'CANCELAMENTO_REEMBOLSO' }, { eventId: 'e1', active: true, type: 'ACESSIBILIDADE' }, { eventId: 'e1', active: true, type: 'CONTATO' }],
      [{ sessionId: 'sess1', status: 'DISPONIVEL' }, { sessionId: 'sess1', status: 'BLOQUEADO' }],
    ]);
    const result = await new EventosReadinessService({ db } as any).verificar('e1', { userId: 'u1', role: 'diretora_geral', schoolId: 's1' });
    expect(result.items.find((item) => item.key === 'INVENTARIO_SESSOES')).toMatchObject({ state: 'BLOQUEADOR' });
  });

  it('sincroniza mapas confirmados antes de calcular o inventário', async () => {
    const db = fakeDb([
      [{ id: 'e1', schoolId: 's1', title: 'Evento', slug: 'evento', status: 'RASCUNHO', description: 'x', cancellationPolicy: 'x', contactEmail: 'a@b.com', defaultMapId: 'm1' }],
      [{ id: 'sess1', eventId: 'e1', startsAt: new Date('2026-11-01T10:00:00Z'), endsAt: new Date('2026-11-01T11:00:00Z'), capacity: 1, locationId: 'l1', mapId: null, salesStartsAt: null, salesEndsAt: null }],
      [{ id: 'm1', eventId: 'e1', status: 'CONFIRMADO' }],
      [],
      [{ eventId: 'e1', active: true, priceCents: 100 }],
      [{ eventId: 'e1', active: true, type: 'PRIVACIDADE' }, { eventId: 'e1', active: true, type: 'COMPRA' }, { eventId: 'e1', active: true, type: 'CANCELAMENTO_REEMBOLSO' }, { eventId: 'e1', active: true, type: 'ACESSIBILIDADE' }, { eventId: 'e1', active: true, type: 'CONTATO' }],
    ]);
    const mapas = { sincronizarInventarioMapa: jest.fn().mockResolvedValue({ inventorySessionIds: ['sess1'], inventoryCreatedCount: 1 }) };
    await new EventosReadinessService({ db } as any, mapas as any).verificar('e1', { userId: 'u1', role: 'diretora_geral', schoolId: 's1' });
    expect(mapas.sincronizarInventarioMapa).toHaveBeenCalledWith(db, 'e1', 'm1', expect.objectContaining({ userId: 'u1' }));
  });

  it('considera evento publicado concluído no checklist de prontidão', async () => {
    const db = fakeDb([
      [{ id: 'e1', schoolId: 's1', title: 'Evento', slug: 'evento', status: 'PUBLICADO', description: 'x', cancellationPolicy: 'x', contactEmail: 'a@b.com', defaultMapId: 'm1' }],
      [{ id: 'sess1', eventId: 'e1', startsAt: new Date('2026-11-01T10:00:00Z'), endsAt: new Date('2026-11-01T11:00:00Z'), capacity: 1, locationId: 'l1', mapId: 'm1', salesStartsAt: null, salesEndsAt: null }],
      [{ id: 'm1', eventId: 'e1', status: 'CONFIRMADO' }],
      [{ eventId: 'e1', active: true, priceCents: 100 }],
      [{ eventId: 'e1', active: true, type: 'PRIVACIDADE' }, { eventId: 'e1', active: true, type: 'COMPRA' }, { eventId: 'e1', active: true, type: 'CANCELAMENTO_REEMBOLSO' }, { eventId: 'e1', active: true, type: 'ACESSIBILIDADE' }, { eventId: 'e1', active: true, type: 'CONTATO' }],
      [{ sessionId: 'sess1', status: 'DISPONIVEL' }],
    ]);

    const result = await new EventosReadinessService({ db } as any).verificar('e1', { userId: 'u1', role: 'diretora_geral', schoolId: 's1' });

    expect(result.items.find((item) => item.key === 'ESTADO_NEGOCIO')).toMatchObject({ state: 'OK' });
    expect(result.progress).toBe(100);
  });

  it.each(['m2', null])('marca como bloqueador sessão com mapa divergente (%s)', async (mapId) => {
    const db = fakeDb([
      [{ id: 'e1', schoolId: 's1', title: 'Evento', slug: 'evento', status: 'RASCUNHO', description: 'x', cancellationPolicy: 'x', contactEmail: 'a@b.com', defaultMapId: 'm4' }],
      [{ id: 'sess1', eventId: 'e1', startsAt: new Date('2026-11-01T10:00:00Z'), endsAt: new Date('2026-11-01T11:00:00Z'), capacity: 1, locationId: 'l1', mapId, salesStartsAt: null, salesEndsAt: null }],
      [{ id: 'm4', eventId: 'e1', status: 'CONFIRMADO' }],
      [], [], [],
    ]);
    const resultado = await new EventosReadinessService({ db } as any).verificar('e1', { userId: 'u1', role: 'diretora_geral', schoolId: 's1' });
    expect(resultado.items.find((item) => item.key === 'MAPA_CONFIRMADO')).toMatchObject({ state: 'BLOQUEADOR' });
  });

  it('rejeita tenant divergente antes de consultar o checklist', async () => {
    const db = fakeDb([[{ id: 'e1', schoolId: 's1', title: 'Evento', status: 'RASCUNHO' }]]);
    await expect(new EventosReadinessService({ db } as any).verificar('e1', { userId: 'u2', role: 'diretora_geral', schoolId: 's2' })).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('mantém o item de ingressos como bloqueador quando o único tipo ativo é interno', async () => {
    const tipos = [{ id: 'ticket-cortesia', eventId: 'e1', name: 'Cortesia', priceCents: 0, internal: true, active: true }];
    const respostas: Array<unknown[] | ((predicate: any) => unknown[])> = [
      [{ id: 'e1', schoolId: 's1', title: 'Evento', slug: 'evento', status: 'RASCUNHO', description: 'x', cancellationPolicy: 'x', contactEmail: 'a@b.com', defaultMapId: 'm1' }],
      [{ id: 'sess1', eventId: 'e1', startsAt: new Date('2026-11-01T10:00:00Z'), endsAt: new Date('2026-11-01T11:00:00Z'), capacity: 1, locationId: 'l1', mapId: 'm1', salesStartsAt: null, salesEndsAt: null }],
      [{ id: 'm1', eventId: 'e1', status: 'CONFIRMADO' }],
      (predicate) => tipos.filter((tipo) => avaliarPredicado(predicate, tipo)),
      [],
      [],
    ];
    let index = 0;
    const db = { select: () => ({ from: (table: any) => ({ where: async (predicate: any) => { const resposta = respostas[index++]; if (table === eventoTiposIngresso && typeof resposta !== 'function') throw new Error('ordem de consultas inesperada'); return typeof resposta === 'function' ? resposta(predicate) : resposta ?? []; } }) }) };

    const resultado = await new EventosReadinessService({ db } as any).verificar('e1', { userId: 'u1', role: 'diretora_geral', schoolId: 's1' });

    expect(resultado.items.find((item) => item.key === 'INGRESSO_OBRIGATORIO')).toMatchObject({ state: 'BLOQUEADOR' });
  });
});


function fakeDb(rows: unknown[][]) {
  let index = 0;
  return { select: () => ({ from: () => ({ where: async () => rows[index++] ?? [] }) }) };
}
