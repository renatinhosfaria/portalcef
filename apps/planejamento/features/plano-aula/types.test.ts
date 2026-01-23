import { describe, expect, it } from "vitest";
import type { DocumentoPreviewStatus, PlanoDocumento } from "./types";

describe("PlanoDocumento", () => {
  it("aceita campos de preview", () => {
    const doc: PlanoDocumento = {
      id: "doc-1",
      planoId: "plano-1",
      tipo: "ARQUIVO",
      createdAt: "2026-01-23T10:00:00.000Z",
      comentarios: [],
      previewStatus: "PENDENTE",
      previewUrl: "https://cdn/preview.pdf",
    };

    expect(doc.previewStatus).toBe("PENDENTE");
  });

  it("valida tipo DocumentoPreviewStatus", () => {
    const status: DocumentoPreviewStatus = "PRONTO";
    expect(["PENDENTE", "PRONTO", "ERRO"]).toContain(status);
  });
});
