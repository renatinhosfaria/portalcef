import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentoUpload } from "./documento-upload";

function criarArquivo(nome: string, tipo: string, tamanhoMB = 1): File {
  const bytes = new Uint8Array(tamanhoMB * 1024 * 1024);
  return new File([bytes], nome, { type: tipo });
}

describe("DocumentoUpload - Upload Múltiplo", () => {
  it("aceita múltiplos arquivos via input file", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue({ id: "doc-1" });
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    const arquivo1 = criarArquivo("doc1.pdf", "application/pdf");
    const arquivo2 = criarArquivo("doc2.pdf", "application/pdf");

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toHaveAttribute("multiple");

    await user.upload(input, [arquivo1, arquivo2]);

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(2);
    });
  });

  it("mostra progresso individual por arquivo", async () => {
    const user = userEvent.setup();
    let resolveUpload: (value: unknown) => void;
    const onUpload = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveUpload = resolve; }),
    );
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    const arquivo = criarArquivo("relatorio.pdf", "application/pdf");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await user.upload(input, [arquivo]);

    await waitFor(() => {
      expect(screen.getByText("relatorio.pdf")).toBeInTheDocument();
    });
  });

  it("chama onAllUploadsComplete quando todos finalizam", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue({ id: "doc-1" });
    const onAddLink = vi.fn();
    const onAllComplete = vi.fn();

    render(
      <DocumentoUpload
        onUpload={onUpload}
        onAddLink={onAddLink}
        onAllUploadsComplete={onAllComplete}
      />,
    );

    const arquivo = criarArquivo("doc.pdf", "application/pdf");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await user.upload(input, [arquivo]);

    await waitFor(() => {
      expect(onAllComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("rejeita arquivo com tipo inválido sem chamar onUpload", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    const arquivoInvalido = criarArquivo("virus.exe", "application/x-msdownload");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await user.upload(input, [arquivoInvalido]);

    await waitFor(() => {
      expect(onUpload).not.toHaveBeenCalled();
    });
  });

  it("exibe textos no plural na drop zone", () => {
    const onUpload = vi.fn();
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    expect(
      screen.getByText(/arraste arquivos ou clique para selecionar/i),
    ).toBeInTheDocument();
  });
});
