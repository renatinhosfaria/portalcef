import { MapDetector } from "./map-detector";
import { sanitizeSvg } from "./map-sanitizer";

jest.mock("sharp", () => ({ __esModule: true, default: () => ({ metadata: async () => ({ width: 200, height: 100 }) }) }));
jest.mock("tesseract.js", () => ({ createWorker: async () => ({ recognize: async () => ({ data: { text: "7 7", words: [{ text: "7", confidence: 91, bbox: { x0: 12, y0: 20, x1: 28, y1: 40 } }, { text: "7", confidence: 90, bbox: { x0: 12, y0: 60, x1: 28, y1: 80 } }] } }), terminate: async () => undefined }) }));

jest.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: () => ({ promise: Promise.resolve({
    numPages: 1,
    getPage: async () => ({ getTextContent: async () => ({ items: [
      { str: "9", transform: [1, 0, 0, 1, 20, 20] },
      { str: "9", transform: [1, 0, 0, 1, 20, 60] },
    ] }) }),
  }) }),
}));

describe("MapDetector", () => {
  it("extrai assentos numerados de SVG e marca duplicidade", async () => {
    const detector = new MapDetector();
    const result = await detector.detect({ mimeType: "image/svg+xml", buffer: Buffer.from('<svg width="100" height="80"><text x="10" y="20">1</text><text x="30" y="20">1</text></svg>') });
    expect(result.seats).toHaveLength(2);
    expect(result.conflicts).toContain("A:1");
  });

  it("separa o mesmo número em fileiras com y diferente", async () => {
    const result = await new MapDetector().detect({ mimeType: "image/svg+xml", buffer: Buffer.from('<svg><text x="10" y="20">1</text><text x="10" y="60">1</text></svg>') });
    expect(result.seats.map((seat) => seat.rowLabel)).toEqual(["A", "B"]);
    expect(result.conflicts).toEqual([]);
  });

  it("rejeita SVG com script", () => {
    expect(() => sanitizeSvg('<svg><script>alert(1)</script></svg>')).toThrow();
  });

  it("aceita PDF pelo magic byte", async () => {
    const result = await new MapDetector().detect({ mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj\n(12 13)\nendobj") });
    expect(result.detector).toContain("pdf");
  });

  it("agrupa propostas PDF pela coordenada y antes de detectar duplicatas", async () => {
    const result = await new MapDetector().detect({ mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") });
    expect(result.seats.map((seat) => seat.rowLabel)).toEqual(["A", "B"]);
    expect(result.conflicts).toEqual([]);
    expect(result.seats.every((seat) => Number.isInteger(seat.x) && Number.isInteger(seat.y))).toBe(true);
  });

  it("usa caixas e confiança do OCR raster", async () => {
    const result = await new MapDetector().detect({ mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
    expect(result.seats[0]).toEqual(expect.objectContaining({ seatNumber: "7", x: 12, y: 20, width: 16, height: 20, confidence: 91 }));
    expect(result.seats.map((seat) => seat.rowLabel)).toEqual(["A", "B"]);
    expect(result.conflicts).toEqual([]);
  });
});
