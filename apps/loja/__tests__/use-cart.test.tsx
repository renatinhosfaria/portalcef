/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_QUANTITY_PER_STUDENT, useCart } from '../lib/useCart';

describe('useCart', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('limita updateQuantity ao máximo por produto por aluno', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 1,
        unitPrice: 62.5,
        studentName: 'João',
        availableStock: 10,
      });
    });

    act(() => {
      result.current.updateQuantity('variant-1', 'João', 5);
    });

    expect(result.current.items[0].quantity).toBe(MAX_QUANTITY_PER_STUDENT);
  });

  it('limita updateQuantity ao estoque disponível do item', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 1,
        unitPrice: 62.5,
        studentName: 'João',
        availableStock: 1,
      });
    });

    act(() => {
      result.current.updateQuantity('variant-1', 'João', 2);
    });

    expect(result.current.items[0].quantity).toBe(1);
  });

  it('rejeita adicionar novamente o mesmo item acima do estoque disponível', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 1,
        unitPrice: 62.5,
        studentName: 'João',
        availableStock: 1,
      });
    });

    let addResult: { success: boolean; message?: string } | undefined;
    act(() => {
      addResult = result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 1,
        unitPrice: 62.5,
        studentName: 'João',
        availableStock: 1,
      });
    });

    expect(addResult?.success).toBe(false);
    expect(result.current.items[0].quantity).toBe(1);
  });

  it('não mistura itens de unidades diferentes no mesmo carrinho', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 1,
        unitPrice: 62.5,
        studentName: 'João',
        availableStock: 10,
      });
    });

    let addResult: { success: boolean; message?: string } | undefined;
    act(() => {
      addResult = result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-2',
        variantId: 'variant-2',
        productId: 'product-2',
        productName: 'Bermuda',
        variantSize: '8',
        quantity: 1,
        unitPrice: 70,
        studentName: 'João',
        availableStock: 10,
      });
    });

    expect(addResult?.success).toBe(false);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.getCartContext()).toEqual({
      schoolId: 'school-1',
      unitId: 'unit-1',
    });
  });
});
