'use client';

import { Search, Eye, Check, ChevronDown, ChevronRight, Globe, Store } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface OrderItem {
    id: string;
    productName: string;
    variantSize: string;
    studentName: string;
    quantity: number;
    unitPrice: number;
}

interface Order {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    totalAmount: number;
    status: string;
    orderSource: string;
    createdAt: string;
    items: OrderItem[];
}

export default function PedidosPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    const loadOrders = useCallback(async () => {
        try {
            setLoading(true);

            // TODO: Call real API /api/shop/admin/orders with filters
            await new Promise(resolve => setTimeout(resolve, 500));

            // Mock data
            const mockOrders: Order[] = [
                {
                    id: '1',
                    orderNumber: '234567',
                    customerName: 'Maria Silva',
                    customerPhone: '11987654321',
                    totalAmount: 13500,
                    status: 'PAGO',
                    orderSource: 'ONLINE',
                    createdAt: new Date().toISOString(),
                    items: [
                        { id: 'i1', productName: 'Camiseta Uniforme', variantSize: '8', studentName: 'João Silva', quantity: 2, unitPrice: 4500 },
                        { id: 'i2', productName: 'Calça Uniforme', variantSize: '10', studentName: 'João Silva', quantity: 1, unitPrice: 4500 },
                    ],
                },
                {
                    id: '2',
                    orderNumber: '234566',
                    customerName: 'Carlos Santos',
                    customerPhone: '11998765432',
                    totalAmount: 9000,
                    status: 'PAGO',
                    orderSource: 'ONLINE',
                    createdAt: new Date(Date.now() - 3600000).toISOString(),
                    items: [
                        { id: 'i3', productName: 'Camiseta Ed. Física', variantSize: '12', studentName: 'Ana Santos', quantity: 2, unitPrice: 3500 },
                        { id: 'i4', productName: 'Short Ed. Física', variantSize: '12', studentName: 'Ana Santos', quantity: 1, unitPrice: 2000 },
                    ],
                },
                {
                    id: '3',
                    orderNumber: '234565',
                    customerName: 'Ana Costa',
                    customerPhone: '11912345678',
                    totalAmount: 22500,
                    status: 'RETIRADO',
                    orderSource: 'PRESENCIAL',
                    createdAt: new Date(Date.now() - 86400000).toISOString(),
                    items: [
                        { id: 'i5', productName: 'Kit Uniforme Completo', variantSize: '6', studentName: 'Pedro Costa', quantity: 1, unitPrice: 22500 },
                    ],
                },
            ];

            // Filter by search
            let filtered = mockOrders;
            if (search) {
                const searchLower = search.toLowerCase();
                filtered = filtered.filter(o =>
                    o.orderNumber.includes(search) ||
                    o.customerName.toLowerCase().includes(searchLower) ||
                    o.customerPhone.includes(search) ||
                    o.items.some(i => i.studentName.toLowerCase().includes(searchLower))
                );
            }

            // Filter by status
            if (statusFilter) {
                filtered = filtered.filter(o => o.status === statusFilter);
            }

            setOrders(filtered);
        } catch (err) {
            console.error('Error loading orders:', err);
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

    const formatPhone = (phone: string) => {
        if (phone.length === 11) {
            return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
        }
        return phone;
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { class: string; label: string }> = {
            AGUARDANDO_PAGAMENTO: { class: 'badge-warning', label: 'Aguardando' },
            PAGO: { class: 'badge-success', label: 'Pago' },
            RETIRADO: { class: 'badge-info', label: 'Retirado' },
            CANCELADO: { class: 'badge-danger', label: 'Cancelado' },
            EXPIRADO: { class: 'badge-neutral', label: 'Expirado' },
        };
        const config = statusConfig[status] || { class: 'badge-neutral', label: status };
        return <span className={`badge ${config.class}`}>{config.label}</span>;
    };

    const handleMarkPickedUp = async (orderId: string) => {
        // TODO: Call real API PATCH /shop/admin/orders/{id}/pickup
        alert(`Marcar pedido ${orderId} como retirado`);
        loadOrders();
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
                                    <>
                                        <tr key={order.id}>
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
                                                    {order.status === 'PAGO' && (
                                                        <button
                                                            onClick={() => handleMarkPickedUp(order.id)}
                                                            className="btn-admin btn-admin-primary btn-admin-sm"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                            Retirar
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
                                                                    <p className="font-semibold text-slate-800">{item.productName}</p>
                                                                    <p className="text-sm text-slate-500 mt-1">
                                                                        Tamanho: <span className="font-medium text-slate-700">{item.variantSize}</span> | 
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
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
