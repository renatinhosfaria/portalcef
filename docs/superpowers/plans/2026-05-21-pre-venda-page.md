# Página de Pré-venda (loja-admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o conteúdo da rota `/interesse` por um painel operacional completo de pré-vendas com KPIs, demanda por produto e lista de pedidos com ações.

**Architecture:** A página `app/interesse/page.tsx` é completamente reescrita — sem nova rota, sem mudança de URL. O sidebar recebe apenas o label atualizado. Nenhuma alteração de backend é necessária: todos os endpoints já existem.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Vitest (source-reading tests)

---

## Mapa de Arquivos

| Arquivo | Operação | Responsabilidade |
|---|---|---|
| `__tests__/interesse.test.ts` | Substituir | Invariantes da nova página de pré-venda + sidebar |
| `app/interesse/page.tsx` | Substituir completamente | Página de pré-venda (KPIs, demanda, pedidos, modais) |
| `components/AdminSidebar.tsx` | Modificar 1 linha | Label "Interesse" → "Pré-venda" |
| `lib/interesse.ts` | Deletar | Não mais utilizada após a substituição |

---

## Task 1: Escrever testes que definem os invariantes da nova página (RED)

**Files:**
- Modify: `__tests__/interesse.test.ts` (substituir completamente)

- [ ] **Step 1.1: Substituir o arquivo de testes**

Substitua o conteúdo de `__tests__/interesse.test.ts` por:

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('página de pré-venda (/interesse)', () => {
    const source = readFileSync(join(process.cwd(), 'app/interesse/page.tsx'), 'utf8');

    it('usa sempre orderSource PRE_VENDA sem expor filtro de origem ao usuário', () => {
        expect(source).toContain("params.set('orderSource', 'PRE_VENDA')");
        expect(source).not.toContain('orderSourceFilter');
    });

    it('busca demanda pelo endpoint dedicado de summary', () => {
        expect(source).toContain("apiFetch('/api/shop/admin/orders/pre-venda/summary')");
    });

    it('calcula KPIs somando todos os campos do summary por variante', () => {
        expect(source).toContain('reservedQuantity');
        expect(source).toContain('paidQuantity');
        expect(source).toContain('pickedUpQuantity');
        expect(source).toContain('totalQuantity');
    });

    it('nunca oferece exclusão para pedidos PAGO ou RETIRADO', () => {
        expect(source).toContain("['AGUARDANDO_PAGAMENTO', 'CANCELADO', 'EXPIRADO'].includes(order.status)");
    });

    it('não permite BRINDE parcial na confirmação de pagamento', () => {
        expect(source).toContain('finalTotalPaid !== confirmPaymentModal.totalAmount');
    });

    it('exibe título Pré-venda', () => {
        expect(source).toContain('>Pré-venda<');
    });
});

