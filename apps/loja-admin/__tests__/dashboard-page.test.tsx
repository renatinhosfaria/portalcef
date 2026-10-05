import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DashboardPage from "../app/page";
import { apiFetch } from "../lib/api";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

describe("Dashboard da loja", () => {
  it("informa indisponibilidade da API sem transformar erro em métricas zeradas", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("API indisponível"));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Não foi possível carregar o dashboard",
      );
    });

    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeTruthy();
    expect(screen.queryByText("0 pedidos")).toBeNull();
  });
});
