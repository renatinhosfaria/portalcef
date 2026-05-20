'use client';

import Link from 'next/link';

import { LoadingSpinner } from '@/components/Loading';
import { OrderItemCard } from '@/components/OrderItemCard';
import { MAX_QUANTITY_PER_STUDENT, useCart, type CartItem, type ModoVenda } from '@/lib/useCart';

export default function CarrinhoPage() {
  const {
    items,
    removeItem,
    updateQuantity,
    getTotalAmount,
    getProntaEntregaItems,
    getPreVendaItems,
    clearCart,
    isLoaded,
  } = useCart();
  const prontaEntregaItems = getProntaEntregaItems();
  const preVendaItems = getPreVendaItems();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-2xl font-bold mb-2">Carrinho Vazio</h2>
          <p className="text-muted-foreground mb-6">
            Adicione produtos ao carrinho para continuar
          </p>
          <Link href="/" className="btn-primary w-full">
            Ver Catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">🛒 Meu Carrinho</h1>
          <Link href="/" className="text-primary hover:underline">
            ← Voltar ao catálogo
          </Link>
        </div>

        {/* Items */}
        <div className="space-y-6 mb-8">
          <CartSection
            title="Pronta entrega"
            modoVenda="PRONTA_ENTREGA"
            items={prontaEntregaItems}
            total={getTotalAmount('PRONTA_ENTREGA')}
            removeItem={removeItem}
            updateQuantity={updateQuantity}
          />
          <CartSection
            title="Pré-venda"
            description="Reservas para pagamento na retirada."
            modoVenda="PRE_VENDA"
            items={preVendaItems}
            total={getTotalAmount('PRE_VENDA')}
            removeItem={removeItem}
            updateQuantity={updateQuantity}
          />
        </div>

        {/* Summary */}
        <div className="card bg-primary/5 border-2 border-primary">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xl font-semibold">Total</span>
            <span className="text-3xl font-bold text-primary">
              R$ {getTotalAmount().toFixed(2)}
            </span>
          </div>

          <Link href="/checkout" className="btn-primary w-full text-center block">
            Ir para Checkout →
          </Link>

          <button
            onClick={clearCart}
            className="btn-outline w-full mt-3"
          >
            Limpar Carrinho
          </button>
        </div>
      </div>
    </div>
  );
}

interface CartSectionProps {
  title: string;
  description?: string;
  modoVenda: ModoVenda;
  items: CartItem[];
  total: number;
  removeItem: (variantId: string, studentName: string, modoVenda?: ModoVenda) => void;
  updateQuantity: (
    variantId: string,
    studentName: string,
    quantity: number,
    modoVenda?: ModoVenda,
  ) => void;
}

function CartSection({
  title,
  description,
  modoVenda,
  items,
  total,
  removeItem,
  updateQuantity,
}: CartSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          {description && (
            <p className="text-sm text-slate-500">{description}</p>
          )}
        </div>
        <span className="text-sm font-semibold text-slate-700 tabular-nums">
          R$ {total.toFixed(2)}
        </span>
      </div>

      <div className="space-y-4">
        {items.map((item: CartItem, index: number) => {
          const itemModoVenda = item.modoVenda ?? 'PRONTA_ENTREGA';
          const maxQuantity =
            itemModoVenda === 'PRE_VENDA'
              ? MAX_QUANTITY_PER_STUDENT
              : item.availableStock;

          return (
            <div
              key={`${itemModoVenda}-${item.variantId}-${item.studentName}-${index}`}
              className="card"
            >
              <OrderItemCard
                productName={item.productName}
                variantSize={item.variantSize}
                quantity={item.quantity}
                unitPrice={item.unitPrice}
                subtotal={item.unitPrice * item.quantity}
                studentName={item.studentName}
                imageUrl={item.imageUrl}
                modoVenda={itemModoVenda}
              />

              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <button
                  onClick={() =>
                    updateQuantity(
                      item.variantId,
                      item.studentName,
                      item.quantity - 1,
                      modoVenda,
                    )
                  }
                  className="btn-outline"
                  disabled={item.quantity <= 1}
                >
                  −
                </button>
                <span className="text-lg font-semibold">{item.quantity}</span>
                <button
                  onClick={() =>
                    updateQuantity(
                      item.variantId,
                      item.studentName,
                      item.quantity + 1,
                      modoVenda,
                    )
                  }
                  className="btn-outline"
                  disabled={item.quantity >= maxQuantity}
                >
                  +
                </button>
                <button
                  onClick={() => removeItem(item.variantId, item.studentName, modoVenda)}
                  className="btn-secondary ml-auto"
                >
                  🗑️ Remover
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
