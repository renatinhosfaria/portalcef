import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAsync } from "docx-preview";

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
    vi.mocked(renderAsync).mockReset();
    vi.mocked(renderAsync).mockImplementation(
      async (_buffer, container: HTMLElement) => {
        container.innerHTML = "<p>Documento renderizado</p>";
      },
    );
    vi.mocked(registrarEventoObservabilidade).mockReset();
    vi.mocked(enviarEventosPendentes).mockClear();
    vi.mocked(enviarEventosPendentes).mockResolvedValue(undefined);
  });

  it("usa preview local antes de tentar o visualizador externo do SharePoint", async () => {
    fetchMock.mockResolvedValueOnce({
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
          arquivo: expect.objectContaining({
            planoId: "plano-1",
            documentoId: "doc-1",
          }),
          detalhes: expect.objectContaining({
            acao: "download_preview",
            fallback: "docx-preview",
            status: "sucesso",
          }),
        }),
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plano-aula/plano-1/documentos/doc-1/download",
      { credentials: "include" },
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("visualizar-sharepoint"),
      expect.anything(),
    );
    expect(renderAsync).toHaveBeenCalled();
    expect(enviarEventosPendentes).toHaveBeenCalled();
  });

  it("tenta SharePoint quando o preview local falha", async () => {
    vi.mocked(renderAsync).mockRejectedValueOnce(new Error("DOCX inválido"));

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })
      .mockResolvedValueOnce({
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
          detalhes: expect.objectContaining({
            acao: "visualizar",
            status: "sucesso",
          }),
        }),
      );
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/plano-aula/plano-1/documentos/doc-1/download",
      { credentials: "include" },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/plano-aula/plano-1/documentos/doc-1/visualizar-sharepoint",
      { credentials: "include" },
    );
  });

  it("registra erro final quando SharePoint e preview falham", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: { message: "Falha ao baixar" },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
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
