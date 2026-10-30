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

  it('normaliza falha do storage durante o upload', async () => {
    const db = fakeDb({ selects: [[event()]] });
    const storage = { uploadBuffer: jest.fn().mockRejectedValue(new Error('minio indisponível')), deletePublicUrl: jest.fn() };

    await expect(service(db, storage).atualizarImagem('e1', { buffer: Buffer.from('x'), filename: 'nova.jpg', mimetype: 'image/jpeg' }, actor)).rejects.toMatchObject({ response: { code: 'UPLOAD_FAILED' } });
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

  it('remove sessão somente dentro do evento e registra a exclusão', async () => {
    const deleted: unknown[] = [];
    const db = fakeDb({
      selects: [[event()], [{ id: 's1', eventId: 'e1' }], []],
      delete: (table: unknown) => ({ where: async () => { deleted.push(table); } }),
    });

    await expect(service(db).removerSessao('e1', 's1', actor)).resolves.toEqual({ id: 's1' });
    expect(deleted).toHaveLength(1);
  });

  it('bloqueia exclusão de sessão fora da escola do ator', async () => {
    const db = fakeDb({ selects: [[event({ schoolId: 's2' })]] });

    await expect(service(db).removerSessao('e1', 's1', actor)).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('lista opções de sessão no escopo da escola, com padrão e apenas mapas confirmados', async () => {
    const db = fakeDb({
      selects: [
        [event({ defaultLocationId: 'local-2', defaultMapId: 'mapa-2' })],
        [
          { id: 'local-1', schoolId: 's1', name: 'Auditório', address: 'Rua A', room: null },
          { id: 'local-2', schoolId: 's1', name: 'Quadra', address: 'Rua B', room: 'Sala 2' },
          { id: 'local-outra-escola', schoolId: 's2', name: 'Local externo', address: 'Rua C', room: null },
        ],
        [
          { id: 'mapa-1', eventId: 'e1', version: 1, status: 'CONFIRMADO', originalFileName: 'mapa-1.pdf' },
          { id: 'mapa-2', eventId: 'e1', version: 2, status: 'CONFIRMADO', originalFileName: null },
          { id: 'mapa-enviado', eventId: 'e1', version: 3, status: 'ENVIADO', originalFileName: 'rascunho.pdf' },
        ],
      ],
    });

    await expect(service(db).listarOpcoesSessoes('e1', actor)).resolves.toEqual({
      defaultLocation: { id: 'local-2', name: 'Quadra', address: 'Rua B', room: 'Sala 2' },
      locations: [
        { id: 'local-1', name: 'Auditório', address: 'Rua A', room: null },
        { id: 'local-2', name: 'Quadra', address: 'Rua B', room: 'Sala 2' },
      ],
      defaultMap: { id: 'mapa-2', version: 2, status: 'CONFIRMADO', originalFileName: null },
      maps: [
        { id: 'mapa-1', version: 1, status: 'CONFIRMADO', originalFileName: 'mapa-1.pdf' },
        { id: 'mapa-2', version: 2, status: 'CONFIRMADO', originalFileName: null },
      ],
    });
  });

  it('retorna padrões nulos quando as referências não estão entre as opções válidas', async () => {
    const db = fakeDb({
      selects: [
        [event({ defaultLocationId: 'local-outra-escola', defaultMapId: 'mapa-enviado' })],
        [{ id: 'local-1', schoolId: 's1', name: 'Auditório', address: 'Rua A', room: null }],
        [{ id: 'mapa-confirmado', eventId: 'e1', version: 1, status: 'CONFIRMADO', originalFileName: 'mapa.pdf' }],
      ],
    });

    await expect(service(db).listarOpcoesSessoes('e1', actor)).resolves.toMatchObject({ defaultLocation: null, defaultMap: null });
  });

  it('rejeita criação de sessão com local de outra escola', async () => {
    const db = fakeDb({
      selects: [
        [event()],
        [{ id: 'local-externo', schoolId: 's2' }],
      ],
    });

    await expect(service(db).criarSessao('e1', {
      startsAt: new Date('2026-11-01T10:00:00Z'),
      endsAt: new Date('2026-11-01T11:00:00Z'),
      capacity: 10,
      locationId: 'local-externo',
      mapId: null,
    }, actor)).rejects.toMatchObject({ response: { code: 'SESSION_LOCATION_INVALID' } });
  });

  it('valida o local padrão do evento ao criar sessão sem exceção', async () => {
    const db = fakeDb({
      selects: [
        [event({ defaultLocationId: 'local-externo' })],
        [{ id: 'local-externo', schoolId: 's2' }],
      ],
    });

    await expect(service(db).criarSessao('e1', {
      startsAt: new Date('2026-11-01T10:00:00Z'),
      endsAt: new Date('2026-11-01T11:00:00Z'),
      capacity: 10,
      mapId: null,
    }, actor)).rejects.toMatchObject({ response: { code: 'SESSION_LOCATION_INVALID' } });
  });

  it('rejeita atualização de sessão com mapa não confirmado de outro evento', async () => {
    const db = fakeDb({
      selects: [
        [{ id: 's1', eventId: 'e1' }],
        [event()],
        [{ id: 'mapa-externo', eventId: 'outro-evento', status: 'EM_REVISAO' }],
      ],
    });

    await expect(service(db).atualizarSessao('e1', 's1', { mapId: 'mapa-externo' }, actor)).rejects.toMatchObject({ response: { code: 'SESSION_MAP_INVALID' } });
  });

  it('bloqueia remoção quando a sessão possui inventário operacional', async () => {
    const db = fakeDb({
      selects: [
        [event()],
        [{ id: 's1', eventId: 'e1' }],
        [],
        [{ id: 'inventory-1', sessionId: 's1' }],
      ],
    });

    await expect(service(db).removerSessao('e1', 's1', actor)).rejects.toMatchObject({ response: { code: 'SESSION_HAS_DEPENDENCIES' } });
  });

  it('bloqueia remoção quando a sessão possui operação administrativa', async () => {
    const db = fakeDb({
      selects: [
        [event()],
        [{ id: 's1', eventId: 'e1' }],
        [],
        [],
        [{ id: 'operation-1', sessionId: 's1' }],
      ],
    });

    await expect(service(db).removerSessao('e1', 's1', actor)).rejects.toMatchObject({ response: { code: 'SESSION_HAS_DEPENDENCIES' } });
  });

  it('mantém a remoção e a auditoria na mesma transação com lock da sessão', async () => {
    const lockCalls: string[] = [];
    const committedDeletes: unknown[] = [];
    const pendingDeletes: unknown[] = [];
    const db = fakeDb({
      lockCalls,
      selects: [[event()], [{ id: 's1', eventId: 'e1' }], [], [], [], []],
      delete: (table: unknown) => ({ where: async () => { pendingDeletes.push(table); } }),
    });
    db.insert = () => ({ values: async () => { throw new Error('auditoria indisponível'); } });
    db.transaction = async (callback: (tx: any) => Promise<unknown>) => {
      try {
        const result = await callback(db);
        committedDeletes.push(...pendingDeletes);
        return result;
      } catch (error) {
        pendingDeletes.length = 0;
        throw error;
      }
    };

    await expect(service(db).removerSessao('e1', 's1', actor)).rejects.toThrow('auditoria indisponível');
    expect(lockCalls).toEqual(['update']);
    expect(committedDeletes).toHaveLength(0);
  });
});

function service(db: any, storage?: any) { return new EventosService({ db } as any, { validarPublicacao: jest.fn() } as any, storage); }

function fakeDb(options: { selects?: unknown[][]; lockCalls?: string[]; insert?: (values: any) => Promise<any[]>; update?: () => Promise<any[]>; delete?: (table: unknown) => { where: () => Promise<unknown> } } = {}) {
  let selectIndex = 0;
  const selects = options.selects ?? [];
  const db: any = { updated: false };
  db.select = () => ({ from: () => ({ where: () => { const rows = selects[selectIndex++] ?? []; const promise: any = Promise.resolve(rows); promise.limit = async () => rows; promise.for = (mode: string) => { options.lockCalls?.push(mode); return promise; }; return promise; } }) });
  db.insert = (table: any) => ({ values: (values: any) => ({ returning: async () => options.insert ? options.insert(values) : [] }) });
  db.update = () => ({ set: () => ({ where: () => ({ returning: async () => { db.updated = true; return options.update ? options.update() : []; } }) }) });
  db.delete = (table: unknown) => options.delete ? options.delete(table) : ({ where: async () => undefined });
  db.transaction = async (callback: (tx: any) => Promise<unknown>) => callback(db);
  return db;
}
