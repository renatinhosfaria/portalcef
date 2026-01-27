import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => ({
    name: "Equipe",
    isLoaded: true,
  }),
}));

vi.mock("../components/announcement-banner", () => ({
  AnnouncementBanner: () => <div data-testid="announcement-banner" />,
}));

vi.mock("../components/calendar-widget", () => ({
  CalendarWidget: () => <div data-testid="calendar-widget" />,
}));

vi.mock("../components/quick-stats", () => ({
  QuickStats: () => <div data-testid="quick-stats" />,
}));

vi.mock("../components/system-feed", () => ({
  SystemFeed: () => <div data-testid="system-feed" />,
}));

describe("Home", () => {
  it("marca links dos modulos como externos", () => {
    render(<Home />);

    const links = [
      {
        nome: /Planejamento/i,
        href: "https://www.portalcef.com.br/planejamento",
      },
      { nome: /Escolas/i, href: "https://www.portalcef.com.br/escolas" },
      { nome: /Turmas/i, href: "https://www.portalcef.com.br/turmas" },
      { nome: /Usu/i, href: "https://www.portalcef.com.br/usuarios" },
      { nome: /Cal/i, href: "https://www.portalcef.com.br/calendario" },
    ];

    links.forEach(({ nome, href }) => {
      const link = screen.getByRole("link", { name: nome });

      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("rel", "external");
    });
  });
});
