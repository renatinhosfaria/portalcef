import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CheckoutPage from '../app/checkout/page';

const mocks = vi.hoisted(() => ({
  routerBack: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  clearCart: vi.fn(),
  removeItems: vi.fn(),
  showToast: vi.fn(),
  locationAssign: vi.fn(),
  confirm: vi.fn(),
  cartItems: [] as Array<{
    variantId: string;
    productName: string;
    variantSize: string;
    quantity: number;
    unitPrice: number;
    studentName: string;
    availableStock: number;
    modoVenda?: 'PRONTA_ENTREGA' | 'PRE_VENDA';
  }>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mocks.routerBack,
    push: mocks.routerPush,
    replace: mocks.routerReplace,
  }),
}));

vi.mock('../components/Loading', () => ({
  LoadingSpinner: () => <div>Carregando</div>,
}));

vi.mock('../components/OrderItemCard', () => ({
  OrderItemCard: ({
    productName,
    subtotal,
  }: {
    productName: string;
    subtotal: number;
  }) => (
    <div>
      <span>{productName}</span>
      <span>{subtotal}</span>
    </div>
  ),
}));

vi.mock('../components/Toast', () => ({
  Toast: ({ message }: { message: string }) => <div>{message}</div>,
  useToast: () => ({
    toast: null,
    showToast: mocks.showToast,
  }),
}));

vi.mock('../lib/useCart', () => ({
  useCart: () => ({
    items: mocks.cartItems,
    getTotalAmount: (modoVenda?: 'PRONTA_ENTREGA' | 'PRE_VENDA') =>
      mocks.cartItems
        .filter((item) => !modoVenda || (item.modoVenda ?? 'PRONTA_ENTREGA') === modoVenda)
        .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    getProntaEntregaItems: () =>
      mocks.cartItems.filter((item) => (item.modoVenda ?? 'PRONTA_ENTREGA') === 'PRONTA_ENTREGA'),
    getPreVendaItems: () =>
      mocks.cartItems.filter((item) => (item.modoVenda ?? 'PRONTA_ENTREGA') === 'PRE_VENDA'),
    getCartContext: () => ({
      schoolId: 'school-1',
      unitId: 'unit-1',
    }),
    clearCart: mocks.clearCart,
    removeItems: mocks.removeItems,
    isLoaded: true,
  }),
}));

