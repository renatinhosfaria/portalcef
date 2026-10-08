import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => ({
    name: "Equipe",
    role: "professora",
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
  it("mostra apenas módulos disponíveis para o perfil atual", () => {
    render(<Home />);

    const links = [
      {
        nome: /Planejamento/i,
        href: "/planejamento",
      },
      { nome: /Cal/i, href: "/calendario" },
    ];

    links.forEach(({ nome, href }) => {
      const link = screen.getByRole("link", { name: nome });

      expect(link).toHaveAttribute("href", href);
      expect(link).not.toHaveAttribute("rel");
    });

    expect(screen.queryByRole("link", { name: /Escolas/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Turmas/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Usuários/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Ver todos os módulos/i }),
    ).not.toBeInTheDocument();
  });
});
