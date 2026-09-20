import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("smoke de Tarefas", () => {
  it("mantém a página de entrada integrada ao conteúdo de tarefas", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/export default function/);
    expect(source).toMatch(/TarefasPageContent|DashboardContent|Shell/);
  });
});
