import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");

describe("Identidade visual do layout compartilhado", () => {
  it("mantém o logo do cabeçalho, a marca e o acesso a tarefas no menu", () => {
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
    const configuracaoModulos = readFileSync(
      path.join(repoRoot, "packages/components/src/shell/module-config.ts"),
      "utf8",
    );

    expect(shellSource).toContain('src="/logo.png"');
    expect(shellSource).toContain('alt="Logo da escola"');
    expect(shellSource).toContain('className="h-12 w-auto object-contain"');
    expect(sidebarSource).toContain("Portal CEF");
    expect(sidebarSource).toContain('from "./module-config"');
    expect(configuracaoModulos).toContain('label: "Tarefas"');
    expect(configuracaoModulos).toContain('href: "/tarefas"');
    expect(sidebarSource).not.toContain("tenantPayload");
  });
});
