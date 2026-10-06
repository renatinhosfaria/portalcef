import {
  STATUS_TRANSITIONS,
  type OrdemServicoStatus,
} from "@essencia/shared/types";
import { describe, expect, it } from "vitest";

describe("opções de status da ordem de serviço", () => {
  it("não oferece ações para uma ordem fechada", () => {
    const status: OrdemServicoStatus = "FECHADA";

    expect(STATUS_TRANSITIONS[status]).toEqual([]);
  });

  it("permite reabrir uma ordem resolvida para andamento", () => {
    expect(STATUS_TRANSITIONS.RESOLVIDA).toContain("EM_ANDAMENTO");
  });
});
