import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enviarEventosPendentes,
  registrarEventoObservabilidade,
} from "../../../lib/observabilidade";

import { DocumentoEditorModal } from "./documento-editor";

vi.mock("../../../lib/observabilidade", () => ({
  enviarEventosPendentes: vi.fn().mockResolvedValue(undefined),
  registrarEventoObservabilidade: vi.fn(),
}));

vi.mock("docx-preview", () => ({
  renderAsync: vi.fn(async (_buffer, container: HTMLElement) => {
    container.innerHTML = "<p>Documento renderizado</p>";
  }),
}));

describe("DocumentoEditorModal", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.mocked(registrarEventoObservabilidade).mockReset();
    vi.mocked(enviarEventosPendentes).mockClear();
    vi.mocked(enviarEventosPendentes).mockResolvedValue(undefined);
  });

  it("registra tentativa SharePoint ao abrir visualizador", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          disponivel: true,
          embedUrl: "https://sharepoint/embed",
        },
      }),
    });

    render(
      <DocumentoEditorModal
        planoId="plano-1"
        documentoId="doc-1"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "sharepoint_word",
          nivel: "info",
          arquivo: expect.objectContaining({
            planoId: "plano-1",
            documentoId: "doc-1",
          }),
          detalhes: expect.objectContaining({
            acao: "visualizar",
            status: "inicio",
          }),
        }),
      );
    });
    expect(enviarEventosPendentes).toHaveBeenCalled();
  });

  it("registra fallback docx-preview como download_preview", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { disponivel: false } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      });

    render(
      <DocumentoEditorModal
        planoId="plano-1"
        documentoId="doc-1"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "arquivo_acao",
          nivel: "info",
          detalhes: expect.objectContaining({
            acao: "download_preview",
            fallback: "docx-preview",
            status: "sucesso",
          }),
        }),
      );
    });
  });

  it("registra erro final quando SharePoint e preview falham", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: { message: "Falha ao baixar" },
        }),
      });

    render(
      <DocumentoEditorModal
        planoId="plano-1"
        documentoId="doc-1"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Falha ao baixar")).toBeInTheDocument();
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "erro_navegador",
          nivel: "error",
          arquivo: expect.objectContaining({
            planoId: "plano-1",
            documentoId: "doc-1",
          }),
          erro: expect.objectContaining({
            mensagem: expect.any(String),
          }),
        }),
      );
    });
  });
});
