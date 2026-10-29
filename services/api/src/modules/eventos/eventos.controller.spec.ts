import { hasEventosAdminAccess } from "./eventos.constants";
import { EventosAdminController } from "./eventos-admin.controller";
import { criarRascunhoSchema } from "@essencia/shared/schemas";
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
  });

  it('aceita somente o título no contrato de criação mínima', () => {
    expect(criarRascunhoSchema.parse({ title: '  Festa Junina  ' })).toEqual({ title: 'Festa Junina' });
    expect(() => criarRascunhoSchema.parse({ title: 'Evento', schoolId: 'outra-escola' })).toThrow();
  });
});
