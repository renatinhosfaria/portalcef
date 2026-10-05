'use client';

import {
  AlertTriangle,
  BarChart3,
  Calendar,
  DollarSign,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
  customers: Array<{
    name: string;
    phone: string;
  }>;
}

const PRE_SALE_ERROR_MESSAGE = 'Não foi possível carregar o relatório de pré-venda';

type TabType = 'vendas' | 'estoque' | 'interesse' | 'pre-venda';

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState<TabType>('vendas');
  const [loading, setLoading] = useState(true);
  const [preSaleReport, setPreSaleReport] = useState<PreSaleSummaryItem[] | null>(null);
  const [preSaleError, setPreSaleError] = useState<string | null>(null);

  const loadPreSaleReport = useCallback(async () => {
    setPreSaleError(null);

    try {
      const preSaleResponse = await apiFetch('/api/shop/admin/orders/pre-venda/summary');
      if (!preSaleResponse.ok) {
        throw new Error('Falha ao carregar relatório de pré-venda');
      }

      const preSalePayload = await preSaleResponse.json() as { data?: PreSaleSummaryItem[] };
      if (!Array.isArray(preSalePayload.data)) {
        throw new Error('Resposta inválida do relatório de pré-venda');
      }

      setPreSaleReport(preSalePayload.data);
    } catch (error) {
      console.error('Erro ao carregar relatório de pré-venda:', error);
      setPreSaleReport(null);
      setPreSaleError(PRE_SALE_ERROR_MESSAGE);
    }
  }, []);

  useEffect(() => {
    void loadPreSaleReport().finally(() => setLoading(false));
  }, [loadPreSaleReport]);

  const tabs = [
    { id: 'vendas' as TabType, label: 'Vendas', icon: TrendingUp },
    { id: 'estoque' as TabType, label: 'Estoque', icon: Package },
    { id: 'interesse' as TabType, label: 'Interesse', icon: Users },
    { id: 'pre-venda' as TabType, label: 'Pré-venda', icon: ShoppingBag },
  ];

  const preSaleTotals = preSaleReport?.reduce(
    (acc, item) => ({
      reservedQuantity: acc.reservedQuantity + item.reservedQuantity,
      paidQuantity: acc.paidQuantity + item.paidQuantity,
      pickedUpQuantity: acc.pickedUpQuantity + item.pickedUpQuantity,
      totalQuantity: acc.totalQuantity + item.totalQuantity,
    }),
    {
      reservedQuantity: 0,
      paidQuantity: 0,
      pickedUpQuantity: 0,
      totalQuantity: 0,
    },
  );

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
        <p className="text-sm text-slate-500">
          Selecione uma aba para consultar os dados disponíveis.
        </p>
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
      {activeTab !== 'pre-venda' && (
        <div className="admin-card">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Relatório em preparação</h2>
              <p className="text-sm text-slate-500 mt-1">
                Este relatório ainda não está disponível.
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Os dados serão exibidos quando a fonte correspondente estiver integrada à API.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pre-venda' && preSaleError && (
        <div className="admin-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Pré-venda indisponível</h2>
                <p className="text-sm text-slate-500 mt-1">{preSaleError}</p>
              </div>
            </div>
            <button
              onClick={loadPreSaleReport}
              className="btn-admin btn-admin-secondary"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {activeTab === 'pre-venda' && !preSaleError && preSaleReport && preSaleTotals && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="admin-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Reservado</p>
                  <p className="text-2xl font-bold text-amber-600">{preSaleTotals.reservedQuantity}</p>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Pago</p>
                  <p className="text-2xl font-bold text-blue-600">{preSaleTotals.paidQuantity}</p>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Retirado</p>
                  <p className="text-2xl font-bold text-emerald-600">{preSaleTotals.pickedUpQuantity}</p>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-2xl font-bold text-slate-800">{preSaleTotals.totalQuantity}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Demanda de Pré-venda</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Produto</th>
                    <th className="pb-3 font-medium">Tamanho</th>
                    <th className="pb-3 font-medium text-right">Reservado</th>
                    <th className="pb-3 font-medium text-right">Pago</th>
                    <th className="pb-3 font-medium text-right">Retirado</th>
                    <th className="pb-3 font-medium text-right">Total</th>
                    <th className="pb-3 font-medium">Clientes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {preSaleReport.map((item) => (
                    <tr key={item.variantId} className="text-sm align-top">
                      <td className="py-3">
                        <p className="font-medium text-slate-800">{item.productName}</p>
                        {item.variantSku && (
                          <p className="text-xs text-slate-400 mt-0.5">{item.variantSku}</p>
                        )}
                      </td>
                      <td className="py-3 text-slate-600">{item.variantSize}</td>
                      <td className="py-3 text-right font-medium text-amber-600">{item.reservedQuantity}</td>
                      <td className="py-3 text-right font-medium text-blue-600">{item.paidQuantity}</td>
                      <td className="py-3 text-right font-medium text-emerald-600">{item.pickedUpQuantity}</td>
                      <td className="py-3 text-right font-semibold text-slate-800">{item.totalQuantity}</td>
                      <td className="py-3 min-w-56">
                        <div className="space-y-1">
                          {item.customers.slice(0, 3).map((customer) => (
                            <div key={`${customer.phone}-${customer.name}`} className="text-slate-600">
                              <span className="font-medium text-slate-700">{customer.name}</span>
                              <span className="text-slate-400"> · {customer.phone}</span>
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
                  {preSaleReport.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                        Nenhuma demanda de pré-venda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
