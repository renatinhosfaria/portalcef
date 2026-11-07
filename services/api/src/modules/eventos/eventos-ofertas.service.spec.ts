import { BadRequestException } from "@nestjs/common";
import type { EventoActor } from "@essencia/shared/types";
import { EventosOfertasService } from "./eventos-ofertas.service";
import { EventosAdminController } from "./eventos-admin.controller";

const actor: EventoActor = {
  userId: "u1",
  role: "diretora_geral",
  schoolId: "s1",
};
const evento = (extra: Record<string, unknown> = {}) => ({
  id: "e1",
  schoolId: "s1",
  ...extra,
});
const oferta = (extra: Record<string, unknown> = {}) => ({
  id: "o1",
  eventId: "e1",
  name: "A partir de 10",
  pricingType: "PERCENTUAL",
  minQuantity: 10,
  maxQuantity: null,
  priceCents: null,
  discountPercent: 15,
  version: 1,
  active: true,
  ...extra,
});

describe("EventosOfertasService", () => {
  it("expõe as rotas administrativas de ofertas", () => {
    expect(typeof (EventosAdminController.prototype as any).offers).toBe(
      "function",
    );
    expect(typeof (EventosAdminController.prototype as any).updateOffers).toBe(
      "function",
    );
  });

  it("recusa evento fora do escopo da escola do ator", async () => {
    const db = fakeDb({ selects: [[evento({ schoolId: "s2" })]] });

    await expect(service(db).listarAdmin("e1", actor)).rejects.toMatchObject({
      response: { code: "FORBIDDEN" },
    });
  });

  it("recusa percentual inválido", async () => {
    const db = fakeDb({ selects: [[evento()], []] });

    await expect(
      service(db).atualizar(
        "e1",
        [
          {
            name: "Oferta",
            pricingType: "PERCENTUAL",
            minQuantity: 10,
            discountPercent: 101,
          } as any,
        ],
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persiste faixa aberta com preço percentual e retorna o resumo administrativo", async () => {
    const inserted: any[] = [];
    const db = fakeDb({
      selects: [[evento()], []],
      insert: (values) => {
        inserted.push(values);
        return [{ id: "o2", ...values }];
      },
    });

    await expect(
      service(db).atualizar(
        "e1",
        [
          {
            name: "A partir de 10",
            pricingType: "PERCENTUAL",
            minQuantity: 10,
            maxQuantity: null,
            discountPercent: 15,
          },
        ],
        actor,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "o2",
        version: 1,
        maxQuantity: null,
        discountPercent: 15,
        active: true,
      }),
    ]);
    expect(inserted[0]).toMatchObject({
      eventId: "e1",
      pricingType: "PERCENTUAL",
      maxQuantity: null,
      discountPercent: 15,
      priceCents: null,
    });
  });

  it("desativa a versão anterior, cria a nova versão e registra auditoria", async () => {
    const inserted: any[] = [];
    const updated: any[] = [];
    const db = fakeDb({
      selects: [[evento()], [oferta()]],
      insert: (values) => {
        inserted.push(values);
        return [{ id: "o2", ...values }];
      },
      update: (values) => {
        updated.push(values);
        return [oferta({ active: false })];
      },
    });

    const result = await service(db).atualizar(
      "e1",
      [
        {
          id: "o1",
          name: "A partir de 10 revisada",
          pricingType: "PERCENTUAL",
          minQuantity: 10,
          maxQuantity: null,
          discountPercent: 20,
          version: 1,
        },
      ],
      actor,
    );

    expect(result[0]).toMatchObject({
      id: "o2",
      version: 2,
      name: "A partir de 10 revisada",
      discountPercent: 20,
      active: true,
    });
    expect(updated).toEqual(
      expect.arrayContaining([expect.objectContaining({ active: false })]),
    );
    expect(inserted[0]).toMatchObject({
      eventId: "e1",
      version: 2,
      active: true,
    });
    expect(inserted).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventId: "e1" })]),
    );
    expect(db.audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceType: "oferta",
          action: "ATUALIZADO",
        }),
      ]),
    );
  });

  it("recusa uma versão stale antes de desativar ou inserir a oferta", async () => {
    const inserted: any[] = [];
    const updated: any[] = [];
    const db = fakeDb({
      selects: [[evento()], [oferta({ version: 3 })]],
      insert: (values) => {
        inserted.push(values);
        return [{ id: "o2", ...values }];
      },
      update: (values) => {
        updated.push(values);
        return [oferta({ active: false })];
      },
    });

    await expect(service(db).atualizar("e1", [{
      id: "o1",
      version: 2,
      name: "Oferta stale",
      pricingType: "PERCENTUAL",
      minQuantity: 10,
      discountPercent: 20,
    }], actor)).rejects.toMatchObject({
      response: { code: "VERSION_CONFLICT", message: "A oferta foi alterada por outra pessoa" },
    });
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });

  it("preserva compatibilidade por tipo ao versionar quando o campo é omitido", async () => {
    const inserted: any[] = [];
    const db = fakeDb({
      selects: [[evento()], [oferta({ compatibleTicketTypeIds: ["ticket-adulto", "ticket-infantil"] })]],
      insert: (values) => {
        inserted.push(values);
        return [{ id: "o2", ...values }];
      },
    });

    await service(db).atualizar("e1", [{ id: "o1", version: 1, name: "Oferta revisada", pricingType: "PERCENTUAL", minQuantity: 10, discountPercent: 20 }], actor);

    expect(inserted[0]).toMatchObject({ compatibleTicketTypeIds: ["ticket-adulto", "ticket-infantil"] });
  });

  it("permite limpar explicitamente a compatibilidade por tipo", async () => {
    const inserted: any[] = [];
    const db = fakeDb({
      selects: [[evento()], [oferta({ compatibleTicketTypeIds: ["ticket-adulto"] })]],
      insert: (values) => {
        inserted.push(values);
        return [{ id: "o2", ...values }];
      },
    });

    await service(db).atualizar("e1", [{ id: "o1", version: 1, name: "Oferta geral", pricingType: "PERCENTUAL", minQuantity: 10, discountPercent: 20, compatibleTicketTypeIds: null }], actor);

    expect(inserted[0]).toMatchObject({ compatibleTicketTypeIds: null });
  });

  it("recusa o mesmo id de oferta repetido no PATCH", async () => {
    const db = fakeDb();

    await expect(service(db).atualizar("e1", [
      { id: "o1", name: "Primeira", pricingType: "PERCENTUAL", minQuantity: 10, discountPercent: 15, active: false },
      { id: "o1", name: "Segunda", pricingType: "PERCENTUAL", minQuantity: 10, discountPercent: 20, active: false },
    ], actor)).rejects.toMatchObject({ response: { code: "DUPLICATE_OFFER_ID" } });
  });

  it("exige versão ao atualizar uma oferta existente", async () => {
    const db = fakeDb({ selects: [[evento()], [oferta()]] });

    await expect(service(db).atualizar("e1", [{
      id: "o1",
      name: "Sem versão",
      pricingType: "PERCENTUAL",
      minQuantity: 10,
      discountPercent: 15,
    }], actor)).rejects.toMatchObject({
      response: { code: "OFFER_VERSION_REQUIRED" },
    });
  });

  it("recusa duas ofertas ativas no mesmo evento", async () => {
    const db = fakeDb({ selects: [[evento()], []] });

    await expect(
      service(db).atualizar(
        "e1",
        [
          {
            name: "Dez",
            pricingType: "PERCENTUAL",
            minQuantity: 10,
            discountPercent: 15,
            active: true,
          },
          {
            name: "Vinte",
            pricingType: "PERCENTUAL",
            minQuantity: 20,
            discountPercent: 20,
            active: true,
          },
        ],
        actor,
      ),
    ).rejects.toMatchObject({ response: { code: "MULTIPLE_ACTIVE_OFFERS" } });
  });

  it("lista publicamente somente a oferta percentual ativa", async () => {
    const db = fakeDb({
      selects: [
        [
          oferta(),
          oferta({ id: "o2", active: false }),
          oferta({
            id: "o3",
            pricingType: "VALOR_FIXO",
            priceCents: 12000,
            discountPercent: null,
            active: false,
          }),
        ],
      ],
    });

    await expect(service(db).listarPublicas("e1")).resolves.toEqual([
      {
        id: "o1",
        version: 1,
        name: "A partir de 10",
        minQuantity: 10,
        maxQuantity: null,
        discountPercent: 15,
      },
    ]);
  });

  it("explicita a ambiguidade de ofertas ativas legadas", async () => {
    const db = fakeDb({ selects: [[oferta(), oferta({ id: "o2", version: 2 })]] });

    await expect(service(db).listarPublicas("e1")).rejects.toMatchObject({
      response: { code: "MULTIPLE_ACTIVE_OFFERS" },
    });
  });
});

function service(db: any) {
  return new EventosOfertasService({ db } as any);
}

function fakeDb(
  options: {
    selects?: unknown[][];
    insert?: (values: any) => any[];
    update?: (values: any) => any[];
  } = {},
) {
  let selectIndex = 0;
  const db: any = { audit: [], updated: [] };
  const selects = options.selects ?? [];
  db.select = () => ({
    from: () => ({
      where: () => {
        const rows = selects[selectIndex++] ?? [];
        const query: any = Promise.resolve(rows);
        query.limit = async () => rows;
        query.orderBy = () => query;
        query.for = () => query;
        return query;
      },
      orderBy: () => Promise.resolve(selects[selectIndex++] ?? []),
    }),
  });
  db.insert = (table: unknown) => ({
    values: (values: any) => {
      if (table) db.audit.push(values);
      return {
        returning: async () => (options.insert ? options.insert(values) : []),
      };
    },
  });
  db.update = () => ({
    set: (values: any) => ({
      where: async () => {
        const rows = options.update ? options.update(values) : [];
        return { returning: async () => rows };
      },
    }),
  });
  db.transaction = async (callback: (tx: any) => Promise<unknown>) =>
    callback(db);
  return db;
}
