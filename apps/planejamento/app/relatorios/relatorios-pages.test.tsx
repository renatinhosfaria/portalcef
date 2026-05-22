import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AnaliseRelatorioPage from "./analise/page";
import GestaoRelatorioPage from "./gestao/page";
import TurmasRelatorioPage from "./turmas/page";

const mockApiGet = vi.fn();
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();

vi.mock("@essencia/shared/fetchers/client", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => ({ role: "coordenadora_geral", isLoaded: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("rotas do módulo Relatórios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue([]);
  });

  it("renderiza a seleção de turmas da professora", async () => {
    render(<TurmasRelatorioPage />);

    expect(await screen.findByText("Relatórios Semanais")).toBeTruthy();
  });

  it("renderiza a fila de análise de relatórios", async () => {
    render(<AnaliseRelatorioPage />);

    expect(await screen.findByText("Análise de Relatórios")).toBeTruthy();
  });

  it("renderiza o dashboard de gestão de relatórios", async () => {
    render(<GestaoRelatorioPage />);

    expect(await screen.findByText("Dashboard de Relatórios")).toBeTruthy();
  });
});
