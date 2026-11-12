import { montarIngressosDoPedido } from "./montar-pedido-ingressos";

function dbComLinhas(linhas: unknown[]) {
  const cadeia: any = {};
  for (const metodo of ["select", "from", "innerJoin", "where"]) cadeia[metodo] = jest.fn(() => cadeia);
  cadeia.then = (resolve: (valor: unknown[]) => unknown) => Promise.resolve(linhas).then(resolve);
  return cadeia;
}

describe("montarIngressosDoPedido", () => {
  it("devolve os dados públicos de cada ingresso do pedido", async () => {
    const db = dbComLinhas([{
      ticket: { numero: "ING-1", qrPayload: "evento:abc", status: "EMITIDO" },
      item: { ticketTypeName: "Inteira" },
      inventory: {},
      seat: { rowLabel: "B", seatNumber: "7" },
      ticketType: { name: "Inteira" },
      participant: { fullName: "Maria Souza" },
    }]);

    await expect(montarIngressosDoPedido(db, "pedido-1")).resolves.toEqual([
      { numero: "ING-1", qrPayload: "evento:abc", rowLabel: "B", seatNumber: "7", ticketTypeName: "Inteira", participantName: "Maria Souza", status: "EMITIDO" },
    ]);
  });
});
