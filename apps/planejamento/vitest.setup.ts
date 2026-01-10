import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, vi } from "vitest";

afterEach(() => {
  cleanup();
});

expect.extend(matchers);

const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

Object.defineProperty(globalThis, "localStorage", {
  value: createStorage(),
  configurable: true,
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
