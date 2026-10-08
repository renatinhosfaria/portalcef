import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTodayCalendarEvents } from "../lib/home-api";

import { AnnouncementBanner } from "./announcement-banner";
import { CalendarWidget } from "./calendar-widget";
import { SystemFeed } from "./system-feed";

type HomeApiModule = {
  getTodayCalendarEvents: typeof getTodayCalendarEvents;
  formatarDataCivil: (data: string | Date) => string;
};

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => ({ unitId: "8d7e7f1f-4f2c-4f05-9ed3-c6db6c6e1a02" }),
}));

vi.mock("../lib/home-api", async (importOriginal) => {
  const actual = await importOriginal<HomeApiModule>();
  return {
    ...actual,
    getTodayCalendarEvents: vi.fn(),
  };
});

const getTodayCalendarEventsMock = vi.mocked(getTodayCalendarEvents);

describe("componentes do resumo da home", () => {
  beforeEach(() => {
    getTodayCalendarEventsMock.mockResolvedValue([]);
  });

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

  it("exibe os eventos reais do dia e oferece acesso à agenda completa", async () => {
    getTodayCalendarEventsMock.mockResolvedValueOnce([
      {
        id: "8d7e7f1f-4f2c-4f05-9ed3-c6db6c6e1a03",
        unitId: "8d7e7f1f-4f2c-4f05-9ed3-c6db6c6e1a02",
        title: "Reunião Pedagógica",
        description: null,
        eventType: "REUNIAO_PEDAGOGICA",
        startDate: new Date("2026-10-05"),
        endDate: new Date("2026-10-05"),
        isSchoolDay: true,
        isRecurringAnnually: false,
        createdBy: "8d7e7f1f-4f2c-4f05-9ed3-c6db6c6e1a04",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ]);

    render(<CalendarWidget />);

    expect(screen.getByRole("link", { name: /ver agenda completa/i })).toHaveAttribute(
      "href",
      "/calendario",
    );

    await waitFor(() => {
      expect(screen.getByText("Reunião Pedagógica")).toBeInTheDocument();
      expect(screen.getByText("Dia todo")).toBeInTheDocument();
    });
  });

  it("mostra fallback quando a agenda falha", async () => {
    getTodayCalendarEventsMock.mockRejectedValueOnce(new Error("indisponível"));

    render(<CalendarWidget />);

    await waitFor(() => {
      expect(screen.getByText("Não foi possível carregar a agenda.")).toBeInTheDocument();
    });
  });
});
