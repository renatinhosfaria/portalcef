import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AppSidebar Workflows", () => {
  const source = readFileSync(join(process.cwd(), "src/shell/app-sidebar.tsx"), "utf8");

  it("inclui Workflows no menu compartilhado para todos os usuarios", () => {
    expect(source).toContain('workflows: "ALL"');
    expect(source).toContain('label: "Workflows"');
    expect(source).toContain('href: "https://www.portalcef.com.br/workflows"');
    expect(source).not.toContain("tenantPayload");
    expect(source).toContain('if (port === "3015") return setActivePage("workflows")');
  });
});
