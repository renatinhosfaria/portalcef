'use client';

import { formatarDataHora } from '@essencia/shared/formatar-data';
import {
    Check, ChevronDown, ChevronRight, Clock, CreditCard,
    DollarSign, Eye, PackageCheck, RefreshCw, Search,
    ShoppingBag, Trash2, X,
} from 'lucide-react';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../lib/api';

interface PreSaleSummaryItem {
    productId: string;
    variantId: string;
    productName: string;
    variantSize: string;
    variantSku: string | null;
    reservedQuantity: number;
    paidQuantity: number;
    pickedUpQuantity: number;
    totalQuantity: number;
    customers: Array<{ name: string; phone: string }>;
}

interface OrderItem {
    id: string;
    studentName: string;
    quantity: number;
    unitPrice: number;
    product?: { name: string };
    variant?: { size: string };
}

interface Order {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    items: OrderItem[];
}

type PaymentMethod = 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BRINDE';

const WhatsAppIcon = () => (
    <svg className="w-4 h-4 text-emerald-500 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.45 5.323.002 9.613-4.294 9.615-9.617.002-2.58-1.001-5.005-2.825-6.83C16.237 2.33 13.811 1.326 11.23 1.325 5.908 1.325 1.618 5.62 1.615 10.943c-.001 1.502.4 2.977 1.162 4.259l-.993 3.628 3.71-.973l.563.337z"/>
    </svg>
);

const getWhatsAppUrl = (phone: string, customerName: string, productName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = `Olá, ${customerName}! Tudo bem? Vimos que você reservou o produto "${productName}" no Portal do Colégio Essência Feliz. Gostaria de confirmar o andamento do seu pedido?`;
    return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
};

interface GroupedProduct {
    productId: string;
    productName: string;
    totalReserved: number;
    totalPaid: number;
    totalPickedUp: number;
    totalQuantity: number;
    variants: PreSaleSummaryItem[];
}

