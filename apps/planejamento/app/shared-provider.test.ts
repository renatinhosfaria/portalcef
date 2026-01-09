import { TenantProvider, useTenant } from "@essencia/shared/providers/tenant";
import { describe, expect, it } from "vitest";

describe("shared tenant provider exports", () => {
  it("exposes TenantProvider and useTenant", () => {
    expect(typeof TenantProvider).toBe("function");
    expect(typeof useTenant).toBe("function");
  });
});
