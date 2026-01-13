'use client';

import { jsPDF } from 'jspdf';
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
  product?: {
    name?: string;
    imageUrl?: string;
  };
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
              productName: item.product?.name || item.variant?.product?.name || 'Produto',
              variantSize: item.variant?.size || 'Único',
              quantity: item.quantity,
              unitPrice: item.unitPrice / 100, // Converter de centavos para reais
              subtotal: (item.unitPrice * item.quantity) / 100, // Converter de centavos para reais
              studentName: item.studentName,
              imageUrl: item.product?.imageUrl || item.variant?.product?.imageUrl || '/placeholder-product.jpg',
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
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">Aguardando Pagamento Presencial</span>;
      case 'PAGO':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Pago - Pronto para Retirada</span>;
      case 'RETIRADO':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">Retirado</span>;
      case 'EXPIRADO':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">Voucher Expirado</span>;
      default:
        return null;
    }
  };

  const handleShareWhatsApp = async () => {
    if (!order || typeof window === 'undefined') return;

    setCopying(true);
    try {
      // Gerar PDF em memória
      const doc = new jsPDF();

      // Header com gradiente azul
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 45, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('VOUCHER DE RETIRADA', 105, 20, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`Código: ${order.orderNumber}`, 105, 32, { align: 'center' });

      // Informações do cliente
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      let y = 55;
      doc.text(`Responsável: ${order.customerName}`, 20, y);
      doc.text(`Telefone: ${order.customerPhone}`, 120, y);
      y += 8;
      doc.text(`Data: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}`, 20, y);
      doc.text(`Validade: ${new Date(order.expiresAt).toLocaleDateString('pt-BR')}`, 120, y);

      // Código grande no centro
      y += 15;
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(2);
      doc.roundedRect(50, y, 110, 25, 3, 3);
      doc.setFontSize(28);
      doc.setTextColor(59, 130, 246);
      doc.text(order.orderNumber, 105, y + 17, { align: 'center' });

      // Instruções
      y += 35;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Apresente este código na secretaria da unidade para retirar seus produtos.', 105, y, { align: 'center' });

      // Itens do pedido
      y += 15;
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Itens do Pedido:', 20, y);
      y += 8;

      doc.setFontSize(10);
      order.items.forEach((item) => {
        const itemText = `${item.quantity}x ${item.productName} (${item.variantSize}) - Aluno: ${item.studentName}`;
        doc.text(itemText, 20, y);
        const priceText = `R$ ${item.unitPrice.toFixed(2)}`;
        doc.text(priceText, 180, y, { align: 'right' });
        y += 7;
      });

      // Total
      y += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(20, y, 190, y);
      y += 8;
      doc.setFontSize(14);
      doc.setTextColor(59, 130, 246);
      const totalReais = order.totalAmount / 100;
      doc.text(`TOTAL: R$ ${totalReais.toFixed(2)}`, 180, y, { align: 'right' });

      // Gerar blob do PDF
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], `voucher-${order.orderNumber}.pdf`, { type: 'application/pdf' });

      // Tentar usar Web Share API para compartilhar o arquivo (mobile)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Voucher #${order.orderNumber}`,
          text: `Voucher de retirada - Pedido #${order.orderNumber}`
        });
      } else {
        // Desktop/WhatsApp Web: baixar o PDF e abrir WhatsApp com mensagem completa
        doc.save(`voucher-${order.orderNumber}.pdf`);

        const link = `${window.location.origin}/pedido/${orderNumber}?phone=${phone}`;
        const totalFormatted = (order.totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Lista de itens formatada
        const itemsList = order.items.map(item =>
          `• ${item.quantity}x ${item.productName} (${item.variantSize}) - ${item.studentName}`
        ).join('\n');

        const message = `🛒 *VOUCHER DE RETIRADA*

📋 *Pedido #${order.orderNumber}*

👤 *Responsável:* ${order.customerName}
📱 *Telefone:* ${order.customerPhone}

📦 *Itens:*
${itemsList}

💰 *Total:* ${totalFormatted}

📍 *Retirada:* Apresente o código *${order.orderNumber}* na secretaria da unidade.

📥 *PDF baixado!* Anexe o arquivo "voucher-${order.orderNumber}.pdf" nesta conversa.

🔗 *Link online:* ${link}

_Válido até ${new Date(order.expiresAt).toLocaleDateString('pt-BR')}_`;

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

        // Mostrar instrução para o usuário
        window.alert(`✅ PDF baixado com sucesso!\n\nO WhatsApp Web será aberto.\nAnexe o arquivo "voucher-${order.orderNumber}.pdf" na conversa.`);

        window.open(whatsappUrl, '_blank');
      }
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
      window.alert('Erro ao gerar ou compartilhar PDF. Tente novamente.');
    } finally {
      setCopying(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!order) return;

    const doc = new jsPDF();

    // Header
    doc.setFillColor(59, 130, 246); // Blue
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Voucher de Retirada', 105, 25, { align: 'center' });

    // Order Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Pedido #${order.orderNumber}`, 20, 60);
    doc.text(`Status: ${order.status}`, 20, 70);
    doc.text(`Total: R$ ${(order.totalAmount / 100).toFixed(2)}`, 20, 80);

    // Customer
    doc.text(`Responsável: ${order.customerName}`, 120, 60);
    doc.text(`Telefone: ${order.customerPhone}`, 120, 70);
    doc.text(`Data: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}`, 120, 80);

    // Code Box
    doc.setDrawColor(0, 0, 0);
    doc.rect(50, 95, 110, 30);
    doc.setFontSize(30);
    doc.setTextColor(59, 130, 246);
    doc.text(order.orderNumber, 105, 115, { align: 'center' });

    // Instructions
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const splitInstructions = doc.splitTextToSize(order.pickupInstructions, 170);
    doc.text(splitInstructions, 20, 140);

    // Items
    let y = 160;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Itens do Pedido:', 20, y);
    y += 10;

    order.items.forEach((item) => {
      const itemText = `${item.quantity}x ${item.productName} (${item.variantSize}) - Aluno: ${item.studentName}`;
      doc.setFontSize(10);
      doc.text(itemText, 20, y);
      const priceText = `R$ ${item.unitPrice.toFixed(2)}`;
      doc.text(priceText, 180, y, { align: 'right' });
      y += 8;
    });

    doc.save(`voucher-${order.orderNumber}.pdf`);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-slate-700 mb-4">{error || 'Pedido não encontrado'}</p>
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-slate-800">Voucher de Retirada</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Voucher Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          {/* Código de 6 dígitos */}
          <div className="bg-slate-900 text-white p-8 text-center voucher-code">
            <p className="text-sm font-medium mb-2 text-slate-300">CÓDIGO DE RETIRADA</p>
            <p className="text-6xl font-bold tracking-wider mb-2 tabular-nums">{order.orderNumber}</p>
            <p className="text-sm text-slate-300">Apresente este código na secretaria</p>
          </div>

          {/* Status e Informações */}
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Status do Pedido</p>
                <div className="mt-1">{getStatusBadge(order.status)}</div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">
                  {order.status === 'AGUARDANDO_PAGAMENTO' ? 'Total a Pagar' : 'Total Pago'}
                </p>
                <p className="text-2xl font-bold text-slate-800 tabular-nums">R$ {totalReais.toFixed(2)}</p>
              </div>
            </div>

            {/* Alerta de Pagamento Pendente */}
            {order.status === 'AGUARDANDO_PAGAMENTO' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div>
                    <p className="font-semibold text-amber-800 mb-1">Pagamento Pendente</p>
                    <p className="text-sm text-amber-700">
                      Dirija-se à secretaria da escola para efetuar o pagamento presencial.
                      Após o pagamento, seus produtos estarão disponíveis para retirada.
                    </p>
                    <p className="text-xs text-amber-600 mt-2">
                      Formas de pagamento aceitas: Dinheiro, PIX, Cartão de Crédito ou Débito
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-600">Responsável</p>
                <p className="font-medium text-slate-800">{order.customerName}</p>
              </div>
              <div>
                <p className="text-slate-600">Telefone</p>
                <p className="font-medium text-slate-800">{order.customerPhone}</p>
              </div>
              <div>
                <p className="text-slate-600">Data do Pedido</p>
                <p className="font-medium text-slate-800">{createdDate}</p>
              </div>
              <div>
                <p className="text-slate-600">Validade</p>
                <p className="font-medium text-slate-800">{expiresDate}</p>
              </div>
            </div>

            {/* Instruções de Retirada */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="font-semibold text-amber-800 mb-2">Instruções de Retirada</p>
              <p className="text-sm text-amber-700">{order.pickupInstructions}</p>
            </div>

            {/* Itens do Pedido */}
            <div>
              <h3 className="font-semibold text-slate-800 mb-4">Itens do Pedido</h3>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <OrderItemCard key={item.id} {...item} />
                ))}
              </div>
            </div>

            {/* Ações */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 no-print">
              <button onClick={handlePrint} className="btn-primary">
                Imprimir
              </button>
              <button onClick={handleDownloadPDF} className="btn-outline">
                Baixar PDF
              </button>
              <button onClick={handleShareWhatsApp} disabled={copying} className="btn-outline">
                {copying ? <LoadingSpinner size="sm" /> : 'WhatsApp'}
              </button>
            </div>

            <div className="text-center pt-4 no-print">
              <Link href="/" className="text-slate-600 hover:text-slate-800 font-medium transition-colors duration-150">
                ← Voltar ao Catálogo
              </Link>
            </div>
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-sm text-slate-600 no-print">
          <p className="font-semibold text-slate-800 mb-2">Importante:</p>
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
