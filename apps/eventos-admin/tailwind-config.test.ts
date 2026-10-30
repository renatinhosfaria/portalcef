import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("configuração do Tailwind do eventos-admin", () => {
  it("inclui as features para gerar os estilos dos componentes do workspace", () => {
    const config = readFileSync(join(process.cwd(), "tailwind.config.ts"), "utf8");

    expect(config).toContain('"./features/**/*.{js,ts,jsx,tsx,mdx}"');
  });
});
