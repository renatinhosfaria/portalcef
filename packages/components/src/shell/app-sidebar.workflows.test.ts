import { describe, expect, it } from "vitest";

import { PORTAL_MODULES, hasModuleAccess } from "./module-config";

describe("AppSidebar Workflows", () => {
  it("inclui Workflows no menu compartilhado para todos os usuarios", () => {
    const workflows = PORTAL_MODULES.find((item) => item.key === "workflows");

    expect(workflows).toMatchObject({
      label: "Workflows",
      href: "/workflows",
    });
    expect(hasModuleAccess("professora", "workflows")).toBe(true);
  });
});
