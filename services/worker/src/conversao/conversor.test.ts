import { describe, expect, it } from "vitest";

import { caminhoSaidaPdf, normalizarNomeArquivo } from "./conversor";

describe("conversor", () => {
  it("gera caminho de saida com .pdf", () => {
    expect(caminhoSaidaPdf("/tmp/arquivo.docx", "/tmp")).toBe(
      "/tmp/arquivo.pdf",
    );
  });

  it("remove tentativa de path traversal do nome do arquivo", () => {
    expect(normalizarNomeArquivo("../segredo.docx", "padrao.docx")).toBe(
      "segredo.docx",
    );
  });
});
