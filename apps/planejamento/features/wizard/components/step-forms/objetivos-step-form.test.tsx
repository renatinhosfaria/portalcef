import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ObjetivosStepForm } from "./objetivos-step-form";

describe("ObjetivosStepForm", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it("renders objetivos field with label and placeholder", () => {
    render(<ObjetivosStepForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText("Objetivos da Quinzena")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Descreva os objetivos de aprendizagem/i)
    ).toBeInTheDocument();
  });

  it("shows error when field is empty on blur", async () => {
    const user = userEvent.setup();
    render(<ObjetivosStepForm onSubmit={mockOnSubmit} />);

    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.tab(); // Blur event

    await waitFor(() => {
      expect(
        screen.getByText(/os objetivos devem ter pelo menos 20 caracteres/i)
      ).toBeInTheDocument();
    });
  });

  it("shows error when text is too short (less than 20 chars)", async () => {
    const user = userEvent.setup();
    render(<ObjetivosStepForm onSubmit={mockOnSubmit} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Texto curto");
    await user.tab(); // Blur event

    await waitFor(() => {
      expect(
        screen.getByText(/os objetivos devem ter pelo menos 20 caracteres/i)
      ).toBeInTheDocument();
    });
  });

  it("validates successfully with text >= 20 characters", async () => {
    const user = userEvent.setup();
    const validText = "Compreender os conceitos básicos de matemática";

    render(<ObjetivosStepForm onSubmit={mockOnSubmit} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, validText);
    await user.tab(); // Blur event

    // Should not show error
    await waitFor(() => {
      expect(
        screen.queryByText(/os objetivos devem ter pelo menos 20 caracteres/i)
      ).not.toBeInTheDocument();
    });
  });

  it("calls onSubmit with valid data", async () => {
    const user = userEvent.setup();
    const validText = "Desenvolver habilidades de leitura e escrita";

    render(<ObjetivosStepForm onSubmit={mockOnSubmit} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, validText);

    const form = document.querySelector("form");
    if (form) {
      form.requestSubmit();
    }

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        objetivos: validText,
      });
    });
  });

  it("loads default values when provided", () => {
    const defaultText = "Identificar letras do alfabeto";

    render(
      <ObjetivosStepForm
        onSubmit={mockOnSubmit}
        defaultValues={{ objetivos: defaultText }}
      />
    );

    expect(screen.getByDisplayValue(defaultText)).toBeInTheDocument();
  });

  it("trims whitespace from input", async () => {
    const user = userEvent.setup();
    const textWithSpaces = "   Compreender conceitos matemáticos   ";

    render(<ObjetivosStepForm onSubmit={mockOnSubmit} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, textWithSpaces);

    const form = document.querySelector("form");
    if (form) {
      form.requestSubmit();
    }

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        objetivos: textWithSpaces.trim(),
      });
    });
  });
});
