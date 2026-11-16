// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PedidoPublicoResult, PublicEventDetail, PublicEventSession } from "@essencia/shared/types";
import { ResumoPedido } from "../resumo-pedido";

const sessao: PublicEventSession = { id: "sessao-1", startsAt: new Date("2026-12-07T19:00:00Z"), endsAt: new Date("2026-12-07T21:00:00Z"), status: "PUBLICADA", capacity: 30, location: null, mapId: null, salesStartsAt: null, salesEndsAt: null, availability: "available", offers: [], ticketTypes: [] };
const evento: PublicEventDetail = { id: "evento-1", slug: "festival", title: "Festival", summary: null, description: null, imageUrl: null, category: null, startsAt: sessao.startsAt, locationName: null, fromPriceCents: 5000, availability: "available", contactEmail: null, contactPhone: null, cancellationPolicy: null };
const pedido: PedidoPublicoResult = { orderNumber: "PED123456", status: "RESERVADO", eventTitle: evento.title, eventSlug: evento.slug, sessionId: sessao.id, expiresAt: new Date("2026-12-07T18:30:00Z"), session: { startsAt: sessao.startsAt, endsAt: sessao.endsAt }, subtotalCents: 10000, offerDiscountCents: 1000, couponDiscountCents: 500, discountCents: 1500, totalCents: 8500, appliedOffer: { id: "oferta-1", version: 1, name: "Grupo", minQuantity: 2, maxQuantity: null, discountPercent: 10 }, appliedCoupon: { id: "cupom-1", version: 1, code: "DEZ", name: "Dez por cento", pricingType: "PERCENTUAL", discountPercent: 5, discountCents: null }, items: [{ seatId: "seat-1", ticketTypeId: "inteira", unitPriceCents: 8500, totalPriceCents: 8500, rowLabel: "A", seatNumber: "1", ticketTypeName: "Inteira" }] };

afterEach(() => cleanup());

describe("ResumoPedido", () => {
  it("mostra um único campo de cupom, dentro do resumo e antes do subtotal", () => {
    render(<ResumoPedido pedido={pedido} evento={evento} sessao={sessao} onAlterar={vi.fn()} onAtualizar={vi.fn()} />);

    const resumo = screen.getByRole("complementary", { name: "Resumo do pedido" });
    const campos = screen.getAllByLabelText("Cupom de desconto");
    expect(campos).toHaveLength(1);
    expect(resumo.contains(campos[0]!)).toBe(true);
    const subtotal = screen.getByText("Subtotal");
    expect(campos[0]!.compareDocumentPosition(subtotal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("não oferece o campo de cupom quando a troca não é mais permitida, mas mantém o desconto", () => {
    render(<ResumoPedido pedido={pedido} evento={evento} sessao={sessao} onAlterar={vi.fn()} onAtualizar={vi.fn()} permitirCupom={false} />);

    expect(screen.queryByLabelText("Cupom de desconto")).toBeNull();
    expect(screen.queryByRole("button", { name: /cupom/i })).toBeNull();
    expect(screen.getByText(/Cupom:/)).toBeTruthy();
    expect(screen.getByText("-R$ 5,00")).toBeTruthy();
  });

  it("no celular, abre e fecha os detalhes do pedido pelo botão do resumo", () => {
    render(<ResumoPedido pedido={pedido} evento={evento} sessao={sessao} onAlterar={vi.fn()} onAtualizar={vi.fn()} />);

    const alternar = screen.getByRole("button", { name: /1 lugar · A1/ });
    expect(alternar.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(alternar);
    expect(alternar.getAttribute("aria-expanded")).toBe("true");
  });

  it("mostra oferta, cupom, descontos separados e total retornado", () => {
    render(<ResumoPedido pedido={pedido} evento={evento} sessao={sessao} onAlterar={vi.fn()} onAtualizar={vi.fn()} />);

    expect(screen.getAllByText(/Oferta automática/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cupom:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Desconto da oferta/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Desconto do cupom/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("-R$ 10,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-R$ 5,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 85,00").length).toBeGreaterThan(0);
  });

  it("informa quando o pedido ficou gratuito", () => {
    render(<ResumoPedido pedido={{ ...pedido, couponDiscountCents: 10000, discountCents: 10000, totalCents: 0 }} evento={evento} sessao={sessao} onAlterar={vi.fn()} onAtualizar={vi.fn()} />);
    expect(screen.getAllByText("Pedido gratuito").length).toBeGreaterThan(0);
  });

  it("informa pedido gratuito quando o subtotal retornado é zero", () => {
    render(<ResumoPedido pedido={{ ...pedido, subtotalCents: 0, offerDiscountCents: 0, couponDiscountCents: 0, discountCents: 0, totalCents: 0, appliedOffer: null, appliedCoupon: null, items: [] }} evento={evento} sessao={sessao} onAlterar={vi.fn()} onAtualizar={vi.fn()} />);
    expect(screen.getAllByText("R$ 0,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pedido gratuito").length).toBeGreaterThan(0);
  });
});
