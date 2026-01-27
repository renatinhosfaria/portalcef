import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MasterSidebar } from "./master-sidebar";

describe("MasterSidebar", () => {
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
});
