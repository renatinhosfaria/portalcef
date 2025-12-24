import { render, screen } from "@testing-library/react";
import NovoPage, { metadata } from "./page";

// Mock WizardContainer since we're testing the page shell
jest.mock("../../../features/wizard/components", () => ({
  WizardContainer: () => <div data-testid="wizard-container">Wizard Mock</div>,
}));

describe("NovoPage", () => {
  it("renders the WizardContainer component", () => {
    render(<NovoPage />);

    expect(screen.getByTestId("wizard-container")).toBeInTheDocument();
  });

  it("exports correct SEO metadata", () => {
    expect(metadata.title).toBe("Novo Planejamento | Essência");
    expect(metadata.description).toContain("planejamento pedagógico");
  });

  it("page has no business logic (shell only)", () => {
    // This test validates AC6 - page should only import and render
    const pageSource = NovoPage.toString();

    // Should not contain state management
    expect(pageSource).not.toContain("useState");
    expect(pageSource).not.toContain("useEffect");

    // Should not contain business logic
    expect(pageSource).not.toContain("if (");
    expect(pageSource).not.toContain("for (");
    expect(pageSource).not.toContain("switch (");
  });
});
