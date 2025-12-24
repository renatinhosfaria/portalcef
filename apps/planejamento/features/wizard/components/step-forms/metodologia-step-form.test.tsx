import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetodologiaStepForm } from "./metodologia-step-form";

describe("MetodologiaStepForm", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it("renders metodologia field with label and placeholder", () => {
    render(<MetodologiaStepForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText("Metodologia")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Descreva como você vai trabalhar/i)
    ).toBeInTheDocument();
  });

  it("shows error when field is empty on blur", async () => {
    const user = userEvent.setup();
    render(<MetodologiaStepForm onSubmit={mockOnSubmit} />);

    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.tab(); // Blur event

    await waitFor(() => {
      expect(
        screen.getByText(/a metodologia deve ter pelo menos 30 caracteres/i)
      ).toBeInTheDocument();
    });
  });

  it("shows error when text is too short (less than 30 chars)", async () => {
    const user = userEvent.setup();
    render(<MetodologiaStepForm onSubmit={mockOnSubmit} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Rodas de conversa");
    await user.tab(); // Blur event

    await waitFor(() => {
      expect(
        screen.getByText(/a metodologia deve ter pelo menos 30 caracteres/i)
      ).toBeInTheDocument();
    });
  });

  it("validates successfully with text >= 30 characters", async () => {
    const user = userEvent.setup();
    const validText = "Rodas de conversa, jogos lúdicos e atividades práticas";

    render(<MetodologiaStepForm onSubmit={mockOnSubmit} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, validText);
    await user.tab(); // Blur event

    // Should not show error
    await waitFor(() => {
      expect(
        screen.queryByText(/a metodologia deve ter pelo menos 30 caracteres/i)
      ).not.toBeInTheDocument();
    });
  });

  it("calls onSubmit with valid data", async () => {
    const user = userEvent.setup();
    const validText = "Utilizarei rodas de conversa para discutir o tema, seguidas de atividades práticas";

    render(<MetodologiaStepForm onSubmit={mockOnSubmit} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, validText);

    const form = document.querySelector("form");
    if (form) {
      form.requestSubmit();
    }

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        metodologia: validText,
      });
    });
  });

  it("loads default values when provided", () => {
    const defaultText = "Experimentos científicos em grupo com relatórios individuais";

    render(
      <MetodologiaStepForm
        onSubmit={mockOnSubmit}
        defaultValues={{ metodologia: defaultText }}
      />
    );

    expect(screen.getByDisplayValue(defaultText)).toBeInTheDocument();
  });

  it("trims whitespace from input", async () => {
    const user = userEvent.setup();
    const textWithSpaces = "   Atividades práticas com materiais manipuláveis   ";

    render(<MetodologiaStepForm onSubmit={mockOnSubmit} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, textWithSpaces);

    const form = document.querySelector("form");
    if (form) {
      form.requestSubmit();
    }

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        metodologia: textWithSpaces.trim(),
      });
    });
  });
});
