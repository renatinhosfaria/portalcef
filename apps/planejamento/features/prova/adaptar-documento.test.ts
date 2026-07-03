import { describe, expect, it } from "vitest";

import { adaptarDocumentoProvaParaDocumentoList } from "./adaptar-documento";
import type { ProvaDocumento } from "./types";

describe("adaptarDocumentoProvaParaDocumentoList", () => {
  it("marca Word aprovado sem PDF como erro para liberar reprocessamento", () => {
    const documento = {
      id: "doc-1",
      provaId: "prova-1",
      tipo: "ARQUIVO",
      fileName: "Prova.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      url: "https://cdn/prova.docx",
      createdAt: "2026-06-18T10:00:00.000Z",
      approvedBy: "analista-1",
      approvedAt: "2026-06-18T11:00:00.000Z",
      pdfUrl: null,
    } satisfies ProvaDocumento;

    const resultado = adaptarDocumentoProvaParaDocumentoList(documento);

    expect(resultado.planoId).toBe("prova-1");
    expect(resultado.pdfStatus).toBe("ERRO");
  });
});
