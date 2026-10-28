import { hasEventosAdminAccess } from "./eventos.constants";
describe("eventos API contracts", () => {
  it("exposes public and administrative role contract", () => {
    expect(hasEventosAdminAccess("diretora_geral")).toBe(true);
    expect(hasEventosAdminAccess("professora")).toBe(false);
  });
});
