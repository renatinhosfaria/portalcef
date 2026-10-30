import { hasEventosAdminAccess } from "./eventos.constants";
import { EventosAdminController } from "./eventos-admin.controller";
import { atualizarLocalPadraoEventoSchema, atualizarMapaPadraoSchema, criarRascunhoSchema, localEventoSchema } from "@essencia/shared/schemas";
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

  it('expõe troca transacional do mapa padrão com contrato estrito', () => {
    const proto = (EventosAdminController as any).prototype;
    expect(typeof proto.updateDefaultMap).toBe('function');
    expect(() => atualizarMapaPadraoSchema.parse({ mapId: 'mapa-invalido' })).toThrow();
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
