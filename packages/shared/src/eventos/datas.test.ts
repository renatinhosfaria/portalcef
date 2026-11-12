import { describe, expect, it } from "vitest";
import { formatarDataHoraExtenso } from "./datas";

describe("formatarDataHoraExtenso", () => {
  it("formata no fuso de São Paulo", () =>
    expect(formatarDataHoraExtenso("2026-12-12T22:00:00Z", "2026-12-13T00:30:00Z")).toBe("Sábado, 12 de dezembro de 2026 · 19h às 21h30"));
  it("devolve aviso para data inválida", () => expect(formatarDataHoraExtenso("x")).toBe("Data a confirmar"));
});
