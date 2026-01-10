'use client';

import { Plus, Edit, Layers, ToggleLeft, ToggleRight, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Product {
    id: string;
    name: string;
    category: string;
    basePrice: number;
    imageUrl?: string;
    isActive: boolean;
    variantsCount: number;
}

export default function ProdutosPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            setLoading(true);
            // TODO: Call real API GET /shop/admin/products
            await new Promise(resolve => setTimeout(resolve, 500));

            setProducts([
                { id: '1', name: 'Camiseta Uniforme Diário', category: 'UNIFORME_DIARIO', basePrice: 4500, isActive: true, variantsCount: 8 },
                { id: '2', name: 'Calça Uniforme Diário', category: 'UNIFORME_DIARIO', basePrice: 5500, isActive: true, variantsCount: 8 },
                { id: '3', name: 'Camiseta Ed. Física', category: 'UNIFORME_EDUCACAO_FISICA', basePrice: 3500, isActive: true, variantsCount: 8 },
                { id: '4', name: 'Short Ed. Física', category: 'UNIFORME_EDUCACAO_FISICA', basePrice: 2500, isActive: true, variantsCount: 8 },
                { id: '5', name: 'Meia Escolar', category: 'ACESSORIO', basePrice: 1000, isActive: false, variantsCount: 3 },
            ]);
        } catch (err) {
            console.error('Error loading products:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (cents: number) => {
        return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const getCategoryLabel = (category: string) => {
        const labels: Record<string, string> = {
            UNIFORME_DIARIO: 'Uniforme Diário',
            UNIFORME_EDUCACAO_FISICA: 'Ed. Física',
            ACESSORIO: 'Acessório',
        };
        return labels[category] || category;
    };

    const toggleActive = async (productId: string) => {
        // TODO: Call real API to toggle active status
        setProducts(products.map(p =>
            p.id === productId ? { ...p, isActive: !p.isActive } : p
        ));
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestão de Produtos</h1>
                    <p className="text-slate-500 mt-1">Gerencie o catálogo de uniformes</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-admin btn-admin-primary">
                    <Plus className="w-4 h-4" />
                    Novo Produto
                </button>
            </div>

            {/* Products Table */}
            <div className="admin-card">
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Categoria</th>
                                <th>Preço Base</th>
                                <th>Variantes</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12">
                                        <div className="loading-spinner-admin mx-auto"></div>
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">📦</div>
                                            <div className="empty-state-title">Nenhum produto cadastrado</div>
                                            <div className="empty-state-description">
                                                Clique em &quot;Novo Produto&quot; para começar
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => (
                                    <tr key={product.id}>
                                        <td className="font-semibold text-slate-800">{product.name}</td>
                                        <td>
                                            <span className="badge badge-info">
                                                {getCategoryLabel(product.category)}
                                            </span>
                                        </td>
                                        <td className="font-medium">{formatCurrency(product.basePrice)}</td>
                                        <td className="text-slate-600">{product.variantsCount} tamanhos</td>
                                        <td>
                                            <button
                                                onClick={() => toggleActive(product.id)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                                                    product.isActive 
                                                        ? 'bg-[#A3D154]/20 text-[#5a7a1f]' 
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}
                                            >
                                                {product.isActive ? (
                                                    <><ToggleRight className="w-4 h-4" /> Ativo</>
                                                ) : (
                                                    <><ToggleLeft className="w-4 h-4" /> Inativo</>
                                                )}
                                            </button>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button className="btn-admin btn-admin-ghost btn-admin-sm">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <Link
                                                    href={`/produtos/${product.id}/variantes`}
                                                    className="btn-admin btn-admin-secondary btn-admin-sm"
                                                >
                                                    <Layers className="w-4 h-4" />
                                                    Variantes
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">Novo Produto</h3>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-500 mb-4">Formulário de criação de produto em construção...</p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowModal(false)} className="btn-admin btn-admin-secondary flex-1">
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
