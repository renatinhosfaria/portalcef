import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enviarEventosPendentes,
  registrarEventoObservabilidade,
} from "../../../lib/observabilidade";

import { DocumentoUpload } from "./documento-upload";

vi.mock("../../../lib/observabilidade", () => ({
  enviarEventosPendentes: vi.fn().mockResolvedValue(undefined),
  registrarEventoObservabilidade: vi.fn(),
}));

function criarArquivo(nome: string, tipo: string, tamanhoMB = 1): File {
  const bytes = new Uint8Array(tamanhoMB * 1024 * 1024);
  return new File([bytes], nome, { type: tipo });
}

describe("DocumentoUpload - Upload Múltiplo", () => {
  beforeEach(() => {
    vi.mocked(registrarEventoObservabilidade).mockReset();
    vi.mocked(enviarEventosPendentes).mockClear();
    vi.mocked(enviarEventosPendentes).mockResolvedValue(undefined);
  });

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
    let _resolveUpload: (value: unknown) => void;
    const onUpload = vi.fn().mockImplementation(
      () => new Promise((resolve) => { _resolveUpload = resolve; }),
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
    const onUpload = vi.fn();
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    const arquivoInvalido = criarArquivo("virus.exe", "application/x-msdownload");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [arquivoInvalido],
      },
    });

    await waitFor(() => {
      expect(onUpload).not.toHaveBeenCalled();
    });
  });

  it("registra arquivo rejeitado por validação", async () => {
    const onUpload = vi.fn();
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    const arquivoInvalido = criarArquivo("virus.exe", "application/x-msdownload");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [arquivoInvalido],
      },
    });

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "upload_resultado",
          nivel: "warn",
          arquivo: expect.objectContaining({
            nome: "virus.exe",
            tipo: "application/x-msdownload",
            tamanhoBytes: arquivoInvalido.size,
          }),
          detalhes: expect.objectContaining({
            status: "erro_validacao",
          }),
        }),
      );
    });
    expect(enviarEventosPendentes).toHaveBeenCalled();
  });

  it("registra upload com sucesso com tamanho, MIME, tentativas e duração", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue({ id: "doc-1" });
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    const arquivo = criarArquivo("doc.pdf", "application/pdf");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await user.upload(input, [arquivo]);

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "upload_resultado",
          nivel: "info",
          arquivo: expect.objectContaining({
            nome: "doc.pdf",
            tipo: "application/pdf",
            tamanhoBytes: arquivo.size,
          }),
          detalhes: expect.objectContaining({
            status: "sucesso",
            tentativa: 1,
            duracaoMs: expect.any(Number),
          }),
        }),
      );
    });
  });

  it("registra erro definitivo de upload com nível error", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockRejectedValue(new Error("Falha no upload"));
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    const arquivo = criarArquivo("doc.pdf", "application/pdf");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await user.upload(input, [arquivo]);

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(5);
    });
    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "upload_resultado",
          nivel: "error",
          arquivo: expect.objectContaining({
            nome: "doc.pdf",
            tipo: "application/pdf",
            tamanhoBytes: arquivo.size,
          }),
          detalhes: expect.objectContaining({
            status: "erro",
            tentativa: 5,
          }),
          erro: expect.objectContaining({
            mensagem: expect.any(String),
          }),
        }),
      );
    });
  });

  it("registra link do YouTube rejeitado por validação sem gravar a URL", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    await user.click(screen.getByRole("button", { name: /link do youtube/i }));
    await user.type(
      screen.getByPlaceholderText("https://www.youtube.com/watch?v=..."),
      "https://example.com/video?token=segredo",
    );
    await user.click(screen.getByRole("button", { name: /adicionar/i }));

    expect(onAddLink).not.toHaveBeenCalled();
    expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "upload_resultado",
        nivel: "warn",
        arquivo: expect.objectContaining({
          nome: "link_youtube",
          tipo: "youtube",
          tamanhoBytes: null,
        }),
        detalhes: expect.objectContaining({
          status: "erro_validacao",
          tipo: "link_youtube",
        }),
      }),
    );
    expect(
      JSON.stringify(vi.mocked(registrarEventoObservabilidade).mock.calls),
    ).not.toContain("segredo");
    expect(enviarEventosPendentes).toHaveBeenCalled();
  });

  it("registra link do YouTube adicionado com sucesso sem gravar a URL", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const onAddLink = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    await user.click(screen.getByRole("button", { name: /link do youtube/i }));
    await user.type(
      screen.getByPlaceholderText("https://www.youtube.com/watch?v=..."),
      "https://www.youtube.com/watch?v=abc123&token=segredo",
    );
    await user.click(screen.getByRole("button", { name: /adicionar/i }));

    await waitFor(() => {
      expect(onAddLink).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=abc123&token=segredo",
      );
    });
    expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "upload_resultado",
        nivel: "info",
        arquivo: expect.objectContaining({
          nome: "link_youtube",
          tipo: "youtube",
          tamanhoBytes: null,
        }),
        detalhes: expect.objectContaining({
          status: "sucesso",
          tipo: "link_youtube",
        }),
      }),
    );
    expect(
      JSON.stringify(vi.mocked(registrarEventoObservabilidade).mock.calls),
    ).not.toContain("segredo");
    expect(enviarEventosPendentes).toHaveBeenCalled();
  });

  it("registra erro ao adicionar link do YouTube sem gravar a URL nem mensagem externa sensivel", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const onUpload = vi.fn();
    const onAddLink = vi
      .fn()
      .mockRejectedValue(
        new Error("Falha link https://youtu.be/abc123?token=segredo"),
      );

    try {
      render(
        <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
      );

      await user.click(screen.getByRole("button", { name: /link do youtube/i }));
      await user.type(
        screen.getByPlaceholderText("https://www.youtube.com/watch?v=..."),
        "https://youtu.be/abc123?token=segredo",
      );
      await user.click(screen.getByRole("button", { name: /adicionar/i }));

      await waitFor(() => {
        expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
          expect.objectContaining({
            evento: "upload_resultado",
            nivel: "error",
            arquivo: expect.objectContaining({
              nome: "link_youtube",
              tipo: "youtube",
              tamanhoBytes: null,
            }),
            erro: expect.objectContaining({
              mensagem: "Nao foi possivel adicionar link do YouTube",
            }),
            detalhes: expect.objectContaining({
              status: "erro",
              tipo: "link_youtube",
            }),
          }),
        );
      });
      expect(
        JSON.stringify(vi.mocked(registrarEventoObservabilidade).mock.calls),
      ).not.toContain("segredo");
      expect(
        JSON.stringify(vi.mocked(registrarEventoObservabilidade).mock.calls),
      ).not.toContain("youtu.be");
      expect(enviarEventosPendentes).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
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
