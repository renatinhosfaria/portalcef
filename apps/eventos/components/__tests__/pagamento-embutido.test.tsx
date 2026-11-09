// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { obterStripe, PagamentoEmbutido } from "../checkout/pagamento-embutido";

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn((publishableKey: string) => Promise.resolve({ publishableKey })),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({ children, options }: { children: React.ReactNode; options: { clientSecret: string } }) => (
    <div data-testid="embedded-checkout-provider" data-client-secret={options.clientSecret}>{children}</div>
  ),
  EmbeddedCheckout: () => <div data-testid="embedded-checkout" />,
}));

describe("pagamento embutido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("monta o checkout embutido com o clientSecret", () => {
    render(<PagamentoEmbutido publishableKey="pk_test_eventos" clientSecret="cs_test_123" />);

    expect(screen.getByText("Pagamento processado pela Stripe. Os dados do seu cartão não passam pelo nosso servidor.")).toBeTruthy();
    expect(screen.getByTestId("embedded-checkout-provider").getAttribute("data-client-secret")).toBe("cs_test_123");
    expect(screen.getByTestId("embedded-checkout")).toBeTruthy();
  });

  it("chama loadStripe uma vez por chave", async () => {
    await obterStripe("pk_test_cache_a");
    await obterStripe("pk_test_cache_a");
    await obterStripe("pk_test_cache_b");

    expect(loadStripe).toHaveBeenCalledTimes(2);
    expect(loadStripe).toHaveBeenNthCalledWith(1, "pk_test_cache_a");
    expect(loadStripe).toHaveBeenNthCalledWith(2, "pk_test_cache_b");
  });

  it("sem chave mostra mensagem e não quebra", () => {
    render(<PagamentoEmbutido publishableKey={null} clientSecret="cs_test_123" />);

    expect(screen.getByRole("alert").textContent).toBe("Pagamento indisponível no momento. Tente novamente em instantes.");
    expect(screen.queryByTestId("embedded-checkout-provider")).toBeNull();
  });
});

void EmbeddedCheckout;
void EmbeddedCheckoutProvider;
