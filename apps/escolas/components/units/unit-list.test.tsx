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
  it("renders o gerente da unidade", () => {
    render(
      <UnitList
        units={[baseUnit]}
        onCreateClick={vi.fn()}
        onEditClick={vi.fn()}
        onAddDirectorClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Gerente da Unidade")).toBeInTheDocument();
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

    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });
});
