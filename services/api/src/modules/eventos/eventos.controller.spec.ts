import { hasEventosAdminAccess } from "./eventos.constants";
import { EventosAdminController } from "./eventos-admin.controller";
import { atualizarLocalPadraoEventoSchema, criarRascunhoSchema, localEventoSchema } from "@essencia/shared/schemas";
describe("eventos API contracts", () => {
  it("exposes public and administrative role contract", () => {
    expect(hasEventosAdminAccess("diretora_geral")).toBe(true);
    expect(hasEventosAdminAccess("professora")).toBe(false);
  });
});

describe('eventos workspace contracts', () => {
  it('expõe criação mínima e prontidão', () => {
    const proto = (EventosAdminController as any).prototype;
    expect(typeof proto.createDraft).toBe('function');
    expect(typeof proto.readiness).toBe('function');
    expect(typeof proto.publish).toBe('function');
    expect(typeof proto.uploadImage).toBe('function');
    expect(typeof proto.sessionOptions).toBe('function');
    expect(typeof proto.deleteSession).toBe('function');
  });

  it('aceita somente o título no contrato de criação mínima', () => {
    expect(criarRascunhoSchema.parse({ title: '  Festa Junina  ' })).toEqual({ title: 'Festa Junina' });
    expect(() => criarRascunhoSchema.parse({ title: 'Evento', schoolId: 'outra-escola' })).toThrow();
  });

  it('não expõe rota legada de troca do mapa padrão', () => {
    const proto = (EventosAdminController as any).prototype;
    expect(proto.updateDefaultMap).toBeUndefined();
  });

  it('não expõe rotas administrativas de ofertas', () => {
    const proto = (EventosAdminController as any).prototype;
    expect(proto.offers).toBeUndefined();
    expect(proto.updateOffers).toBeUndefined();
  });

  it('aceita apenas o campo file e rejeita versão inválida no multipart', async () => {
    const service = { atualizarImagem: jest.fn() };
    const controller = new EventosAdminController(service as any, {} as any);
    const request = {
      isMultipart: () => true,
      parts: async function* () {
        yield { type: "file", fieldname: "capa", filename: "capa.jpg", mimetype: "image/jpeg", toBuffer: async () => Buffer.from("imagem") } as any;
        yield { type: "field", fieldname: "expectedUpdatedAt", value: "data-invalida" } as any;
      },
    };

    const result = await controller.uploadImage("e1", request as any, {} as any);

    expect(result).toMatchObject({ success: false, error: { code: "INVALID_REQUEST" } });
    expect(service.atualizarImagem).not.toHaveBeenCalled();
  });

  it('expõe as rotas administrativas de locais e valida o contrato do local', async () => {
    const proto = (EventosAdminController as any).prototype;
    expect(typeof proto.locations).toBe('function');
    expect(typeof proto.createLocation).toBe('function');
    expect(typeof proto.updateLocation).toBe('function');
    expect(typeof proto.updateDefaultLocation).toBe('function');

    expect(localEventoSchema.parse({ name: 'Auditório', address: 'Rua A' })).toEqual({ name: 'Auditório', address: 'Rua A' });
    expect(localEventoSchema.parse({ name: 'Auditório', address: 'Rua A', room: null, instructions: null, accessibility: null })).toEqual({ name: 'Auditório', address: 'Rua A', room: null, instructions: null, accessibility: null });
    expect(() => localEventoSchema.parse({ name: 'Auditório', address: 'Rua A', unknown: true })).toThrow();
  });

  it('retorna envelope de locais e não chama serviço quando o corpo é inválido', async () => {
    const service = { listarLocais: jest.fn(), criarLocal: jest.fn(), atualizarLocal: jest.fn(), atualizarLocalPadrao: jest.fn() };
    const controller = new EventosAdminController(service as any, {} as any);
    await expect(controller.locations('e1', {} as any)).resolves.toMatchObject({ success: true });
    const invalid = await controller.createLocation('e1', { name: '', address: '' }, {} as any);
    expect(invalid).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(service.criarLocal).not.toHaveBeenCalled();
  });

  it('aceita defaultLocationId no contrato do local padrão', () => {
    expect(atualizarLocalPadraoEventoSchema.parse({ defaultLocationId: null })).toEqual({ defaultLocationId: null });
    expect(() => atualizarLocalPadraoEventoSchema.parse({ locationId: null })).toThrow();
  });

  it('encaminha expectedUpdatedAt ao editar local e trocar o padrão', async () => {
    const service = {
      listarLocais: jest.fn(),
      criarLocal: jest.fn(),
      atualizarLocal: jest.fn().mockResolvedValue({ id: 'local-1' }),
      atualizarLocalPadrao: jest.fn().mockResolvedValue({ defaultLocationId: null }),
    };
    const controller = new EventosAdminController(service as any, {} as any);
    const expectedUpdatedAt = '2026-10-29T10:00:00.000Z';

    await controller.updateLocation('e1', 'local-1', { name: 'Auditório', expectedUpdatedAt }, {} as any);
    await controller.updateDefaultLocation('e1', { defaultLocationId: null, expectedUpdatedAt }, {} as any);

    expect(service.atualizarLocal).toHaveBeenCalledWith('e1', 'local-1', { name: 'Auditório' }, expect.anything(), new Date(expectedUpdatedAt));
    expect(service.atualizarLocalPadrao).toHaveBeenCalledWith('e1', null, expect.anything(), new Date(expectedUpdatedAt));
  });
});

describe('classificação indicativa no painel', () => {
  it('valida a faixa e encaminha a versão esperada ao serviço', async () => {
    const service = { atualizarClassificacaoEtaria: jest.fn().mockResolvedValue({ classificacaoEtaria: 'LIVRE' }) };
    const controller = new EventosAdminController(service as any, {} as any);
    const expectedUpdatedAt = '2026-11-17T10:00:00.000Z';

    await expect(controller.updateAgeRating('e1', { classificacaoEtaria: 'LIVRE', expectedUpdatedAt }, {} as any)).resolves.toEqual({ success: true, data: { classificacaoEtaria: 'LIVRE' } });
    expect(service.atualizarClassificacaoEtaria).toHaveBeenCalledWith('e1', 'LIVRE', expect.anything(), new Date(expectedUpdatedAt));
  });

  it('recusa faixa inválida sem chamar o serviço', async () => {
    const service = { atualizarClassificacaoEtaria: jest.fn() };
    const controller = new EventosAdminController(service as any, {} as any);

    await expect(controller.updateAgeRating('e1', { classificacaoEtaria: '13' }, {} as any)).resolves.toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(service.atualizarClassificacaoEtaria).not.toHaveBeenCalled();
  });
});
