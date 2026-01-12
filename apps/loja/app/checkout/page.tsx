'use client';

import { ArrowLeft, FileText, Info, Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { LoadingSpinner } from '@/components/Loading';
import { OrderItemCard } from '@/components/OrderItemCard';
import { Toast, useToast } from '@/components/Toast';
import { useCart, type CartItem } from '@/lib/useCart';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotalAmount, clearCart, isLoaded } = useCart();
  const { toast, showToast } = useToast();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);

  const totalReais = getTotalAmount();

  useEffect(() => {
    if (isLoaded && items.length === 0 && !orderCreated && !processing) {
      router.push('/');
    }
  }, [isLoaded, items.length, router, orderCreated, processing]);

  if (!isLoaded || (isLoaded && items.length === 0 && !orderCreated)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    let formatted = value;
    if (value.length > 10) {
      formatted = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 6) {
      formatted = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
    } else if (value.length > 2) {
      formatted = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }

    setCustomerPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerPhone.trim()) {
      showToast({ message: 'Preencha todos os campos obrigatórios', type: 'error' });
      return;
    }

    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      showToast({ message: 'Telefone inválido. Use formato: (11) 98765-4321', type: 'error' });
      return;
    }

    setProcessing(true);

    try {
      const storedSchoolId = localStorage.getItem('cef_shop_school_id') || 'default';
      const storedUnitId = localStorage.getItem('cef_shop_unit_id') || 'default';

      const response = await fetch(`/api/shop/orders/${storedSchoolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: storedSchoolId,
          unitId: storedUnitId,
          items: items.map(item => ({
            variantId: item.variantId,
            quantity: item.quantity,
            studentName: item.studentName
          })),
          customerName: customerName.trim(),
          customerPhone: phoneDigits,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          showToast({ message: 'Muitos pedidos. Aguarde alguns minutos e tente novamente.', type: 'error' });
          setProcessing(false);
          return;
        }
        throw new Error(errorData.error?.message || 'Erro ao criar pedido');
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Erro ao criar pedido');
      }

      const { orderNumber } = result.data;

      setOrderCreated(true);
      showToast({ message: 'Voucher gerado com sucesso!', type: 'success' });
      router.replace(`/pedido/${orderNumber}?phone=${phoneDigits}`);

      setTimeout(() => clearCart(), 500);

    } catch (err: unknown) {
      console.error('Checkout error:', err);
      const message = err instanceof Error ? err.message : 'Erro ao gerar voucher';
      showToast({ message, type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors duration-150"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-slate-800">Finalizar Pedido</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 mb-1">Como funciona?</p>
              <p className="text-amber-700">
                Você receberá um voucher para pagamento presencial na escola. Válido por 7 dias.
              </p>
            </div>
          </div>

          {/* Customer Data */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-4">Dados do Responsável</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="customerName" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-[#A3D154] focus:ring-2 focus:ring-[#A3D154]/20 outline-none transition-colors duration-150"
                  placeholder="Ex: Maria Silva"
                  required
                />
              </div>
              <div>
                <label htmlFor="customerPhone" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Telefone
                </label>
                <input
                  type="tel"
                  id="customerPhone"
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-[#A3D154] focus:ring-2 focus:ring-[#A3D154]/20 outline-none transition-colors duration-150"
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Usado para consultar seu pedido
                </p>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-4">Resumo do Pedido</h3>
            <div className="space-y-2 mb-4">
              {items.map((item: CartItem, index: number) => (
                <OrderItemCard
                  key={`${item.variantId}-${item.studentName}-${index}`}
                  {...item}
                  subtotal={item.unitPrice * item.quantity}
                />
              ))}
            </div>
            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-700">Total a Pagar:</span>
                <span className="text-xl font-semibold text-slate-800 tabular-nums">
                  {totalReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Pagamento realizado presencialmente na escola
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={processing}
            className="w-full bg-[#A3D154] text-white font-medium py-3 rounded-lg hover:bg-[#8FBD3F] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Gerando voucher...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Gerar Voucher
              </>
            )}
          </button>

          {/* Clear Cart */}
          <button
            type="button"
            onClick={() => {
              if (confirm('Tem certeza que deseja limpar o carrinho?')) {
                clearCart();
                router.push('/');
              }
            }}
            className="w-full text-center text-sm text-slate-400 hover:text-red-500 py-2 flex items-center justify-center gap-1.5 transition-colors duration-150"
          >
            <Trash2 className="w-4 h-4" />
            Limpar Carrinho
          </button>

          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => {}}
            />
          )}
        </form>
      </main>
    </div>
  );
}
