// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PedidoPublicoResult } from "@essencia/shared/types";
import { EventosApiError } from "../../../lib/eventos-api";
import * as eventosApi from "../../../lib/eventos-api";
import { CupomPedido } from "../cupom-pedido";

vi.mock("../../../lib/eventos-api", async () => {
  const atual = await vi.importActual<typeof import("../../../lib/eventos-api")>("../../../lib/eventos-api");
  return { ...atual, aplicarCupom: vi.fn() };
});

const pedido: PedidoPublicoResult = {
  orderNumber: "PED123456",
  status: "RESERVADO",
  eventTitle: "Festival",
  eventSlug: "festival",
  sessionId: "sessao-1",
  expiresAt: new Date("2026-12-07T18:30:00Z"),
  session: { startsAt: new Date("2026-12-07T19:00:00Z"), endsAt: new Date("2026-12-07T21:00:00Z") },
  subtotalCents: 10000,
  offerDiscountCents: 0,
  couponDiscountCents: 0,
  discountCents: 0,
  totalCents: 10000,
  appliedOffer: null,
  appliedCoupon: null,
  items: [],
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CupomPedido", () => {
  it("aplica o código e atualiza o pedido retornado pela API", async () => {
    const atualizado = { ...pedido, couponDiscountCents: 1000, discountCents: 1000, totalCents: 9000, appliedCoupon: { id: "cupom-1", version: 1, code: "DEZ", name: "Dez por cento", pricingType: "PERCENTUAL" as const, discountPercent: 10, discountCents: null } };
    vi.mocked(eventosApi.aplicarCupom).mockResolvedValue(atualizado);
    const onAtualizar = vi.fn();
    render(<CupomPedido pedido={pedido} onAtualizar={onAtualizar} />);

    fireEvent.change(screen.getByLabelText("Cupom de desconto"), { target: { value: " dez " } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar cupom" }));

    await waitFor(() => expect(eventosApi.aplicarCupom).toHaveBeenCalledWith(pedido.orderNumber, "dez"));
    expect(onAtualizar).toHaveBeenCalledWith(atualizado);
    expect(screen.getByRole("status").textContent).toContain("Cupom aplicado");
  });

  it("mostra carregamento e permite remover o cupom", async () => {
    const aplicado = { ...pedido, appliedCoupon: { id: "cupom-1", version: 1, code: "DEZ", name: null, pricingType: "PERCENTUAL" as const, discountPercent: 10, discountCents: null } };
    let resolver!: (value: PedidoPublicoResult) => void;
    vi.mocked(eventosApi.aplicarCupom).mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
    const onAtualizar = vi.fn();
    render(<CupomPedido pedido={aplicado} onAtualizar={onAtualizar} />);

    fireEvent.click(screen.getByRole("button", { name: "Remover cupom" }));
    expect((screen.getByRole("button", { name: "Removendo cupom…" }) as HTMLButtonElement).disabled).toBe(true);
    resolver(pedido);
    await waitFor(() => expect(onAtualizar).toHaveBeenCalledWith(pedido));
    expect(screen.getByRole("status").textContent).toContain("Cupom removido");
  });

  it.each([
    ["COUPON_NOT_FOUND", "Cupom não encontrado"],
    ["COUPON_EXPIRED", "Cupom expirado"],
    ["COUPON_USAGE_LIMIT_REACHED", "Limite de uso do cupom esgotado"],
  ])("mostra a mensagem retornada para %s", async (code, message) => {
    vi.mocked(eventosApi.aplicarCupom).mockRejectedValue(new EventosApiError(message, 400, code));
    render(<CupomPedido pedido={pedido} onAtualizar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Cupom de desconto"), { target: { value: "teste" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar cupom" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(message));
  });
});
