import type { HistoricoEntry } from "@essencia/shared/types";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RelatorioContent } from "./relatorio-content";

const criarRelatorio = vi.fn();
const getRelatorio = vi.fn();
const getHistorico = vi.fn();
const deleteDocumento = vi.fn();

let documentoListProps: {
  canDelete?: boolean;
  onDelete?: (documentoId: string, motivo: string) => Promise<void>;
} | null = null;

const relatorio = {
  id: "relatorio-1",
  userId: "usuario-1",
  turmaId: "turma-1",
  unitId: "unidade-1",
  semestreId: "semestre-1",
  semestreRelatorioId: "semestre-1",
  status: "RASCUNHO",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  documentos: [],
  user: { id: "usuario-1", name: "Professora" },
  turma: { id: "turma-1", name: "Turma 1", code: "T1" },
};

vi.mock("../../../features/plano-aula", () => ({
  DocumentoUpload: () => <div>Upload de documento</div>,
  DocumentoList: (props: typeof documentoListProps) => {
    documentoListProps = props;
    return <div>Lista de documentos</div>;
  },
}));

vi.mock("../../../features/relatorio", () => ({
  STATUS_LABELS: { RASCUNHO: "Rascunho" },
  useRelatorio: () => ({
    loading: false,
    criarRelatorio,
    getRelatorio,
    getHistorico,
    uploadDocumento: vi.fn(),
    addLink: vi.fn(),
    deleteDocumento,
    submeterRelatorio: vi.fn(),
    recuperarRelatorio: vi.fn(),
  }),
}));

describe("RelatorioContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentoListProps = null;
    criarRelatorio.mockResolvedValue({ id: "relatorio-1" });
    getRelatorio.mockResolvedValue(relatorio);
    getHistorico.mockResolvedValue([]);
    deleteDocumento.mockResolvedValue(undefined);
  });

  it("exclui documento com motivo, recarrega o relatório e o histórico", async () => {
    render(<RelatorioContent semestreId="semestre-1" turmaId="turma-1" />);

    await waitFor(() => {
      expect(documentoListProps?.canDelete).toBe(true);
      expect(documentoListProps?.onDelete).toEqual(expect.any(Function));
    });

    await act(async () => {
      await documentoListProps?.onDelete?.(
        "documento-1",
        "Arquivo enviado com conteúdo incorreto",
      );
    });

    expect(deleteDocumento).toHaveBeenCalledWith(
      "relatorio-1",
      "documento-1",
      "Arquivo enviado com conteúdo incorreto",
    );
    expect(getRelatorio).toHaveBeenCalledTimes(2);
    expect(getHistorico).toHaveBeenCalledTimes(2);
  });

  it("propaga erro amigável quando a exclusão falha", async () => {
    deleteDocumento.mockRejectedValueOnce({ response: { status: 403 } });

    render(<RelatorioContent semestreId="semestre-1" turmaId="turma-1" />);

    await waitFor(() => {
      expect(documentoListProps?.onDelete).toEqual(expect.any(Function));
    });

    await act(async () => {
      await expect(
        documentoListProps?.onDelete?.(
          "documento-1",
          "Arquivo enviado com conteúdo incorreto",
        ),
      ).rejects.toEqual({ response: { status: 403 } });
    });

    expect(
      await screen.findByText("Você não tem permissão para fazer essa ação."),
    ).toBeInTheDocument();
  });

  it("não exibe sucesso quando o histórico falha ao recarregar após a exclusão", async () => {
    getHistorico
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("Falha de conexão"));

    render(<RelatorioContent semestreId="semestre-1" turmaId="turma-1" />);

    await waitFor(() => {
      expect(documentoListProps?.onDelete).toEqual(expect.any(Function));
    });

    await act(async () => {
      await documentoListProps?.onDelete?.(
        "documento-1",
        "Arquivo enviado com conteúdo incorreto",
      );
    });

    expect(
      await screen.findByText(
        "O arquivo foi excluído, mas não foi possível atualizar a lista agora. Atualize a página para conferir.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Arquivo excluído com sucesso.")).toBeNull();
  });

  it("exibe exclusão no histórico com label e detalhes amigáveis", async () => {
    const historico: HistoricoEntry[] = [
      {
        id: "historico-exclusao",
        planoId: "relatorio-1",
        userId: "usuario-1",
        userName: "Professora",
        userRole: "professora",
        acao: "DOCUMENTO_EXCLUIDO",
        statusAnterior: "RASCUNHO",
        statusNovo: "RASCUNHO",
        detalhes: {
          documentoId: "documento-1",
          documentoNome: "relatorio-final.pdf",
          documentoTipo: "ARQUIVO",
          motivo: "Arquivo enviado com informações incorretas",
        },
        createdAt: "2026-09-08T12:00:00.000Z",
      },
    ];
    getHistorico.mockResolvedValue(historico);

    render(<RelatorioContent semestreId="semestre-1" turmaId="turma-1" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Histórico/i }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Histórico/i }));

    expect(
      screen.getByText("Documento do relatório excluído"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Arquivo: relatorio-final\.pdf/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Motivo: Arquivo enviado com informações incorretas/),
    ).toBeInTheDocument();
    expect(screen.queryByText("DOCUMENTO_EXCLUIDO")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        (_, elemento) =>
          elemento?.tagName === "P" &&
          elemento.textContent?.includes("Professora • RASCUNHO") === true,
      ),
    ).toBeInTheDocument();
  });

  it("mantém os eventos antigos funcionando no histórico", async () => {
    getHistorico.mockResolvedValue([
      {
        id: "historico-submetido",
        planoId: "relatorio-1",
        userId: "usuario-1",
        userName: "Professora",
        userRole: "professora",
        acao: "SUBMETIDO",
        statusAnterior: "RASCUNHO",
        statusNovo: "AGUARDANDO_ANALISTA",
        detalhes: null,
        createdAt: "2026-09-08T12:00:00.000Z",
      } satisfies HistoricoEntry,
    ]);

    render(<RelatorioContent semestreId="semestre-1" turmaId="turma-1" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Histórico/i }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Histórico/i }));

    expect(screen.getByText("SUBMETIDO")).toBeInTheDocument();
  });
});
