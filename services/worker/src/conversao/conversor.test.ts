import { describe, expect, it } from "vitest";

import {
  caminhoSaidaDocxIntermediario,
  caminhoSaidaPdf,
  deveUsarLibreOfficeParaDoc,
  deveUsarLibreOfficeParaImagem,
  gerarArgsConversaoDocParaDocx,
  gerarArgsConversaoImagemParaPdf,
  normalizarNomeArquivo,
} from "./conversor";

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

  it("usa LibreOffice quando mime type for application/msword", () => {
    expect(
      deveUsarLibreOfficeParaDoc({
        caminhoEntrada: "/tmp/documento.bin",
        mimeType: "application/msword",
      }),
    ).toBe(true);
  });

  it("usa LibreOffice quando extensao original for .doc", () => {
    expect(
      deveUsarLibreOfficeParaDoc({
        caminhoEntrada: "/tmp/documento.doc",
      }),
    ).toBe(true);
  });

  it("nao usa LibreOffice para .docx", () => {
    expect(
      deveUsarLibreOfficeParaDoc({
        caminhoEntrada: "/tmp/documento.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe(false);
  });

  it("gera caminho de saida para DOCX intermediario", () => {
    expect(caminhoSaidaDocxIntermediario("/tmp/entrada.DOC", "/tmp/saida")).toBe(
      "/tmp/saida/entrada.docx",
    );
  });

  it("gera args do LibreOffice para converter DOC em DOCX com perfil isolado", () => {
    const args = gerarArgsConversaoDocParaDocx(
      "/tmp/entrada.doc",
      "/tmp/saida",
      "/tmp/saida/libreoffice-profile",
    );

    expect(args).toContain(
      "-env:UserInstallation=file:///tmp/saida/libreoffice-profile",
    );
    expect(args).toEqual([
      "--headless",
      "--convert-to",
      "docx",
      "--outdir",
      "/tmp/saida",
      "/tmp/entrada.doc",
      "-env:UserInstallation=file:///tmp/saida/libreoffice-profile",
    ]);
  });

  it("gera caminho de saida pdf para imagem jpg", () => {
    expect(caminhoSaidaPdf("/tmp/foto.jpg", "/tmp")).toBe("/tmp/foto.pdf");
  });

  it("gera caminho de saida pdf para imagem jpeg", () => {
    expect(caminhoSaidaPdf("/tmp/foto.jpeg", "/tmp")).toBe("/tmp/foto.pdf");
  });

  it("gera caminho de saida pdf para imagem png", () => {
    expect(caminhoSaidaPdf("/tmp/diagrama.png", "/tmp")).toBe(
      "/tmp/diagrama.pdf",
    );
  });

  it("detecta imagem jpeg como devendo usar LibreOffice para imagem", () => {
    expect(
      deveUsarLibreOfficeParaImagem({ mimeType: "image/jpeg" }),
    ).toBe(true);
  });

  it("detecta imagem jpg como devendo usar LibreOffice para imagem", () => {
    expect(
      deveUsarLibreOfficeParaImagem({ mimeType: "image/jpg" }),
    ).toBe(true);
  });

  it("detecta imagem png como devendo usar LibreOffice para imagem", () => {
    expect(
      deveUsarLibreOfficeParaImagem({ mimeType: "image/png" }),
    ).toBe(true);
  });

  it("nao detecta docx como imagem", () => {
    expect(
      deveUsarLibreOfficeParaImagem({
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe(false);
  });

  it("gera args do LibreOffice para converter imagem em PDF com perfil isolado", () => {
    const args = gerarArgsConversaoImagemParaPdf(
      "/tmp/foto.jpg",
      "/tmp/saida",
      "/tmp/saida/libreoffice-profile",
    );

    expect(args).toContain(
      "-env:UserInstallation=file:///tmp/saida/libreoffice-profile",
    );
    expect(args).toEqual([
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      "/tmp/saida",
      "/tmp/foto.jpg",
      "-env:UserInstallation=file:///tmp/saida/libreoffice-profile",
    ]);
  });
});
