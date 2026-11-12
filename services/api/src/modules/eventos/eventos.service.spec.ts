import { ConflictException, BadRequestException } from '@nestjs/common';
import 'reflect-metadata';
import { EventosService } from './eventos.service';
import { MapasService } from './mapas/mapas.service';
import { eventoPedidos, eventoSessoes, eventoTiposIngresso, eventos } from '@essencia/db';
import { avaliarPredicado } from './avaliar-predicado.spec-helper';

const actor = { userId: 'u1', role: 'diretora_geral', schoolId: 's1' };
const event = (extra: Record<string, unknown> = {}) => ({
  id: 'e1', schoolId: 's1', title: 'Evento Original', slug: 'evento-manual', status: 'RASCUNHO',
  description: null, summary: null, cancellationPolicy: null, contactEmail: null,
  publishedAt: null, plannedPublicationAt: null, defaultLocationId: null, defaultMapId: null,
  updatedAt: new Date('2026-10-29T10:00:00Z'), ...extra,
});

describe('EventosService contratos de workspace', () => {
  it('usa o ingresso padrão no preço público em vez da meia-entrada', async () => {
    const db = fakeDb({
      selects: [[
        { event: event({ status: 'PUBLICADO', publishedAt: null, slug: 'ballet' }), session: { id: 's1', eventId: 'e1', status: 'PUBLICADA', startsAt: new Date('2026-12-07T19:00:00Z'), salesStartsAt: null, salesEndsAt: null }, location: { name: 'Teatro Municipal' }, ticket: { name: 'Ingresso', priceCents: 4500, active: true }, inventory: { status: 'DISPONIVEL' } },
        { event: event({ status: 'PUBLICADO', publishedAt: null, slug: 'ballet' }), session: { id: 's1', eventId: 'e1', status: 'PUBLICADA', startsAt: new Date('2026-12-07T19:00:00Z'), salesStartsAt: null, salesEndsAt: null }, location: { name: 'Teatro Municipal' }, ticket: { name: 'Meia-entrada', priceCents: 2250, active: true }, inventory: { status: 'DISPONIVEL' } },
      ]],
    });

    await expect(service(db).listarPublicados(new Date('2026-11-09T12:00:00Z'))).resolves.toEqual([
      expect.objectContaining({ fromPriceCents: 4500 }),
    ]);
  });

  it.each(['mapa-v2', null])('publicar recusa sessão legada com mapId %s mesmo se as regras já tiverem passado', async (mapId) => {
    const db = fakeDb({
      selects: [
        [event({ defaultMapId: 'mapa-v4', status: 'RASCUNHO' })],
        [{ id: 'sessao-1', eventId: 'e1', mapId }],
      ],
      update: async () => [event({ defaultMapId: 'mapa-v4', status: 'PUBLICADO' })],
    });

    await expect(service(db).publicar('e1', actor)).rejects.toMatchObject({ response: { code: 'SESSION_MAP_MISMATCH' } });
    expect(db.updated).toBe(false);
  });

  it('criarSessao grava o mapa do evento na sessão', async () => {
    const inserted: any[] = [];
    const db = fakeDb({ selects: [[event({ defaultMapId: 'mapa-1' })]], insert: async (values: any) => { inserted.push(values); return [{ id: 's1', ...values }]; } });

    await service(db).criarSessao('e1', {
      startsAt: new Date('2026-11-01T10:00:00Z'),
      endsAt: new Date('2026-11-01T11:00:00Z'),
      capacity: 10,
    }, actor);

    expect(inserted[0]).toMatchObject({ mapId: 'mapa-1' });
  });

  it('criarSessao em evento sem mapa grava mapId null', async () => {
    const inserted: any[] = [];
    const db = fakeDb({ selects: [[event({ defaultMapId: null })]], insert: async (values: any) => { inserted.push(values); return [{ id: 's1', ...values }]; } });

    await service(db).criarSessao('e1', {
      startsAt: new Date('2026-11-01T10:00:00Z'),
      endsAt: new Date('2026-11-01T11:00:00Z'),
      capacity: 10,
    }, actor);

    expect(inserted[0]).toMatchObject({ mapId: null });
  });

  it('registra MapasService como token de DI mesmo sendo opcional', () => {
    const selfParamTypes = Reflect.getMetadata('self:paramtypes', EventosService) as Array<{ index: number; param: unknown }>;
    expect(selfParamTypes).toEqual(expect.arrayContaining([{ index: 3, param: MapasService }]));
  });

  it('lista locais da escola do evento com indicação do padrão', async () => {
    const updatedAt = new Date('2026-10-29T10:00:00Z');
    const db = fakeDb({
      selects: [
        [event({ defaultLocationId: 'l1', updatedAt })],
        [
          { id: 'l1', schoolId: 's1', name: 'Auditório', address: 'Rua A', room: null, instructions: 'Chegar cedo', accessibility: null },
          { id: 'l2', schoolId: 's1', name: 'Quadra', address: 'Rua B', room: 'Coberta', instructions: null, accessibility: 'Rampa' },
          { id: 'l3', schoolId: 's2', name: 'Outra escola', address: 'Rua C', room: null, instructions: null, accessibility: null },
        ],
      ],
    });

    await expect(service(db).listarLocais('e1', actor)).resolves.toEqual({
      items: [
        { id: 'l1', name: 'Auditório', address: 'Rua A', room: null, instructions: 'Chegar cedo', accessibility: null, isDefault: true },
        { id: 'l2', name: 'Quadra', address: 'Rua B', room: 'Coberta', instructions: null, accessibility: 'Rampa', isDefault: false },
      ],
      defaultLocationId: 'l1',
      updatedAt,
    });
  });

  it('cadastra local com a escola do evento e registra auditoria', async () => {
    const inserted: any[] = [];
    const db = fakeDb({
      selects: [[event({ defaultLocationId: null })]],
      insert: async (values: any) => { inserted.push(values); return [{ id: 'l1', ...values }]; },
      update: async () => [event({ updatedAt: new Date('2026-10-29T11:00:00Z') })],
    });
    const insert = db.insert;
    db.insert = (table: unknown) => {
      const builder = insert(table);
      return { values: (values: any) => { inserted.push(values); return builder.values(values); } };
    };

    const result = await service(db).criarLocal('e1', { name: 'Auditório', address: 'Rua A', room: null }, actor);
    expect(result).toMatchObject({ id: 'l1', schoolId: 's1', name: 'Auditório', address: 'Rua A' });
    expect(inserted[0]).toMatchObject({ schoolId: 's1', name: 'Auditório', address: 'Rua A' });
    expect(inserted.some((value) => value.resourceType === 'local' && value.action === 'CRIADO')).toBe(true);
  });

  it('rejeita local de outra escola sem alterar o evento', async () => {
    const db = fakeDb({ selects: [[event({ schoolId: 's2' })]] });
    await expect(service(db).criarLocal('e1', { name: 'Auditório', address: 'Rua A' }, actor)).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
    expect(db.updated).toBe(false);
  });

  it('edita local preservando o ID e os campos de referência', async () => {
    const location = { id: 'l1', schoolId: 's1', name: 'Auditório', address: 'Rua A', room: null, instructions: null, accessibility: null };
    const db = fakeDb({
      selects: [[event({ defaultLocationId: 'l1' })], [location]],
      update: async () => [{ ...location, name: 'Auditório novo', address: 'Rua B' }],
    });
    const audited: any[] = [];
    const insert = db.insert;
    db.insert = (table: unknown) => {
      const builder = insert(table);
      return { values: (values: any) => { audited.push(values); return builder.values(values); } };
    };

    await expect(service(db).atualizarLocal('e1', 'l1', { name: 'Auditório novo', address: 'Rua B' }, actor)).resolves.toMatchObject({ id: 'l1', name: 'Auditório novo', address: 'Rua B' });
    expect(audited).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'ATUALIZADO', resourceType: 'local', resourceId: 'l1' })]));
  });

  it('faz rollback quando a versão do evento conflita depois de atualizar o local', async () => {
    const location = { id: 'l1', schoolId: 's1', name: 'Auditório', address: 'Rua A', room: null, instructions: null, accessibility: null };
    const expectedUpdatedAt = new Date('2026-10-29T10:00:00Z');
    const db = fakeDb({ selects: [[event({ updatedAt: expectedUpdatedAt })], [location]] });
    let localMutated = false;
    let updateCount = 0;
    db.update = () => ({
      set: () => ({
        where: () => ({
          returning: async () => {
            updateCount += 1;
            if (updateCount === 1) {
              localMutated = true;
              return [{ ...location, name: 'Auditório editado' }];
            }
            return [];
          },
        }),
      }),
    });
    db.transaction = async (callback: (tx: any) => Promise<unknown>) => {
      try {
        return await callback(db);
      } catch (error) {
        localMutated = false;
        throw error;
      }
    };

    await expect(service(db).atualizarLocal('e1', 'l1', { name: 'Auditório editado' }, actor, expectedUpdatedAt)).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
    expect(localMutated).toBe(false);
  });

  it('rejeita troca para local inexistente sem perder o padrão atual', async () => {
    const db = fakeDb({ selects: [[event({ defaultLocationId: 'l1' })], []] });
    await expect(service(db).atualizarLocalPadrao('e1', 'l-inexistente', actor)).rejects.toMatchObject({ response: { code: 'LOCATION_NOT_FOUND' } });
    expect(db.updated).toBe(false);
  });

  it('rejeita conflito de versão ao trocar padrão sem mutação parcial', async () => {
    const current = new Date('2026-10-29T11:00:00Z');
    const db = fakeDb({ selects: [[event({ defaultLocationId: 'l1', updatedAt: current })], [{ id: 'l2', schoolId: 's1' }]] });
    await expect(service(db).atualizarLocalPadrao('e1', 'l2', actor, new Date('2026-10-29T10:00:00Z'))).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
    expect(db.updated).toBe(false);
  });

  it('permite remover o padrão com null e audita a alteração', async () => {
    const db = fakeDb({
      selects: [[event({ defaultLocationId: 'l1' })]],
      update: async () => [event({ defaultLocationId: null })],
    });
    await expect(service(db).atualizarLocalPadrao('e1', null, actor)).resolves.toMatchObject({ defaultLocationId: null });
  });

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
    }, actor)).rejects.toMatchObject({ response: { code: 'SESSION_LOCATION_INVALID' } });
  });

  it('trava o evento antes da sessão ao atualizar a referência do mapa', async () => {
    const lockOrder: unknown[] = [];
    let selectCount = 0;
    const db: any = {
      select: () => ({ from: () => ({ where: () => {
        selectCount += 1;
        const rows = selectCount === 1 ? [event()] : selectCount === 2 ? [{ id: 's1', eventId: 'e1', mapId: null }] : [];
        const query: any = Promise.resolve(rows);
        query.for = () => { lockOrder.push(selectCount); return query; };
        query.limit = async () => rows;
        return query;
      } }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [{ id: 's1', eventId: 'e1' }] }) }) }),
      insert: () => ({ values: async () => undefined }),
      transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    await service(db).atualizarSessao('e1', 's1', { capacity: 12 }, actor);

    expect(lockOrder).toEqual([1, 2]);
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
  it("desativa ingresso existente dentro do evento e devolve seu id", async () => {
    const db = fakeDb({
      selects: [[event()]],
      update: async () => [{ id: "ticket-1" }],
    });

    await expect(service(db).removerIngresso("e1", "ticket-1", actor)).resolves.toEqual({ id: "ticket-1" });
    expect(db.updated).toBe(true);
  });

  it("inclui somente as ofertas públicas ativas em cada sessão pública", async () => {
    const ofertas = { listarPublicas: jest.fn().mockResolvedValue([{ id: "o1", version: 2, name: "A partir de 10", minQuantity: 10, maxQuantity: null, discountPercent: 15 }]) };
    const db: any = publicSessionsDb([
      [{ id: "t1", eventId: "e1", name: "Inteira", description: null, priceCents: 4500, maxPerOrder: null, eligibility: null, active: true }],
      [{ session: { id: "s1", startsAt: new Date("2026-11-01T10:00:00Z"), endsAt: new Date("2026-11-01T11:00:00Z"), status: "PUBLICADA", capacity: 20, mapId: null, salesStartsAt: null, salesEndsAt: null }, location: null, inventory: { status: "DISPONIVEL" } }],
    ]);
    const instance = new EventosService({ db } as any, { validarPublicacao: jest.fn() } as any, undefined, undefined, ofertas as any);
    jest.spyOn(instance as any, "getPublicBySlug").mockResolvedValue({ id: "e1" });

    await expect(instance.listarSessoesPublicas("evento")).resolves.toEqual([expect.objectContaining({ id: "s1", offers: [{ id: "o1", version: 2, name: "A partir de 10", minQuantity: 10, maxQuantity: null, discountPercent: 15 }] })]);
    expect(ofertas.listarPublicas).toHaveBeenCalledWith("e1");
  });

  it("devolve palco, entradas e letras só das fileiras com assento", async () => {
    const db = fakeDb({
      selects: [
        [{ id: "s1", eventId: "e1", mapId: "mapa-1", status: "PUBLICADA" }],
        [event({ status: "PUBLICADO" })],
        [{ id: "mapa-1", status: "CONFIRMADO", layout: { versao: 1, largura: 800, altura: 600, rotulos: [{ fileira: "A", x: 10, y: 20 }, { fileira: "X", x: 30, y: 40 }], elementos: [{ tipo: "PALCO", texto: "Palco", x: 100, y: 50 }, { tipo: "ENTRADA", texto: "Entrada", x: 200, y: 50 }] } }],
        [{ seat: { id: "seat-1", rowLabel: "A", seatNumber: "1", x: 10, y: 20, width: 50, height: 50, category: "COMUM", accessible: false, metadata: { rotacao: 90 } }, inventory: { status: "DISPONIVEL" } }, { seat: { id: "seat-2", rowLabel: "A", seatNumber: "2", x: 70, y: 20, width: 50, height: 50, category: "COMUM", accessible: false, metadata: {} }, inventory: { status: "DISPONIVEL" } }],
      ],
    });

    await expect(service(db).getPublicMap("s1")).resolves.toEqual({
      sessionId: "s1",
      mapId: "mapa-1",
      seats: [
        expect.objectContaining({ id: "seat-1", rowLabel: "A", rotacao: 90 }),
        expect.objectContaining({ id: "seat-2", rowLabel: "A", rotacao: 0 }),
      ],
      layout: { largura: 800, altura: 600, rotulos: [{ fileira: "A", x: 10, y: 20 }], elementos: [{ tipo: "PALCO", texto: "Palco", x: 100, y: 50 }, { tipo: "ENTRADA", texto: "Entrada", x: 200, y: 50 }] },
    });
  });

  it("não expõe campos internos do inventário na resposta pública", async () => {
    const db = fakeDb({
      selects: [[{ id: "s1", eventId: "e1", mapId: "mapa-1", status: "PUBLICADA" }], [event({ status: "PUBLICADO" })], [{ id: "mapa-1", status: "CONFIRMADO", layout: null }], [
        { seat: { id: "seat-1", rowLabel: "A", seatNumber: "1", x: 10, y: 20, width: 50, height: 50, category: null, accessible: false, metadata: {} }, inventory: { id: "inv-1", status: "VENDIDO" } },
      ]],
    });

    const mapa = await service(db).getPublicMap("s1");

    expect(mapa.seats[0]).toMatchObject({ id: "seat-1", state: "sold" });
    expect(mapa.seats[0]).not.toHaveProperty("inventorySeatId");
    expect(mapa.seats[0]).not.toHaveProperty("inventoryStatus");
  });

  it("devolve layout nulo quando o mapa não tem desenho", async () => {
    const db = fakeDb({ selects: [[{ id: "s1", eventId: "e1", mapId: "mapa-1", status: "PUBLICADA" }], [event({ status: "PUBLICADO" })], [{ id: "mapa-1", status: "CONFIRMADO", layout: null }], []] });

    await expect(service(db).getPublicMap("s1")).resolves.toMatchObject({ sessionId: "s1", mapId: "mapa-1", seats: [], layout: null });
  });

  it("usa a rotação gravada em metadata e zero quando falta", async () => {
    const db = fakeDb({
      selects: [[{ id: "s1", eventId: "e1", mapId: "mapa-1", status: "PUBLICADA" }], [event({ status: "PUBLICADO" })], [{ id: "mapa-1", status: "CONFIRMADO", layout: null }], [
        { seat: { id: "seat-1", rowLabel: "A", seatNumber: "1", x: 10, y: 20, width: 50, height: 50, category: null, accessible: false, metadata: { rotacao: "12.5" } }, inventory: { status: "DISPONIVEL" } },
        { seat: { id: "seat-2", rowLabel: "A", seatNumber: "2", x: 70, y: 20, width: 50, height: 50, category: null, accessible: false, metadata: { rotacao: "invalida" } }, inventory: { status: "DISPONIVEL" } },
      ]],
    });

    await expect(service(db).getPublicMap("s1")).resolves.toMatchObject({ seats: [expect.objectContaining({ rotacao: 12.5 }), expect.objectContaining({ rotacao: 0 })] });
  });


  describe('tipo de ingresso interno (cortesia)', () => {
    const inteira = () => ({ id: 'ticket-inteira', eventId: 'e1', name: 'Inteira', description: null, priceCents: 4500, maxPerOrder: null, eligibility: null, version: 1, internal: false, active: true });
    const cortesia = () => ({ id: 'ticket-cortesia', eventId: 'e1', name: 'Cortesia', description: null, priceCents: 0, maxPerOrder: null, eligibility: null, version: 1, internal: true, active: true });

    it('listarPublicados e getPublicBySlug não devolvem o tipo interno', async () => {
      const db = tiposDb({ tipos: [inteira(), cortesia()], event: event({ status: 'PUBLICADO', slug: 'ballet' }) });

      const lista = await service(db).listarPublicados(new Date('2026-11-09T12:00:00Z'));
      expect(lista).toEqual([expect.objectContaining({ slug: 'ballet', fromPriceCents: 4500 })]);
      expect(db.tiposVistosNoJoin).toEqual(['ticket-inteira']);

      await expect(service(db).getPublicBySlug('ballet', new Date('2026-11-09T12:00:00Z'))).resolves.toMatchObject({ fromPriceCents: 4500 });
      expect(db.tiposVistosNoJoin).toEqual(['ticket-inteira']);
    });

    it('um evento só com o tipo interno não expõe preço', async () => {
      const db = tiposDb({ tipos: [cortesia()], event: event({ status: 'PUBLICADO', slug: 'ballet' }) });
      await expect(service(db).listarPublicados(new Date('2026-11-09T12:00:00Z'))).resolves.toEqual([expect.objectContaining({ fromPriceCents: null })]);
    });

    it('listarSessoesPublicas não devolve o tipo interno', async () => {
      const db = tiposDb({ tipos: [inteira(), cortesia()], event: event({ status: 'PUBLICADO', slug: 'ballet' }) });
      const instance = service(db);
      jest.spyOn(instance, 'getPublicBySlug').mockResolvedValue({ id: 'e1' } as any);

      const sessoes = await instance.listarSessoesPublicas('ballet');

      expect(sessoes).toHaveLength(1);
      expect(sessoes[0]!.ticketTypes.map((tipo: any) => tipo.id)).toEqual(['ticket-inteira']);
    });

    it('listarIngressosAdmin não devolve o tipo interno', async () => {
      const db = tiposDb({ tipos: [inteira(), cortesia()], event: event() });
      const lista = await service(db).listarIngressosAdmin('e1', actor);
      expect(lista.map((tipo: any) => tipo.id)).toEqual(['ticket-inteira']);
    });

    it('atualizarIngressos sem o tipo interno no payload o mantém ativo', async () => {
      const db = tiposDb({ tipos: [inteira(), cortesia()], event: event() });

      await service(db).atualizarIngressos('e1', [{ id: 'ticket-inteira', name: 'Inteira', priceCents: 5000 }], actor);

      expect(db.estado.find((tipo: any) => tipo.id === 'ticket-cortesia')).toMatchObject({ active: true });
      expect(db.estado.find((tipo: any) => tipo.id === 'ticket-inteira')).toMatchObject({ active: true, priceCents: 5000 });
    });

    it('atualizarIngressos sem o tipo comum o desativa e continua preservando o interno', async () => {
      const db = tiposDb({ tipos: [inteira(), cortesia()], event: event() });

      await service(db).atualizarIngressos('e1', [], actor);

      expect(db.estado.find((tipo: any) => tipo.id === 'ticket-inteira')).toMatchObject({ active: false });
      expect(db.estado.find((tipo: any) => tipo.id === 'ticket-cortesia')).toMatchObject({ active: true });
    });

    it('removerIngresso do tipo interno responde não encontrado e não o desativa', async () => {
      const db = tiposDb({ tipos: [inteira(), cortesia()], event: event() });

      await expect(service(db).removerIngresso('e1', 'ticket-cortesia', actor)).rejects.toMatchObject({ response: { code: 'TICKET_NOT_FOUND' } });
      expect(db.estado.find((tipo: any) => tipo.id === 'ticket-cortesia')).toMatchObject({ active: true });
    });
  });

  describe('cortesias não travam a edição do evento e da sessão', () => {
    const cortesiaAtiva = { id: 'p-cortesia-1', eventId: 'e1', sessionId: 's1', origin: 'CORTESIA', status: 'CONFIRMADO' };
    const cortesiaCancelada = { id: 'p-cortesia-2', eventId: 'e1', sessionId: 's1', origin: 'CORTESIA', status: 'CANCELADO' };
    const venda = { id: 'p-venda', eventId: 'e1', sessionId: 's1', origin: 'VENDA', status: 'CONFIRMADO' };

    it('atualizarEvento edita evento que só tem cortesias (ativa e cancelada)', async () => {
      const db = pedidosDb({ event: event(), pedidos: [cortesiaAtiva, cortesiaCancelada] });
      await expect(service(db).atualizarEvento('e1', { title: 'Novo Título' }, actor)).resolves.toMatchObject({ id: 'e1' });
      expect(db.updated).toBe(true);
    });

    it('atualizarEvento continua bloqueado quando há pedido de venda', async () => {
      const db = pedidosDb({ event: event(), pedidos: [cortesiaAtiva, venda] });
      await expect(service(db).atualizarEvento('e1', { title: 'Novo Título' }, actor)).rejects.toMatchObject({ response: { code: 'EVENT_HAS_SALES' } });
      expect(db.updated).toBe(false);
    });

    it('atualizarSessao edita sessão que só tem cortesias (ativa e cancelada)', async () => {
      const db = pedidosDb({ event: event(), pedidos: [cortesiaAtiva, cortesiaCancelada] });
      await expect(service(db).atualizarSessao('e1', 's1', { capacity: 12 }, actor)).resolves.toMatchObject({ id: 's1' });
      expect(db.updated).toBe(true);
    });

    it('atualizarSessao continua bloqueado quando há pedido de venda', async () => {
      const db = pedidosDb({ event: event(), pedidos: [cortesiaCancelada, venda] });
      await expect(service(db).atualizarSessao('e1', 's1', { capacity: 12 }, actor)).rejects.toMatchObject({ response: { code: 'EVENT_HAS_SALES' } });
      expect(db.updated).toBe(false);
    });
  });

});

