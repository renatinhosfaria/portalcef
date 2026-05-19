import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OrderItemCard } from '../OrderItemCard';

describe('OrderItemCard', () => {
  const itemBase = {
    productName: 'Moletom',
    variantSize: '10',
    quantity: 1,
    unitPrice: 170,
    subtotal: 170,
    studentName: 'João',
  };

  it('sinaliza visualmente item de pré-venda', () => {
    render(<OrderItemCard {...itemBase} modoVenda="PRE_VENDA" />);

    expect(screen.getByText('Pré-venda')).toBeInTheDocument();
  });

  it('não sinaliza pré-venda em item de pronta entrega', () => {
    render(<OrderItemCard {...itemBase} modoVenda="PRONTA_ENTREGA" />);

    expect(screen.queryByText('Pré-venda')).not.toBeInTheDocument();
  });
});
