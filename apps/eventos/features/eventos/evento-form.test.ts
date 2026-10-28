import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./evento-form.tsx", import.meta.url), "utf8");
describe("EventoForm", () => {
  it("separa rascunho de publicação e valida campos obrigatórios", () => { expect(source).toContain("Salvar rascunho"); expect(source).toContain("Publicar imediatamente"); expect(source).toContain("cancellationPolicy"); expect(source).toContain("publishImmediately"); });
  it("envia sessões e políticas para a rota administrativa", () => { expect(source).toContain("sessions"); expect(source).toContain("ticketTypes"); expect(source).toContain("policies"); expect(source).toContain("/api/eventos/admin/eventos"); });
});
