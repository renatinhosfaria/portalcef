import { criarPdfSintetico } from "./__fixtures__/pdf-sintetico";
import { lerPlantaPdf } from "./ler-planta-pdf";

const umaPagina = (textos: Parameters<typeof criarPdfSintetico>[0][number]["textos"]) =>
  criarPdfSintetico([{ largura: 842, altura: 595, textos }]);

describe("lerPlantaPdf", () => {
  it("lê números e letras no centro do texto, com a cor de cada um", async () => {
    const pdf = umaPagina([
      { texto: "12", x: 100, y: 200 },
      { texto: "13", x: 130, y: 200, cor: "#0000ff" },
      { texto: "A", x: 160, y: 200, cor: "#ff0000" },
    ]);
    const planta = await lerPlantaPdf(pdf);
    const por = (t: string) => planta.tokens.find((k) => k.texto === t)!;
    expect(por("12").cor).toBe("#000000");
    expect(por("13").cor).toBe("#0000ff");
    expect(por("A").cor).toBe("#ff0000");
    // Helvetica 10 pt: "12" mede 11,12 pt; centro = origem + 5,56 em x e 3,5 pt acima da linha de base.
    expect(Math.abs(por("12").x - (100 + 11.12 / 2))).toBeLessThan(1);
    expect(Math.abs(por("12").y - (200 - 3.5))).toBeLessThan(1);
  });

  it("separa um item com vários números ('27 26') em dois tokens", async () => {
    const planta = await lerPlantaPdf(umaPagina([{ texto: "27 26", x: 100, y: 200, cor: "#00ff00" }]));
    const t27 = planta.tokens.find((k) => k.texto === "27")!;
    const t26 = planta.tokens.find((k) => k.texto === "26")!;
    expect(planta.tokens).toHaveLength(2);
    expect(t27.x).toBeLessThan(t26.x);
    expect(t27.cor).toBe("#00ff00");
    expect(t26.cor).toBe("#00ff00");
  });

  it("lê texto girado com o ângulo da fileira", async () => {
    const planta = await lerPlantaPdf(umaPagina([{ texto: "7", x: 100, y: 200, angulo: 30 }]));
    expect(Math.round(planta.tokens[0].angulo)).toBe(-30);
  });

  it("lê texto girado no sentido horário (ângulo negativo no PDF)", async () => {
    const planta = await lerPlantaPdf(umaPagina([{ texto: "7", x: 100, y: 200, angulo: -30 }]));
    expect(Math.round(planta.tokens[0].angulo)).toBe(30);
  });

  it("guarda frases da legenda e do palco com o texto inteiro", async () => {
    const planta = await lerPlantaPdf(
      umaPagina([
        { texto: "1", x: 50, y: 50 },
        { texto: "EXCLUSIVO CADEIRANTES", x: 100, y: 500, cor: "#3b82f6" },
        { texto: "PALCO", x: 400, y: 100 },
      ]),
    );
    const textos = planta.frases.map((f) => f.texto);
    expect(textos).toContain("EXCLUSIVO CADEIRANTES");
    expect(textos).toContain("PALCO");
    expect(textos).not.toContain("1");
    const legenda = planta.frases.find((f) => f.texto === "EXCLUSIVO CADEIRANTES")!;
    expect(legenda.esquerda).toBeCloseTo(100, 0);
    expect(legenda.cor).toBe("#3b82f6");
  });

  it("exige a escolha da página quando o PDF tem várias", async () => {
    const duas = criarPdfSintetico([
      { largura: 842, altura: 595, textos: [{ texto: "1", x: 10, y: 10 }] },
      { largura: 842, altura: 595, textos: [{ texto: "2", x: 10, y: 10 }] },
    ]);
    await expect(lerPlantaPdf(duas)).rejects.toMatchObject({
      response: { code: "PDF_PAGINA_OBRIGATORIA", details: { paginas: 2 } },
    });
  });

  it("lê a página escolhida e recusa página inexistente", async () => {
    const duas = criarPdfSintetico([
      { largura: 842, altura: 595, textos: [{ texto: "1", x: 10, y: 10 }] },
      { largura: 842, altura: 595, textos: [{ texto: "2", x: 10, y: 10 }] },
    ]);
    const planta = await lerPlantaPdf(duas, 2);
    expect(planta.pagina.numero).toBe(2);
    expect(planta.tokens[0].texto).toBe("2");
    await expect(lerPlantaPdf(duas, 3)).rejects.toMatchObject({
      response: { code: "PDF_PAGINA_INEXISTENTE" },
    });
  });

  it("recusa planta sem números (PDF escaneado)", async () => {
    const semTexto = criarPdfSintetico([{ largura: 842, altura: 595, textos: [] }]);
    await expect(lerPlantaPdf(semTexto)).rejects.toMatchObject({
      response: { code: "PLANTA_SEM_NUMEROS" },
    });
  });

  it("recusa arquivo que não é PDF", async () => {
    await expect(lerPlantaPdf(Buffer.from("olá"))).rejects.toMatchObject({
      response: { code: "PDF_INVALIDO" },
    });
  });

  it("respeita /Rotate 90: o '1' fica acima do '2', alinhados na vertical, com texto girado 90 graus", async () => {
    const pdf = criarPdfSintetico([
      {
        largura: 400,
        altura: 300,
        rotacao: 90,
        textos: [
          { texto: "1", x: 100, y: 50 },
          { texto: "2", x: 120, y: 50 },
        ],
      },
    ]);
    const planta = await lerPlantaPdf(pdf);
    expect(planta.pagina).toMatchObject({ largura: 300, altura: 400 });
    const a = planta.tokens.find((t) => t.texto === "1")!;
    const b = planta.tokens.find((t) => t.texto === "2")!;
    expect(Math.abs(a.x - b.x)).toBeLessThan(1);
    expect(b.y - a.y).toBeGreaterThan(19);
    expect(b.y - a.y).toBeLessThan(21);
    expect(Math.abs(a.angulo)).toBeCloseTo(90, 0);
  });

  it("lê as coordenadas relativas ao canto da página quando o MediaBox tem origem deslocada", async () => {
    const texto = { texto: "12", x: 100, y: 200 };
    const normal = await lerPlantaPdf(criarPdfSintetico([{ largura: 400, altura: 300, textos: [texto] }]));
    const deslocada = await lerPlantaPdf(
      criarPdfSintetico([{ largura: 400, altura: 300, origem: { x: 50, y: 50 }, textos: [texto] }]),
    );
    expect(deslocada.pagina).toMatchObject({ largura: 400, altura: 300 });
    expect(deslocada.tokens[0].x).toBeCloseTo(normal.tokens[0].x, 1);
    expect(deslocada.tokens[0].y).toBeCloseTo(normal.tokens[0].y, 1);
    // Helvetica 10 pt: "12" mede 11,12 pt; o texto gravado em x=150 do PDF aparece em x≈105,56 da página.
    expect(Math.abs(deslocada.tokens[0].x - (100 + 11.12 / 2))).toBeLessThan(1);
  });
});
