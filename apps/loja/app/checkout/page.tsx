'use client';

import { ArrowLeft, CreditCard, FileText, Info, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { LoadingSpinner } from '@/components/Loading';
import { OrderItemCard } from '@/components/OrderItemCard';
import { Toast, useToast } from '@/components/Toast';
import { useCart, type CartItem, type CartItemKey } from '@/lib/useCart';

type CreatedOrder = {
  orderNumber: string;
  tipo: 'PRONTA_ENTREGA' | 'PRE_VENDA';
};

type OrderRequestError = Error & {
  code?: string;
  variantId?: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items,
    getTotalAmount,
    getCartContext,
    clearCart,
    removeItems,
    isLoaded,
    getProntaEntregaItems,
    getPreVendaItems,
  } = useCart();
  const { toast, showToast } = useToast();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [processingAction, setProcessingAction] = useState<'online' | 'voucher' | null>(null);
  const [orderCreated, setOrderCreated] = useState(false);
  const [createdOrders, setCreatedOrders] = useState<CreatedOrder[]>([]);
  const [createdPhone, setCreatedPhone] = useState('');
  const [voucherNotice, setVoucherNotice] = useState<string | null>(null);

  const totalReais = getTotalAmount();
  const prontaEntregaItems = getProntaEntregaItems();
  const preVendaItems = getPreVendaItems();
  const hasPreVenda = preVendaItems.length > 0;
  const processing = processingAction !== null;

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

  const buildOrderPayload = (sourceItems: CartItem[]) => {
    if (!customerName.trim() || !customerPhone.trim()) {
      showToast({ message: 'Preencha todos os campos obrigatórios', type: 'error' });
      return null;
    }

    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      showToast({ message: 'Telefone inválido. Use formato: (11) 98765-4321', type: 'error' });
      return null;
    }

    const cartContext = getCartContext();
    if (!cartContext) {
      showToast({ message: 'Carrinho sem escola/unidade. Selecione os produtos novamente.', type: 'error' });
      return null;
    }

    return {
      cartContext,
      phoneDigits,
      payload: {
        schoolId: cartContext.schoolId,
        unitId: cartContext.unitId,
        items: sourceItems.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          studentName: item.studentName
        })),
        customerName: customerName.trim(),
        customerPhone: phoneDigits,
      },
    };
  };

  const handleOnlinePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasPreVenda) {
      showToast({
        message: 'Itens de pré-venda geram voucher para pagamento na retirada.',
        type: 'error',
      });
      return;
    }

    const orderPayload = buildOrderPayload(prontaEntregaItems);
    if (!orderPayload) return;

    setProcessingAction('online');

    try {
      const response = await fetch('/api/shop/checkout/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload.payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        if (response.status === 429) {
          showToast({ message: 'Muitos pedidos. Aguarde alguns minutos e tente novamente.', type: 'error' });
          return;
        }
        throw new Error(result.error?.message || 'Erro ao iniciar pagamento online');
      }

      const { checkoutUrl } = result.data;

      if (!checkoutUrl) {
        throw new Error('Stripe não retornou o link de pagamento.');
      }

      setOrderCreated(true);
      clearCart();
      window.location.assign(checkoutUrl);
    } catch (err: unknown) {
      console.error('Erro no pagamento online:', err);
      const message = err instanceof Error ? err.message : 'Erro ao iniciar pagamento online';
      showToast({ message, type: 'error' });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleVoucherSubmit = async () => {
    const orderPayload = buildOrderPayload(items);
    if (!orderPayload) return;

    setProcessingAction('voucher');

    const created: CreatedOrder[] = [];
    let createdPhoneDigits = '';
    const processedItems: CartItemKey[] = [];

    try {
      const { cartContext, phoneDigits } = orderPayload;
      createdPhoneDigits = phoneDigits;
      const orderUrl = `/api/shop/orders/${cartContext.schoolId}`;
      const preVendaUrl = `/api/shop/orders/pre-venda/${cartContext.schoolId}`;

      const toCartKeys = (sourceItems: CartItem[]): CartItemKey[] =>
        sourceItems.map((item) => ({
          variantId: item.variantId,
          studentName: item.studentName,
          modoVenda: item.modoVenda ?? 'PRONTA_ENTREGA',
        }));

      const isSameCartItem = (a: CartItem, b: CartItem) =>
        a.variantId === b.variantId &&
        a.studentName.toLowerCase() === b.studentName.toLowerCase() &&
        (a.modoVenda ?? 'PRONTA_ENTREGA') === (b.modoVenda ?? 'PRONTA_ENTREGA');

      const isStockError = (error: unknown): error is OrderRequestError => {
        return (
          error instanceof Error &&
          (
            (error as OrderRequestError).code === 'INSUFFICIENT_STOCK' ||
            error.message.toLowerCase().includes('estoque insuficiente') ||
            error.message.toLowerCase().includes('estoque indisponível')
          )
        );
      };

      const createOrder = async (
        sourceItems: CartItem[],
        tipo: CreatedOrder['tipo'],
        url: string,
      ) => {
        if (sourceItems.length === 0) return;

        const payload = {
          ...orderPayload.payload,
          items: sourceItems.map(item => ({
            variantId: item.variantId,
            quantity: item.quantity,
            studentName: item.studentName
          })),
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 429) {
            throw new Error('Muitos pedidos. Aguarde alguns minutos e tente novamente.');
          }
          const requestError = new Error(
            errorData.error?.message || 'Erro ao criar pedido',
          ) as OrderRequestError;
          requestError.code = errorData.error?.code;
          requestError.variantId =
            errorData.error?.variantId || errorData.error?.details?.variantId;
          throw requestError;
        }

        const result = await response.json();

        if (!result.success || !result.data) {
          throw new Error(result.error?.message || 'Erro ao criar pedido');
        }

        created.push({ orderNumber: result.data.orderNumber, tipo });
        processedItems.push(...toCartKeys(sourceItems));
      };

      const createProntaEntregaWithFallback = async (sourceItems: CartItem[]) => {
        let pendingItems = [...sourceItems];

        while (pendingItems.length > 0) {
          try {
            await createOrder(pendingItems, 'PRONTA_ENTREGA', orderUrl);
            return;
          } catch (error: unknown) {
            if (!isStockError(error)) {
              throw error;
            }

            const affectedItems = error.variantId
              ? pendingItems.filter((item) => item.variantId === error.variantId)
              : pendingItems;

            if (affectedItems.length === 0) {
              throw error;
            }

            const confirmed = window.confirm(
              'O estoque acabou para um dos itens de pronta entrega. Deseja transformar esse item em pré-venda para pagamento na retirada?',
            );

            if (!confirmed) {
              throw error;
            }

            await createOrder(affectedItems, 'PRE_VENDA', preVendaUrl);
            pendingItems = pendingItems.filter(
              (item) => !affectedItems.some((affected) => isSameCartItem(item, affected)),
            );
          }
        }
      };

      await createProntaEntregaWithFallback(prontaEntregaItems);
      await createOrder(preVendaItems, 'PRE_VENDA', preVendaUrl);

      setOrderCreated(true);
      setCreatedOrders(created);
      setCreatedPhone(phoneDigits);
      setVoucherNotice(null);
      showToast({
        message: created.length > 1 ? 'Vouchers gerados com sucesso!' : 'Voucher gerado com sucesso!',
        type: 'success',
      });

      setTimeout(() => clearCart(), 500);

    } catch (err: unknown) {
      console.error('Checkout error:', err);

      if (created.length > 0) {
        removeItems(processedItems);
        setOrderCreated(true);
        setCreatedOrders(created);
        setCreatedPhone(createdPhoneDigits);
        setVoucherNotice(
          'Alguns vouchers foram gerados. Os itens não finalizados permaneceram no carrinho.',
        );
        showToast({
          message:
            'Alguns vouchers foram gerados. Os itens não finalizados permaneceram no carrinho.',
          type: 'error',
        });
        return;
      }

      const message = err instanceof Error ? err.message : 'Erro ao gerar voucher';
      showToast({ message, type: 'error' });
    } finally {
      setProcessingAction(null);
    }
  };

  if (orderCreated && createdOrders.length > 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <h1 className="text-lg font-semibold text-slate-800">Vouchers Gerados</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Pedido registrado</h2>
              <p className="text-sm text-slate-500 mt-1">
                Apresente o código do voucher na secretaria no momento da retirada.
              </p>
            </div>

            {voucherNotice ? (
              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <p>{voucherNotice}</p>
              </div>
            ) : null}

            <div className="space-y-3">
              {createdOrders.map((order) => (
                <Link
                  key={`${order.tipo}-${order.orderNumber}`}
                  href={`/pedido/${order.orderNumber}?phone=${createdPhone}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-slate-800">#{order.orderNumber}</p>
                    <p className="text-sm text-slate-500">
                      {order.tipo === 'PRE_VENDA' ? 'Pré-venda' : 'Pronta entrega'}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[#5a7a1f]">Ver voucher</span>
                </Link>
              ))}
            </div>

            <Link href="/" className="btn-primary w-full text-center block">
              Voltar ao Catálogo
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
        <form onSubmit={handleOnlinePayment} className="space-y-4">
          {/* Info Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 mb-1">Como funciona?</p>
              <p className="text-amber-700">
                Produtos de pronta entrega podem gerar voucher ou pagamento online. Válido por 7 dias. Itens de pré-venda geram reserva para pagamento na retirada.
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
            <div className="space-y-5 mb-4">
              {prontaEntregaItems.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">Pronta entrega</h4>
                    <span className="text-sm font-semibold text-slate-800 tabular-nums">
                      {getTotalAmount('PRONTA_ENTREGA').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  {prontaEntregaItems.map((item: CartItem, index: number) => (
                    <OrderItemCard
                      key={`pronta-entrega-${item.variantId}-${item.studentName}-${index}`}
                      {...item}
                      subtotal={item.unitPrice * item.quantity}
                    />
                  ))}
                </section>
              )}

              {preVendaItems.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-amber-700">Pré-venda</h4>
                    <span className="text-sm font-semibold text-slate-800 tabular-nums">
                      {getTotalAmount('PRE_VENDA').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  {preVendaItems.map((item: CartItem, index: number) => (
                    <OrderItemCard
                      key={`pre-venda-${item.variantId}-${item.studentName}-${index}`}
                      {...item}
                      subtotal={item.unitPrice * item.quantity}
                    />
                  ))}
                </section>
              )}
            </div>
            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-700">Total a Pagar:</span>
                <span className="text-xl font-semibold text-slate-800 tabular-nums">
                  {totalReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {hasPreVenda
                  ? 'Itens de pré-venda geram voucher para pagamento na retirada.'
                  : 'Pagamento online confirmado automaticamente pelo Stripe.'}
              </p>
            </div>
          </div>

          {/* Online payment */}
          <button
            type="submit"
            disabled={processing || hasPreVenda}
            className="w-full bg-[#A3D154] text-white font-medium py-3 rounded-lg hover:bg-[#8FBD3F] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processingAction === 'online' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Abrindo pagamento...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                {hasPreVenda ? 'Pagamento online indisponível para pré-venda' : 'Pagar online'}
              </>
            )}
          </button>

          {/* Voucher fallback */}
          <button
            type="button"
            onClick={handleVoucherSubmit}
            disabled={processing}
            className="w-full bg-white text-slate-700 border border-slate-200 font-medium py-3 rounded-lg hover:bg-slate-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processingAction === 'voucher' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Gerando voucher...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                {hasPreVenda && prontaEntregaItems.length > 0
                  ? 'Gerar vouchers separados'
                  : hasPreVenda
                    ? 'Gerar voucher de pré-venda'
                    : 'Gerar voucher presencial'}
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
