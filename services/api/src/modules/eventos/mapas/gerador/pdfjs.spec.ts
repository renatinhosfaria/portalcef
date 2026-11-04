import { carregarPdfjs } from "./pdfjs";

describe("carregarPdfjs", () => {
  it("não guarda uma falha: a chamada seguinte tenta importar de novo", async () => {
    const falso = { getDocument: jest.fn() } as any;
    const importar = jest
      .fn()
      .mockRejectedValueOnce(new Error("falha passageira"))
      .mockResolvedValue(falso);

    await expect(carregarPdfjs(importar)).rejects.toThrow("falha passageira");
    await expect(carregarPdfjs(importar)).resolves.toBe(falso);
    expect(importar).toHaveBeenCalledTimes(2);

    // Depois de carregar com sucesso, o resultado fica em cache.
    await expect(carregarPdfjs(importar)).resolves.toBe(falso);
    expect(importar).toHaveBeenCalledTimes(2);
  });
});
