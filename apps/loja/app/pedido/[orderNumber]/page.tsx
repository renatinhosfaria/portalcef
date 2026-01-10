'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import { LoadingSpinner } from '@/components/Loading';
import { OrderItemCard } from '@/components/OrderItemCard';

interface OrderItem {
  id: string;
  productName: string;
  variantSize: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  studentName: string;
  imageUrl: string;
}

// API response types
interface ApiOrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  studentName: string;
  variant?: {
    size?: string;
    product?: {
      name?: string;
      imageUrl?: string;
    };
  };
}

interface Order {
  orderNumber: string;
  status: 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'RETIRADO' | 'EXPIRADO';
  totalAmount: number;
  createdAt: string;
  expiresAt: string;
  items: OrderItem[];
  pickupInstructions: string;
  customerName: string;
  customerPhone: string;
}

export default function VoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);
  const { orderNumber } = resolvedParams;
  const { phone } = resolvedSearchParams;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true);
        setError(null);

        if (!phone) {
          setError('Telefone é obrigatório para consultar o pedido.');
          setLoading(false);
          return;
        }

        // Call real API to fetch order by number + phone
        const response = await fetch(`/api/shop/orders/lookup/${orderNumber}?phone=${encodeURIComponent(phone)}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Pedido não encontrado. Verifique o número e telefone informados.');
          } else {
            const errorData = await response.json();
            setError(errorData.error?.message || 'Erro ao carregar pedido.');
          }
          setLoading(false);
          return;
        }

        const result = await response.json();

        if (result.success && result.data) {
          const orderData = result.data;

          // Transform API response to local Order format
          const transformedOrder: Order = {
            orderNumber: orderData.orderNumber,
            status: orderData.status,
            totalAmount: orderData.totalAmount,
            createdAt: orderData.createdAt,
            expiresAt: orderData.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            pickupInstructions: 'Retire seu pedido na secretaria da unidade, de segunda a sexta, das 7h às 18h. Apresente o código de 6 dígitos acima.',
            items: orderData.items?.map((item: ApiOrderItem) => ({
              id: item.id,
              productName: item.variant?.product?.name || 'Produto',
              variantSize: item.variant?.size || 'Único',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.unitPrice * item.quantity,
              studentName: item.studentName,
              imageUrl: item.variant?.product?.imageUrl || '/placeholder-product.jpg',
            })) || [],
          };

          setOrder(transformedOrder);
        } else {
          setError('Erro ao carregar dados do pedido.');
        }
      } catch (err: unknown) {
        console.error('Error loading order:', err);
        setError('Erro ao carregar pedido. Verifique o número e telefone informados.');
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderNumber, phone]);

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'AGUARDANDO_PAGAMENTO':
        return <span className="badge-low-stock">⏳ Aguardando Pagamento</span>;
      case 'PAGO':
        return <span className="badge-in-stock">✅ Pago</span>;
      case 'RETIRADO':
        return <span className="badge-in-stock">📦 Retirado</span>;
      case 'EXPIRADO':
        return <span className="badge-out-of-stock">❌ Expirado</span>;
      default:
        return null;
    }
  };

  const handleCopyLink = async () => {
    if (typeof window === 'undefined' || !navigator.clipboard) return;

    setCopying(true);
    try {
      const link = `${window.location.origin}/pedido/${orderNumber}?phone=${phone}`;
      await navigator.clipboard.writeText(link);
      if (typeof window !== 'undefined') {
        window.alert('Link copiado para a área de transferência!');
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.alert('Erro ao copiar link. Tente novamente.');
      }
    } finally {
      setCopying(false);
    }
  };

  const handleDownloadPDF = () => {
    // TODO: Implementar geração de PDF com jsPDF ou react-pdf
    if (typeof window !== 'undefined') {
      window.alert('Funcionalidade de download em PDF será implementada em breve!');
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-xl text-red-600 mb-4">❌</p>
          <p className="text-gray-700 mb-4">{error || 'Pedido não encontrado'}</p>
          <Link href="/consulta" className="btn-primary">
            Consultar Outro Pedido
          </Link>
        </div>
      </div>
    );
  }

  const totalReais = order.totalAmount / 100;
  const createdDate = new Date(order.createdAt).toLocaleDateString('pt-BR');
  const expiresDate = new Date(order.expiresAt).toLocaleDateString('pt-BR');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white border-b border-gray-200 no-print">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-800">📋 Voucher de Retirada</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Voucher Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          {/* Código de 6 dígitos */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8 text-center voucher-code">
            <p className="text-sm font-medium mb-2">CÓDIGO DE RETIRADA</p>
            <p className="text-6xl font-bold tracking-wider mb-2">{order.orderNumber}</p>
            <p className="text-sm opacity-90">Apresente este código na secretaria</p>
          </div>

          {/* Status e Informações */}
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Status do Pedido</p>
                <div className="mt-1">{getStatusBadge(order.status)}</div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Pago</p>
                <p className="text-2xl font-bold text-blue-600">R$ {totalReais.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Responsável</p>
                <p className="font-medium text-gray-800">{order.customerName}</p>
              </div>
              <div>
                <p className="text-gray-600">Telefone</p>
                <p className="font-medium text-gray-800">{order.customerPhone}</p>
              </div>
              <div>
                <p className="text-gray-600">Data do Pedido</p>
                <p className="font-medium text-gray-800">{createdDate}</p>
              </div>
              <div>
                <p className="text-gray-600">Validade</p>
                <p className="font-medium text-gray-800">{expiresDate}</p>
              </div>
            </div>

            {/* Instruções de Retirada */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-medium text-yellow-800 mb-2">📍 Instruções de Retirada</p>
              <p className="text-sm text-yellow-700">{order.pickupInstructions}</p>
            </div>

            {/* Itens do Pedido */}
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Itens do Pedido</h3>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <OrderItemCard key={item.id} {...item} />
                ))}
              </div>
            </div>

            {/* Ações */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 no-print">
              <button onClick={handlePrint} className="btn-primary">
                🖨️ Imprimir
              </button>
              <button onClick={handleDownloadPDF} className="btn-outline">
                📄 Baixar PDF
              </button>
              <button onClick={handleCopyLink} disabled={copying} className="btn-outline">
                {copying ? <LoadingSpinner size="sm" /> : '🔗 Compartilhar'}
              </button>
            </div>

            <div className="text-center pt-4 no-print">
              <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
                ← Voltar ao Catálogo
              </Link>
            </div>
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="bg-white rounded-lg shadow-md p-6 text-sm text-gray-600 no-print">
          <p className="font-medium text-gray-800 mb-2">ℹ️ Importante:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Este voucher é válido por 7 dias a partir da data do pedido</li>
            <li>Traga um documento de identificação com foto</li>
            <li>A retirada pode ser feita por qualquer responsável cadastrado</li>
            <li>Em caso de dúvidas, entre em contato com a secretaria da unidade</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
