import { render, screen, fireEvent } from "@testing-library/react";
import { WizardContainer } from "./wizard-container";

describe("WizardContainer", () => {
  it("renders the wizard with title", () => {
    render(<WizardContainer />);

    expect(screen.getByText("Novo Planejamento")).toBeInTheDocument();
  });

  it("renders navigation buttons", () => {
    render(<WizardContainer />);

    expect(
      screen.getByRole("button", { name: /anterior/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /próximo/i })).toBeInTheDocument();
  });

  it("disables 'Anterior' button on first step", () => {
    render(<WizardContainer />);

    const previousButton = screen.getByRole("button", { name: /anterior/i });
    expect(previousButton).toBeDisabled();
  });

  it("advances to next step when 'Próximo' is clicked", () => {
    render(<WizardContainer />);

    const nextButton = screen.getByRole("button", { name: /próximo/i });

    // Should start at step 1
    expect(screen.getByText("Passo 1 de 4")).toBeInTheDocument();

    // Click next
    fireEvent.click(nextButton);

    // Should now be at step 2
    expect(screen.getByText("Passo 2 de 4")).toBeInTheDocument();
  });

  it("goes back to previous step when 'Anterior' is clicked", () => {
    render(<WizardContainer />);

    const nextButton = screen.getByRole("button", { name: /próximo/i });
    const previousButton = screen.getByRole("button", { name: /anterior/i });

    // Advance to step 2
    fireEvent.click(nextButton);
    expect(screen.getByText("Passo 2 de 4")).toBeInTheDocument();

    // Go back to step 1
    fireEvent.click(previousButton);
    expect(screen.getByText("Passo 1 de 4")).toBeInTheDocument();
  });

  it("disables 'Próximo' button on last step", () => {
    render(<WizardContainer />);

    const nextButton = screen.getByRole("button", { name: /próximo/i });

    // Click next 3 times to reach last step
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(screen.getByText("Passo 4 de 4")).toBeInTheDocument();
    expect(nextButton).toBeDisabled();
  });

  it("displays correct content for each step", () => {
    render(<WizardContainer />);

    const nextButton = screen.getByRole("button", { name: /próximo/i });

    // Step 1: Dados
    expect(screen.getByText("Dados do Planejamento")).toBeInTheDocument();

    // Step 2: Objetivos
    fireEvent.click(nextButton);
    expect(
      screen.getByText("Objetivos de Aprendizagem")
    ).toBeInTheDocument();

    // Step 3: Metodologia
    fireEvent.click(nextButton);
    expect(screen.getByText("Metodologia")).toBeInTheDocument();

    // Step 4: Recursos
    fireEvent.click(nextButton);
    expect(screen.getByText("Recursos Didáticos")).toBeInTheDocument();
  });

  it("uses Tunnel Focus layout (max-w-3xl)", () => {
    const { container } = render(<WizardContainer />);

    const tunnelContainer = container.querySelector(".max-w-3xl");
    expect(tunnelContainer).toBeInTheDocument();
  });

  it("has minimum touch target height for buttons (44px)", () => {
    render(<WizardContainer />);

    const nextButton = screen.getByRole("button", { name: /próximo/i });
    const previousButton = screen.getByRole("button", { name: /anterior/i });

    // Both buttons should have min-h-[44px] class
    expect(nextButton.className).toContain("min-h-[44px]");
    expect(previousButton.className).toContain("min-h-[44px]");
  });

  it("has proper aria-labels for screen readers", () => {
    render(<WizardContainer />);

    expect(
      screen.getByLabelText(/voltar para o passo anterior/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/avançar para o próximo passo/i)
    ).toBeInTheDocument();
  });
});
