'use client';

import { useState, useEffect } from 'react';

export interface CartItem {
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
    const currentQty = getQuantityForProductStudent(item.productId, item.studentName);
    const newTotal = currentQty + item.quantity;

    if (newTotal > MAX_QUANTITY_PER_STUDENT) {
      return {
        success: false,
        message: `Limite de ${MAX_QUANTITY_PER_STUDENT} unidades por produto por aluno atingido`,
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
      current.map((item) =>
        item.variantId === variantId && item.studentName === studentName
          ? { ...item, quantity }
          : item
      )
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

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalAmount,
    getTotalItems,
    getQuantityForProductStudent,
    isLoaded,
  };
}
