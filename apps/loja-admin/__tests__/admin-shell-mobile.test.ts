import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("menu móvel da Loja Admin", () => {
  it("reutiliza o drawer compartilhado e não transporta identidade na URL", () => {
    const source = readFileSync(join(process.cwd(), "components/AdminShell.tsx"), "utf8");
    expect(source).toContain('@essencia/components/shell/mobile-drawer');
    expect(source).toContain('<AdminSidebar mobile />');
    expect(source).not.toContain("tenantPayload");
    expect(source).not.toContain("?data=");
  });
});
