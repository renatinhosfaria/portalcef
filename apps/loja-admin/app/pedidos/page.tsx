'use client';

import { Search, Eye, Check, ChevronDown, ChevronRight, Globe, Store, CreditCard, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../lib/api';

interface OrderItem {
    id: string;
    productName?: string;
    variantSize?: string;
    studentName: string;
    quantity: number;
    unitPrice: number;
    product?: {
        name: string;
    };
    variant?: {
        size: string;
    };
}

interface Order {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    totalAmount: number;
    status: string;
    orderSource: string;
    paymentMethod?: PaymentMethod;
    createdAt: string;
    items: OrderItem[];
}

type PaymentMethod = 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO';

export default function PedidosPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    // Estado para modal de confirmação de pagamento
    const [confirmPaymentModal, setConfirmPaymentModal] = useState<{
        open: boolean;
        orderId: string;
        orderNumber: string;
        totalAmount: number;
    } | null>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
    const [confirmingPayment, setConfirmingPayment] = useState(false);

    const loadOrders = useCallback(async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (statusFilter) params.set('status', statusFilter);

            const response = await apiFetch(`/api/shop/admin/orders?${params.toString()}`);

            if (!response.ok) {
                console.warn('API de pedidos não disponível:', response.status);
                setOrders([]);
                return;
            }

            const result = await response.json();
            let filtered = result.data || [];

            // Filter by status
            if (statusFilter) {
                filtered = filtered.filter((o: Order) => o.status === statusFilter);
            }

            setOrders(filtered);
        } catch (err) {
            console.warn('Não foi possível carregar pedidos. API ainda não implementada?', err);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            loadOrders();
        }, 300);
        return () => clearTimeout(debounce);
    }, [loadOrders]);

    const formatCurrency = (cents: number) => {
        return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('pt-BR');
    };

    const formatPhone = (phone: string | undefined | null) => {
        if (!phone) return '-';
        if (phone.length === 11) {
            return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
        }
        return phone;
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { class: string; label: string }> = {
            AGUARDANDO_PAGAMENTO: { class: 'badge-warning', label: 'Aguardando Pgto' },
            PAGO: { class: 'badge-success', label: 'Pago' },
            RETIRADO: { class: 'badge-info', label: 'Retirado' },
            CANCELADO: { class: 'badge-danger', label: 'Cancelado' },
            EXPIRADO: { class: 'badge-neutral', label: 'Expirado' },
        };
        const config = statusConfig[status] || { class: 'badge-neutral', label: status };
        return <span className={`badge ${config.class}`}>{config.label}</span>;
    };

    const getPaymentMethodLabel = (method: PaymentMethod) => {
        const labels: Record<PaymentMethod, string> = {
            DINHEIRO: 'Dinheiro',
            PIX: 'PIX',
            CARTAO_CREDITO: 'Cartão de Crédito',
            CARTAO_DEBITO: 'Cartão de Débito',
        };
        return labels[method];
    };

    const handleMarkPickedUp = async (orderId: string) => {
        if (!confirm('Confirmar retirada deste pedido?')) return;

        try {
            const res = await apiFetch(`/api/shop/admin/orders/${orderId}/pickup`, {
                method: 'PATCH'
            });

            if (!res.ok) throw new Error('Falha ao marcar retirada');

            loadOrders();
        } catch (err) {
            console.error(err);
            alert('Erro ao confirmar retirada');
        }
    };

    const openConfirmPaymentModal = (order: Order) => {
        setConfirmPaymentModal({
            open: true,
            orderId: order.id,
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
        });
        setSelectedPaymentMethod('DINHEIRO');
    };

    const closeConfirmPaymentModal = () => {
        setConfirmPaymentModal(null);
        setSelectedPaymentMethod('DINHEIRO');
    };

    const handleConfirmPayment = async () => {
        if (!confirmPaymentModal) return;

        setConfirmingPayment(true);

        try {
            const res = await apiFetch(`/api/shop/admin/orders/${confirmPaymentModal.orderId}/confirm-payment`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentMethod: selectedPaymentMethod }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || 'Falha ao confirmar pagamento');
            }

            closeConfirmPaymentModal();
            loadOrders();
            alert('Pagamento confirmado com sucesso!');
        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'Erro ao confirmar pagamento';
            alert(message);
        } finally {
            setConfirmingPayment(false);
        }
    };

    // Estado para modal de exclusão
    const [deleteOrderModal, setDeleteOrderModal] = useState<{
        open: boolean;
        orderId: string;
        orderNumber: string;
    } | null>(null);
    const [deletingOrder, setDeletingOrder] = useState(false);

    const openDeleteOrderModal = (order: Order) => {
        setDeleteOrderModal({
            open: true,
            orderId: order.id,
            orderNumber: order.orderNumber,
        });
    };

    const closeDeleteOrderModal = () => {
        setDeleteOrderModal(null);
    };

    const handleDeleteOrder = async () => {
        if (!deleteOrderModal) return;

        setDeletingOrder(true);

        try {
            const res = await apiFetch(`/api/shop/admin/orders/${deleteOrderModal.orderId}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || 'Falha ao excluir pedido');
            }

            closeDeleteOrderModal();
            loadOrders();
            alert('Pedido excluído com sucesso!');
        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'Erro ao excluir pedido';
            alert(message);
        } finally {
            setDeletingOrder(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestão de Pedidos</h1>
                <p className="text-slate-500 mt-1">Visualize e gerencie todos os pedidos da loja</p>
            </div>

            {/* Filters */}
            <div className="filter-bar">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por pedido, nome ou telefone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="form-input pl-11"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="form-select w-auto min-w-[180px]"
                >
                    <option value="">Todos os Status</option>
                    <option value="AGUARDANDO_PAGAMENTO">Aguardando Pagamento</option>
                    <option value="PAGO">Aguardando Retirada</option>
                    <option value="RETIRADO">Retirado</option>
                    <option value="CANCELADO">Cancelado</option>
                    <option value="EXPIRADO">Expirado</option>
                </select>
            </div>

            {/* Orders Table */}
            <div className="admin-card">
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Responsável</th>
                                <th>Telefone</th>
                                <th>Total</th>
                                <th>Origem</th>
                                <th>Status</th>
                                <th>Data</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12">
                                        <div className="loading-spinner-admin mx-auto"></div>
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">📋</div>
                                            <div className="empty-state-title">Nenhum pedido encontrado</div>
                                            <div className="empty-state-description">
                                                Tente ajustar os filtros de busca
                                            </div>
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
                                            <td>
                                                <span className={`badge ${order.orderSource === 'ONLINE' ? 'badge-info' : 'badge-neutral'}`}>
                                                    {order.orderSource === 'ONLINE' ? (
                                                        <><Globe className="w-3 h-3" /> Online</>
                                                    ) : (
                                                        <><Store className="w-3 h-3" /> Presencial</>
                                                    )}
                                                </span>
                                            </td>
                                            <td>{getStatusBadge(order.status)}</td>
                                            <td className="text-sm text-slate-500">{formatDate(order.createdAt)}</td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <Link
                                                        href={`/pedidos/${order.id}`}
                                                        className="btn-admin btn-admin-ghost btn-admin-sm"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Link>
                                                    {order.status === 'AGUARDANDO_PAGAMENTO' && (
                                                        <button
                                                            onClick={() => openConfirmPaymentModal(order)}
                                                            className="btn-admin btn-admin-warning btn-admin-sm"
                                                            title="Confirmar Pagamento"
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
                                                <td colSpan={8} className="p-6">
                                                    <div className="pl-4 border-l-4 border-[#A3D154] rounded">
                                                        <h4 className="font-semibold text-slate-800 mb-4">Itens do Pedido</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {order.items.map(item => (
                                                                <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                                    <p className="font-semibold text-slate-800">
                                                                        {item.product?.name || item.productName || 'Produto'}
                                                                    </p>
                                                                    <p className="text-sm text-slate-500 mt-1">
                                                                        Tamanho: <span className="font-medium text-slate-700">
                                                                            {item.variant?.size || item.variantSize || '-'}
                                                                        </span> |
                                                                        Qtd: <span className="font-medium text-slate-700">{item.quantity}</span>
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
            </div>

            {/* Modal de Confirmação de Pagamento */}
            {confirmPaymentModal?.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={closeConfirmPaymentModal}
                    />

                    {/* Modal */}
                    <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">
                                Confirmar Pagamento
                            </h2>
                            <button
                                onClick={closeConfirmPaymentModal}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Order Info */}
                        <div className="bg-slate-50 rounded-lg p-4">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Pedido</span>
                                <span className="font-mono font-bold text-slate-800">
                                    #{confirmPaymentModal.orderNumber}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-slate-600">Total</span>
                                <span className="text-xl font-bold text-[#A3D154]">
                                    {formatCurrency(confirmPaymentModal.totalAmount)}
                                </span>
                            </div>
                        </div>

                        {/* Payment Method Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">
                                Forma de Pagamento
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {(['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'] as PaymentMethod[]).map(
                                    (method) => (
                                        <button
                                            key={method}
                                            type="button"
                                            onClick={() => setSelectedPaymentMethod(method)}
                                            className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${selectedPaymentMethod === method
                                                ? 'border-[#A3D154] bg-[#A3D154]/10 text-[#8FBD3F]'
                                                : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                                }`}
                                        >
                                            {getPaymentMethodLabel(method)}
                                        </button>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Actions */}
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
                                disabled={confirmingPayment}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-[#A3D154] text-white font-medium hover:bg-[#8FBD3F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {confirmingPayment ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Confirmando...
                                    </span>
                                ) : (
                                    'Confirmar Pagamento'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Exclusão de Pedido */}
            {deleteOrderModal?.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={closeDeleteOrderModal}
                    />

                    {/* Modal */}
                    <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                                <Trash2 className="w-5 h-5" />
                                Excluir Pedido
                            </h2>
                            <button
                                onClick={closeDeleteOrderModal}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="space-y-4">
                            <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-red-800">
                                <p className="font-semibold mb-1">Atenção: Ação Irreversível!</p>
                                <p className="text-sm">
                                    Você está prestes a excluir permanentemente o pedido <strong>#{deleteOrderModal.orderNumber}</strong>.
                                    Todos os dados relacionados serão removidos do sistema.
                                </p>
                            </div>

                            <p className="text-slate-600">
                                Tem certeza que deseja prosseguir com a exclusão definitiva?
                            </p>
                        </div>

                        {/* Actions */}
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
                                ) : (
                                    'Sim, Excluir'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
