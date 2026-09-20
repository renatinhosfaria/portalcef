import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MasterSidebar } from "./master-sidebar";

describe("MasterSidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("shows Portal CEF branding", () => {
    render(<MasterSidebar />);

    expect(screen.getByText("Portal CEF")).toBeInTheDocument();
  });

  it("marca link externo para voltar aos apps", () => {
    render(<MasterSidebar />);

    const link = screen.getByRole("link", { name: /Voltar aos Apps/i });

    expect(link).toHaveAttribute("href", "https://www.portalcef.com.br/");
    expect(link).toHaveAttribute("rel", "external");
  });

  it("invalida a sessão no servidor antes de redirecionar", async () => {
    const resposta = Promise.resolve(new Response(null, { status: 200 }));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(resposta);
    const redirecionar = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign: redirecionar });
    localStorage.setItem("tenant", "school-a");

    render(<MasterSidebar />);
    fireEvent.click(screen.getByRole("button", { name: /Sair do Master/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
      expect(localStorage.getItem("tenant")).toBeNull();
      expect(redirecionar).toHaveBeenCalledWith(
        "https://www.portalcef.com.br/login",
      );
    });
  });
});