describe('sidebar de navegação', () => {
    const source = readFileSync(join(process.cwd(), 'components/AdminSidebar.tsx'), 'utf8');

    it('mostra Pré-venda no menu e não mais Interesse', () => {
        expect(source).toContain("label: 'Pré-venda'");
        expect(source).not.toContain("label: 'Interesse'");
    });
});
```

- [ ] **Step 1.2: Confirmar que os testes falham (RED)**

```bash
cd apps/loja-admin && pnpm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|interesse"
```

Esperado: todos os `it()` em `interesse.test.ts` falham — a página atual é a de Interesse, não Pré-venda.

---

## Task 2: Implementar a nova página de pré-venda

**Files:**
- Modify: `app/interesse/page.tsx` (substituir completamente)

- [ ] **Step 2.1: Reescrever `app/interesse/page.tsx`**

Substitua todo o conteúdo do arquivo por:

```tsx
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
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Demanda por produto</h2>
                {summaryLoading ? (
                    <div className="flex justify-center py-8">
                        <div className="loading-spinner-admin" />
                    </div>
                ) : summaryItems.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📦</div>
                        <div className="empty-state-title">Nenhuma demanda de pré-venda</div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Tamanho</th>
                                    <th className="text-right">Reservado</th>
                                    <th className="text-right">Pago</th>
                                    <th className="text-right">Retirado</th>
                                    <th className="text-right">Total</th>
                                    <th>Clientes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaryItems.map((item) => (
                                    <tr key={item.variantId} className="align-top">
                                        <td>
                                            <p className="font-medium text-slate-800">{item.productName}</p>
                                            {item.variantSku && (
                                                <p className="text-xs text-slate-400 mt-0.5">{item.variantSku}</p>
                                            )}
                                        </td>
                                        <td className="text-slate-600">{item.variantSize}</td>
                                        <td className="text-right font-medium text-amber-600">{item.reservedQuantity}</td>
                                        <td className="text-right font-medium text-blue-600">{item.paidQuantity}</td>
                                        <td className="text-right font-medium text-[#5a7a1f]">{item.pickedUpQuantity}</td>
                                        <td className="text-right font-semibold text-slate-800">{item.totalQuantity}</td>
                                        <td className="min-w-48">
                                            <div className="space-y-1">
                                                {item.customers.slice(0, 3).map((c) => (
                                                    <div key={`${c.phone}-${c.name}`} className="text-xs text-slate-600">
                                                        <span className="font-medium text-slate-700">{c.name}</span>
                                                        <span className="text-slate-400"> · {c.phone}</span>
                                                    </div>
                                                ))}
                                                {item.customers.length > 3 && (
                                                    <p className="text-xs text-slate-400">
                                                        +{item.customers.length - 3} clientes
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
```

- [ ] **Step 2.2: Confirmar que os testes de página passam (GREEN para Task 2)**

```bash
cd apps/loja-admin && pnpm test -- --reporter=verbose 2>&1 | grep -E "✓|✗|FAIL|PASS|interesse"
```

Esperado: os 6 testes do describe `página de pré-venda (/interesse)` passam. O teste de sidebar ainda falha.

---

## Task 3: Atualizar label e ícone na sidebar

**Files:**
- Modify: `components/AdminSidebar.tsx`

- [ ] **Step 3.1: Alterar o item de menu**

Em `components/AdminSidebar.tsx`, localize a linha:

```typescript
    { href: '/interesse', label: 'Interesse', icon: '💡' },
```

Substitua por:

```typescript
    { href: '/interesse', label: 'Pré-venda', icon: '🛍️' },
```

- [ ] **Step 3.2: Confirmar que todos os testes passam (GREEN completo)**

```bash
cd apps/loja-admin && pnpm test -- --reporter=verbose
```

Esperado: todos os testes passam, incluindo o teste de sidebar `mostra Pré-venda no menu e não mais Interesse`.

---

## Task 4: Remover lib/interesse.ts (não mais utilizada)

**Files:**
- Delete: `lib/interesse.ts`

- [ ] **Step 4.1: Verificar que nenhum arquivo importa lib/interesse.ts**

```bash
grep -r "from.*lib/interesse\|require.*lib/interesse" apps/loja-admin --include="*.ts" --include="*.tsx"
```

Esperado: nenhuma saída (zero importações).

- [ ] **Step 4.2: Deletar o arquivo**

```bash
rm apps/loja-admin/lib/interesse.ts
```

- [ ] **Step 4.3: Confirmar que os testes continuam passando**

```bash
cd apps/loja-admin && pnpm test -- --reporter=verbose
```

Esperado: todos passam. (O arquivo de testes substituído não importa mais `lib/interesse`.)

---

## Task 5: Pipeline de qualidade e commit

- [ ] **Step 5.1: Lint e typecheck**

```bash
cd /var/www/essencia && pnpm turbo lint typecheck --filter=loja-admin
```

Esperado: zero erros. Se houver erro de lint de `@typescript-eslint/no-unused-vars` ou similar, corrija antes de prosseguir.

- [ ] **Step 5.2: Suite completa de testes do loja-admin**

```bash
cd apps/loja-admin && pnpm test
```

Esperado: todos os testes passam.

- [ ] **Step 5.3: Commit**

```bash
git add apps/loja-admin/app/interesse/page.tsx \
        apps/loja-admin/components/AdminSidebar.tsx \
        apps/loja-admin/__tests__/interesse.test.ts \
        apps/loja-admin/lib/interesse.ts \
        docs/superpowers/specs/2026-05-21-pre-venda-page-design.md \
        docs/superpowers/plans/2026-05-21-pre-venda-page.md

git commit -m "$(cat <<'EOF'
feat(loja-admin): substitui página Interesse por painel de Pré-venda

Página /interesse agora exibe KPIs de pré-venda, demanda agrupada por
produto/tamanho e lista operacional de pedidos PRE_VENDA com confirmação
de pagamento (multi-forma), retirada e exclusão. Sidebar atualizado.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Auto-revisão do Plano

**Cobertura do spec:**
- ✅ Header com título e botão refresh → Task 2 (JSX do header)
- ✅ 4 cards KPI calculados do summary → Task 2 (kpis reducer + JSX)
- ✅ Tabela de demanda por produto → Task 2 (summaryItems table)
- ✅ Busca com debounce 300ms → Task 2 (useEffect com setTimeout)
- ✅ Filtro de status (sem filtro de origem) → Task 2 (statusFilter select)
- ✅ orderSource=PRE_VENDA fixo → Task 2 + Task 1 (teste invariante)
- ✅ Expand de linha com itens → Task 2 (Fragment + expandedOrder)
- ✅ Confirmar pagamento (modal multi-forma) → Task 2 (modal completo)
- ✅ Registrar retirada → Task 2 (handleMarkPickedUp)
- ✅ Excluir pedido (modal) → Task 2 (modal de exclusão)
- ✅ Paginação → Task 2 (goToPage + rodapé)
- ✅ Sidebar label → Task 3
- ✅ Remoção de lib não utilizada → Task 4

**Invariantes testados:**
- `orderSource=PRE_VENDA` fixo, sem `orderSourceFilter`
- endpoint `/pre-venda/summary` usado
- campos `reservedQuantity`, `paidQuantity`, `pickedUpQuantity`, `totalQuantity` presentes
- exclusão apenas para `AGUARDANDO_PAGAMENTO`, `CANCELADO`, `EXPIRADO`
- validação `finalTotalPaid !== confirmPaymentModal.totalAmount`
- título `Pré-venda` no JSX
- sidebar sem `label: 'Interesse'`, com `label: 'Pré-venda'`
