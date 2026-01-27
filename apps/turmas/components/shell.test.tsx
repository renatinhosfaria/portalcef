import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");

describe("Shell layout assets", () => {
  it("keeps the header logo and sidebar branding in the shared shell", () => {
    const shellPath = path.join(
      repoRoot,
      "packages/components/src/shell/shell.tsx",
    );
    const sidebarPath = path.join(
      repoRoot,
      "packages/components/src/shell/app-sidebar.tsx",
    );

    const shellSource = readFileSync(shellPath, "utf8");
    const sidebarSource = readFileSync(sidebarPath, "utf8");

    expect(shellSource).toContain('src="/logo.png"');
    expect(shellSource).toContain('alt="Logo da escola"');
    expect(shellSource).toContain('className="h-12 w-auto object-contain"');
    expect(sidebarSource).toContain("Portal CEF");
    expect(sidebarSource).toContain('label: "Tarefas"');
    expect(sidebarSource).toContain("/tarefas?data=");
  });
});
