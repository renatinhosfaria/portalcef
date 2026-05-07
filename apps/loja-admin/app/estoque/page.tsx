'use client';

import { useTenant } from '@essencia/shared/providers/tenant';
import { Search, Plus, Minus, Settings, History, Package, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiFetch } from '../../lib/api';
import { getInventoryRowKey, getInventoryUnitLabel } from '../../lib/inventory';
import { canManageInventory } from '../../lib/permissions';

interface InventoryItem {
    variantId: string;
    productName: string;
    variantSize: string;
    reservedQuantity: number;
    available: number;
    totalSold: number;
    lowStockThreshold: number;
    unitId: string;
    unitName?: string | null;
    needsRestock: boolean;
}

export default function EstoquePage() {
    const { role } = useTenant();
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<InventoryItem | null>(null);

    useEffect(() => {
        loadInventory();
    }, []);

    const loadInventory = async () => {
        try {
            setLoading(true);
            const response = await apiFetch('/api/shop/admin/inventory');

            if (!response.ok) {
                console.warn('API de estoque não disponível:', response.status);
                setInventory([]);
                return;
            }

            const result = await response.json();
            setInventory(result.data || []);
        } catch (err) {
            console.warn('Não foi possível carregar estoque. API ainda não implementada?', err);
            setInventory([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredInventory = inventory.filter(item =>
        item.productName.toLowerCase().includes(search.toLowerCase()) ||
        item.variantSize.includes(search)
    );

    const getStockStatus = (item: InventoryItem) => {
        if (item.available === 0) return { class: 'badge-danger', label: 'Sem Estoque' };
        if (item.needsRestock) return { class: 'badge-warning', label: 'Estoque Baixo' };
        return { class: 'badge-success', label: 'Disponível' };
    };

    const totalAvailable = inventory.reduce((sum, i) => sum + i.available, 0);
    const totalReserved = inventory.reduce((sum, i) => sum + i.reservedQuantity, 0);
    const totalSold = inventory.reduce((sum, i) => sum + i.totalSold, 0);
    const lowStockCount = inventory.filter(i => i.needsRestock).length;
    const canManageStock = canManageInventory(role);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestão de Estoque</h1>
                <p className="text-slate-500 mt-1">Controle de entrada, saída e movimentações</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Disponível</p>
                            <p className="stat-card-value">{totalAvailable}</p>
                        </div>
                        <div className="stat-card-icon bg-[#A3D154]/20 text-[#5a7a1f]">
                            <Package className="w-6 h-6" />
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Reservados</p>
                            <p className="stat-card-value text-amber-600">{totalReserved}</p>
                        </div>
                        <div className="stat-card-icon bg-amber-100 text-amber-600">
                            <Package className="w-6 h-6" />
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Total Vendido</p>
                            <p className="stat-card-value text-emerald-600">{totalSold}</p>
                        </div>
                        <div className="stat-card-icon bg-emerald-100 text-emerald-600">
                            <Package className="w-6 h-6" />
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Alertas Baixo Estoque</p>
                            <p className="stat-card-value text-red-600">{lowStockCount}</p>
                        </div>
                        <div className="stat-card-icon bg-red-100 text-red-600">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="filter-bar">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por produto ou tamanho..."
                        value={search}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                        className="form-input pl-11"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="admin-card">
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Tamanho</th>
                                <th>Unidade</th>
                                <th>Reservado</th>
                                <th>Disponível</th>
                                <th>Vendido</th>
                                <th>Status</th>
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
                            ) : filteredInventory.length === 0 ? (
                                <tr>
                                    <td colSpan={8}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">📦</div>
                                            <div className="empty-state-title">Nenhum item encontrado</div>
                                            <div className="empty-state-description">
                                                Tente ajustar os filtros de busca
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredInventory.map((item) => {
                                    const status = getStockStatus(item);

                                    return (
                                        <tr key={getInventoryRowKey(item)} className={item.needsRestock ? 'bg-red-50/50' : ''}>
                                            <td className="font-semibold text-slate-800">{item.productName}</td>
                                            <td>
                                                <span className="badge badge-neutral">{item.variantSize}</span>
                                            </td>
                                            <td className="text-sm text-slate-600">{getInventoryUnitLabel(item)}</td>
                                            <td className="font-mono text-amber-600">{item.reservedQuantity}</td>
                                            <td className="font-mono font-bold text-slate-800">{item.available}</td>
                                            <td className="font-mono text-emerald-600">{item.totalSold}</td>
                                            <td>
                                                <span className={`badge ${status.class}`}>{status.label}</span>
                                            </td>
                                            <td>
                                                <div className="flex gap-2">
                                                    {canManageStock && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedVariant(item);
                                                                    setShowEntryModal(true);
                                                                }}
                                                                className="btn-admin btn-admin-primary btn-admin-sm"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                                Entrada
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedVariant(item);
                                                                    setShowExitModal(true);
                                                                }}
                                                                className="btn-admin btn-admin-danger btn-admin-sm"
                                                            >
                                                                <Minus className="w-4 h-4" />
                                                                Saída
                                                            </button>
                                                        </>
                                                    )}
                                                    <button className="btn-admin btn-admin-ghost btn-admin-sm">
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                    <button className="btn-admin btn-admin-ghost btn-admin-sm">
                                                        <History className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Entry Modal */}
            {showEntryModal && selectedVariant && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">Entrada de Estoque</h3>
                            <button
                                onClick={() => setShowEntryModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="bg-slate-50 rounded-xl p-4 mb-6">
                                <p className="font-semibold text-slate-800">{selectedVariant.productName}</p>
                                <p className="text-sm text-slate-500">Tamanho {selectedVariant.variantSize}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="form-label">Quantidade</label>
                                    <input id="entry-quantity" type="number" min="1" defaultValue="1" className="form-input" />
                                </div>
                                <div>
                                    <label className="form-label">Observação</label>
                                    <input id="entry-notes" type="text" placeholder="Ex: Compra fornecedor X" className="form-input" />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowEntryModal(false)} className="btn-admin btn-admin-secondary flex-1">
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            const quantityInput = document.getElementById('entry-quantity') as HTMLInputElement;
                                            const notesInput = document.getElementById('entry-notes') as HTMLInputElement;
                                            const quantity = parseInt(quantityInput.value) || 0;

                                            if (quantity <= 0) {
                                                alert('Quantidade deve ser maior que zero');
                                                return;
                                            }

                                            const res = await apiFetch('/api/shop/admin/inventory/entry', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    variantId: selectedVariant.variantId,
                                                    unitId: selectedVariant.unitId,
                                                    quantity,
                                                    notes: notesInput.value
                                                })
                                            });

                                            if (!res.ok) throw new Error('Falha ao registrar entrada');

                                            alert('Entrada registrada com sucesso!');
                                            setShowEntryModal(false);
                                            loadInventory();
                                        } catch (err) {
                                            console.error(err);
                                            alert('Erro ao registrar entrada');
                                        }
                                    }}
                                    className="btn-admin btn-admin-primary flex-1"
                                >
                                    Confirmar Entrada
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit Modal */}
            {showExitModal && selectedVariant && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">Saída de Estoque</h3>
                            <button
                                onClick={() => setShowExitModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="bg-slate-50 rounded-xl p-4 mb-6">
                                <p className="font-semibold text-slate-800">{selectedVariant.productName}</p>
                                <p className="text-sm text-slate-500">Tamanho {selectedVariant.variantSize}</p>
                                <p className="text-sm text-slate-500 mt-1">
                                    Disponível: <span className="font-semibold text-slate-700">{selectedVariant.available}</span>
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="form-label">Quantidade</label>
                                    <input
                                        id="exit-quantity"
                                        type="number"
                                        min="1"
                                        max={selectedVariant.available}
                                        defaultValue="1"
                                        className="form-input"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Motivo da Saída</label>
                                    <select id="exit-reason" className="form-input">
                                        <option value="VENDA_BALCAO">Venda Balcão</option>
                                        <option value="DANO">Dano/Avaria</option>
                                        <option value="PERDA">Perda/Extravio</option>
                                        <option value="AMOSTRA">Amostra</option>
                                        <option value="OUTROS">Outros</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Observação</label>
                                    <input
                                        id="exit-notes"
                                        type="text"
                                        placeholder="Ex: Produto com defeito de fábrica"
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowExitModal(false)} className="btn-admin btn-admin-secondary flex-1">
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            const quantityInput = document.getElementById('exit-quantity') as HTMLInputElement;
                                            const reasonSelect = document.getElementById('exit-reason') as HTMLSelectElement;
                                            const notesInput = document.getElementById('exit-notes') as HTMLInputElement;
                                            const quantity = parseInt(quantityInput.value) || 0;
                                            const available = selectedVariant.available;

                                            if (quantity <= 0) {
                                                alert('Quantidade deve ser maior que zero');
                                                return;
                                            }

                                            if (quantity > available) {
                                                alert(`Quantidade maior que o disponível (${available})`);
                                                return;
                                            }

                                            if (!notesInput.value.trim()) {
                                                alert('Observação é obrigatória para dar saída');
                                                return;
                                            }

                                            const res = await apiFetch('/api/shop/admin/inventory/exit', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    variantId: selectedVariant.variantId,
                                                    unitId: selectedVariant.unitId,
                                                    quantity,
                                                    reason: reasonSelect.value,
                                                    notes: notesInput.value
                                                })
                                            });

                                            if (!res.ok) {
                                                const data = await res.json();
                                                throw new Error(data.error?.message || 'Falha ao registrar saída');
                                            }

                                            alert('Saída registrada com sucesso!');
                                            setShowExitModal(false);
                                            loadInventory();
                                        } catch (err) {
                                            console.error(err);
                                            alert(err instanceof Error ? err.message : 'Erro ao registrar saída');
                                        }
                                    }}
                                    className="btn-admin btn-admin-danger flex-1"
                                >
                                    Confirmar Saída
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
