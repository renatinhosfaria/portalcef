import { EventosOfertasPublicService } from "./eventos-ofertas-public.service";

describe("EventosOfertasPublicService", () => {
  it("lista somente ofertas percentuais ativas do evento", async () => {
    const database = {
      db: {
        select: () => ({
          from: () => ({
            where: async () => [
              {
                id: "oferta-ativa",
                eventId: "evento-1",
                name: "A partir de 10",
                minQuantity: 10,
                maxQuantity: null,
                pricingType: "PERCENTUAL",
                discountPercent: 15,
                priceCents: null,
                version: 2,
                active: true,
              },
              {
                id: "oferta-inativa",
                eventId: "evento-1",
                name: "Oferta antiga",
                minQuantity: 5,
                maxQuantity: null,
                pricingType: "PERCENTUAL",
                discountPercent: 10,
                priceCents: null,
                version: 1,
                active: false,
              },
            ],
          }),
        }),
      },
    };

    await expect(new EventosOfertasPublicService(database as any).listarPublicas("evento-1")).resolves.toEqual([
      {
        id: "oferta-ativa",
        version: 2,
        name: "A partir de 10",
        minQuantity: 10,
        maxQuantity: null,
        discountPercent: 15,
      },
    ]);
  });
});
