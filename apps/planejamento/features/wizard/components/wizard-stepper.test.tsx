import { render, screen } from "@testing-library/react";
import { WizardStepper, type WizardStep } from "./wizard-stepper";

describe("WizardStepper", () => {
  const mockSteps: WizardStep[] = [
    { id: "dados", title: "Dados", status: "current" },
    { id: "objetivos", title: "Objetivos", status: "pending" },
    { id: "metodologia", title: "Metodologia", status: "pending" },
    { id: "recursos", title: "Recursos", status: "pending" },
  ];

  it("renders all 4 steps", () => {
    render(<WizardStepper steps={mockSteps} />);

    expect(screen.getAllByText("Dados")).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText("Objetivos")).toHaveLength(2);
    expect(screen.getAllByText("Metodologia")).toHaveLength(2);
    expect(screen.getAllByText("Recursos")).toHaveLength(2);
  });

  it("displays step numbers correctly", () => {
    render(<WizardStepper steps={mockSteps} />);

    expect(screen.getAllByText("1")).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText("2")).toHaveLength(2);
    expect(screen.getAllByText("3")).toHaveLength(2);
    expect(screen.getAllByText("4")).toHaveLength(2);
  });

  it("marks current step with aria-current", () => {
    render(<WizardStepper steps={mockSteps} />);

    const currentSteps = screen.getAllByRole("listitem", {
      current: "step",
    });
    expect(currentSteps).toHaveLength(2); // Desktop + Mobile
  });

  it("shows checkmark for completed steps", () => {
    const stepsWithCompleted: WizardStep[] = [
      { id: "dados", title: "Dados", status: "completed" },
      { id: "objetivos", title: "Objetivos", status: "current" },
      { id: "metodologia", title: "Metodologia", status: "pending" },
      { id: "recursos", title: "Recursos", status: "pending" },
    ];

    render(<WizardStepper steps={stepsWithCompleted} />);

    // Check icons should be present (hidden from screen readers with aria-hidden)
    const checks = document.querySelectorAll('[aria-hidden="true"]');
    expect(checks.length).toBeGreaterThan(0);
  });

  it("applies correct styling classes for current step (primary color)", () => {
    render(<WizardStepper steps={mockSteps} />);

    const firstStepCircles = document.querySelectorAll(
      ".border-primary.bg-primary"
    );
    expect(firstStepCircles.length).toBeGreaterThan(0);
  });

  it("applies correct styling classes for completed step (secondary color)", () => {
    const stepsWithCompleted: WizardStep[] = [
      { id: "dados", title: "Dados", status: "completed" },
      { id: "objetivos", title: "Objetivos", status: "current" },
      { id: "metodologia", title: "Metodologia", status: "pending" },
      { id: "recursos", title: "Recursos", status: "pending" },
    ];

    render(<WizardStepper steps={stepsWithCompleted} />);

    const completedCircles = document.querySelectorAll(
      ".border-secondary.bg-secondary"
    );
    expect(completedCircles.length).toBeGreaterThan(0);
  });

  it("has accessible navigation label", () => {
    render(<WizardStepper steps={mockSteps} />);

    expect(
      screen.getByRole("navigation", { name: /progresso do formulário/i })
    ).toBeInTheDocument();
  });
});
