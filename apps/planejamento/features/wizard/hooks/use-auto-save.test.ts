import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoSave } from "./use-auto-save";

// Mock toast
vi.mock("@essencia/ui/components/toaster", () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe("useAutoSave", () => {
  const visitorId = "development_user";
  const storageKey = `planning_draft_${visitorId}`;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves to localStorage after 30 seconds when data changes", () => {
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave({ data }),
      {
        initialProps: { data: { foo: "bar" } },
      },
    );

    // Determine initial state logic: if initialized with data, does it count as change?
    // Ref initialized with data. comparison checks ref vs current data.
    // So initial render = no change.

    // Update data
    rerender({ data: { foo: "baz" } });

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    const saved = localStorage.getItem(storageKey);
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!).data).toEqual({ foo: "baz" });
  });

  it("does not save if data hasn't changed", () => {
    renderHook(() => useAutoSave({ data: { foo: "bar" } }));

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("saves immediately with saveNow()", () => {
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave({ data }),
      {
        initialProps: { data: { foo: "bar" } },
      },
    );

    rerender({ data: { foo: "baz" } }); // Make dirty

    act(() => {
      result.current.saveNow();
    });

    const saved = localStorage.getItem(storageKey);
    expect(JSON.parse(saved!).data).toEqual({ foo: "baz" });
  });

  it("clears draft", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        data: { foo: "old" },
        savedAt: new Date().toISOString(),
      }),
    );

    const { result } = renderHook(() => useAutoSave({ data: { foo: "bar" } }));

    act(() => {
      result.current.clearDraft();
    });

    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("loads draft", () => {
    const savedData = { foo: "saved" };
    const date = new Date().toISOString();
    localStorage.setItem(
      storageKey,
      JSON.stringify({ data: savedData, savedAt: date }),
    );

    const { result } = renderHook(() =>
      useAutoSave({ data: { foo: "current" } }),
    );

    const loaded = result.current.loadDraft();
    expect(loaded).not.toBeNull();
    expect(loaded?.data).toEqual(savedData);
    expect(loaded?.savedAt).toEqual(new Date(date));
  });
});
