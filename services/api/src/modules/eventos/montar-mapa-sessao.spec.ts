import { montarAssentosDaSessao } from "./montar-mapa-sessao";

function dbComLinhas(linhas: unknown[]) {
  const cadeia: any = {};
  for (const metodo of ["select", "from", "innerJoin", "where"]) cadeia[metodo] = jest.fn(() => cadeia);
  cadeia.then = (resolve: (valor: unknown[]) => unknown) => Promise.resolve(linhas).then(resolve);
  return cadeia;
}

function linha(id: string, status: string, metadata: unknown = {}) {
  return {
    seat: { id: `seat-${id}`, rowLabel: "A", seatNumber: id, x: 1, y: 2, width: 50, height: 50, category: "COMUM", accessible: false, metadata },
    inventory: { id: `inv-${id}`, status },
  };
}

describe("montarAssentosDaSessao", () => {
  it("converte o status do inventário em state e expõe os campos internos", async () => {
    const db = dbComLinhas([
      linha("1", "VENDIDO"),
      linha("2", "RESERVADO"),
      linha("3", "BLOQUEADO"),
      linha("4", "DISPONIVEL"),
      linha("5", "LIBERADO"),
    ]);

    const assentos = await montarAssentosDaSessao(db, "s1", "mapa-1");

    expect(assentos.map((a) => a.state)).toEqual(["sold", "reserved", "blocked", "available", "available"]);
    expect(assentos.map((a) => a.inventoryStatus)).toEqual(["VENDIDO", "RESERVADO", "BLOQUEADO", "DISPONIVEL", "LIBERADO"]);
    expect(assentos[0]).toMatchObject({ id: "seat-1", sessionId: "s1", rowLabel: "A", seatNumber: "1", inventorySeatId: "inv-1" });
  });

  it("usa a rotação de metadata e zero quando for inválida", async () => {
    const db = dbComLinhas([linha("1", "DISPONIVEL", { rotacao: "12.5" }), linha("2", "DISPONIVEL", { rotacao: "invalida" }), linha("3", "DISPONIVEL", null)]);

    const assentos = await montarAssentosDaSessao(db, "s1", "mapa-1");

    expect(assentos.map((a) => a.rotacao)).toEqual([12.5, 0, 0]);
  });
});
