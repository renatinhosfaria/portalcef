'use client';

import {
  BarChart3,
  TrendingUp,
  Package,
  Users,
  Download,
  Calendar,
  AlertTriangle,
  DollarSign,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface SalesReport {
  totalOrders: number;
  totalRevenue: number;
  averageTicket: number;
  ordersChange: number;
  revenueChange: number;
  topProducts: Array<{
    id: string;
    name: string;
    size: string;
    quantity: number;
    revenue: number;
  }>;
  salesByDay: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
}

interface StockReport {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  criticalItems: Array<{
    id: string;
    productName: string;
    size: string;
    available: number;
    threshold: number;
  }>;
}

interface InterestReport {
  totalRequests: number;
  pendingCount: number;
  contactedCount: number;
  topDemand: Array<{
    id: string;
    productName: string;
    size: string;
    requestCount: number;
  }>;
}

type TabType = 'vendas' | 'estoque' | 'interesse';

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState<TabType>('vendas');
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [stockReport, setStockReport] = useState<StockReport | null>(null);
  const [interestReport, setInterestReport] = useState<InterestReport | null>(null);

  useEffect(() => {
    loadReports();
  }, [period]);

  const loadReports = async () => {
    setLoading(true);
    try {
      // Simular chamada API - quando backend estiver pronto, substituir por fetch real
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock data para demonstração
      setSalesReport({
        totalOrders: 156,
        totalRevenue: 24680,
        averageTicket: 158.21,
        ordersChange: 12.5,
        revenueChange: 8.3,
        topProducts: [
          { id: '1', name: 'Camisa Polo', size: 'M', quantity: 45, revenue: 4500 },
          { id: '2', name: 'Calça Social', size: 'P', quantity: 38, revenue: 5700 },
          { id: '3', name: 'Shorts Ed. Física', size: 'G', quantity: 32, revenue: 2240 },
          { id: '4', name: 'Camiseta Ed. Física', size: 'M', quantity: 28, revenue: 1680 },
          { id: '5', name: 'Meia Branca', size: 'Único', quantity: 65, revenue: 975 },
        ],
        salesByDay: [
          { date: '06/01', orders: 8, revenue: 1280 },
          { date: '07/01', orders: 12, revenue: 1920 },
          { date: '08/01', orders: 15, revenue: 2400 },
          { date: '09/01', orders: 10, revenue: 1600 },
          { date: '10/01', orders: 18, revenue: 2880 },
        ],
      });

      setStockReport({
        totalProducts: 48,
        lowStockCount: 8,
        outOfStockCount: 3,
        criticalItems: [
          { id: '1', productName: 'Camisa Polo', size: '10', available: 2, threshold: 5 },
          { id: '2', productName: 'Calça Social', size: '12', available: 0, threshold: 5 },
          { id: '3', productName: 'Shorts Ed. Física', size: 'GG', available: 1, threshold: 3 },
          { id: '4', productName: 'Tênis Escolar', size: '36', available: 0, threshold: 4 },
          { id: '5', productName: 'Mochila', size: 'Único', available: 3, threshold: 5 },
        ],
      });

      setInterestReport({
        totalRequests: 42,
        pendingCount: 18,
        contactedCount: 24,
        topDemand: [
          { id: '1', productName: 'Calça Social', size: '12', requestCount: 12 },
          { id: '2', productName: 'Tênis Escolar', size: '36', requestCount: 8 },
          { id: '3', productName: 'Camisa Polo', size: '14', requestCount: 6 },
          { id: '4', productName: 'Jaqueta Inverno', size: 'G', requestCount: 5 },
        ],
      });
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleExportCSV = () => {
    // Implementar export quando houver dados reais
    alert('Funcionalidade de exportação será habilitada quando conectado à API');
  };

  const tabs = [
    { id: 'vendas' as TabType, label: 'Vendas', icon: TrendingUp },
    { id: 'estoque' as TabType, label: 'Estoque', icon: Package },
    { id: 'interesse' as TabType, label: 'Interesse', icon: Users },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner-admin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Relatórios</h1>
          <p className="text-slate-500 mt-1">Análise de vendas, estoque e demanda</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="form-input py-2 w-40"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="btn-admin btn-admin-secondary"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#A3D154] text-[#5a7a1f]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'vendas' && salesReport && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="admin-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total de Pedidos</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {salesReport.totalOrders}
                  </p>
                </div>
                <div className={`flex items-center gap-1 text-sm ${
                  salesReport.ordersChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {salesReport.ordersChange >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {Math.abs(salesReport.ordersChange)}%
                </div>
              </div>
              <div className="mt-4 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#A3D154] w-3/4"></div>
              </div>
            </div>

            <div className="admin-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Receita Total</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {formatCurrency(salesReport.totalRevenue)}
                  </p>
                </div>
                <div className={`flex items-center gap-1 text-sm ${
                  salesReport.revenueChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {salesReport.revenueChange >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {Math.abs(salesReport.revenueChange)}%
                </div>
              </div>
              <div className="mt-4 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-2/3"></div>
              </div>
            </div>

            <div className="admin-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Ticket Médio</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {formatCurrency(salesReport.averageTicket)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-slate-300" />
              </div>
              <div className="mt-4 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-1/2"></div>
              </div>
            </div>
          </div>

          {/* Top Products Table */}
          <div className="admin-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#A3D154]/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#5a7a1f]" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Top 10 Produtos</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Produto</th>
                    <th className="pb-3 font-medium">Tamanho</th>
                    <th className="pb-3 font-medium text-right">Qtd Vendida</th>
                    <th className="pb-3 font-medium text-right">Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {salesReport.topProducts.map((product, index) => (
                    <tr key={product.id} className="text-sm">
                      <td className="py-3 text-slate-400">{index + 1}</td>
                      <td className="py-3 font-medium text-slate-800">{product.name}</td>
                      <td className="py-3 text-slate-600">{product.size}</td>
                      <td className="py-3 text-right text-slate-600">{product.quantity}</td>
                      <td className="py-3 text-right font-medium text-emerald-600">
                        {formatCurrency(product.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'estoque' && stockReport && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="admin-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total de Produtos</p>
                  <p className="text-2xl font-bold text-slate-800">{stockReport.totalProducts}</p>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Estoque Baixo</p>
                  <p className="text-2xl font-bold text-amber-600">{stockReport.lowStockCount}</p>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <Package className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Sem Estoque</p>
                  <p className="text-2xl font-bold text-red-600">{stockReport.outOfStockCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Critical Items Table */}
          <div className="admin-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Itens Críticos</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Produto</th>
                    <th className="pb-3 font-medium">Tamanho</th>
                    <th className="pb-3 font-medium text-center">Disponível</th>
                    <th className="pb-3 font-medium text-center">Mínimo</th>
                    <th className="pb-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stockReport.criticalItems.map((item) => (
                    <tr key={item.id} className="text-sm">
                      <td className="py-3 font-medium text-slate-800">{item.productName}</td>
                      <td className="py-3 text-slate-600">{item.size}</td>
                      <td className="py-3 text-center font-medium text-slate-800">{item.available}</td>
                      <td className="py-3 text-center text-slate-500">{item.threshold}</td>
                      <td className="py-3 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          item.available === 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.available === 0 ? 'Esgotado' : 'Baixo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'interesse' && interestReport && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="admin-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total de Solicitações</p>
                  <p className="text-2xl font-bold text-slate-800">{interestReport.totalRequests}</p>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Pendentes</p>
                  <p className="text-2xl font-bold text-amber-600">{interestReport.pendingCount}</p>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Contatados</p>
                  <p className="text-2xl font-bold text-emerald-600">{interestReport.contactedCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Demand Table */}
          <div className="admin-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Produtos Mais Solicitados</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Produto</th>
                    <th className="pb-3 font-medium">Tamanho</th>
                    <th className="pb-3 font-medium text-right">Solicitações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {interestReport.topDemand.map((item, index) => (
                    <tr key={item.id} className="text-sm">
                      <td className="py-3 text-slate-400">{index + 1}</td>
                      <td className="py-3 font-medium text-slate-800">{item.productName}</td>
                      <td className="py-3 text-slate-600">{item.size}</td>
                      <td className="py-3 text-right">
                        <span className="inline-flex px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {item.requestCount} solicitações
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
