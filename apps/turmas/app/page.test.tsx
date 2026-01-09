import { clientFetch } from "@essencia/shared/fetchers/client";
import { useTenant } from "@essencia/shared/providers/tenant";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TurmasPage from "./page";

vi.mock("@essencia/shared/fetchers/client", () => ({
  clientFetch: vi.fn(),
}));

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const clientFetchMock = vi.mocked(clientFetch);
const useTenantMock = vi.mocked(useTenant);
const baseTenant: ReturnType<typeof useTenant> = {
  userId: "user-1",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: "stage-1",
  role: "diretora_geral",
  name: "Test User",
  email: "test@example.com",
  isLoaded: true,
};

describe("TurmasPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientFetchMock.mockResolvedValue([]);
  });

  it("calls unit endpoint when unitId exists", async () => {
    useTenantMock.mockReturnValue({ ...baseTenant, unitId: "unit-1" });

    render(<TurmasPage />);

    await waitFor(() => {
      expect(clientFetchMock).toHaveBeenCalledWith("/units/unit-1/turmas");
    });
  });

  it("calls general endpoint when unitId is empty", async () => {
    useTenantMock.mockReturnValue({ ...baseTenant, unitId: "" });

    render(<TurmasPage />);

    await waitFor(() => {
      expect(clientFetchMock).toHaveBeenCalledWith("/turmas");
    });
  });
});
