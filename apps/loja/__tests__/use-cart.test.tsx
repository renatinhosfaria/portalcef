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

  it('permite adicionar item de pré-venda mesmo sem estoque disponível', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    let addResult: { success: boolean; message?: string } | undefined;
    act(() => {
      addResult = result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 1,
        unitPrice: 170,
        studentName: 'João',
        availableStock: 0,
        modoVenda: 'PRE_VENDA',
      });
    });

    expect(addResult?.success).toBe(true);
    expect(result.current.getPreVendaItems()).toHaveLength(1);
    expect(result.current.getProntaEntregaItems()).toHaveLength(0);
  });

  it('mantém totais separados para pronta entrega e pré-venda', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-pronta-entrega',
        productId: 'product-1',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 1,
        unitPrice: 80,
        studentName: 'João',
        availableStock: 2,
        modoVenda: 'PRONTA_ENTREGA',
      });
      result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-pre-venda',
        productId: 'product-2',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 2,
        unitPrice: 170,
        studentName: 'João',
        availableStock: 0,
        modoVenda: 'PRE_VENDA',
      });
    });

    expect(result.current.getProntaEntregaItems()).toHaveLength(1);
    expect(result.current.getPreVendaItems()).toHaveLength(1);
    expect(result.current.getTotalAmount('PRONTA_ENTREGA')).toBe(80);
    expect(result.current.getTotalAmount('PRE_VENDA')).toBe(340);
    expect(result.current.getTotalAmount()).toBe(420);
  });

  it('mantém carrinhos separados por modoVenda para mesma variante e aluno', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    let prontaEntregaResult: { success: boolean; message?: string } | undefined;
    let preVendaResult: { success: boolean; message?: string } | undefined;

    act(() => {
      prontaEntregaResult = result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 1,
        unitPrice: 170,
        studentName: 'João',
        availableStock: 1,
        modoVenda: 'PRONTA_ENTREGA',
      });
      preVendaResult = result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 1,
        unitPrice: 170,
        studentName: 'João',
        availableStock: 0,
        modoVenda: 'PRE_VENDA',
      });
    });

    expect(prontaEntregaResult?.success).toBe(true);
    expect(preVendaResult?.success).toBe(true);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.getProntaEntregaItems()).toHaveLength(1);
    expect(result.current.getPreVendaItems()).toHaveLength(1);
    expect(result.current.getTotalAmount('PRONTA_ENTREGA')).toBe(170);
    expect(result.current.getTotalAmount('PRE_VENDA')).toBe(170);
  });

  it('remove apenas o item do modo de venda informado', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 1,
        unitPrice: 170,
        studentName: 'João',
        availableStock: 1,
        modoVenda: 'PRONTA_ENTREGA',
      });
      result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 1,
        unitPrice: 170,
        studentName: 'João',
        availableStock: 0,
        modoVenda: 'PRE_VENDA',
      });
    });

    act(() => {
      result.current.removeItem('variant-1', 'João', 'PRE_VENDA');
    });

    expect(result.current.getProntaEntregaItems()).toHaveLength(1);
    expect(result.current.getPreVendaItems()).toHaveLength(0);
  });

  it('altera quantidade apenas do item de pré-venda com mesma variante e aluno', async () => {
    localStorage.setItem(
      'cef_shop_cart',
      JSON.stringify([
        {
          schoolId: 'school-1',
          unitId: 'unit-1',
          variantId: 'variant-1',
          productId: 'product-1',
          productName: 'Moletom',
          variantSize: '10',
          quantity: 2,
          unitPrice: 170,
          studentName: 'João',
          availableStock: 2,
          modoVenda: 'PRONTA_ENTREGA',
        },
        {
          schoolId: 'school-1',
          unitId: 'unit-1',
          variantId: 'variant-1',
          productId: 'product-1',
          productName: 'Moletom',
          variantSize: '10',
          quantity: 2,
          unitPrice: 170,
          studentName: 'João',
          availableStock: 0,
          modoVenda: 'PRE_VENDA',
        },
      ]),
    );
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.updateQuantity('variant-1', 'João', 1, 'PRE_VENDA');
    });

    expect(result.current.getProntaEntregaItems()[0].quantity).toBe(2);
    expect(result.current.getPreVendaItems()[0].quantity).toBe(1);
  });

  it('altera quantidade apenas do item de pronta entrega com mesma variante e aluno', async () => {
    localStorage.setItem(
      'cef_shop_cart',
      JSON.stringify([
        {
          schoolId: 'school-1',
          unitId: 'unit-1',
          variantId: 'variant-1',
          productId: 'product-1',
          productName: 'Moletom',
          variantSize: '10',
          quantity: 2,
          unitPrice: 170,
          studentName: 'João',
          availableStock: 2,
          modoVenda: 'PRONTA_ENTREGA',
        },
        {
          schoolId: 'school-1',
          unitId: 'unit-1',
          variantId: 'variant-1',
          productId: 'product-1',
          productName: 'Moletom',
          variantSize: '10',
          quantity: 2,
          unitPrice: 170,
          studentName: 'João',
          availableStock: 0,
          modoVenda: 'PRE_VENDA',
        },
      ]),
    );
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.updateQuantity('variant-1', 'João', 1, 'PRONTA_ENTREGA');
    });

    expect(result.current.getProntaEntregaItems()[0].quantity).toBe(1);
    expect(result.current.getPreVendaItems()[0].quantity).toBe(2);
  });

  it('remove somente os itens informados quando há sucesso parcial no checkout', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-pronta',
        productId: 'product-1',
        productName: 'Camiseta',
        variantSize: '8',
        quantity: 1,
        unitPrice: 80,
        studentName: 'João',
        availableStock: 1,
        modoVenda: 'PRONTA_ENTREGA',
      });
      result.current.addItem({
        schoolId: 'school-1',
        unitId: 'unit-1',
        variantId: 'variant-pre-venda',
        productId: 'product-2',
        productName: 'Moletom',
        variantSize: '10',
        quantity: 1,
        unitPrice: 170,
        studentName: 'João',
        availableStock: 0,
        modoVenda: 'PRE_VENDA',
      });
    });

    act(() => {
      result.current.removeItems([
        {
          variantId: 'variant-pronta',
          studentName: 'João',
          modoVenda: 'PRONTA_ENTREGA',
        },
      ]);
    });

    expect(result.current.getProntaEntregaItems()).toHaveLength(0);
    expect(result.current.getPreVendaItems()).toHaveLength(1);
  });
});
