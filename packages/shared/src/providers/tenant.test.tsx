// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TenantProvider, useTenant } from "./tenant";

function Identidade() {
  const tenant = useTenant();
  return <output data-testid="identidade">{JSON.stringify(tenant)}</output>;
}

describe("TenantProvider", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/usuarios?data=%7B%22role%22%3A%22master%22%7D");
    localStorage.setItem("tenant", JSON.stringify({ role: "falso", schoolId: "falsa" }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              user: {
                id: "usuario-1",
                email: "ana@escola.test",
                name: "Ana",
                role: "professora",
                schoolId: "escola-1",
                unitId: "unidade-1",
                stageId: "etapa-1",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
  });

  it("hidrata identidade pela sessão e remove legado da URL e localStorage", async () => {
    render(
      <TenantProvider>
        <Identidade />
      </TenantProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("identidade").textContent).toContain('"userId":"usuario-1"'));

    expect(fetch).toHaveBeenCalledWith("/api/auth/me", { credentials: "include" });
    expect(window.location.search).toBe("");
    expect(localStorage.getItem("tenant")).toBeNull();
    expect(screen.getByTestId("identidade").textContent).toContain('"schoolId":"escola-1"');
  });
});
