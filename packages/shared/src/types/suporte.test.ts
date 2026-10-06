import { describe, expect, it } from "vitest";

import {
  LIMITE_TOTAL_ANEXOS_SUPORTE,
  STATUS_TRANSITIONS,
  isTransicaoStatusPermitida,
} from "./suporte";

describe("contrato do suporte", () => {
  it("permite apenas as transições de status do workflow", () => {
    expect(isTransicaoStatusPermitida("ABERTA", "EM_ANDAMENTO")).toBe(true);
    expect(isTransicaoStatusPermitida("RESOLVIDA", "EM_ANDAMENTO")).toBe(true);
    expect(isTransicaoStatusPermitida("FECHADA", "EM_ANDAMENTO")).toBe(false);
    expect(isTransicaoStatusPermitida("ABERTA", "ABERTA")).toBe(false);
  });

  it("mantém o limite total de anexos alinhado entre as camadas", () => {
    expect(LIMITE_TOTAL_ANEXOS_SUPORTE).toBe(5);
    expect(STATUS_TRANSITIONS.FECHADA).toEqual([]);
  });
});
