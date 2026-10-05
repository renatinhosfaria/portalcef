import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TenantProvider, useTenant } from "./tenant-provider";

function Identidade() {
  const tenant = useTenant();
  return <span>{tenant.name}</span>;
}

describe("TenantProvider", () => {
  it("mostra erro e permite tentar novamente sem redirecionar", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("offline"));
    render(
      <TenantProvider>
        <Identidade />
      </TenantProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /não foi possível carregar/i,
      ),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(window.location.href).not.toContain("portalcef.com.br/login");

    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { user: { name: "Maria", role: "master" } } }),
        { status: 200 },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    await waitFor(() => expect(screen.getByText("Maria")).toBeInTheDocument());
  });
});
