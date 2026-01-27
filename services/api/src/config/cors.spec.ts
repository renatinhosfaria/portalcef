import { obterOrigensCors } from "./cors";

describe("origens CORS", () => {
  it("inclui lojas e demais apps locais", () => {
    const origens = obterOrigensCors();

    expect(origens).toContain("http://localhost:3000");
    expect(origens).toContain("http://localhost:3003");
    expect(origens).toContain("http://localhost:3004");
    expect(origens).toContain("http://localhost:3005");
    expect(origens).toContain("http://localhost:3006");
    expect(origens).toContain("http://localhost:3007");
    expect(origens).toContain("http://localhost:3008");
    expect(origens).toContain("http://localhost:3010");
    expect(origens).toContain("http://localhost:3011");
  });
});