/** Banco que filtra `eventoPedidos` pelos predicados da consulta, para provar o critério de bloqueio. */
function pedidosDb(config: { event: any; pedidos: any[] }) {
  const db: any = { updated: false };
  const resposta = (linhas: any[]) => Object.assign(Promise.resolve(linhas), { limit: async (n: number) => linhas.slice(0, n), for: () => resposta(linhas) });
  db.select = () => {
    let tabela: unknown;
    const builder: any = {};
    builder.from = (alvo: unknown) => { tabela = alvo; return builder; };
    builder.where = (predicado: any) => {
      if (tabela === eventoPedidos) return resposta(config.pedidos.filter((pedido) => avaliarPredicado(predicado, pedido)));
      if (tabela === eventoSessoes) return resposta([{ id: 's1', eventId: 'e1', mapId: null }]);
      if (tabela === eventos) return resposta([config.event]);
      return resposta([]);
    };
    return builder;
  };
  db.update = (tabela: unknown) => ({ set: (valores: any) => ({ where: () => ({ returning: async () => { db.updated = true; return tabela === eventoSessoes ? [{ id: 's1', eventId: 'e1', ...valores }] : [{ ...config.event, ...valores }]; } }) }) });
  db.insert = () => ({ values: () => Object.assign(Promise.resolve(undefined), { returning: async () => [] }) });
  db.transaction = async (callback: (tx: any) => Promise<unknown>) => callback(db);
  return db;
}

