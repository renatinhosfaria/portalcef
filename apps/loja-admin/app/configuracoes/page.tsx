'use client';

import { Save, Store, Clock, Users, DollarSign, Bell, Settings2, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ShopConfig {
    shopName: string;
    description: string;
    openTime: string;
    closeTime: string;
    workDays: string[];
    maxItemsPerOrder: number;
    minOrderValue: number;
    allowInterestList: boolean;
    requireStudentInfo: boolean;
    notifyLowStock: boolean;
    lowStockThreshold: number;
    allowPartialPayment: boolean;
    paymentMethods: string[];
}

export default function ConfiguracoesPage() {
    const [config, setConfig] = useState<ShopConfig>({
        shopName: 'Loja Colégio Essência Feliz',
        description: 'Uniformes, materiais escolares e acessórios',
        openTime: '08:00',
        closeTime: '18:00',
        workDays: ['seg', 'ter', 'qua', 'qui', 'sex'],
        maxItemsPerOrder: 20,
        minOrderValue: 50,
        allowInterestList: true,
        requireStudentInfo: true,
        notifyLowStock: true,
        lowStockThreshold: 5,
        allowPartialPayment: false,
        paymentMethods: ['dinheiro', 'pix', 'cartao', 'boleto'],
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            await new Promise(resolve => setTimeout(resolve, 500));
            // Config já está no state inicial
        } catch (err) {
            console.error('Error loading config:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await new Promise(resolve => setTimeout(resolve, 1000));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Error saving config:', err);
        } finally {
            setSaving(false);
        }
    };

    const weekDays = [
        { value: 'seg', label: 'Seg' },
        { value: 'ter', label: 'Ter' },
        { value: 'qua', label: 'Qua' },
        { value: 'qui', label: 'Qui' },
        { value: 'sex', label: 'Sex' },
        { value: 'sab', label: 'Sáb' },
        { value: 'dom', label: 'Dom' },
    ];

    const toggleDay = (day: string) => {
        if (config.workDays.includes(day)) {
            setConfig({ ...config, workDays: config.workDays.filter(d => d !== day) });
        } else {
            setConfig({ ...config, workDays: [...config.workDays, day] });
        }
    };

    const togglePaymentMethod = (method: string) => {
        if (config.paymentMethods.includes(method)) {
            setConfig({ ...config, paymentMethods: config.paymentMethods.filter(m => m !== method) });
        } else {
            setConfig({ ...config, paymentMethods: [...config.paymentMethods, method] });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="loading-spinner-admin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Configurações</h1>
                    <p className="text-slate-500 mt-1">Gerencie as configurações da loja</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-admin btn-admin-primary"
                >
                    {saving ? (
                        <>
                            <div className="loading-spinner-admin w-4 h-4 border-2"></div>
                            Salvando...
                        </>
                    ) : saved ? (
                        <>
                            <Settings2 className="w-5 h-5" />
                            Salvo!
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            Salvar Alterações
                        </>
                    )}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Informações da Loja */}
                <div className="admin-card">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-[#A3D154]/20 flex items-center justify-center">
                            <Store className="w-5 h-5 text-[#5a7a1f]" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-800">Informações da Loja</h2>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome da Loja</label>
                            <input
                                type="text"
                                className="form-input"
                                value={config.shopName}
                                onChange={(e) => setConfig({ ...config, shopName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição</label>
                            <textarea
                                className="form-input min-h-[80px] resize-none"
                                value={config.description}
                                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Horário de Funcionamento */}
                <div className="admin-card">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-800">Horário de Funcionamento</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Abertura</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={config.openTime}
                                    onChange={(e) => setConfig({ ...config, openTime: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Fechamento</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={config.closeTime}
                                    onChange={(e) => setConfig({ ...config, closeTime: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">Dias de Funcionamento</label>
                            <div className="flex flex-wrap gap-2">
                                {weekDays.map(day => (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() => toggleDay(day.value)}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                            config.workDays.includes(day.value)
                                                ? 'bg-[#A3D154] text-white shadow-lg shadow-[#A3D154]/30'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Regras de Pedido */}
                <div className="admin-card">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-800">Regras de Pedido</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Máx. Itens por Pedido</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={config.maxItemsPerOrder}
                                    onChange={(e) => setConfig({ ...config, maxItemsPerOrder: parseInt(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Valor Mínimo (R$)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={config.minOrderValue}
                                    onChange={(e) => setConfig({ ...config, minOrderValue: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-3 pt-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={config.allowInterestList}
                                    onChange={(e) => setConfig({ ...config, allowInterestList: e.target.checked })}
                                    className="w-5 h-5 rounded-lg border-slate-300 text-[#A3D154] focus:ring-[#A3D154] cursor-pointer"
                                />
                                <span className="text-sm text-slate-700 group-hover:text-slate-900">Permitir lista de interesse</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={config.requireStudentInfo}
                                    onChange={(e) => setConfig({ ...config, requireStudentInfo: e.target.checked })}
                                    className="w-5 h-5 rounded-lg border-slate-300 text-[#A3D154] focus:ring-[#A3D154] cursor-pointer"
                                />
                                <span className="text-sm text-slate-700 group-hover:text-slate-900">Exigir dados do aluno</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Pagamento */}
                <div className="admin-card">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-800">Formas de Pagamento</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { value: 'dinheiro', label: '💵 Dinheiro' },
                                { value: 'pix', label: '📱 PIX' },
                                { value: 'cartao', label: '💳 Cartão' },
                                { value: 'boleto', label: '📄 Boleto' },
                            ].map(method => (
                                <button
                                    key={method.value}
                                    type="button"
                                    onClick={() => togglePaymentMethod(method.value)}
                                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                        config.paymentMethods.includes(method.value)
                                            ? 'bg-[#A3D154] text-white shadow-lg shadow-[#A3D154]/30'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {method.label}
                                </button>
                            ))}
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer group pt-2">
                            <input
                                type="checkbox"
                                checked={config.allowPartialPayment}
                                onChange={(e) => setConfig({ ...config, allowPartialPayment: e.target.checked })}
                                className="w-5 h-5 rounded-lg border-slate-300 text-[#A3D154] focus:ring-[#A3D154] cursor-pointer"
                            />
                            <span className="text-sm text-slate-700 group-hover:text-slate-900">Permitir pagamento parcelado</span>
                        </label>
                    </div>
                </div>

                {/* Notificações */}
                <div className="admin-card lg:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-amber-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-800">Notificações e Alertas</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={config.notifyLowStock}
                                    onChange={(e) => setConfig({ ...config, notifyLowStock: e.target.checked })}
                                    className="w-5 h-5 rounded-lg border-slate-300 text-[#A3D154] focus:ring-[#A3D154] cursor-pointer"
                                />
                                <span className="text-sm text-slate-700 group-hover:text-slate-900">Alertar estoque baixo</span>
                            </label>
                            {config.notifyLowStock && (
                                <div className="ml-8">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantidade mínima para alerta</label>
                                    <input
                                        type="number"
                                        className="form-input w-32"
                                        value={config.lowStockThreshold}
                                        onChange={(e) => setConfig({ ...config, lowStockThreshold: parseInt(e.target.value) })}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <div className="flex items-start gap-3">
                                <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-amber-800">Atenção</p>
                                    <p className="text-sm text-amber-700 mt-1">
                                        As alterações nas configurações afetam imediatamente o funcionamento da loja.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