export default function PreVendaPage() {
    const [summaryItems, setSummaryItems] = useState<PreSaleSummaryItem[]>([]);
    const [summaryLoading, setSummaryLoading] = useState(true);

    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

    const [confirmPaymentModal, setConfirmPaymentModal] = useState<{
        open: boolean;
        orderId: string;
        orderNumber: string;
        totalAmount: number;
    } | null>(null);
    const [modalPayments, setModalPayments] = useState<Array<{ method: string; amount: number }>>([]);
    const [currentModalPaymentMethod, setCurrentModalPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
    const [currentModalPaymentAmount, setCurrentModalPaymentAmount] = useState(0);
    const [confirmingPayment, setConfirmingPayment] = useState(false);

    const [deleteOrderModal, setDeleteOrderModal] = useState<{
        open: boolean;
        orderId: string;
        orderNumber: string;
    } | null>(null);
    const [deletingOrder, setDeletingOrder] = useState(false);

    const kpis = summaryItems.reduce(
        (acc, item) => ({
            reservedQuantity: acc.reservedQuantity + item.reservedQuantity,
            paidQuantity: acc.paidQuantity + item.paidQuantity,
            pickedUpQuantity: acc.pickedUpQuantity + item.pickedUpQuantity,
            totalQuantity: acc.totalQuantity + item.totalQuantity,
        }),
        { reservedQuantity: 0, paidQuantity: 0, pickedUpQuantity: 0, totalQuantity: 0 },
    );

    const loadSummary = useCallback(async () => {
        setSummaryLoading(true);
        try {
            const res = await apiFetch('/api/shop/admin/orders/pre-venda/summary');
            if (!res.ok) { setSummaryItems([]); return; }
            const data = await res.json();
            setSummaryItems(Array.isArray(data.data) ? data.data : []);
        } catch {
            setSummaryItems([]);
        } finally {
            setSummaryLoading(false);
        }
    }, []);

    const loadOrders = useCallback(async (page = 1) => {
        setOrdersLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('orderSource', 'PRE_VENDA');
            if (search) params.set('search', search);
            if (statusFilter) params.set('status', statusFilter);
            params.set('page', page.toString());
            params.set('limit', '30');

            const res = await apiFetch(`/api/shop/admin/orders?${params.toString()}`);
            if (!res.ok) { setOrders([]); return; }
            const data = await res.json();
            const pagination = data.meta?.pagination;
            setOrders(data.data || []);
            setCurrentPage(page);
            setTotalPages(pagination?.totalPages || 1);
            setTotalOrders(pagination?.total || (data.data || []).length);
        } catch {
            setOrders([]);
        } finally {
            setOrdersLoading(false);
        }
    }, [search, statusFilter]);

    useEffect(() => { loadSummary(); }, [loadSummary]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1);
            loadOrders(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [loadOrders]);

    const goToPage = useCallback((page: number) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) loadOrders(page);
    }, [loadOrders, totalPages, currentPage]);

    const formatCurrency = (cents: number) =>
        (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const formatPhone = (phone: string) => {
        if (phone.length === 11) return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
        return phone;
    };

    const getStatusBadge = (status: string) => {
        const config: Record<string, { class: string; label: string }> = {
            AGUARDANDO_PAGAMENTO: { class: 'badge-warning', label: 'Aguardando Pgto' },
            PAGO: { class: 'badge-success', label: 'Pago' },
            RETIRADO: { class: 'badge-info', label: 'Retirado' },
            CANCELADO: { class: 'badge-danger', label: 'Cancelado' },
            EXPIRADO: { class: 'badge-neutral', label: 'Expirado' },
        };
        const c = config[status] || { class: 'badge-neutral', label: status };
        return <span className={`badge ${c.class}`}>{c.label}</span>;
    };

    const getPaymentMethodLabel = (method: string) => {
        const labels: Record<string, string> = {
            DINHEIRO: 'Dinheiro', PIX: 'PIX',
            CARTAO_CREDITO: 'Cartão de Crédito', CARTAO_DEBITO: 'Cartão de Débito',
            BRINDE: 'Brinde',
        };
        return labels[method] || method;
    };

    const openConfirmPaymentModal = (order: Order) => {
        setConfirmPaymentModal({ open: true, orderId: order.id, orderNumber: order.orderNumber, totalAmount: order.totalAmount });
        setModalPayments([]);
        setCurrentModalPaymentMethod('DINHEIRO');
        setCurrentModalPaymentAmount(order.totalAmount);
    };

    const closeConfirmPaymentModal = () => {
        setConfirmPaymentModal(null);
        setModalPayments([]);
        setCurrentModalPaymentMethod('DINHEIRO');
        setCurrentModalPaymentAmount(0);
    };

    useEffect(() => {
        if (!confirmPaymentModal) return;
        const currentPaid = modalPayments.reduce((acc, p) => acc + p.amount, 0);
        const remaining = confirmPaymentModal.totalAmount - currentPaid;
        if (currentModalPaymentAmount === 0 && remaining > 0) setCurrentModalPaymentAmount(remaining);
    }, [currentModalPaymentAmount, currentModalPaymentMethod, confirmPaymentModal, modalPayments]);

    const addModalPayment = () => {
        if (!confirmPaymentModal) return;
        const currentPaid = modalPayments.reduce((acc, p) => acc + p.amount, 0);
        const remaining = confirmPaymentModal.totalAmount - currentPaid;
        if (currentModalPaymentAmount <= 0) { alert('Valor deve ser maior que zero'); return; }
        if (currentModalPaymentAmount > remaining) { alert(`Valor excede o restante (${formatCurrency(remaining)})`); return; }
        setModalPayments([...modalPayments, { method: currentModalPaymentMethod, amount: currentModalPaymentAmount }]);
    };

    const removeModalPayment = (index: number) => {
        setModalPayments(modalPayments.filter((_, i) => i !== index));
    };

    const handleConfirmPayment = async () => {
        if (!confirmPaymentModal) return;
        let finalPayments = [...modalPayments];
        if (finalPayments.length === 0 && currentModalPaymentAmount === confirmPaymentModal.totalAmount) {
            finalPayments = [{ method: currentModalPaymentMethod, amount: currentModalPaymentAmount }];
        }
        const finalTotalPaid = finalPayments.reduce((acc, p) => acc + p.amount, 0);
        if (finalTotalPaid !== confirmPaymentModal.totalAmount) {
            alert(`Total pago (${formatCurrency(finalTotalPaid)}) deve ser igual ao total do pedido (${formatCurrency(confirmPaymentModal.totalAmount)})`);
            return;
        }
        setConfirmingPayment(true);
        try {
            const res = await apiFetch(`/api/shop/admin/orders/${confirmPaymentModal.orderId}/confirm-payment`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payments: finalPayments }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || 'Falha ao confirmar pagamento');
            }
            closeConfirmPaymentModal();
            loadSummary();
            loadOrders(currentPage);
            alert('Pagamento confirmado com sucesso!');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Erro ao confirmar pagamento');
        } finally {
            setConfirmingPayment(false);
        }
    };

    const handleMarkPickedUp = async (orderId: string) => {
        if (!confirm('Confirmar retirada deste pedido?')) return;
        try {
            const res = await apiFetch(`/api/shop/admin/orders/${orderId}/pickup`, { method: 'PATCH' });
            if (!res.ok) throw new Error('Falha ao marcar retirada');
            loadSummary();
            loadOrders(currentPage);
        } catch {
            alert('Erro ao confirmar retirada');
        }
    };

    const openDeleteOrderModal = (order: Order) => {
        setDeleteOrderModal({ open: true, orderId: order.id, orderNumber: order.orderNumber });
    };

    const closeDeleteOrderModal = () => setDeleteOrderModal(null);

    const handleDeleteOrder = async () => {
        if (!deleteOrderModal) return;
        setDeletingOrder(true);
        try {
            const res = await apiFetch(`/api/shop/admin/orders/${deleteOrderModal.orderId}`, { method: 'DELETE' });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || 'Falha ao excluir pedido');
            }
            closeDeleteOrderModal();
            loadSummary();
            loadOrders(1);
            alert('Pedido excluído com sucesso!');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Erro ao excluir pedido');
        } finally {
            setDeletingOrder(false);
        }
    };

    const modalTotalPaid = modalPayments.reduce((acc, p) => acc + p.amount, 0);
    const modalRemaining = confirmPaymentModal ? confirmPaymentModal.totalAmount - modalTotalPaid : 0;

    const groupedProducts = summaryItems.reduce<Record<string, GroupedProduct>>((acc, item) => {
        if (!acc[item.productId]) {
            acc[item.productId] = {
                productId: item.productId,
                productName: item.productName,
                totalReserved: 0,
                totalPaid: 0,
                totalPickedUp: 0,
                totalQuantity: 0,
                variants: [],
            };
        }
        const gp = acc[item.productId];
        gp.totalReserved += item.reservedQuantity;
        gp.totalPaid += item.paidQuantity;
        gp.totalPickedUp += item.pickedUpQuantity;
        gp.totalQuantity += item.totalQuantity;
        gp.variants.push(item);
        return acc;
    }, {});

    const sortedGroupedProducts = Object.values(groupedProducts).sort((a, b) => b.totalQuantity - a.totalQuantity);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Pré-venda</h1>
                    <p className="text-slate-500 mt-1">Pedidos de produtos sob encomenda</p>
                </div>
                <button
                    onClick={() => { loadSummary(); loadOrders(1); }}
                    className="btn-admin btn-admin-ghost"
                    title="Atualizar"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Aguardando Pgto</p>
                            <p className="stat-card-value text-amber-600">
                                {summaryLoading ? '—' : kpis.reservedQuantity}
                            </p>
                        </div>
                        <div className="stat-card-icon bg-amber-100 text-amber-600">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Pago / Ag. Retirada</p>
                            <p className="stat-card-value text-blue-600">
                                {summaryLoading ? '—' : kpis.paidQuantity}
                            </p>
                        </div>
                        <div className="stat-card-icon bg-blue-100 text-blue-600">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Retirado</p>
                            <p className="stat-card-value text-[#5a7a1f]">
                                {summaryLoading ? '—' : kpis.pickedUpQuantity}
                            </p>
                        </div>
                        <div className="stat-card-icon bg-[#A3D154]/20 text-[#5a7a1f]">
                            <PackageCheck className="w-6 h-6" />
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Total</p>
                            <p className="stat-card-value">
                                {summaryLoading ? '—' : kpis.totalQuantity}
                            </p>
                        </div>
                        <div className="stat-card-icon bg-slate-100 text-slate-600">
                            <ShoppingBag className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Demanda por produto */}
            <div className="admin-card">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Demanda por produto</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Agrupado por produto com controle de status e tamanhos</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-200/60 px-2.5 py-1 rounded-full">
                        {sortedGroupedProducts.length} {sortedGroupedProducts.length === 1 ? 'Produto' : 'Produtos'}
                    </span>
                </div>

                {summaryLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="loading-spinner-admin mx-auto" />
                    </div>
                ) : sortedGroupedProducts.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon text-4xl">📦</div>
                        <div className="empty-state-title">Nenhuma demanda de pré-venda</div>
                        <p className="text-sm text-slate-500 mt-1">Nenhum produto foi reservado até o momento.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {sortedGroupedProducts.map((product) => {
                            const isExpanded = !!expandedProducts[product.productId];
                            const reservedPct = product.totalQuantity > 0 ? (product.totalReserved / product.totalQuantity) * 100 : 0;
                            const paidPct = product.totalQuantity > 0 ? (product.totalPaid / product.totalQuantity) * 100 : 0;
                            const pickedUpPct = product.totalQuantity > 0 ? (product.totalPickedUp / product.totalQuantity) * 100 : 0;

                            return (
                                <div key={product.productId} className="group hover:bg-slate-50/30 transition-all duration-150">
                                    {/* Product Header Row */}
                                    <div
                                        onClick={() => setExpandedProducts(prev => ({ ...prev, [product.productId]: !prev[product.productId] }))}
                                        className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                                    >
                                        <div className="flex items-start gap-3 min-w-[250px] flex-1">
                                            <div className="mt-1 text-slate-400 group-hover:text-[#A3D154] transition-colors">
                                                {isExpanded ? (
                                                    <ChevronDown className="w-5 h-5" />
                                                ) : (
                                                    <ChevronRight className="w-5 h-5" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-800 text-base group-hover:text-[#A3D154] transition-colors">
                                                    {product.productName}
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {product.variants.length} {product.variants.length === 1 ? 'tamanho disponível' : 'tamanhos disponíveis'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="hidden lg:flex flex-col w-48 xl:w-64 gap-1.5">
                                            <div className="flex justify-between text-[10px] font-medium text-slate-400 px-0.5">
                                                <span>Distribuição de Status</span>
                                                <span className="font-semibold text-slate-700">{product.totalQuantity} un.</span>
                                            </div>
                                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                                                {product.totalReserved > 0 && (
                                                    <div
                                                        className="bg-amber-500 h-full transition-all duration-300"
                                                        style={{ width: `${reservedPct}%` }}
                                                        title={`Reservado: ${product.totalReserved} un.`}
                                                    />
                                                )}
                                                {product.totalPaid > 0 && (
                                                    <div
                                                        className="bg-blue-500 h-full transition-all duration-300"
                                                        style={{ width: `${paidPct}%` }}
                                                        title={`Pago: ${product.totalPaid} un.`}
                                                    />
                                                )}
                                                {product.totalPickedUp > 0 && (
                                                    <div
                                                        className="bg-emerald-500 h-full transition-all duration-300"
                                                        style={{ width: `${pickedUpPct}%` }}
                                                        title={`Retirado: ${product.totalPickedUp} un.`}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Status Totals Grid */}
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 md:justify-end text-sm">
                                            <div className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-100 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                <span className="text-xs text-amber-700 font-medium">{product.totalReserved} <span className="hidden sm:inline">Reservados</span></span>
                                            </div>
                                            <div className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-100 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                <span className="text-xs text-blue-700 font-medium">{product.totalPaid} <span className="hidden sm:inline">Pagos</span></span>
                                            </div>
                                            <div className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-xs text-emerald-700 font-medium">{product.totalPickedUp} <span className="hidden sm:inline">Retirados</span></span>
                                            </div>
                                            <div className="px-3 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs">
                                                {product.totalQuantity} <span className="font-normal text-slate-500">Total</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Panel */}
                                    {isExpanded && (
                                        <div className="px-6 pb-6 pt-2 bg-slate-50/40 border-t border-slate-100 space-y-6">
                                            {/* Sub-table by sizes */}
                                            <div>
                                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Detalhamento por Tamanho</h4>
                                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                                                <th className="px-4 py-2.5">Tamanho</th>
                                                                <th className="px-4 py-2.5">SKU</th>
                                                                <th className="px-4 py-2.5 text-right">Reservado</th>
                                                                <th className="px-4 py-2.5 text-right">Pago</th>
                                                                <th className="px-4 py-2.5 text-right">Retirado</th>
                                                                <th className="px-4 py-2.5 text-right bg-slate-50/80 font-bold">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-sm">
                                                            {product.variants.map((v) => (
                                                                <tr key={v.variantId} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="px-4 py-3 font-medium text-slate-800">{v.variantSize}</td>
                                                                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{v.variantSku || '—'}</td>
                                                                    <td className="px-4 py-3 text-right font-medium text-amber-600">{v.reservedQuantity}</td>
                                                                    <td className="px-4 py-3 text-right font-medium text-blue-600">{v.paidQuantity}</td>
                                                                    <td className="px-4 py-3 text-right font-medium text-emerald-600">{v.pickedUpQuantity}</td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-slate-800 bg-slate-50/20">{v.totalQuantity}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Customers List for the product */}
                                            <div>
                                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Clientes Interessados</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                    {(() => {
                                                        const uniqueCustomersMap = new Map();
                                                        product.variants.forEach(v => {
                                                            v.customers.forEach(c => {
                                                                if (!uniqueCustomersMap.has(c.phone)) {
                                                                    uniqueCustomersMap.set(c.phone, {
                                                                        name: c.name,
                                                                        phone: c.phone,
                                                                        sizes: [v.variantSize]
                                                                    });
                                                                } else {
                                                                    const existing = uniqueCustomersMap.get(c.phone);
                                                                    if (!existing.sizes.includes(v.variantSize)) {
                                                                        existing.sizes.push(v.variantSize);
                                                                    }
                                                                }
                                                            });
                                                        });
                                                        const uniqueCustomers = Array.from(uniqueCustomersMap.values());

                                                        return uniqueCustomers.map((customer) => (
                                                            <div
                                                                key={customer.phone}
                                                                className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between hover:border-slate-300 transition-colors"
                                                            >
                                                                <div className="min-w-0 pr-2">
                                                                    <p className="font-medium text-slate-800 text-sm truncate" title={customer.name}>
                                                                        {customer.name}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                                                                        <span>{formatPhone(customer.phone)}</span>
                                                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-sans">
                                                                            Tam. {customer.sizes.join(', ')}
                                                                        </span>
                                                                    </p>
                                                                </div>
                                                                <a
                                                                    href={getWhatsAppUrl(customer.phone, customer.name, product.productName)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center justify-center p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
                                                                    title={`Conversar com ${customer.name} no WhatsApp`}
                                                                >
                                                                    <WhatsAppIcon />
                                                                </a>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Lista de pedidos */}
            <div className="space-y-4">
                <div className="filter-bar">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou telefone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="form-input pl-11"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="form-select w-auto min-w-[200px]"
                    >
                        <option value="">Todos os status</option>
                        <option value="AGUARDANDO_PAGAMENTO">Aguardando Pagamento</option>
                        <option value="PAGO">Pago</option>
                        <option value="RETIRADO">Retirado</option>
                        <option value="CANCELADO">Cancelado</option>
                    </select>
                </div>

                <div className="admin-card">
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Pedido</th>
                                    <th>Responsável</th>
                                    <th>Telefone</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Data</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordersLoading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12">
                                            <div className="loading-spinner-admin mx-auto" />
                                        </td>
                                    </tr>
                                ) : orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon">🛍️</div>
                                                <div className="empty-state-title">Nenhum pedido de pré-venda</div>
                                                <div className="empty-state-description">Tente ajustar os filtros de busca</div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map((order) => (
                                        <Fragment key={order.id}>
                                            <tr>
                                                <td>
                                                    <button
                                                        onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                                        className="flex items-center gap-2 font-mono font-semibold text-[#A3D154] hover:text-[#8FBD3F] transition-colors"
                                                    >
                                                        {expandedOrder === order.id ? (
                                                            <ChevronDown className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4" />
                                                        )}
                                                        #{order.orderNumber}
                                                    </button>
                                                </td>
                                                <td className="font-medium text-slate-800">{order.customerName}</td>
                                                <td className="font-mono text-sm text-slate-600">{formatPhone(order.customerPhone)}</td>
                                                <td className="font-semibold text-slate-800">{formatCurrency(order.totalAmount)}</td>
                                                <td>{getStatusBadge(order.status)}</td>
                                                <td className="text-sm text-slate-500">{formatarDataHora(order.createdAt)}</td>
                                                <td>
                                                    <div className="flex gap-2">
                                                        <Link
                                                            href={`/pedidos/${order.id}`}
                                                            className="btn-admin btn-admin-ghost btn-admin-sm"
                                                            title="Ver detalhes"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Link>
                                                        {order.status === 'AGUARDANDO_PAGAMENTO' && (
                                                            <button
                                                                onClick={() => openConfirmPaymentModal(order)}
                                                                className="btn-admin btn-admin-warning btn-admin-sm"
                                                            >
                                                                <CreditCard className="w-4 h-4" />
                                                                Pagamento
                                                            </button>
                                                        )}
                                                        {order.status === 'PAGO' && (
                                                            <button
                                                                onClick={() => handleMarkPickedUp(order.id)}
                                                                className="btn-admin btn-admin-primary btn-admin-sm"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                                Retirar
                                                            </button>
                                                        )}
                                                        {['AGUARDANDO_PAGAMENTO', 'CANCELADO', 'EXPIRADO'].includes(order.status) && (
                                                            <button
                                                                onClick={() => openDeleteOrderModal(order)}
                                                                className="btn-admin btn-admin-ghost btn-admin-sm text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                title="Excluir Definitivamente"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedOrder === order.id && (
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan={7} className="p-6">
                                                        <div className="pl-4 border-l-4 border-[#A3D154] rounded">
                                                            <h4 className="font-semibold text-slate-800 mb-4">Itens do Pedido</h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                {order.items.map((item) => (
                                                                    <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                                        <p className="font-semibold text-slate-800">
                                                                            {item.product?.name || 'Produto'}
                                                                        </p>
                                                                        <p className="text-sm text-slate-500 mt-1">
                                                                            Tamanho: <span className="font-medium text-slate-700">{item.variant?.size || '-'}</span>
                                                                            {' '}| Qtd: <span className="font-medium text-slate-700">{item.quantity}</span>
                                                                        </p>
                                                                        <p className="text-sm text-slate-500">
                                                                            Aluno: <span className="font-medium text-slate-700">{item.studentName}</span>
                                                                        </p>
                                                                        <p className="text-sm font-bold text-[#A3D154] mt-2">
                                                                            {formatCurrency(item.unitPrice * item.quantity)}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                            Página <span className="font-medium text-slate-700">{currentPage}</span> de{' '}
                            <span className="font-medium text-slate-700">{totalPages}</span>
                            {' '}• Total: <span className="font-medium text-slate-700">{totalOrders}</span> pedidos
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    ← Anterior
                                </button>
                                <div className="flex items-center gap-1 mx-2">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                        <button
                                            key={page}
                                            onClick={() => goToPage(page)}
                                            className={`min-w-[40px] px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                                page === currentPage
                                                    ? 'bg-[#A3D154] text-white'
                                                    : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Próximo →
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Confirmação de Pagamento */}
            {confirmPaymentModal?.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={closeConfirmPaymentModal} />
                    <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">Confirmar Pagamento</h2>
                            <button onClick={closeConfirmPaymentModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Pedido</span>
                                <span className="font-mono font-bold text-slate-800">#{confirmPaymentModal.orderNumber}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-slate-600">Total</span>
                                <span className="text-xl font-bold text-[#A3D154]">{formatCurrency(confirmPaymentModal.totalAmount)}</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {modalPayments.length > 0 && (
                                <div className="space-y-2 border border-slate-200 rounded-lg p-3">
                                    {modalPayments.map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm bg-slate-50 p-2 rounded">
                                            <span>{getPaymentMethodLabel(p.method)}: {formatCurrency(p.amount)}</span>
                                            <button onClick={() => removeModalPayment(idx)} type="button" className="text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-200">
                                        <span>Total Pago:</span>
                                        <span className={modalRemaining === 0 ? 'text-green-600' : 'text-amber-600'}>
                                            {formatCurrency(modalTotalPaid)}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {modalRemaining > 0 && (
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Adicionar Pagamento (Restante: {formatCurrency(modalRemaining)})
                                    </label>
                                    <div className="flex gap-2 mb-2">
                                        <select
                                            value={currentModalPaymentMethod}
                                            onChange={(e) => setCurrentModalPaymentMethod(e.target.value as PaymentMethod)}
                                            className="form-select text-sm flex-1"
                                        >
                                            {(['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BRINDE'] as const).map((m) => (
                                                <option key={m} value={m}>{getPaymentMethodLabel(m)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={(currentModalPaymentAmount / 100).toFixed(2)}
                                            onChange={(e) => setCurrentModalPaymentAmount(Math.round(parseFloat(e.target.value) * 100))}
                                            className="form-input text-sm flex-1"
                                            step="0.01"
                                        />
                                        <button
                                            onClick={addModalPayment}
                                            type="button"
                                            className="btn-admin btn-admin-secondary px-3"
                                            disabled={currentModalPaymentAmount <= 0}
                                        >
                                            Adicionar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={closeConfirmPaymentModal}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                                disabled={confirmingPayment}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmPayment}
                                disabled={confirmingPayment || modalRemaining > 0}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-[#A3D154] text-white font-medium hover:bg-[#8FBD3F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {confirmingPayment ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Confirmando...
                                    </span>
                                ) : 'Confirmar Pagamento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Exclusão */}
            {deleteOrderModal?.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={closeDeleteOrderModal} />
                    <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                                <Trash2 className="w-5 h-5" />
                                Excluir Pedido
                            </h2>
                            <button onClick={closeDeleteOrderModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-red-800">
                                <p className="font-semibold mb-1">Atenção: Ação Irreversível!</p>
                                <p className="text-sm">
                                    Você está prestes a excluir permanentemente o pedido{' '}
                                    <strong>#{deleteOrderModal.orderNumber}</strong>.
                                </p>
                            </div>
                            <p className="text-slate-600">Tem certeza que deseja prosseguir com a exclusão definitiva?</p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={closeDeleteOrderModal}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                                disabled={deletingOrder}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteOrder}
                                disabled={deletingOrder}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {deletingOrder ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Excluindo...
                                    </span>
                                ) : 'Sim, Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
