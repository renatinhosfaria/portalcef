import { gerarTokenAcesso, hashTokenAcesso, validadeAcesso } from "./acesso-pedido";

describe("acesso seguro do pedido", () => {
  it("gera token base64url de 43 caracteres e hash SHA-256 hexadecimal", () => {
    const { token, hash } = gerarTokenAcesso();

    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash).toBe(hashTokenAcesso(token));
  });

  it("calcula validade 30 dias após o fim da sessão", () => {
    expect(validadeAcesso(new Date("2026-12-07T22:00:00Z"))).toEqual(new Date("2027-01-06T22:00:00Z"));
  });
});
