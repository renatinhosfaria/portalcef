import { montarUrlPortal } from "@essencia/components/tarefas";
import { describe, expect, it } from "vitest";

describe("montarUrlPortal", () => {
  it("gera URL absoluta para a lista de tarefas", () => {
    expect(montarUrlPortal("/tarefas", "http://localhost")).toBe(
      "http://localhost/tarefas",
    );
  });

  it("gera URL absoluta para detalhe de tarefa mesmo sem barra inicial", () => {
    expect(montarUrlPortal("tarefas/t1", "http://localhost")).toBe(
      "http://localhost/tarefas/t1",
    );
  });
});
