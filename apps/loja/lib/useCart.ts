'use client';

import { useState, useEffect } from 'react';

export type ModoVenda = 'PRONTA_ENTREGA' | 'PRE_VENDA';

export interface CartItem {
  schoolId: string;
  unitId: string;
  variantId: string;
  productId: string;
  productName: string;
  variantSize: string;
  quantity: number;
  unitPrice: number;
  studentName: string;
  imageUrl?: string;
  availableStock: number;
  modoVenda?: ModoVenda;
}

export interface CartItemKey {
  variantId: string;
  studentName: string;
  modoVenda?: ModoVenda;
}

export const MAX_QUANTITY_PER_STUDENT = 2;

const CART_STORAGE_KEY = 'cef_shop_cart';
const MODO_VENDA_PADRAO: ModoVenda = 'PRONTA_ENTREGA';

function normalizarItem(item: CartItem): CartItem {
  return {
    ...item,
    modoVenda: item.modoVenda ?? MODO_VENDA_PADRAO,
  };
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored).map(normalizarItem));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (error) {
        console.error('Error saving cart:', error);
      }
    }
  }, [items, isLoaded]);

  // Retorna quantidade total de um produto para um aluno (todas as variantes)
  const getQuantityForProductStudent = (productId: string, studentName: string) => {
    return items
      .filter((i) => i.productId === productId && i.studentName.toLowerCase() === studentName.toLowerCase())
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  const addItem = (item: CartItem): { success: boolean; message?: string } => {
    const normalizedItem = normalizarItem(item);
    const currentContext = getCartContext();
    if (
      currentContext &&
      (currentContext.schoolId !== normalizedItem.schoolId ||
        currentContext.unitId !== normalizedItem.unitId)
    ) {
      return {
        success: false,
        message:
          'Finalize ou limpe o carrinho atual antes de comprar em outra unidade',
      };
    }

    const currentQty = getQuantityForProductStudent(normalizedItem.productId, normalizedItem.studentName);
    const newTotal = currentQty + normalizedItem.quantity;
    const existingVariantQty = items
      .filter(
        (cartItem) =>
          cartItem.variantId === normalizedItem.variantId &&
          cartItem.studentName.toLowerCase() === normalizedItem.studentName.toLowerCase() &&
          (cartItem.modoVenda ?? MODO_VENDA_PADRAO) === normalizedItem.modoVenda,
      )
      .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

    if (newTotal > MAX_QUANTITY_PER_STUDENT) {
      return {
        success: false,
        message: `Limite de ${MAX_QUANTITY_PER_STUDENT} unidades por produto por aluno atingido`,
      };
    }

    if (
      normalizedItem.modoVenda !== 'PRE_VENDA' &&
      existingVariantQty + normalizedItem.quantity > normalizedItem.availableStock
    ) {
      return {
        success: false,
        message: `Estoque disponível insuficiente para ${normalizedItem.productName}`,
      };
    }

    setItems((current) => {
      // Check if item already exists (same variant + student)
      const existingIndex = current.findIndex(
        (i) =>
          i.variantId === normalizedItem.variantId &&
          i.studentName.toLowerCase() === normalizedItem.studentName.toLowerCase() &&
          (i.modoVenda ?? MODO_VENDA_PADRAO) === normalizedItem.modoVenda
      );

      if (existingIndex >= 0) {
        // Update quantity
        const updated = [...current];
        updated[existingIndex].quantity += normalizedItem.quantity;
        return updated;
      }

      // Add new item
      return [...current, normalizedItem];
    });

    return { success: true };
  };

  const itemMatchesKey = (item: CartItem, key: CartItemKey) => {
    return (
      item.variantId === key.variantId &&
      item.studentName.toLowerCase() === key.studentName.toLowerCase() &&
      (
        key.modoVenda === undefined ||
        (item.modoVenda ?? MODO_VENDA_PADRAO) === key.modoVenda
      )
    );
  };

  const removeItem = (
    variantId: string,
    studentName: string,
    modoVenda?: ModoVenda,
  ) => {
    setItems((current) =>
      current.filter(
        (item) => !itemMatchesKey(item, { variantId, studentName, modoVenda })
      )
    );
  };

  const removeItems = (keys: CartItemKey[]) => {
    setItems((current) =>
      current.filter(
        (item) => !keys.some((key) => itemMatchesKey(item, key)),
      ),
    );
  };

  const updateQuantity = (
    variantId: string,
    studentName: string,
    quantity: number,
    modoVenda?: ModoVenda,
  ) => {
    if (quantity <= 0) {
      removeItem(variantId, studentName, modoVenda);
      return;
    }

    setItems((current) =>
      current.map((item) => {
        if (
          item.variantId !== variantId ||
          item.studentName.toLowerCase() !== studentName.toLowerCase() ||
          (
            modoVenda !== undefined &&
            (item.modoVenda ?? MODO_VENDA_PADRAO) !== modoVenda
          )
        ) {
          return item;
        }

        const itemModoVenda = item.modoVenda ?? MODO_VENDA_PADRAO;
        const quantityFromOtherVariants = current
          .filter(
            (cartItem) =>
              cartItem.productId === item.productId &&
              cartItem.studentName.toLowerCase() === studentName.toLowerCase() &&
              !(
                cartItem.variantId === variantId &&
                (cartItem.modoVenda ?? MODO_VENDA_PADRAO) === itemModoVenda
              ),
          )
          .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
        const maxByStudent = Math.max(
          1,
          MAX_QUANTITY_PER_STUDENT - quantityFromOtherVariants,
        );
        const maxAllowed =
          itemModoVenda === 'PRE_VENDA'
            ? maxByStudent
            : Math.min(item.availableStock, maxByStudent);

        return {
          ...item,
          quantity: Math.max(1, Math.min(quantity, maxAllowed)),
        };
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const getItemsByModoVenda = (modoVenda: ModoVenda) => {
    return items.filter(
      (item) => (item.modoVenda ?? MODO_VENDA_PADRAO) === modoVenda,
    );
  };

  const getProntaEntregaItems = () => getItemsByModoVenda('PRONTA_ENTREGA');

  const getPreVendaItems = () => getItemsByModoVenda('PRE_VENDA');

  const getTotalAmount = (modoVenda?: ModoVenda) => {
    const sourceItems = modoVenda ? getItemsByModoVenda(modoVenda) : items;
    return sourceItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  };

  const getTotalItems = (modoVenda?: ModoVenda) => {
    const sourceItems = modoVenda ? getItemsByModoVenda(modoVenda) : items;
    return sourceItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getCartContext = () => {
    const firstItem = items[0];
    if (!firstItem?.schoolId || !firstItem?.unitId) {
      return null;
    }

    return {
      schoolId: firstItem.schoolId,
      unitId: firstItem.unitId,
    };
  };

  return {
    items,
    addItem,
    removeItem,
    removeItems,
    updateQuantity,
    clearCart,
    getTotalAmount,
    getTotalItems,
    getItemsByModoVenda,
    getProntaEntregaItems,
    getPreVendaItems,
    getCartContext,
    getQuantityForProductStudent,
    isLoaded,
  };
}