function service(db: any, storage?: any, mapas?: any) { return new EventosService({ db } as any, { validarPublicacao: jest.fn() } as any, storage, mapas); }

function fakeDb(options: { selects?: unknown[][]; lockCalls?: string[]; insert?: (values: any) => Promise<any[]>; update?: () => Promise<any[]>; delete?: (table: unknown) => { where: () => Promise<unknown> } } = {}) {
  let selectIndex = 0;
  const selects = options.selects ?? [];
  const db: any = { updated: false };
  db.select = () => {
    const builder: any = {};
    builder.from = () => builder;
    builder.innerJoin = () => builder;
    builder.leftJoin = () => builder;
    builder.where = () => { const rows = selects[selectIndex++] ?? []; const promise: any = Promise.resolve(rows); promise.limit = async () => rows; promise.for = (mode: string) => { options.lockCalls?.push(mode); return promise; }; return promise; };
    return builder;
  };
  db.insert = (table: any) => ({ values: (values: any) => ({ returning: async () => options.insert ? options.insert(values) : [] }) });
  db.update = () => ({ set: () => ({ where: () => ({ returning: async () => { db.updated = true; return options.update ? options.update() : []; } }) }) });
  db.delete = (table: unknown) => options.delete ? options.delete(table) : ({ where: async () => undefined });
  db.transaction = async (callback: (tx: any) => Promise<unknown>) => callback(db);
  return db;
}

