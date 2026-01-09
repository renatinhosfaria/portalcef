import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => ({
    userId: "development_user",
    schoolId: "school-1",
    unitId: "unit-1",
    role: "professora",
    name: "Test User",
    email: "test@example.com",
    isLoaded: true,
  }),
  TenantProvider: ({ children }: { children: ReactNode }) => children,
}));

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
