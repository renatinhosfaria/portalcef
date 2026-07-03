import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProvasGestaoContent } from "./provas-content";

const fetchProvas = vi.fn();
const deletarProva = vi.fn();
const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => new URLSearchParams("status=aguardando-impressao"),
}));

vi.mock("../../../../features/prova", () => ({
  PROVA_STATUS_COLORS: {
    AGUARDANDO_IMPRESSAO: "bg-orange-100 text-orange-800",
  },
  PROVA_STATUS_LABELS: {
    AGUARDANDO_IMPRESSAO: "Aguardando Impressao",
  },
  useGestaoProvas: () => ({
    provas: [
      {
        id: "prova-1",
        professorName: "Maria Silva",
        turmaCode: "1A",
        turmaName: "1º Ano A",
        segmento: "Fundamental I",
        provaCicloId: "ciclo-1",
        cicloPeriodo: "1a Prova",
        status: "AGUARDANDO_IMPRESSAO",
        submittedAt: "2026-06-10T12:00:00.000Z",
        createdAt: "2026-06-09T12:00:00.000Z",
        updatedAt: "2026-06-10T12:00:00.000Z",
        documentosCount: 2,
      },
    ],
    pagination: {
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
    isLoading: false,
    error: null,
    fetchProvas,
    deletarProva,
  }),
}));

describe("ProvasGestaoContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProvas.mockResolvedValue(undefined);
  });

  it("busca provas com o filtro inicial e permite abrir o detalhe de gestão", async () => {
    render(
      <ProvasGestaoContent
        initialStatus="aguardando-impressao"
        initialPage={1}
      />,
    );

    await waitFor(() => {
      expect(fetchProvas).toHaveBeenCalledWith({
        status: "aguardando-impressao",
        provaCicloId: undefined,
        segmentoId: undefined,
        professora: undefined,
        page: 1,
        limit: 20,
      });
    });

    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver/i })).toHaveAttribute(
      "href",
      "/provas/gestao/provas/prova-1",
    );
  });
});
