import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnnouncementBanner } from "./announcement-banner";
import { CalendarWidget } from "./calendar-widget";
import { QuickStats } from "./quick-stats";
import { SystemFeed } from "./system-feed";

describe("componentes do resumo da home", () => {
  it("não exibe avisos fictícios quando não há dados", () => {
    render(<AnnouncementBanner />);

    expect(screen.getByText("Nenhum aviso publicado.")).toBeInTheDocument();
    expect(screen.queryByText(/rematrículas/i)).not.toBeInTheDocument();
  });

  it("não exibe atividades fictícias quando não há dados", () => {
    render(<SystemFeed />);

    expect(screen.getByText("Nenhuma atividade recente.")).toBeInTheDocument();
    expect(screen.queryByText(/Ana Silva/i)).not.toBeInTheDocument();
  });

  it("informa quando as estatísticas ainda não estão disponíveis", () => {
    render(<QuickStats />);

    expect(screen.getAllByText("Dados indisponíveis")).toHaveLength(2);
    expect(screen.queryByText("1,245")).not.toBeInTheDocument();
  });

  it("mantém a data atual e oferece acesso à agenda real", () => {
    render(<CalendarWidget />);

    expect(screen.getByRole("link", { name: /ver agenda completa/i })).toHaveAttribute(
      "href",
      "/calendario",
    );
    expect(screen.queryByText("Reunião Pedagógica")).not.toBeInTheDocument();
  });
});
