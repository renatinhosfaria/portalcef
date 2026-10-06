import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDashboardStats } from "../lib/home-api";

import { QuickStats } from "./quick-stats";

vi.mock("../lib/home-api", () => ({
  getDashboardStats: vi.fn(),
}));

const getDashboardStatsMock = vi.mocked(getDashboardStats);

describe("QuickStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe estatísticas reais após o carregamento", async () => {
    getDashboardStatsMock.mockResolvedValueOnce({
      totalUsers: 1245,
      activeNow: 18,
      administrators: 7,
      sessions24h: 94,
    });

    render(<QuickStats />);

    expect(screen.getByText("Carregando estatísticas...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("1.245")).toBeInTheDocument();
      expect(screen.getByText("18")).toBeInTheDocument();
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("94")).toBeInTheDocument();
    });
  });

  it("oferece nova tentativa quando a consulta falha", async () => {
    getDashboardStatsMock.mockRejectedValueOnce(new Error("indisponível"));

    render(<QuickStats />);

    await waitFor(() => {
      expect(screen.getByText("Não foi possível carregar as estatísticas.")).toBeInTheDocument();
    });

    getDashboardStatsMock.mockResolvedValueOnce({
      totalUsers: 10,
      activeNow: 2,
      administrators: 1,
      sessions24h: 4,
    });

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });
  });
});
