import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CheckoutPage from '../app/checkout/page';

const mocks = vi.hoisted(() => ({
  routerBack: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  clearCart: vi.fn(),
  showToast: vi.fn(),
  locationAssign: vi.fn(),
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
    items: [
      {
        variantId: 'variant-1',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 1,
        unitPrice: 4500,
        studentName: 'João Silva',
      },
    ],
    getTotalAmount: () => 4500,
    getCartContext: () => ({
      schoolId: 'school-1',
      unitId: 'unit-1',
    }),
    clearCart: mocks.clearCart,
    isLoaded: true,
  }),
}));

const originalLocation = window.location;

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
