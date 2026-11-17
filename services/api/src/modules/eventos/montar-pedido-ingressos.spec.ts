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


it.each([true, false])("mantém nome histórico de pacote quando presente (%s)", async (historico) => {
  const linhas = [{ ticket: { numero: "TEST1234", qrPayload: "qr-individual", status: "EMITIDO" }, item: { pricingEvidence: historico ? { pacote: { nomeTipo: "Combo histórico" } } : {} }, seat: { rowLabel: "A", seatNumber: "1" }, ticketType: { name: "Nome atual" }, participant: { fullName: "Pessoa Teste" } }];
  const consulta: any = { from: () => consulta, innerJoin: () => consulta, where: async () => linhas };
  const resultado = await montarIngressosDoPedido({ select: () => consulta }, "pedido");
  expect(resultado[0]).toMatchObject({ numero: "TEST1234", qrPayload: "qr-individual", ticketTypeName: historico ? "Combo histórico" : "Nome atual", participantName: "Pessoa Teste" });
});
