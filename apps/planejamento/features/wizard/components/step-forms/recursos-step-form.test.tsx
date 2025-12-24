import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecursosStepForm } from "./recursos-step-form";

describe("RecursosStepForm", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it("renders recursos field with label and input", () => {
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText("Recursos e Atividades")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Digite um recurso ou atividade")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adicionar/i })).toBeInTheDocument();
  });

  it("adds item to list when clicking Adicionar button", async () => {
    const user = userEvent.setup();
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText("Digite um recurso ou atividade");
    const addButton = screen.getByRole("button", { name: /adicionar/i });

    await user.type(input, "Livros didáticos");
    await user.click(addButton);

    expect(screen.getByText("Livros didáticos")).toBeInTheDocument();
    expect(input).toHaveValue(""); // Input should be cleared
  });

  it("adds item to list when pressing Enter", async () => {
    const user = userEvent.setup();
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText("Digite um recurso ou atividade");

    await user.type(input, "Jogos educativos");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Jogos educativos")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("does not add empty items", async () => {
    const user = userEvent.setup();
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText("Digite um recurso ou atividade");
    const addButton = screen.getByRole("button", { name: /adicionar/i });

    await user.type(input, "   "); // Only whitespace
    await user.click(addButton);

    // Should not add item
    expect(screen.queryByText("   ")).not.toBeInTheDocument();
  });

  it("disables Adicionar button when input is empty", () => {
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    const addButton = screen.getByRole("button", { name: /adicionar/i });

    expect(addButton).toBeDisabled();
  });

  it("enables Adicionar button when input has text", async () => {
    const user = userEvent.setup();
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText("Digite um recurso ou atividade");
    const addButton = screen.getByRole("button", { name: /adicionar/i });

    await user.type(input, "Computador");

    expect(addButton).not.toBeDisabled();
  });

  it("removes item when clicking Remover button", async () => {
    const user = userEvent.setup();
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText("Digite um recurso ou atividade");

    // Add item
    await user.type(input, "Quadro branco");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Quadro branco")).toBeInTheDocument();

    // Remove item
    const removeButton = screen.getByRole("button", { name: /remover quadro branco/i });
    await user.click(removeButton);

    expect(screen.queryByText("Quadro branco")).not.toBeInTheDocument();
  });

  it("adds multiple items to list", async () => {
    const user = userEvent.setup();
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText("Digite um recurso ou atividade");

    await user.type(input, "Lápis de cor");
    await user.keyboard("{Enter}");

    await user.type(input, "Papel sulfite");
    await user.keyboard("{Enter}");

    await user.type(input, "Tesoura");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Lápis de cor")).toBeInTheDocument();
    expect(screen.getByText("Papel sulfite")).toBeInTheDocument();
    expect(screen.getByText("Tesoura")).toBeInTheDocument();
  });

  it("shows error when submitting with empty list", async () => {
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    const form = document.querySelector("form");
    if (form) {
      form.requestSubmit();
    }

    await waitFor(() => {
      expect(
        screen.getByText(/adicione pelo menos um recurso ou atividade/i)
      ).toBeInTheDocument();
    });
  });

  it("calls onSubmit with valid data", async () => {
    const user = userEvent.setup();
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText("Digite um recurso ou atividade");

    await user.type(input, "Livro de histórias");
    await user.keyboard("{Enter}");

    await user.type(input, "Fantoches");
    await user.keyboard("{Enter}");

    const form = document.querySelector("form");
    if (form) {
      form.requestSubmit();
    }

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        recursos: ["Livro de histórias", "Fantoches"],
      });
    });
  });

  it("loads default values when provided", () => {
    render(
      <RecursosStepForm
        onSubmit={mockOnSubmit}
        defaultValues={{ recursos: ["Giz de cera", "Massinha"] }}
      />
    );

    expect(screen.getByText("Giz de cera")).toBeInTheDocument();
    expect(screen.getByText("Massinha")).toBeInTheDocument();
  });

  it("trims whitespace from items", async () => {
    const user = userEvent.setup();
    render(<RecursosStepForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText("Digite um recurso ou atividade");

    await user.type(input, "   Calculadora   ");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Calculadora")).toBeInTheDocument();
  });
});
