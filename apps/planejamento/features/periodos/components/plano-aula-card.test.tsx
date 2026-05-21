import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanoAulaCard } from "./plano-aula-card";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("turmaId=turma-1"),
}));

describe("PlanoAulaCard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("não marca prazo civil de 01/01 como atrasado na noite anterior", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T01:00:00.000Z"));

    render(
      <PlanoAulaCard
        periodo={{
          id: "periodo-1",
          numero: 1,
          descricao: "Plano de janeiro",
          dataInicio: "2026-01-01",
          dataFim: "2026-01-15",
          dataMaximaEntrega: "2026-01-01",
        }}
      />,
    );

    expect(screen.queryByText("Atrasado")).not.toBeInTheDocument();
  });
});