function publicSessionsDb(selects: unknown[][]) {
  let index = 0;
  const db: any = {};
  db.select = () => {
    const builder: any = {};
    builder.from = () => builder;
    builder.leftJoin = () => builder;
    builder.where = () => {
      const query: any = Promise.resolve(selects[index++] ?? []);
      query.orderBy = () => query;
      return query;
    };
    return builder;
  };
  return db;
}

/** Banco em memória que avalia os predicados de `eventoTiposIngresso` (inclusive nos joins). */
function tiposDb(config: { tipos: any[]; event: any }) {
  const estado = config.tipos.map((tipo) => ({ ...tipo }));
  const db: any = { estado, tiposVistosNoJoin: [] as string[] };
  const resposta = (linhas: any[]) => Object.assign(Promise.resolve(linhas), { limit: async () => linhas, orderBy: async () => [...linhas].sort((a, b) => String(a.name).localeCompare(String(b.name))) });
  db.select = () => {
    let tabela: unknown;
    let predicadoJoin: any;
    const builder: any = {};
    builder.from = (alvo: unknown) => { tabela = alvo; return builder; };
    builder.innerJoin = () => builder;
    builder.leftJoin = (alvo: unknown, predicado: any) => { if (alvo === eventoTiposIngresso) predicadoJoin = predicado; return builder; };
    builder.where = (predicado: any) => {
      if (tabela === eventoTiposIngresso) return resposta(estado.filter((tipo: any) => avaliarPredicado(predicado, tipo)));
      const sessao = { id: 's1', eventId: 'e1', status: 'PUBLICADA', startsAt: new Date('2026-12-07T19:00:00Z'), endsAt: new Date('2026-12-07T21:00:00Z'), capacity: 10, mapId: null, salesStartsAt: null, salesEndsAt: null };
      if (tabela === eventoSessoes) return resposta([{ session: sessao, location: null, inventory: { status: 'DISPONIVEL' } }]);
      if (predicadoJoin === undefined) return resposta([config.event]);
      const visiveis = estado.filter((tipo: any) => avaliarPredicado(predicadoJoin, tipo));
      db.tiposVistosNoJoin = visiveis.map((tipo: any) => tipo.id);
      const base = { event: config.event, session: sessao, location: { name: 'Teatro Municipal' }, inventory: { status: 'DISPONIVEL' } };
      return resposta(visiveis.length ? visiveis.map((ticket: any) => ({ ...base, ticket })) : [{ ...base, ticket: null }]);
    };
    return builder;
  };
  db.insert = () => ({ values: () => ({ returning: async () => [] }) });
  db.update = (alvo: unknown) => ({ set: (valores: any) => ({ where: (predicado: any) => {
    const afetados = alvo === eventoTiposIngresso ? estado.filter((tipo: any) => avaliarPredicado(predicado, tipo)) : [];
    for (const tipo of afetados) Object.assign(tipo, valores);
    return Object.assign(Promise.resolve(afetados), { returning: async () => afetados });
  } }) });
  return db;
}
