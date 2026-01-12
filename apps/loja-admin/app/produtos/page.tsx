'use client';

import { Button } from '@essencia/ui/components/button';
import { Input } from '@essencia/ui/components/input';
import { Label } from '@essencia/ui/components/label';
import { Sheet } from '@essencia/ui/components/sheet';
import { useTenant } from '@essencia/shared/providers/tenant';
import { AlertCircle, Check, Loader2, Package, Plus, Edit, Layers, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ImageUploader } from '../../components/ImageUploader';

interface Product {
    id: string;
    name: string;
    category: string;
    basePrice: number;
    description?: string;
    imageUrl?: string;
    images?: string[];
    isActive: boolean;
    variantsCount: number;
}

const CATEGORY_OPTIONS = [
    { value: 'UNIFORME_DIARIO', label: 'Uniforme Diário' },
    { value: 'UNIFORME_EDUCACAO_FISICA', label: 'Educação Física' },
    { value: 'ACESSORIO', label: 'Acessório' },
];

export default function ProdutosPage() {
    const router = useRouter();
    const { schoolId } = useTenant();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        category: 'UNIFORME_DIARIO',
        basePrice: '',
        description: '',
        images: [] as string[],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState(false);

    const loadProducts = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/shop/admin/products');

            if (!response.ok) {
                console.warn('API de produtos não disponível:', response.status);
                setProducts([]);
                return;
            }

            const result = await response.json();
            setProducts(result.data || []);
        } catch (err) {
            console.warn('Não foi possível carregar produtos.', err);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const formatCurrency = (cents: number) => {
        return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const getCategoryLabel = (category: string) => {
        const found = CATEGORY_OPTIONS.find(c => c.value === category);
        return found?.label || category;
    };

    const handleCreateClick = () => {
        setProductToEdit(null);
        setFormData({
            name: '',
            category: 'UNIFORME_DIARIO',
            basePrice: '',
            description: '',
            images: [],
        });
        setFormError(null);
        setFormSuccess(false);
        setIsFormOpen(true);
    };

    const handleEditClick = (product: Product) => {
        setProductToEdit(product);
        setFormData({
            name: product.name,
            category: product.category,
            basePrice: (product.basePrice / 100).toFixed(2),
            description: product.description || '',
            images: product.images && product.images.length > 0
                ? product.images
                : (product.imageUrl ? [product.imageUrl] : []),
        });
        setFormError(null);
        setFormSuccess(false);
        setIsFormOpen(true);
    };

    const handleClose = () => {
        setIsFormOpen(false);
        setProductToEdit(null);
        setFormError(null);
        setFormSuccess(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError(null);

        try {
            // Validate
            if (!formData.name.trim()) {
                setFormError('Nome do produto é obrigatório.');
                setIsSubmitting(false);
                return;
            }

            const priceValue = parseFloat(formData.basePrice);
            if (isNaN(priceValue) || priceValue <= 0) {
                setFormError('Preço base deve ser maior que zero.');
                setIsSubmitting(false);
                return;
            }

            if (!schoolId) {
                setFormError('School ID não encontrado. Faça login novamente.');
                setIsSubmitting(false);
                return;
            }

            const isEditing = !!productToEdit;

            // Build payload - schoolId only for create
            const basePayload = {
                name: formData.name.trim(),
                category: formData.category,
                basePrice: Math.round(priceValue * 100), // cents
                description: formData.description.trim() || undefined,
                imageUrl: formData.images[0] || undefined,
                images: formData.images,
            };

            const payload = isEditing
                ? basePayload
                : { ...basePayload, schoolId, isActive: true };

            const url = isEditing
                ? `/api/shop/admin/products/${productToEdit.id}`
                : '/api/shop/admin/products';
            const method = isEditing ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Falha ao salvar produto');
            }

            setFormSuccess(true);
            router.refresh();

            setTimeout(() => {
                handleClose();
                loadProducts();
            }, 1000);
        } catch (err) {
            console.error(err);
            setFormError(err instanceof Error ? err.message : 'Erro ao salvar produto.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleActive = async (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        try {
            const res = await fetch(`/api/shop/admin/products/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !product.isActive })
            });

            if (!res.ok) throw new Error('Falha ao atualizar');

            setProducts(products.map(p =>
                p.id === productId ? { ...p, isActive: !product.isActive } : p
            ));
        } catch (err) {
            console.error(err);
            alert('Erro ao atualizar status do produto');
        }
    };

    const deleteProduct = async (productId: string, productName: string) => {
        const confirmed = window.confirm(`Tem certeza que deseja excluir o produto "${productName}"?\n\nEsta ação não pode ser desfeita.`);
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/shop/admin/products/${productId}`, {
                method: 'DELETE',
            });

            if (!res.ok && res.status !== 204) {
                throw new Error('Falha ao excluir');
            }

            setProducts(products.filter(p => p.id !== productId));
        } catch (err) {
            console.error(err);
            alert('Erro ao excluir produto');
        }
    };

    const isEditing = !!productToEdit;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestão de Produtos</h1>
                    <p className="text-slate-500 mt-1">Gerencie o catálogo de uniformes</p>
                </div>
                <Button
                    onClick={handleCreateClick}
                    className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Produto
                </Button>
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
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${product.isActive
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
                                                <button
                                                    onClick={() => handleEditClick(product)}
                                                    className="btn-admin btn-admin-ghost btn-admin-sm"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <Link
                                                    href={`/produtos/${product.id}/variantes`}
                                                    className="btn-admin btn-admin-secondary btn-admin-sm"
                                                >
                                                    <Layers className="w-4 h-4" />
                                                    Variantes
                                                </Link>
                                                <button
                                                    onClick={() => deleteProduct(product.id, product.name)}
                                                    className="btn-admin btn-admin-ghost btn-admin-sm text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    title="Excluir produto"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Product Form Sheet */}
            <Sheet
                isOpen={isFormOpen}
                onClose={handleClose}
                title={isEditing ? 'Editar Produto' : 'Novo Produto'}
            >
                <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                    {formError && (
                        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {formError}
                        </div>
                    )}

                    {formSuccess && (
                        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
                            <Check className="w-4 h-4 shrink-0" />
                            Produto salvo com sucesso!
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="name">Nome do Produto</Label>
                        <div className="relative">
                            <Package className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                            <Input
                                id="name"
                                placeholder="Ex: Camiseta Polo Manga Curta"
                                required
                                className="pl-10"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Categoria</Label>
                        <select
                            id="category"
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        >
                            {CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="basePrice">Preço Base (R$)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-medium">R$</span>
                            <Input
                                id="basePrice"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0,00"
                                required
                                className="pl-10"
                                value={formData.basePrice}
                                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                            />
                        </div>
                        <p className="text-xs text-slate-500">
                            Este é o preço padrão. Variantes podem ter preços diferentes.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição (Opcional)</Label>
                        <textarea
                            id="description"
                            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                            placeholder="Descrição do produto..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Imagens do Produto</Label>
                        <ImageUploader
                            value={formData.images}
                            onChange={(images) => setFormData({ ...formData, images })}
                            maxFiles={5}
                        />
                        <p className="text-xs text-slate-500">
                            A primeira imagem será usada como imagem principal.
                        </p>
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={handleClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold min-w-[140px]"
                            disabled={isSubmitting || formSuccess}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : formSuccess ? (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Salvo!
                                </>
                            ) : (
                                isEditing ? 'Salvar Alterações' : 'Criar Produto'
                            )}
                        </Button>
                    </div>
                </form>
            </Sheet>
        </div>
    );
}
