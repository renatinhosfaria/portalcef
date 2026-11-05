import { criarEventoSchema, criarSessaoSchema, atualizarEventoSchema } from './eventos';

describe('schemas de sessão e mapa do evento', () => {
  const sessaoValida = {
    startsAt: '2026-11-01T10:00:00Z',
    endsAt: '2026-11-01T11:00:00Z',
    capacity: 10,
  };

  it('criarSessaoSchema recusa mapId', () => {
    expect(criarSessaoSchema.safeParse({ ...sessaoValida, mapId: '00000000-0000-0000-0000-000000000001' }).success).toBe(false);
  });

  it('criarEventoSchema recusa mapId dentro de sessions', () => {
    const resultado = criarEventoSchema.safeParse({
      schoolId: '00000000-0000-0000-0000-000000000001',
      slug: 'evento',
      title: 'Evento',
      description: 'Descrição',
      cancellationPolicy: 'Política',
      contactEmail: 'contato@example.com',
      sessions: [{ ...sessaoValida, mapId: '00000000-0000-0000-0000-000000000002' }],
    });

    expect(resultado.success).toBe(false);
  });

  it('atualizarEventoSchema ignora defaultMapId', () => {
    expect(atualizarEventoSchema.parse({ defaultMapId: '00000000-0000-0000-0000-000000000001' })).not.toHaveProperty('defaultMapId');
  });
});
