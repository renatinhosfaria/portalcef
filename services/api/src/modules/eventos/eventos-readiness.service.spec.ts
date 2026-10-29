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

  it('conta somente inventário disponível ou liberado por capacidade', async () => {
    const db = fakeDb([
      [{ id: 'e1', schoolId: 's1', title: 'Evento', slug: 'evento', status: 'RASCUNHO', description: 'x', cancellationPolicy: 'x', contactEmail: 'a@b.com', defaultMapId: 'm1' }],
      [{ id: 'sess1', eventId: 'e1', startsAt: new Date('2026-11-01T10:00:00Z'), endsAt: new Date('2026-11-01T11:00:00Z'), capacity: 2, locationId: 'l1', mapId: 'm1', salesStartsAt: null, salesEndsAt: null }],
      [{ id: 'm1', eventId: 'e1', status: 'CONFIRMADO' }],
      [{ sessionId: 'sess1', status: 'DISPONIVEL' }, { sessionId: 'sess1', status: 'BLOQUEADO' }],
      [{ eventId: 'e1', active: true, priceCents: 100 }],
      [{ eventId: 'e1', active: true, type: 'PRIVACIDADE' }, { eventId: 'e1', active: true, type: 'COMPRA' }, { eventId: 'e1', active: true, type: 'CANCELAMENTO_REEMBOLSO' }, { eventId: 'e1', active: true, type: 'ACESSIBILIDADE' }, { eventId: 'e1', active: true, type: 'CONTATO' }],
    ]);
    const result = await new EventosReadinessService({ db } as any).verificar('e1', { userId: 'u1', role: 'diretora_geral', schoolId: 's1' });
    expect(result.items.find((item) => item.key === 'INVENTARIO_SESSOES')).toMatchObject({ state: 'BLOQUEADOR' });
  });

  it('rejeita tenant divergente antes de consultar o checklist', async () => {
    const db = fakeDb([[{ id: 'e1', schoolId: 's1', title: 'Evento', status: 'RASCUNHO' }]]);
    await expect(new EventosReadinessService({ db } as any).verificar('e1', { userId: 'u2', role: 'diretora_geral', schoolId: 's2' })).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });
});

function fakeDb(rows: unknown[][]) {
  let index = 0;
  return { select: () => ({ from: () => ({ where: async () => rows[index++] ?? [] }) }) };
}
