import { violacaoDeUnico } from "./violacao-unico";

/** Reproduz o erro como ele chega do Drizzle 0.45 com postgres-js. */
function erroDoDriver(constraint: string, code = "23505") {
  const original = Object.assign(new Error("duplicate key value violates unique constraint"), { code, constraint_name: constraint });
  return Object.assign(new Error("Failed query: insert into ..."), { query: "insert into ...", params: [], cause: original });
}

describe("violacaoDeUnico", () => {
  it("reconhece o erro embrulhado pelo Drizzle e devolve o nome da restrição", () => {
    expect(violacaoDeUnico(erroDoDriver("uq_evento_pedidos_idempotency_key"))).toBe("uq_evento_pedidos_idempotency_key");
  });

  it("reconhece o erro cru do driver", () => {
    expect(violacaoDeUnico({ code: "23505", constraint_name: "uq_x" })).toBe("uq_x");
  });

  it("aceita o campo constraint, usado pelo driver pg", () => {
    expect(violacaoDeUnico({ code: "23505", constraint: "uq_y" })).toBe("uq_y");
  });

  it("devolve texto vazio quando é violação de único sem nome de restrição", () => {
    expect(violacaoDeUnico({ code: "23505" })).toBe("");
  });

  it("devolve null para outros erros", () => {
    expect(violacaoDeUnico(erroDoDriver("fk_x", "23503"))).toBeNull();
    expect(violacaoDeUnico(new Error("qualquer"))).toBeNull();
    expect(violacaoDeUnico(null)).toBeNull();
    expect(violacaoDeUnico(undefined)).toBeNull();
    expect(violacaoDeUnico("23505")).toBeNull();
  });
});
