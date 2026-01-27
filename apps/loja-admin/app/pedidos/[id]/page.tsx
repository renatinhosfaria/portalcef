'use client';

import { ArrowLeft, Calendar, User, Phone, DollarSign, Package, Clock, CheckCircle2, XCircle, Store, Globe } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../lib/api';

interface OrderItem {
    id: string;
    variantId: string;
    studentName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    product: {
        id: string;
        name: string;
        category: string;
        imageUrl?: string;
    };
    variant: {
        size: string;
        sku: string;
    };
}

interface Order {
    id: string;
    orderNumber: string;
    schoolId: string;
    unitId: string;
    orderSource: string;
    status: string;
    totalAmount: number;
    customer: {
        name: string;
        phone: string;
        email?: string;
    };
    items: OrderItem[];
    paymentMethod?: 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO';
    paidAt?: string;
    expiresAt?: string;
    pickedUpAt?: string;
    pickedUpBy?: string;
    cancelledAt?: string;
    cancelledBy?: string;
    cancellationReason?: string;
    createdAt: string;
    updatedAt: string;
}

export default function OrderDetailsPage() {
    const params = useParams();
    const id = params?.id as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadOrder = useCallback(async () => {
        if (!id) return;

        try {
            setLoading(true);
            const response = await apiFetch(`/api/shop/admin/orders/${id}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Pedido não encontrado');
                }
                throw new Error('Erro ao carregar detalhes do pedido');
            }

            const result = await response.json();
            setOrder(result.data);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadOrder();
    }, [loadOrder]);

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

    const formatPaymentMethod = (method?: string) => {
        if (!method) return '-';
        const methodLabels: Record<string, string> = {
            DINHEIRO: 'Dinheiro',
            PIX: 'PIX',
            CARTAO_CREDITO: 'Cartão de Crédito',
            CARTAO_DEBITO: 'Cartão de Débito',
        };
        return methodLabels[method] || method;
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { class: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
            AGUARDANDO_PAGAMENTO: { class: 'badge-warning', label: 'Aguardando Pagamento', icon: Clock },
            PAGO: { class: 'badge-success', label: 'Pago', icon: CheckCircle2 },
            RETIRADO: { class: 'badge-info', label: 'Retirado', icon: Package },
            CANCELADO: { class: 'badge-danger', label: 'Cancelado', icon: XCircle },
            EXPIRADO: { class: 'badge-neutral', label: 'Expirado', icon: XCircle },
        };
        const config = statusConfig[status] || { class: 'badge-neutral', label: status, icon: Clock };
        const Icon = config.icon;

        return (
            <span className={`badge ${config.class} flex items-center gap-1.5 px-3 py-1`}>
                <Icon className="w-4 h-4" />
                {config.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="loading-spinner-admin"></div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="space-y-6">
                <Link href="/pedidos" className="btn-admin btn-admin-ghost inline-flex items-center">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para Lista
                </Link>
                <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center text-red-800">
                    <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                    <h2 className="text-lg font-bold mb-2">Erro ao carregar pedido</h2>
                    <p>{error || 'Pedido não encontrado'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Header with Back Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/pedidos" className="btn-admin btn-admin-ghost p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                                Pedido #{order.orderNumber}
                            </h1>
                            {getStatusBadge(order.status)}
                        </div>
                        <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Criado em {formatDate(order.createdAt)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`badge ${order.orderSource === 'ONLINE' ? 'badge-info' : 'badge-neutral'} flex items-center gap-1.5`}>
                        {order.orderSource === 'ONLINE' ? (
                            <><Globe className="w-3 h-3" /> Loja Online</>
                        ) : (
                            <><Store className="w-3 h-3" /> Venda Presencial</>
                        )}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content - Left Column (2/3) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Items Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <Package className="w-5 h-5 text-slate-500" />
                            <h2 className="font-semibold text-slate-700">Itens do Pedido</h2>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {order.items.map((item) => (
                                <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="font-semibold text-slate-800 text-lg">{item.product.name}</p>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                                            <span>Tamanho: <strong className="text-slate-700">{item.variant.size}</strong></span>
                                            <span>Aluno: <strong className="text-slate-700">{item.studentName}</strong></span>
                                        </div>
                                    </div>
                                    <div className="flex items-end sm:items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-slate-400 uppercase font-medium">Quantidade</p>
                                            <p className="font-semibold text-slate-700">{item.quantity}</p>
                                        </div>
                                        <div className="text-right min-w-[100px]">
                                            <p className="text-xs text-slate-400 uppercase font-medium">Total</p>
                                            <p className="font-bold text-[#A3D154] text-lg">
                                                {formatCurrency(item.subtotal)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                            <span className="font-semibold text-slate-600">Total do Pedido</span>
                            <span className="text-2xl font-bold text-slate-800">{formatCurrency(order.totalAmount)}</span>
                        </div>
                    </div>

                </div>

                {/* Sidebar - Right Column (1/3) */}
                <div className="space-y-6">

                    {/* Customer Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <User className="w-5 h-5 text-slate-500" />
                            <h2 className="font-semibold text-slate-700">Dados do Cliente</h2>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <p className="text-xs text-slate-400 uppercase font-medium mb-1">Nome</p>
                                <p className="font-medium text-slate-800">{order.customer.name || '-'}</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                                <div>
                                    <p className="text-xs text-slate-400 uppercase font-medium mb-1">Telefone / WhatsApp</p>
                                    <p className="font-mono text-slate-700">{formatPhone(order.customer.phone)}</p>
                                    {order.customer.phone && order.customer.phone.length >= 10 && (
                                        <a
                                            href={`https://wa.me/55${order.customer.phone.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-[#A3D154] hover:underline mt-1 inline-block"
                                        >
                                            Abrir no WhatsApp
                                        </a>
                                    )}
                                </div>
                            </div>
                            {order.customer.email && (
                                <div>
                                    <p className="text-xs text-slate-400 uppercase font-medium mb-1">E-mail</p>
                                    <p className="font-medium text-slate-700">{order.customer.email}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-slate-500" />
                            <h2 className="font-semibold text-slate-700">Resumo Financeiro</h2>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between items-center text-slate-600">
                                <span>Subtotal</span>
                                <span>{formatCurrency(order.totalAmount)}</span>
                            </div>

                            {order.paymentMethod && (
                                <div className="flex justify-between items-center text-slate-600">
                                    <span>Forma de Pagamento</span>
                                    <span className="font-semibold text-slate-700">{formatPaymentMethod(order.paymentMethod)}</span>
                                </div>
                            )}

                            <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between items-center font-bold text-lg text-slate-800">
                                <span>Total</span>
                                <span className="text-[#A3D154]">{formatCurrency(order.totalAmount)}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
