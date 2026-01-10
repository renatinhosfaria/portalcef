'use client';

import { Search, Plus, Settings, History, Package, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface InventoryItem {
    variantId: string;
    productName: string;
    size: string;
    quantity: number;
    reservedQuantity: number;
    lowStockThreshold: number;
}

export default function EstoquePage() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<InventoryItem | null>(null);

    useEffect(() => {
        loadInventory();
    }, []);

    const loadInventory = async () => {
        try {
            setLoading(true);
            // TODO: Call real API GET /shop/admin/inventory
            await new Promise(resolve => setTimeout(resolve, 500));

            setInventory([
                { variantId: '1', productName: 'Camiseta Uniforme Diário', size: '8', quantity: 15, reservedQuantity: 2, lowStockThreshold: 5 },
                { variantId: '2', productName: 'Camiseta Uniforme Diário', size: '10', quantity: 3, reservedQuantity: 0, lowStockThreshold: 5 },
                { variantId: '3', productName: 'Calça Uniforme Diário', size: '8', quantity: 20, reservedQuantity: 1, lowStockThreshold: 5 },
                { variantId: '4', productName: 'Calça Uniforme Diário', size: '10', quantity: 2, reservedQuantity: 0, lowStockThreshold: 5 },
                { variantId: '5', productName: 'Camiseta Ed. Física', size: '6', quantity: 0, reservedQuantity: 0, lowStockThreshold: 5 },
            ]);
        } catch (err) {
            console.error('Error loading inventory:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredInventory = inventory.filter(item =>
        item.productName.toLowerCase().includes(search.toLowerCase()) ||
        item.size.includes(search)
    );

    const getStockStatus = (item: InventoryItem) => {
        const available = item.quantity - item.reservedQuantity;
        if (available === 0) return { class: 'badge-danger', label: 'Sem Estoque' };
        if (available <= item.lowStockThreshold) return { class: 'badge-warning', label: 'Estoque Baixo' };
        return { class: 'badge-success', label: 'Disponível' };
    };

    const totalInStock = inventory.reduce((sum, i) => sum + i.quantity, 0);
    const totalReserved = inventory.reduce((sum, i) => sum + i.reservedQuantity, 0);
    const lowStockCount = inventory.filter(i => i.quantity - i.reservedQuantity <= i.lowStockThreshold).length;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestão de Estoque</h1>
                <p className="text-slate-500 mt-1">Controle de entrada, ajuste e movimentações</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Total em Estoque</p>
                            <p className="stat-card-value">{totalInStock}</p>
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
                                <th>Quantidade</th>
                                <th>Reservado</th>
                                <th>Disponível</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12">
                                        <div className="loading-spinner-admin mx-auto"></div>
                                    </td>
                                </tr>
                            ) : filteredInventory.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
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
                                    const available = item.quantity - item.reservedQuantity;
                                    const status = getStockStatus(item);
                                    const isLow = available <= item.lowStockThreshold;

                                    return (
                                        <tr key={item.variantId} className={isLow ? 'bg-red-50/50' : ''}>
                                            <td className="font-semibold text-slate-800">{item.productName}</td>
                                            <td>
                                                <span className="badge badge-neutral">{item.size}</span>
                                            </td>
                                            <td className="font-mono text-slate-700">{item.quantity}</td>
                                            <td className="font-mono text-amber-600">{item.reservedQuantity}</td>
                                            <td className="font-mono font-bold text-slate-800">{available}</td>
                                            <td>
                                                <span className={`badge ${status.class}`}>{status.label}</span>
                                            </td>
                                            <td>
                                                <div className="flex gap-2">
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
                                <p className="text-sm text-slate-500">Tamanho {selectedVariant.size}</p>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="form-label">Quantidade</label>
                                    <input type="number" min="1" defaultValue="1" className="form-input" />
                                </div>
                                <div>
                                    <label className="form-label">Observação</label>
                                    <input type="text" placeholder="Ex: Compra fornecedor X" className="form-input" />
                                </div>
                            </div>
                            
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowEntryModal(false)} className="btn-admin btn-admin-secondary flex-1">
                                    Cancelar
                                </button>
                                <button 
                                    onClick={() => { 
                                        window.alert('Entrada registrada!'); 
                                        setShowEntryModal(false); 
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
        </div>
    );
}
