'use client';

import {
  Package,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Sparkles,
  Eye,
  Check,
  Warehouse,
  ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface DashboardStats {
  pendingPickups: number;
  lowStockAlerts: number;
  salesToday: { count: number; total: number };
  salesWeek: { count: number; total: number };
  pendingInterests: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  studentName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      // TODO: Implementar API /api/shop/admin/dashboard no backend
      const response = await fetch('/api/shop/admin/dashboard');
      
      if (!response.ok) {
        console.warn('API de dashboard não disponível:', response.status);
        setStats({
          pendingPickups: 0,
          lowStockAlerts: 0,
          salesToday: { count: 0, total: 0 },
          salesWeek: { count: 0, total: 0 },
          pendingInterests: 0,
        });
        setRecentOrders([]);
        return;
      }
      
      const result = await response.json();

      setStats(result.data.stats || {
        pendingPickups: 0,
        lowStockAlerts: 0,
        salesToday: { count: 0, total: 0 },
        salesWeek: { count: 0, total: 0 },
        pendingInterests: 0,
      });

      setRecentOrders(result.data.recentOrders || []);
    } catch (err) {
      console.warn('Não foi possível carregar dashboard. API ainda não implementada?', err);
      setStats({
        pendingPickups: 0,
        lowStockAlerts: 0,
        salesToday: { count: 0, total: 0 },
        salesWeek: { count: 0, total: 0 },
        pendingInterests: 0,
      });
      setRecentOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading-spinner-admin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-1">Visão geral da loja de uniformes</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/pedidos?status=PAGO" className="stat-card group">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-card-label">Aguardando Retirada</p>
              <p className="stat-card-value">{stats?.pendingPickups || 0}</p>
            </div>
            <div className="stat-card-icon bg-amber-100 text-amber-600">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-[#A3D154] mt-3 font-medium group-hover:underline">Ver pedidos →</p>
        </Link>

        <Link href="/estoque?lowStock=true" className="stat-card group">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-card-label">Estoque Baixo</p>
              <p className="stat-card-value text-red-600">{stats?.lowStockAlerts || 0}</p>
            </div>
            <div className="stat-card-icon bg-red-100 text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-[#A3D154] mt-3 font-medium group-hover:underline">Ver alertas →</p>
        </Link>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-card-label">Vendas Hoje</p>
              <p className="stat-card-value">{formatCurrency(stats?.salesToday.total || 0)}</p>
            </div>
            <div className="stat-card-icon bg-[#A3D154]/20 text-[#5a7a1f]">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-3">{stats?.salesToday.count || 0} pedidos</p>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-card-label">Vendas Semana</p>
              <p className="stat-card-value">{formatCurrency(stats?.salesWeek.total || 0)}</p>
            </div>
            <div className="stat-card-icon bg-blue-100 text-blue-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-3">{stats?.salesWeek.count || 0} pedidos</p>
        </div>
      </div>

      {/* Interest Alert */}
      {stats && stats.pendingInterests > 0 && (
        <div className="admin-card border-l-4 border-l-amber-500">
          <div className="admin-card-body flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">
                  {stats.pendingInterests} clientes aguardando contato
                </p>
                <p className="text-sm text-slate-500">Interesse em produtos sem estoque</p>
              </div>
            </div>
            <Link href="/interesse" className="btn-admin btn-admin-primary">
              Ver Lista
            </Link>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Últimos Pedidos</h2>
          <Link href="/pedidos" className="btn-admin btn-admin-secondary btn-admin-sm">
            Ver Todos
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Responsável</th>
                <th>Aluno</th>
                <th>Total</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Nenhum pedido recente
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-mono font-semibold text-slate-800">#{order.orderNumber}</td>
                    <td>{order.customerName}</td>
                    <td>{order.studentName}</td>
                    <td className="font-medium">{formatCurrency(order.totalAmount)}</td>
                    <td>{getStatusBadge(order.status)}</td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          href={`/pedidos/${order.id}`}
                          className="btn-admin btn-admin-ghost btn-admin-sm"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">Ver</span>
                        </Link>
                        {order.status === 'PAGO' && (
                          <button className="btn-admin btn-admin-primary btn-admin-sm">
                            <Check className="w-4 h-4" />
                            <span className="hidden sm:inline">Retirar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/venda-presencial" className="admin-card p-6 text-center hover:border-[#A3D154] hover:shadow-md transition-all group">
          <div className="w-16 h-16 rounded-2xl bg-[#A3D154]/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-[#A3D154]/20 transition-colors">
            <ShoppingCart className="w-8 h-8 text-[#A3D154]" />
          </div>
          <h3 className="font-semibold text-lg text-slate-800">Venda Presencial</h3>
          <p className="text-sm text-slate-500 mt-1">Registrar venda no balcão</p>
        </Link>

        <Link href="/produtos" className="admin-card p-6 text-center hover:border-[#A3D154] hover:shadow-md transition-all group">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200/80 transition-colors">
            <ClipboardList className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="font-semibold text-lg text-slate-800">Gerenciar Produtos</h3>
          <p className="text-sm text-slate-500 mt-1">Adicionar e editar produtos</p>
        </Link>

        <Link href="/estoque" className="admin-card p-6 text-center hover:border-[#A3D154] hover:shadow-md transition-all group">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 group-hover:bg-amber-200/80 transition-colors">
            <Warehouse className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="font-semibold text-lg text-slate-800">Gestão de Estoque</h3>
          <p className="text-sm text-slate-500 mt-1">Entrada e ajuste de estoque</p>
        </Link>
      </div>
    </div>
  );
}
