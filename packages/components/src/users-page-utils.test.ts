import { describe, expect, it } from "vitest";

import { criarUrlUsuarios } from "./users-page-utils";

describe("criarUrlUsuarios", () => {
  it("adiciona o filtro de inativos preservando os demais parâmetros", () => {
    expect(criarUrlUsuarios("/usuarios?busca=maria", true)).toBe(
      "/usuarios?busca=maria&inativos=true",
    );
  });

  it("remove o filtro de inativos quando a lista ativa é selecionada", () => {
    expect(criarUrlUsuarios("/usuarios?busca=maria&inativos=true", false)).toBe(
      "/usuarios?busca=maria",
    );
  });
});
