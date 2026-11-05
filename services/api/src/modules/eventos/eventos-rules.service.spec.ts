import { EVENTOS_ADMIN_ROLES, hasEventosAdminAccess } from "./eventos.constants";
import { EventosRulesService } from "./eventos-rules.service";
import { eventoMapas, eventoSessoes, eventos } from "@essencia/db";
describe("EventosRulesService contracts", () => {
  it.each(["diretora_geral", "gerente_unidade", "auxiliar_administrativo", "master"])("allows %s", (role: string) => expect(hasEventosAdminAccess(role)).toBe(true));
  it("rejects unrelated roles", () => expect(hasEventosAdminAccess("professora")).toBe(false));
  it("keeps the four explicit roles", () => expect(EVENTOS_ADMIN_ROLES).toEqual(["master", "diretora_geral", "gerente_unidade", "auxiliar_administrativo"]));

  it.each(["mapa-v2", null])("recusa publicação quando a sessão não aponta exatamente para o mapa do evento (%s)", async (mapId) => {
    const db = {
      select: () => ({
        from: (table: any) => ({
          where: async () => {
            if (table === eventos) return [{ id: "e1", defaultMapId: "mapa-v4", title: "Evento", description: "Descrição", cancellationPolicy: "Política", contactEmail: "contato@example.com", plannedPublicationAt: null }];
            if (table === eventoMapas) return [{ id: "mapa-v4", status: "CONFIRMADO" }];
            if (table === eventoSessoes) return [{ id: "s1", startsAt: new Date("2026-12-01T10:00:00Z"), endsAt: new Date("2026-12-01T11:00:00Z"), capacity: 1, mapId }];
            return [];
          },
        }),
      }),
    };

    await expect(new EventosRulesService({ db } as any).validarPublicacao("e1")).rejects.toMatchObject({ response: { code: "SESSION_MAP_MISMATCH" } });
  });
});
