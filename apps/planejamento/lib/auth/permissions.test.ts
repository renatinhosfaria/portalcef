import { describe, expect, it } from "vitest";

import {
  canAccessPlanejamento,
  canApprove,
  getSegmentPrefix,
  getUserSegment,
} from "./permissions";

describe("permissions", () => {
  it("maps coordinator roles to the correct stage codes", () => {
    expect(getUserSegment("coordenadora_bercario")).toBe("BERCARIO");
    expect(getUserSegment("coordenadora_infantil")).toBe("INFANTIL");
    expect(getUserSegment("coordenadora_fundamental_i")).toBe("FUNDAMENTAL_I");
    expect(getUserSegment("coordenadora_fundamental_ii")).toBe(
      "FUNDAMENTAL_II",
    );
    expect(getUserSegment("coordenadora_medio")).toBe("MEDIO");
  });

  it("returns ALL for roles without stage scoping", () => {
    expect(getUserSegment("coordenadora_geral")).toBe("ALL");
    expect(getUserSegment("analista_pedagogico")).toBe("ALL");
    expect(getUserSegment("diretora_geral")).toBe("ALL");
  });

  it("returns expected prefixes for stage filters", () => {
    expect(getSegmentPrefix("BERCARIO")).toBe("BERC-%");
    expect(getSegmentPrefix("INFANTIL")).toBe("INF-%");
    expect(getSegmentPrefix("FUNDAMENTAL_I")).toBe("FUND-I-%");
    expect(getSegmentPrefix("FUNDAMENTAL_II")).toBe("FUND-II-%");
    expect(getSegmentPrefix("MEDIO")).toBe("MED-%");
    expect(getSegmentPrefix("ALL")).toBeNull();
  });

  it("allows planning access only to authorized roles", () => {
    expect(canAccessPlanejamento("analista_pedagogico")).toBe(true);
    expect(canAccessPlanejamento("professora")).toBe(true);
    expect(canAccessPlanejamento("auxiliar_administrativo")).toBe(false);
  });

  it("restricts approval to coordination or direction roles", () => {
    expect(canApprove("coordenadora_fundamental_i")).toBe(true);
    expect(canApprove("diretora_geral")).toBe(true);
    expect(canApprove("professora")).toBe(false);
  });
});
