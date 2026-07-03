import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WorkflowsPage from "./page";

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => ({
    role: "professora",
    userId: "user-1",
    isLoaded: true,
  }),
}));

vi.mock("@/lib/api", () => ({
  listarCategorias: vi.fn().mockResolvedValue([]),
  listarModelos: vi.fn().mockResolvedValue([]),
  listarExecucoes: vi.fn().mockResolvedValue([]),
}));

describe("WorkflowsPage", () => {
  it("renderiza abas principais do modulo", () => {
    render(<WorkflowsPage />);

    expect(screen.getAllByText("Workflows").length).toBeGreaterThan(0);
    expect(screen.getByText("Em andamento")).toBeTruthy();
    expect(screen.getByText("Concluidos")).toBeTruthy();
  });
});
