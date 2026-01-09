import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftRecoveryDialog } from "./draft-recovery-dialog";

// Mock Dialog to avoid Radix UI rendering issues in test environment (if any)
// Or assume JSDOM + testing-library handles it.
// If issues arise with ResizeObserver or PointerEvents, we mock accordingly.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("DraftRecoveryDialog", () => {
  it("renders correctly when open", () => {
    // Fixed date for consistent formatting test
    const savedAt = new Date("2023-12-25T14:30:00");
    render(
      <DraftRecoveryDialog
        isOpen={true}
        savedAt={savedAt}
        onRecover={() => {}}
        onDiscard={() => {}}
      />,
    );

    expect(screen.getByText("Recuperar Rascunho?")).toBeInTheDocument();
    // Check for month "dezembro"
    expect(screen.getByText(/dezembro/i)).toBeInTheDocument();
  });

  it("calls onRecover when clicked", () => {
    const onRecover = vi.fn();
    render(
      <DraftRecoveryDialog
        isOpen={true}
        savedAt={new Date()}
        onRecover={onRecover}
        onDiscard={() => {}}
      />,
    );

    const button = screen.getByRole("button", { name: "Recuperar Rascunho" });
    fireEvent.click(button);
    expect(onRecover).toHaveBeenCalled();
  });

  it("calls onDiscard when clicked", () => {
    const onDiscard = vi.fn();
    render(
      <DraftRecoveryDialog
        isOpen={true}
        savedAt={new Date()}
        onRecover={() => {}}
        onDiscard={onDiscard}
      />,
    );

    const button = screen.getByRole("button", { name: "Descartar" });
    fireEvent.click(button);
    expect(onDiscard).toHaveBeenCalled();
  });
});
