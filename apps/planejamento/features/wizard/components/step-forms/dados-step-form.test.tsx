import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DadosStepForm } from "./dados-step-form";

describe("DadosStepForm", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it("renders turma and quinzena fields", () => {
    render(<DadosStepForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText("Turma")).toBeInTheDocument();
    expect(screen.getByText("Quinzena")).toBeInTheDocument();
    expect(screen.getByText("Selecione a turma")).toBeInTheDocument();
    expect(screen.getByText("Selecione a quinzena")).toBeInTheDocument();
  });

  it("shows error when turma is empty on blur", async () => {
    const user = userEvent.setup();
    render(<DadosStepForm onSubmit={mockOnSubmit} />);

    const turmaSelect = screen.getByRole("combobox", { name: /turma/i });
    await user.click(turmaSelect);
    await user.tab(); // Blur event

    await waitFor(() => {
      expect(screen.getByText("Selecione uma turma")).toBeInTheDocument();
    });
  });

  it("shows error when quinzena is empty on blur", async () => {
    const user = userEvent.setup();
    render(<DadosStepForm onSubmit={mockOnSubmit} />);

    const quinzenaSelect = screen.getByRole("combobox", { name: /quinzena/i });
    await user.click(quinzenaSelect);
    await user.tab(); // Blur event

    await waitFor(() => {
      expect(screen.getByText("Selecione uma quinzena")).toBeInTheDocument();
    });
  });

  it("allows selecting turma from dropdown", async () => {
    const user = userEvent.setup();
    render(<DadosStepForm onSubmit={mockOnSubmit} />);

    const turmaSelect = screen.getByRole("combobox", { name: /turma/i });
    await user.click(turmaSelect);

    const option = await screen.findByText("Infantil 3A");
    await user.click(option);

    expect(screen.getByText("Infantil 3A")).toBeInTheDocument();
  });

  it("allows selecting quinzena from dropdown", async () => {
    const user = userEvent.setup();
    render(<DadosStepForm onSubmit={mockOnSubmit} />);

    const quinzenaSelect = screen.getByRole("combobox", { name: /quinzena/i });
    await user.click(quinzenaSelect);

    const option = await screen.findByText(/1ª Quinzena/);
    await user.click(option);

    expect(screen.getByText(/1ª Quinzena/)).toBeInTheDocument();
  });

  it("validates successfully with correct data", async () => {
    const user = userEvent.setup();
    render(<DadosStepForm onSubmit={mockOnSubmit} />);

    // Select turma
    const turmaSelect = screen.getByRole("combobox", { name: /turma/i });
    await user.click(turmaSelect);
    const turmaOption = await screen.findByText("Infantil 3A");
    await user.click(turmaOption);

    // Select quinzena
    const quinzenaSelect = screen.getByRole("combobox", { name: /quinzena/i });
    await user.click(quinzenaSelect);
    const quinzenaOption = await screen.findByText(/1ª Quinzena/);
    await user.click(quinzenaOption);

    // Submit form
    const form = screen.getByRole("form");
    await user.click(form);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        turma: "Infantil 3A",
        quinzena: expect.stringContaining("1ª Quinzena"),
      });
    });
  });

  it("loads default values when provided", () => {
    render(
      <DadosStepForm
        onSubmit={mockOnSubmit}
        defaultValues={{ turma: "Infantil 4A", quinzena: "2ª Quinzena - 17/02 a 28/02" }}
      />
    );

    expect(screen.getByText("Infantil 4A")).toBeInTheDocument();
    expect(screen.getByText("2ª Quinzena - 17/02 a 28/02")).toBeInTheDocument();
  });
});
