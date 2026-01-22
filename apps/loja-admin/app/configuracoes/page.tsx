'use client';

import { useTenant } from "@essencia/shared/providers/tenant";
import { Save, Store, CreditCard, Settings2, Shield, Power } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../lib/api';

interface ShopSettings {
    id: string;
    unitId: string;
    maxInstallments: number;
    isShopEnabled: boolean;
    pickupInstructions: string | null;
    createdAt: string;
    updatedAt: string;
}



export default function ConfiguracoesPage() {
    const { unitId } = useTenant();
    const [_settings, setSettings] = useState<ShopSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [maxInstallments, setMaxInstallments] = useState(1);
    const [isShopEnabled, setIsShopEnabled] = useState(true);
    const [pickupInstructions, setPickupInstructions] = useState('');

    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiFetch(`/api/shop/admin/settings/${unitId}`, {
                credentials: 'include',
            });

            const data = await response.json();

            if (data.success && data.data) {
                setSettings(data.data);
                setMaxInstallments(data.data.maxInstallments || 1);
                setIsShopEnabled(data.data.isShopEnabled ?? true);
                setPickupInstructions(data.data.pickupInstructions || '');
            } else {
                // Se não existir, usar defaults
                setMaxInstallments(1);
                setIsShopEnabled(true);
                setPickupInstructions('Retirada na secretaria, de segunda a sexta, das 8h às 17h.');
            }
        } catch (err) {
            console.error('Error loading settings:', err);
            setError('Erro ao carregar configurações');
            // Usar defaults em caso de erro
            setMaxInstallments(1);
            setIsShopEnabled(true);
            setPickupInstructions('Retirada na secretaria, de segunda a sexta, das 8h às 17h.');
        } finally {
            setLoading(false);
        }
    }, [unitId]);

    useEffect(() => {
        if (unitId) {
            loadSettings();
        }
    }, [unitId, loadSettings]);

    const handleSave = async () => {
        if (!unitId) return;

        try {
            setSaving(true);
            setError(null);

            const response = await apiFetch(`/api/shop/admin/settings/${unitId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    maxInstallments,
                    isShopEnabled,
                    pickupInstructions: pickupInstructions || null,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSettings(data.data);
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                setError(data.error?.message || 'Erro ao salvar configurações');
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            setError('Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    const installmentOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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

            {/* Error Alert */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Status da Loja */}
                <div className="admin-card">
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isShopEnabled ? 'bg-emerald-100' : 'bg-slate-100'
                            }`}>
                            <Power className={`w-5 h-5 ${isShopEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-800">Status da Loja</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                            <div>
                                <p className="font-medium text-slate-800">Loja Habilitada</p>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {isShopEnabled
                                        ? 'Clientes podem fazer compras'
                                        : 'Loja está temporariamente fechada'
                                    }
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsShopEnabled(!isShopEnabled)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#A3D154] focus:ring-offset-2 ${isShopEnabled ? 'bg-[#A3D154]' : 'bg-slate-200'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isShopEnabled ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                />
                            </button>
                        </div>
                        {!isShopEnabled && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-sm text-amber-700">
                                    ⚠️ Quando desabilitada, a loja exibirá uma mensagem de manutenção para os clientes.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Parcelamento */}
                <div className="admin-card">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-800">Parcelamento</h2>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Número Máximo de Parcelas
                            </label>
                            <select
                                value={maxInstallments}
                                onChange={(e) => setMaxInstallments(parseInt(e.target.value))}
                                className="form-input"
                            >
                                {installmentOptions.map((n) => (
                                    <option key={n} value={n}>
                                        {n}x {n === 1 ? '(à vista)' : 'sem juros'}
                                    </option>
                                ))}
                            </select>
                            <p className="text-sm text-slate-500 mt-2">
                                Define até quantas parcelas os clientes podem dividir no cartão de crédito.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Instruções de Retirada */}
                <div className="admin-card lg:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                            <Store className="w-5 h-5 text-purple-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-800">Instruções de Retirada</h2>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Texto exibido no voucher do cliente
                            </label>
                            <textarea
                                value={pickupInstructions}
                                onChange={(e) => setPickupInstructions(e.target.value)}
                                className="form-input min-h-[120px] resize-none"
                                placeholder="Ex: Retirada na secretaria, de segunda a sexta, das 8h às 17h."
                            />
                            <p className="text-sm text-slate-500 mt-2">
                                Essas instruções serão exibidas no voucher de compra após a confirmação do pagamento.
                            </p>
                        </div>

                        {/* Preview */}
                        {pickupInstructions && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-slate-700 mb-2">Prévia do Voucher:</p>
                                <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{pickupInstructions}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Aviso */}
                <div className="admin-card lg:col-span-2 bg-amber-50 border-amber-100">
                    <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-800">Atenção</p>
                            <p className="text-sm text-amber-700 mt-1">
                                As alterações nas configurações afetam imediatamente o funcionamento da loja.
                                Certifique-se de que as informações estão corretas antes de salvar.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
