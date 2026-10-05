import { describe, expect, it } from "vitest";

import { getTurmaCapabilities } from "./capabilities";

describe("capacidades do módulo de turmas", () => {
  it("permite administrar dados apenas para roles administrativas", () => {
    expect(getTurmaCapabilities("gerente_unidade")).toEqual({
      canEdit: true,
      canArchive: true,
      canManageProfessora: true,
    });
    expect(getTurmaCapabilities("gerente_financeiro")).toEqual({
      canEdit: false,
      canArchive: false,
      canManageProfessora: false,
    });
  });

  it("mantém gerenciamento de professora para coordenação geral", () => {
    expect(getTurmaCapabilities("coordenadora_geral")).toEqual({
      canEdit: false,
      canArchive: false,
      canManageProfessora: true,
    });
  });
});