const originalLocation = window.location;

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cartItems.splice(0, mocks.cartItems.length, {
      variantId: 'variant-1',
      productName: 'Camiseta',
      variantSize: '8',
      quantity: 1,
      unitPrice: 4500,
      studentName: 'João Silva',
      availableStock: 1,
      modoVenda: 'PRONTA_ENTREGA',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            orderId: 'order-1',
            orderNumber: '123456',
            totalAmount: 4500,
            expiresAt: '2026-04-28T12:30:00.000Z',
            checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
          },
        }),
      }),
    );
    vi.stubGlobal('confirm', mocks.confirm.mockReturnValue(true));

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        assign: mocks.locationAssign,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.unstubAllGlobals();
  });

  it('inicia checkout online, limpa carrinho e redireciona para o Stripe', async () => {
    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText('Nome Completo'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByLabelText('Telefone'), {
      target: { value: '(11) 98765-4321' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pagar online/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/shop/checkout/init',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            schoolId: 'school-1',
            unitId: 'unit-1',
            items: [
              {
                variantId: 'variant-1',
                quantity: 1,
                studentName: 'João Silva',
              },
            ],
            customerName: 'Maria Silva',
            customerPhone: '11987654321',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(mocks.clearCart).toHaveBeenCalledTimes(1);
      expect(mocks.locationAssign).toHaveBeenCalledWith(
        'https://checkout.stripe.com/c/pay/cs_test_123',
      );
    });
  });

  it('exibe erro de estoque sem oferecer conversao automatica para pre-venda', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Estoque insuficiente. Disponível: 0, solicitado: 1',
          variantId: 'variant-1',
        },
      }),
    } as Response);

    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText('Nome Completo'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByLabelText('Telefone'), {
      target: { value: '(11) 98765-4321' },
    });
    fireEvent.click(screen.getByRole('button', { name: /gerar voucher presencial/i }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gera vouchers separados para pronta entrega e pré-venda', async () => {
    mocks.cartItems.splice(
      0,
      mocks.cartItems.length,
      {
        variantId: 'variant-pronta',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 1,
        unitPrice: 80,
        studentName: 'João Silva',
        availableStock: 1,
        modoVenda: 'PRONTA_ENTREGA',
      },
      {
        variantId: 'variant-pre-venda',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 1,
        unitPrice: 170,
        studentName: 'João Silva',
        availableStock: 0,
        modoVenda: 'PRE_VENDA',
      },
    );

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: { orderNumber: '111111' },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: { orderNumber: '222222' },
        }),
      } as Response);

    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText('Nome Completo'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByLabelText('Telefone'), {
      target: { value: '(11) 98765-4321' },
    });
    fireEvent.click(screen.getByRole('button', { name: /gerar vouchers separados/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/shop/orders/school-1',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(fetch).toHaveBeenCalledWith(
        '/api/shop/orders/pre-venda/school-1',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(screen.getByText('#111111')).toBeTruthy();
      expect(screen.getByText('#222222')).toBeTruthy();
    });
  });

  it('exibe erro quando produto de pre-venda nao esta mais marcado como tal', async () => {
    mocks.cartItems.splice(0, mocks.cartItems.length, {
      variantId: 'variant-pre-venda',
      productName: 'Moletom',
      variantSize: '10',
      quantity: 1,
      unitPrice: 170,
      studentName: 'João Silva',
      availableStock: 0,
      modoVenda: 'PRE_VENDA',
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: {
          code: 'PRODUCT_NOT_PRE_SALE',
          message: 'Este produto não está marcado como pré-venda.',
          details: { productId: 'product-1' },
        },
      }),
    } as Response);

    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText('Nome Completo'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByLabelText('Telefone'), {
      target: { value: '(11) 98765-4321' },
    });
    fireEvent.click(screen.getByRole('button', { name: /gerar voucher de pré-venda/i }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/shop/orders/pre-venda/school-1',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('bloqueia pagamento online quando há item de pré-venda', async () => {
    mocks.cartItems.splice(0, mocks.cartItems.length, {
      variantId: 'variant-pre-venda',
      productName: 'Moletom',
      variantSize: '10',
      quantity: 1,
      unitPrice: 170,
      studentName: 'João Silva',
      availableStock: 0,
      modoVenda: 'PRE_VENDA',
    });

    render(<CheckoutPage />);

    const onlineButton = screen.getByRole('button', { name: /pagamento online/i });
    expect((onlineButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(onlineButton);

    expect(fetch).not.toHaveBeenCalledWith(
      '/api/shop/checkout/init',
      expect.any(Object),
    );
    expect(screen.getByText(/Itens de pré-venda geram voucher/i)).toBeTruthy();
  });

  it('mostra aviso na tela quando apenas parte dos vouchers foi gerada', async () => {
    mocks.cartItems.splice(
      0,
      mocks.cartItems.length,
      {
        variantId: 'variant-pronta',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 1,
        unitPrice: 80,
        studentName: 'João Silva',
        availableStock: 1,
        modoVenda: 'PRONTA_ENTREGA',
      },
      {
        variantId: 'variant-pre-venda',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 1,
        unitPrice: 170,
        studentName: 'João Silva',
        availableStock: 0,
        modoVenda: 'PRE_VENDA',
      },
    );

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: { orderNumber: '111111' },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Falha temporária' },
        }),
      } as Response);

    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText('Nome Completo'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByLabelText('Telefone'), {
      target: { value: '(11) 98765-4321' },
    });
    fireEvent.click(screen.getByRole('button', { name: /gerar vouchers separados/i }));

    await waitFor(() => {
      expect(screen.getByText('#111111')).toBeTruthy();
      expect(screen.getByText(/itens não finalizados permaneceram no carrinho/i)).toBeTruthy();
    });
    expect(mocks.removeItems).toHaveBeenCalledWith([
      {
        variantId: 'variant-pronta',
        studentName: 'João Silva',
        modoVenda: 'PRONTA_ENTREGA',
      },
    ]);
  });

  it('nao converte pronta entrega sem estoque para pre-venda automaticamente', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const source = readFileSync(join(process.cwd(), 'app/checkout/page.tsx'), 'utf8');

    expect(source).not.toContain('Deseja transformar esse item em pré-venda');
    expect(source).not.toContain('PRE_SALE_STOCK_AVAILABLE');
  });
});
