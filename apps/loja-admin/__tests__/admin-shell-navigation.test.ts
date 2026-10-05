import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("navegação do shell administrativo", () => {
  const shellPath = join(process.cwd(), "components/AdminShell.tsx");
  const legacySidebarPath = join(process.cwd(), "components/AdminSidebar.tsx");

  it("oferece acesso aos relatórios pelo shell usado em produção", () => {
    const source = readFileSync(shellPath, "utf8");

    expect(source).toContain('href="/relatorios"');
    expect(source).toContain('label="Relatórios"');
  });

  it("mantém uma única implementação de sidebar", () => {
    expect(existsSync(legacySidebarPath)).toBe(false);
  });
});
