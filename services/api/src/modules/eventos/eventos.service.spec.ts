import { ConflictException, BadRequestException } from '@nestjs/common';
import { EventosService } from './eventos.service';

const actor = { userId: 'u1', role: 'diretora_geral', schoolId: 's1' };
const event = (extra: Record<string, unknown> = {}) => ({
  id: 'e1', schoolId: 's1', title: 'Evento Original', slug: 'evento-manual', status: 'RASCUNHO',
  description: null, summary: null, cancellationPolicy: null, contactEmail: null,
  publishedAt: null, plannedPublicationAt: null, defaultLocationId: null, defaultMapId: null,
  updatedAt: new Date('2026-10-29T10:00:00Z'), ...extra,
});

describe('EventosService contratos de workspace', () => {
  it('cria rascunho com slug normalizado e incrementa colisão por escola', async () => {
    const inserted: any[] = [];
    const db = fakeDb({ selects: [[{ id: 'ocupado' }], []], insert: async (values: any) => { inserted.push(values); return [event({ title: values.title, slug: values.slug })]; } });
    const result = await service(db).criarRascunho({ title: '  Café & Cultura  ' }, actor);
    expect(result.slug).toBe('cafe-cultura-2');
    expect(inserted[0]).toMatchObject({ schoolId: 's1', title: 'Café & Cultura', slug: 'cafe-cultura-2', status: 'RASCUNHO' });
  });

  it('rejeita criação sem tenant da sessão', async () => {
    await expect(service(fakeDb()).criarRascunho({ title: 'Evento' }, { ...actor, schoolId: 's2' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita conflito de versão e não apaga a edição local', async () => {
    const db = fakeDb({ selects: [[event({ updatedAt: new Date('2026-10-29T11:00:00Z') })]], update: async () => [] });
    await expect(service(db).atualizarEvento('e1', { title: 'Minha edição', expectedUpdatedAt: new Date('2026-10-29T10:00:00Z') }, actor)).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
    expect(db.updated).toBe(false);
  });

  it('rejeita a segunda gravação mesmo quando a leitura inicial ainda tinha a mesma versão', async () => {
    const version = new Date('2026-10-29T10:00:00Z');
    const db = fakeDb({ selects: [[event({ updatedAt: version })], []], update: async () => [] });
    await expect(service(db).atualizarEvento('e1', { title: 'Concorrente', expectedUpdatedAt: version }, actor)).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
  });

  it('mantém slug manual e devolve sugestão ao alterar título', async () => {
    const db = fakeDb({ selects: [[event()]], update: async () => [event({ title: 'Novo Título', slug: 'evento-manual' })] });
    const result = await service(db).atualizarEvento('e1', { title: 'Novo Título' }, actor);
    expect(result.slug).toBe('evento-manual');
    expect((result as any).slugSuggestion).toBe('novo-titulo');
  });

  it('usa o código de contrato para slug imutável publicado', async () => {
    const db = fakeDb({ selects: [[event({ status: 'PUBLICADO', slug: 'publicado' })]] });
    await expect(service(db).atualizarEvento('e1', { slug: 'outro-slug' }, actor)).rejects.toMatchObject({ response: { code: 'EVENT_SLUG_IMMUTABLE' } });
  });

  it('rejeita qualquer PATCH de slug em evento publicado, mesmo sem mudança', async () => {
    const db = fakeDb({ selects: [[event({ status: 'PUBLICADO', slug: 'publicado' })]] });
    await expect(service(db).atualizarEvento('e1', { slug: 'publicado' }, actor)).rejects.toMatchObject({ response: { code: 'EVENT_SLUG_IMMUTABLE' } });
  });

  it('rejeita mapa pertencente a outro evento', async () => {
    const db = fakeDb({ selects: [[event()], [{ id: 'mapa-externo', eventId: 'outro-evento' }]] });
    await expect(service(db).atualizarMapaPadrao('e1', 'mapa-externo', actor)).rejects.toMatchObject({ response: { code: 'MAP_EVENT_MISMATCH' } });
  });

  it('propaga mapa padrão somente para sessões herdadas e invalida seus inventários', async () => {
    const updates: Array<{ table: unknown; values: unknown }> = [];
    const db = fakeDb({
      selects: [
        [event({ defaultMapId: 'map-antigo' })],
        [{ id: 'map-novo', eventId: 'e1' }],
        [
          { id: 'sessao-herdada', eventId: 'e1', mapId: null },
          { id: 'sessao-especifica', eventId: 'e1', mapId: 'map-especifico' },
        ],
      ],
      update: async () => [event({ defaultMapId: 'map-novo' })],
    });
    db.update = (table: unknown) => ({
      set: (values: unknown) => ({
        where: () => ({
          then: async (resolve: (value: unknown) => void) => {
            updates.push({ table, values });
            resolve([]);
          },
          returning: async () => {
            updates.push({ table, values });
            return [event({ defaultMapId: 'map-novo' })];
          },
        }),
      }),
    });

    await service(db).atualizarMapaPadrao('e1', 'map-novo', actor);

    expect(updates).toHaveLength(2);
    expect(updates.map((item) => item.values)).toEqual(expect.arrayContaining([
      { defaultMapId: 'map-novo', updatedAt: expect.any(Date) },
      { status: 'BLOQUEADO', blockedReason: 'MAPA_PADRAO_ALTERADO', updatedAt: expect.any(Date) },
    ]));
  });
});

function service(db: any) { return new EventosService({ db } as any, { validarPublicacao: jest.fn() } as any); }

function fakeDb(options: { selects?: unknown[][]; insert?: (values: any) => Promise<any[]>; update?: () => Promise<any[]> } = {}) {
  let selectIndex = 0;
  const selects = options.selects ?? [];
  const db: any = { updated: false };
  db.select = () => ({ from: () => ({ where: () => { const rows = selects[selectIndex++] ?? []; const promise: any = Promise.resolve(rows); promise.limit = async () => rows; return promise; } }) });
  db.insert = (table: any) => ({ values: (values: any) => ({ returning: async () => options.insert ? options.insert(values) : [] }) });
  db.update = () => ({ set: () => ({ where: () => ({ returning: async () => { db.updated = true; return options.update ? options.update() : []; } }) }) });
  return db;
}
