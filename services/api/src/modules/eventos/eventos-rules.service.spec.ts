import { EVENTOS_ADMIN_ROLES, hasEventosAdminAccess } from "./eventos.constants";
describe("EventosRulesService contracts", () => {
  it.each(["diretora_geral", "gerente_unidade", "auxiliar_administrativo", "master"])("allows %s", (role: string) => expect(hasEventosAdminAccess(role)).toBe(true));
  it("rejects unrelated roles", () => expect(hasEventosAdminAccess("professora")).toBe(false));
  it("keeps the four explicit roles", () => expect(EVENTOS_ADMIN_ROLES).toEqual(["master", "diretora_geral", "gerente_unidade", "auxiliar_administrativo"]));
});
