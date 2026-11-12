import { InternalServerErrorException } from "@nestjs/common";
import { gerarTokenIngresso } from "./token-ingresso";

describe("gerarTokenIngresso", () => {
  const segredoOriginal = process.env.EVENTOS_QR_SECRET;

  afterEach(() => {
    if (segredoOriginal === undefined) delete process.env.EVENTOS_QR_SECRET;
    else process.env.EVENTOS_QR_SECRET = segredoOriginal;
  });

  it("assina o token e monta o qrPayload com o prefixo evento:", () => {
    process.env.EVENTOS_QR_SECRET = "segredo-de-teste";

    const { signedToken, qrPayload } = gerarTokenIngresso("PED1", "item-1");

    expect(qrPayload).toBe(`evento:${signedToken}`);
    expect(signedToken.startsWith("PED1:item-1:")).toBe(true);
    expect(signedToken.split(".")).toHaveLength(2);
  });

  it("gera tokens diferentes a cada chamada", () => {
    process.env.EVENTOS_QR_SECRET = "segredo-de-teste";

    expect(gerarTokenIngresso("PED1", "item-1").signedToken).not.toBe(gerarTokenIngresso("PED1", "item-1").signedToken);
  });

  it("falha sem EVENTOS_QR_SECRET", () => {
    delete process.env.EVENTOS_QR_SECRET;

    expect(() => gerarTokenIngresso("PED1", "item-1")).toThrow(InternalServerErrorException);
    try {
      gerarTokenIngresso("PED1", "item-1");
    } catch (erro: any) {
      expect(erro.getResponse()).toMatchObject({ code: "EVENTOS_QR_SECRET_MISSING" });
    }
  });
});
