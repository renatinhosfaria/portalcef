import { describe, expect, it } from "vitest";

import {
  isDocumentoExcluivel,
  PDF_STATUS_VALUES,
  type PlanoDocumento,
} from "./types";

describe("PlanoDocumento", () => {
  it("aceita campos de edição via SharePoint", () => {
    const doc: PlanoDocumento = {
      id: "doc-1",
      planoId: "plano-1",
      tipo: "ARQUIVO",
      createdAt: "2026-01-23T10:00:00.000Z",
      sharepointItemId: "item-123",
      sharepointEditUrl: "https://sharepoint/edit/item-123",
      editandoDesde: "2026-01-23T10:00:00.000Z",
    };

    expect(doc.sharepointItemId).toBe("item-123");
  });

  it("aceita documento sem campos SharePoint", () => {
    const doc: PlanoDocumento = {
      id: "doc-2",
      planoId: "plano-1",
      tipo: "ARQUIVO",
      createdAt: "2026-01-23T10:00:00.000Z",
    };

    expect(doc.sharepointItemId).toBeUndefined();
  });

  it("representa status de PDF de impressão", () => {
    const doc: PlanoDocumento = {
      id: "doc-3",
      planoId: "plano-1",
      tipo: "ARQUIVO",
      createdAt: "2026-05-22T10:00:00.000Z",
      pdfStatus: "GERANDO",
      pdfError: null,
      pdfRequestedAt: "2026-05-22T10:00:00.000Z",
      pdfGeneratedAt: null,
    };

    expect(doc.pdfStatus).toBe("GERANDO");
    expect(PDF_STATUS_VALUES).toContain("GERANDO");
  });

  it("aceita os tipos legados de upload e link do YouTube", () => {
    const uploadLegado: PlanoDocumento = {
      id: "doc-upload",
      planoId: "plano-1",
      tipo: "UPLOAD",
      createdAt: "2026-05-22T10:00:00.000Z",
    };
    const youtubeLegado: PlanoDocumento = {
      id: "doc-youtube",
      planoId: "plano-1",
      tipo: "YOUTUBE",
      createdAt: "2026-05-22T10:00:00.000Z",
    };

    expect(uploadLegado.tipo).toBe("UPLOAD");
    expect(youtubeLegado.tipo).toBe("YOUTUBE");
  });

  it("considera excluível apenas upload não aprovado", () => {
    expect(isDocumentoExcluivel({ tipo: "ARQUIVO" })).toBe(true);
    expect(isDocumentoExcluivel({ tipo: "UPLOAD" })).toBe(true);
    expect(isDocumentoExcluivel({ tipo: "LINK_YOUTUBE" })).toBe(false);
    expect(
      isDocumentoExcluivel({ tipo: "ARQUIVO", approvedBy: "analista-1" }),
    ).toBe(false);
    expect(
      isDocumentoExcluivel({ tipo: "ARQUIVO", approvedAt: "2026-06-01" }),
    ).toBe(false);
  });
});
