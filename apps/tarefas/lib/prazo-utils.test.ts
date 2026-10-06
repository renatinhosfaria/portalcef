import { afterEach, describe, expect, it, vi } from "vitest";

import { isAtrasada } from "./prazo-utils";

describe("utilitários de prazo", () => {
  afterEach(() => vi.useRealTimers());

  it("considera atrasado um prazo que já passou no mesmo dia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00-03:00"));

    expect(isAtrasada("2026-10-05T11:30:00-03:00")).toBe(true);
  });
});
