import { describe, expect, it } from "vitest";

import { criarDataCivil } from "./formatar-data";

describe("formatar-data", () => {
  it("cria data civil local para string YYYY-MM-DD", () => {
    const data = criarDataCivil("2026-03-01");

    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(2);
    expect(data.getDate()).toBe(1);
  });
});
