import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UnitList, type UnitListItem } from "./unit-list";

const baseUnit: UnitListItem = {
  id: "unit-1",
  name: "Santa Monica",
  code: "01",
  address: "Rua Lourdes de Carvalho, 1212",
  directorGeneral: "Daviane",
  unitManager: "Isabella",
  students: 0,
};

describe("UnitList", () => {
  it("renders diretora geral and gerente da unidade names", () => {
    render(
      <UnitList
        units={[baseUnit]}
        onCreateClick={vi.fn()}
        onEditClick={vi.fn()}
        onAddDirectorClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Diretora Geral")).toBeInTheDocument();
    expect(screen.getByText("Gerente da Unidade")).toBeInTheDocument();
    expect(screen.getByText("Daviane")).toBeInTheDocument();
    expect(screen.getByText("Isabella")).toBeInTheDocument();
  });

  it("shows pending when no responsible is assigned", () => {
    render(
      <UnitList
        units={[{ ...baseUnit, directorGeneral: null, unitManager: null }]}
        onCreateClick={vi.fn()}
        onEditClick={vi.fn()}
        onAddDirectorClick={vi.fn()}
      />,
    );

    const pendingBadges = screen.getAllByText("Pendente");
    expect(pendingBadges).toHaveLength(2);
  });
});
