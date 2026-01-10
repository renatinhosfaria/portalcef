'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LoadingSpinner } from '@/components/Loading';
import { OrderItemCard } from '@/components/OrderItemCard';
import { Toast, useToast } from '@/components/Toast';
import { useCart, type CartItem } from '@/lib/useCart';

// TODO: Mover STRIPE_PUBLIC_KEY para .env.local
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { items, getTotalAmount, clearCart } = useCart();
  const { toast, showToast } = useToast();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [installments, setInstallments] = useState(1);
  const [processing, setProcessing] = useState(false);

  const totalCents = getTotalAmount();
  const totalReais = totalCents / 100;
  const installmentValue = totalReais / installments;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      showToast({ message: 'Preencha todos os campos obrigatórios', type: 'error' });
      return;
    }

    // Validate phone format (10-13 digits)
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      showToast({ message: 'Telefone inválido. Use formato: (11) 98765-4321', type: 'error' });
      return;
    }

    setProcessing(true);

    try {
      // Get schoolId from localStorage or first item
      const storedSchoolId = localStorage.getItem('cef_shop_school_id') || 'default';
      const storedUnitId = localStorage.getItem('cef_shop_unit_id') || 'default';

      // Call real API to create order
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
          installments
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

      // Confirm payment with Stripe using the real client secret
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/pedido/${orderNumber}?phone=${phoneDigits}`,
        },
        redirect: 'if_required',
      });

      if (error) {
        showToast({ message: error.message || 'Erro no pagamento', type: 'error' });
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        clearCart();
        showToast({ message: 'Pagamento aprovado!', type: 'success' });
        router.push(`/pedido/${orderNumber}?phone=${phoneDigits}`);
      }
    } catch (err: unknown) {
      console.error('Checkout error:', err);
      const message = err instanceof Error ? err.message : 'Erro ao processar pagamento';
      showToast({ message, type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dados do Cliente */}
      <div className="card">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Dados do Responsável</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-2">
              Nome Completo *
            </label>
            <input
              type="text"
              id="customerName"
              value={customerName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerName(e.target.value)}
              className="input w-full"
              placeholder="Ex: João da Silva"
              required
            />
          </div>
          <div>
            <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-2">
              Telefone *
            </label>
            <input
              type="tel"
              id="customerPhone"
              value={customerPhone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerPhone(e.target.value)}
              className="input w-full"
              placeholder="(11) 98765-4321"
              required
            />
          </div>
        </div>
      </div>

      {/* Dados de Pagamento */}
      <div className="card">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Dados de Pagamento</h3>
        <div className="space-y-4">
          <PaymentElement />

          {/* Parcelamento */}
          <div>
            <label htmlFor="installments" className="block text-sm font-medium text-gray-700 mb-2">
              Parcelamento
            </label>
            <select
              id="installments"
              value={installments}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInstallments(Number(e.target.value))}
              className="input w-full"
            >
              {[...Array(12)].map((_, i) => {
                const parcelas = i + 1;
                const valor = totalReais / parcelas;
                return (
                  <option key={parcelas} value={parcelas}>
                    {parcelas}x de R$ {valor.toFixed(2)} {parcelas === 1 ? '(à vista)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Resumo do Pedido */}
      <div className="card bg-blue-50 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Resumo do Pedido</h3>
        <div className="space-y-2 mb-4">
          {items.map((item: CartItem, index: number) => (
            <OrderItemCard key={`${item.variantId}-${item.studentName}-${index}`} {...item} subtotal={item.unitPrice * item.quantity} />
          ))}
        </div>
        <div className="pt-4 border-t border-blue-300">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-gray-800">Total:</span>
            <span className="text-2xl font-bold text-blue-600">R$ {totalReais.toFixed(2)}</span>
          </div>
          {installments > 1 && (
            <p className="text-sm text-gray-600 mt-2 text-right">
              {installments}x de R$ {installmentValue.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* Botão de Pagamento */}
      <button type="submit" disabled={!stripe || processing} className="btn-primary w-full">
        {processing ? <LoadingSpinner size="sm" /> : `💳 Pagar R$ ${totalReais.toFixed(2)}`}
      </button>

      {toast && <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => { }} />}
    </form>
  );
}

export default function CheckoutPage() {
  const { items, getTotalAmount } = useCart();
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (items.length === 0) {
      router.push('/');
      return;
    }

    async function initCheckout() {
      try {
        // TODO: Chamar API para criar PaymentIntent e obter client_secret
        // const response = await fetch('/api/shop/checkout/init', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ amount: getTotalAmount() })
        // });
        // const { data } = await response.json();
        // setClientSecret(data.client_secret);

        // Mock: Simular criação de clientSecret
        await new Promise((resolve) => setTimeout(resolve, 500));
        setClientSecret('mock_client_secret_' + Date.now());
      } catch (err) {
        console.error('Erro ao inicializar checkout:', err);
      } finally {
        setLoading(false);
      }
    }

    initCheckout();
  }, [items, router, getTotalAmount]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-xl text-red-600 mb-4">❌</p>
          <p className="text-gray-700 mb-4">Erro ao carregar checkout. Tente novamente.</p>
          <button onClick={() => router.push('/carrinho')} className="btn-primary w-full">
            Voltar ao Carrinho
          </button>
        </div>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#3b82f6',
        colorText: '#1f2937',
        colorDanger: '#ef4444',
        borderRadius: '8px',
      },
    },
    locale: 'pt-BR',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-800">🛒 Finalizar Pedido</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm />
        </Elements>
      </main>
    </div>
  );
}
