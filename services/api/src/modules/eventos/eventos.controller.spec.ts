import { hasEventosAdminAccess } from "./eventos.constants";
import { EventosAdminController } from "./eventos-admin.controller";
import { atualizarMapaPadraoSchema, criarRascunhoSchema } from "@essencia/shared/schemas";
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
});
