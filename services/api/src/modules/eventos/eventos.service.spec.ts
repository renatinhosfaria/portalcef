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

  it('envia a imagem do evento, atualiza a URL e remove a imagem anterior', async () => {
    const db = fakeDb({ selects: [[event({ imageUrl: 'https://www.portalcef.com.br/storage/essencia-uploads/eventos/e1/imagem/antiga.jpg' })]], update: async () => [event({ imageUrl: 'https://www.portalcef.com.br/storage/essencia-uploads/eventos/e1/imagem/nova.jpg' })] });
    const storage = { uploadBuffer: jest.fn().mockResolvedValue({ url: 'https://www.portalcef.com.br/storage/essencia-uploads/eventos/e1/imagem/nova.jpg' }), deletePublicUrl: jest.fn() };

    const result = await service(db, storage).atualizarImagem('e1', { buffer: Buffer.from([0xff, 0xd8, 0xff]), filename: 'nova.jpg', mimetype: 'image/jpeg' }, actor);

    expect(result.imageUrl).toContain('/nova.jpg');
    expect(storage.uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), 'nova.jpg', 'image/jpeg', 'eventos/e1/imagem', expect.arrayContaining(['image/jpeg']));
    expect(storage.deletePublicUrl).toHaveBeenCalledWith(expect.stringContaining('/antiga.jpg'));
  });

  it('rejeita imagem de evento fora do escopo sem fazer upload', async () => {
    const db = fakeDb({ selects: [[event({ schoolId: 'outra-escola' })]] });
    const storage = { uploadBuffer: jest.fn(), deletePublicUrl: jest.fn() };

    await expect(service(db, storage).atualizarImagem('e1', { buffer: Buffer.from('x'), filename: 'nova.jpg', mimetype: 'image/jpeg' }, actor)).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it('rejeita upload quando o storage não está disponível', async () => {
    const db = fakeDb({ selects: [[event()]] });

    await expect(service(db, undefined).atualizarImagem('e1', { buffer: Buffer.from('x'), filename: 'nova.jpg', mimetype: 'image/jpeg' }, actor)).rejects.toMatchObject({ response: { code: 'STORAGE_UNAVAILABLE' } });
  });

  it('remove a nova imagem quando a atualização do evento falha', async () => {
    const db = fakeDb({ selects: [[event()]], update: async () => [] });
    const storage = { uploadBuffer: jest.fn().mockResolvedValue({ url: 'https://www.portalcef.com.br/storage/essencia-uploads/eventos/e1/imagem/nova.jpg' }), deletePublicUrl: jest.fn() };

    await expect(service(db, storage).atualizarImagem('e1', { buffer: Buffer.from([0xff, 0xd8, 0xff]), filename: 'nova.jpg', mimetype: 'image/jpeg' }, actor)).rejects.toMatchObject({ response: { code: 'EVENT_NOT_FOUND' } });
    expect(storage.deletePublicUrl).toHaveBeenCalledWith(expect.stringContaining('/nova.jpg'));
  });

  it('não faz upload quando a versão esperada está desatualizada', async () => {
    const db = fakeDb({ selects: [[event({ updatedAt: new Date('2026-10-29T11:00:00Z') })]] });
    const storage = { uploadBuffer: jest.fn(), deletePublicUrl: jest.fn() };

    await expect(service(db, storage).atualizarImagem('e1', { buffer: Buffer.from('x'), filename: 'nova.jpg', mimetype: 'image/jpeg' }, actor, new Date('2026-10-29T10:00:00Z'))).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it('não apaga a nova imagem quando a auditoria falha após atualizar o evento', async () => {
    const db = fakeDb({ selects: [[event({ imageUrl: 'https://www.portalcef.com.br/storage/essencia-uploads/eventos/e1/imagem/antiga.jpg' })]], update: async () => [event({ imageUrl: 'https://www.portalcef.com.br/storage/essencia-uploads/eventos/e1/imagem/nova.jpg' })] });
    db.insert = () => ({ values: async () => { throw new Error('auditoria indisponível'); } });
    const storage = { uploadBuffer: jest.fn().mockResolvedValue({ url: 'https://www.portalcef.com.br/storage/essencia-uploads/eventos/e1/imagem/nova.jpg' }), deletePublicUrl: jest.fn() };

    await expect(service(db, storage).atualizarImagem('e1', { buffer: Buffer.from([0xff, 0xd8, 0xff]), filename: 'nova.jpg', mimetype: 'image/jpeg' }, actor)).rejects.toThrow('auditoria indisponível');
    expect(storage.deletePublicUrl).not.toHaveBeenCalledWith(expect.stringContaining('/nova.jpg'));
  });
});

function service(db: any, storage?: any) { return new EventosService({ db } as any, { validarPublicacao: jest.fn() } as any, storage); }

function fakeDb(options: { selects?: unknown[][]; insert?: (values: any) => Promise<any[]>; update?: () => Promise<any[]> } = {}) {
  let selectIndex = 0;
  const selects = options.selects ?? [];
  const db: any = { updated: false };
  db.select = () => ({ from: () => ({ where: () => { const rows = selects[selectIndex++] ?? []; const promise: any = Promise.resolve(rows); promise.limit = async () => rows; return promise; } }) });
  db.insert = (table: any) => ({ values: (values: any) => ({ returning: async () => options.insert ? options.insert(values) : [] }) });
  db.update = () => ({ set: () => ({ where: () => ({ returning: async () => { db.updated = true; return options.update ? options.update() : []; } }) }) });
  return db;
}
