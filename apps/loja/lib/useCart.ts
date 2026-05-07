'use client';

import { useState, useEffect } from 'react';

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
}

export const MAX_QUANTITY_PER_STUDENT = 2;

const CART_STORAGE_KEY = 'cef_shop_cart';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
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
    const currentContext = getCartContext();
    if (
      currentContext &&
      (currentContext.schoolId !== item.schoolId ||
        currentContext.unitId !== item.unitId)
    ) {
      return {
        success: false,
        message:
          'Finalize ou limpe o carrinho atual antes de comprar em outra unidade',
      };
    }

    const currentQty = getQuantityForProductStudent(item.productId, item.studentName);
    const newTotal = currentQty + item.quantity;
    const existingVariantQty = items
      .filter(
        (cartItem) =>
          cartItem.variantId === item.variantId &&
          cartItem.studentName.toLowerCase() === item.studentName.toLowerCase(),
      )
      .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

    if (newTotal > MAX_QUANTITY_PER_STUDENT) {
      return {
        success: false,
        message: `Limite de ${MAX_QUANTITY_PER_STUDENT} unidades por produto por aluno atingido`,
      };
    }

    if (existingVariantQty + item.quantity > item.availableStock) {
      return {
        success: false,
        message: `Estoque disponível insuficiente para ${item.productName}`,
      };
    }

    setItems((current) => {
      // Check if item already exists (same variant + student)
      const existingIndex = current.findIndex(
        (i) => i.variantId === item.variantId && i.studentName.toLowerCase() === item.studentName.toLowerCase()
      );

      if (existingIndex >= 0) {
        // Update quantity
        const updated = [...current];
        updated[existingIndex].quantity += item.quantity;
        return updated;
      }

      // Add new item
      return [...current, item];
    });

    return { success: true };
  };

  const removeItem = (variantId: string, studentName: string) => {
    setItems((current) =>
      current.filter(
        (item) => !(item.variantId === variantId && item.studentName === studentName)
      )
    );
  };

  const updateQuantity = (variantId: string, studentName: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantId, studentName);
      return;
    }

    setItems((current) =>
      current.map((item) => {
        if (
          item.variantId !== variantId ||
          item.studentName.toLowerCase() !== studentName.toLowerCase()
        ) {
          return item;
        }

        const quantityFromOtherVariants = current
          .filter(
            (cartItem) =>
              cartItem.productId === item.productId &&
              cartItem.variantId !== variantId &&
              cartItem.studentName.toLowerCase() === studentName.toLowerCase(),
          )
          .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
        const maxByStudent = Math.max(
          1,
          MAX_QUANTITY_PER_STUDENT - quantityFromOtherVariants,
        );
        const maxAllowed = Math.min(item.availableStock, maxByStudent);

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

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
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
    updateQuantity,
    clearCart,
    getTotalAmount,
    getTotalItems,
    getCartContext,
    getQuantityForProductStudent,
    isLoaded,
  };
}
