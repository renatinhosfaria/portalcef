import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "./page";

const mockUseTenant = vi.fn();
const mockRouterPush = vi.fn();
const mockApiGet = vi.fn();

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock("@essencia/shared/fetchers/client", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTenant.mockReturnValue({
      role: "analista_pedagogico",
      isLoaded: true,
    });
    mockApiGet.mockResolvedValue({ temInfantil: true });
  });

  it("mostra o card Relatórios para analista pedagógica", () => {
    render(<HomePage />);

    expect(screen.getByText("Relatórios")).toBeTruthy();
  });

  it("mostra o card Relatórios para professora com turma infantil", async () => {
    mockUseTenant.mockReturnValue({
      role: "professora",
      isLoaded: true,
    });

    render(<HomePage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/relatorio/tem-turma-infantil");
    });
    expect(await screen.findByText("Relatórios")).toBeTruthy();
  });
});
