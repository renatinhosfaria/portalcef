import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Prova } from "../../../../../features/prova";

import { ProvaGestaoContent } from "./prova-gestao-content";

const fetchProva = vi.fn();
const refetch = vi.fn();
const imprimirDocumento = vi.fn();
const deleteDocumento = vi.fn();
const enviarParaAnalise = vi.fn();

const provaBase: Prova = {
  id: "prova-1",
  userId: "prof-1",
  turmaId: "turma-1",
  unitId: "unidade-1",
  provaCicloId: "ciclo-1",
  status: "AGUARDANDO_IMPRESSAO",
  submittedAt: "2026-06-10T12:00:00.000Z",
  createdAt: "2026-06-09T12:00:00.000Z",
  updatedAt: "2026-06-10T12:00:00.000Z",
  user: { id: "prof-1", name: "Maria Silva" },
  turma: { id: "turma-1", name: "1º Ano A", code: "1A" },
  documentos: [
    {
      id: "doc-1",
      provaId: "prova-1",
      tipo: "ARQUIVO",
      fileName: "prova.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      url: "https://cdn/prova.docx",
      pdfUrl: "https://cdn/prova.pdf",
      pdfStorageKey: "pdf/prova.pdf",
      printedAt: "2026-06-17T14:29:00.000Z",
      createdAt: "2026-06-10T12:00:00.000Z",
    },
  ],
};

let provaMock: Prova = provaBase;
let documentoListProps: {
  canDelete?: boolean;
  onDelete?: (documentoId: string, motivo: string) => Promise<void>;
} | null = null;
let historicoRenderCount = 0;

vi.mock("../../../../../features/prova", () => ({
  PROVA_STATUS_COLORS: {
    AGUARDANDO_IMPRESSAO: "bg-orange-100 text-orange-800",
  },
  PROVA_STATUS_LABELS: {
    AGUARDANDO_IMPRESSAO: "Aguardando Impressao",
  },
  ProvaHeader: () => <div>Cabecalho da prova</div>,
  adaptarDocumentoProvaParaDocumentoList: (documento: {
    provaId: string;
    pdfUrl?: string;
  }) => ({
    ...documento,
    planoId: documento.provaId,
    pdfStatus: documento.pdfUrl ? "PRONTO" : undefined,
  }),
  useGestaoImpressao: () => ({
    loading: false,
    enviarParaAnalise,
  }),
  useProva: () => ({
    imprimirDocumento,
    deleteDocumento,
  }),
  useProvaDetalhe: () => ({
    loading: false,
    error: null,
    fetchProva,
    refetch,
    prova: provaMock,
  }),
}));

vi.mock("../../../../../features/plano-aula", () => ({
  HistoricoTimeline: () => {
    historicoRenderCount += 1;
    return <div>Histórico da prova</div>;
  },
  DocumentoList: (props: {
    documentos: Array<{ pdfStatus?: string }>;
    permitirImpressaoSemAprovacao?: boolean;
    canDelete?: boolean;
    onDelete?: (documentoId: string, motivo: string) => Promise<void>;
  }) => {
    documentoListProps = props;
    return (
      <div>
        <span>Documentos: {props.documentos.length}</span>
        <span>
          PDF status: {props.documentos[0]?.pdfStatus ?? "sem status"}
        </span>
        <span>
          Impressao sem aprovacao:{" "}
          {props.permitirImpressaoSemAprovacao ? "sim" : "nao"}
        </span>
      </div>
    );
  },
}));

describe("ProvaGestaoContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProva.mockResolvedValue(undefined);
    refetch.mockResolvedValue(undefined);
    imprimirDocumento.mockResolvedValue(undefined);
    deleteDocumento.mockResolvedValue(undefined);
    enviarParaAnalise.mockResolvedValue(undefined);
    provaMock = provaBase;
    documentoListProps = null;
    historicoRenderCount = 0;
  });

  it("carrega o detalhe de gestão e envia prova impressa para análise", async () => {
    render(<ProvaGestaoContent provaId="prova-1" />);

    await waitFor(() => {
      expect(fetchProva).toHaveBeenCalledWith("prova-1");
    });

    expect(screen.getByText("Cabecalho da prova")).toBeInTheDocument();
    expect(
      screen.getByText("Impressao sem aprovacao: sim"),
    ).toBeInTheDocument();
    expect(screen.getByText("PDF status: PRONTO")).toBeInTheDocument();

    const botao = screen.getByRole("button", { name: /enviar para análise/i });
    expect(botao).toBeEnabled();

    fireEvent.click(botao);

    await waitFor(() => {
      expect(enviarParaAnalise).toHaveBeenCalledWith("prova-1");
    });
  });

  it("bloqueia envio para análise enquanto houver documento sem impressão", () => {
    const documentoImpresso = provaBase.documentos[0];
    if (!documentoImpresso) {
      throw new Error("Mock precisa ter um documento");
    }
    const { printedAt: _printedAt, ...documentoSemImpressao } =
      documentoImpresso;

    provaMock = {
      ...provaBase,
      documentos: [documentoSemImpressao],
    };

    render(<ProvaGestaoContent provaId="prova-1" />);

    expect(
      screen.getByText(/imprima todos os documentos/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enviar para análise/i }),
    ).toBeDisabled();
  });

  it("permite excluir documento não aprovado com motivo e atualiza a prova", async () => {
    render(<ProvaGestaoContent provaId="prova-1" />);

    await waitFor(() => {
      expect(documentoListProps?.canDelete).toBe(true);
      expect(documentoListProps?.onDelete).toEqual(expect.any(Function));
    });

    await act(async () => {
      await documentoListProps?.onDelete?.(
        "doc-1",
        "Arquivo duplicado enviado pela professora",
      );
    });

    expect(deleteDocumento).toHaveBeenCalledWith(
      "prova-1",
      "doc-1",
      "Arquivo duplicado enviado pela professora",
    );
    expect(refetch).toHaveBeenCalled();
    expect(historicoRenderCount).toBeGreaterThanOrEqual(2);
  });
});
