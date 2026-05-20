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
    modoVenda,
  }: {
    productName: string;
    subtotal: number;
    modoVenda?: 'PRONTA_ENTREGA' | 'PRE_VENDA';
  }) => (
    <div>
      <span>{productName}</span>
      <span>{subtotal.toFixed(2)}</span>
      {modoVenda === 'PRE_VENDA' && <span>Item de pré-venda</span>}
    </div>
  ),
}));

vi.mock('../lib/useCart', () => ({
  MAX_QUANTITY_PER_STUDENT: 2,
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
        modoVenda: 'PRONTA_ENTREGA',
      },
      {
        variantId: 'variant-2',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 1,
        unitPrice: 170,
        studentName: 'João',
        availableStock: 0,
        modoVenda: 'PRE_VENDA',
      },
    ],
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    getProntaEntregaItems: () => [
      {
        variantId: 'variant-1',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 2,
        unitPrice: 62.5,
        studentName: 'João',
        availableStock: 10,
        modoVenda: 'PRONTA_ENTREGA',
      },
    ],
    getPreVendaItems: () => [
      {
        variantId: 'variant-2',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 1,
        unitPrice: 170,
        studentName: 'João',
        availableStock: 0,
        modoVenda: 'PRE_VENDA',
      },
    ],
    getTotalAmount: (modoVenda?: 'PRONTA_ENTREGA' | 'PRE_VENDA') => {
      if (modoVenda === 'PRONTA_ENTREGA') return 125;
      if (modoVenda === 'PRE_VENDA') return 170;
      return 295;
    },
    clearCart: vi.fn(),
    isLoaded: true,
  }),
}));

describe('CarrinhoPage', () => {
  it('separa pronta entrega e pré-venda no carrinho', () => {
    render(<CarrinhoPage />);

    expect(screen.getByText('Pronta entrega')).toBeTruthy();
    expect(screen.getByText('Pré-venda')).toBeTruthy();
    expect(screen.getByText('Item de pré-venda')).toBeTruthy();
    expect(screen.getByText('R$ 295.00')).toBeTruthy();
    expect(screen.queryByText('R$ 1.25')).toBeNull();
  });
});
