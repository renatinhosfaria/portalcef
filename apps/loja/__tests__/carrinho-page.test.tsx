import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import CarrinhoPage from '../app/carrinho/page';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
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
      <span>{subtotal.toFixed(2)}</span>
    </div>
  ),
}));

vi.mock('../lib/useCart', () => ({
  useCart: () => ({
    items: [
      {
        variantId: 'variant-1',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 2,
        unitPrice: 62.5,
        studentName: 'João',
        availableStock: 10,
      },
    ],
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    getTotalAmount: () => 125,
    clearCart: vi.fn(),
    isLoaded: true,
  }),
}));

describe('CarrinhoPage', () => {
  it('renderiza total em reais sem dividir novamente por 100', () => {
    render(<CarrinhoPage />);

    expect(screen.getByText('R$ 125.00')).toBeTruthy();
    expect(screen.queryByText('R$ 1.25')).toBeNull();
  });
});
