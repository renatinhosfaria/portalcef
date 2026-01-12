'use client';

import { Button } from '@essencia/ui/components/button';
import { Input } from '@essencia/ui/components/input';
import { Label } from '@essencia/ui/components/label';
import { Sheet } from '@essencia/ui/components/sheet';
import { AlertCircle, ArrowLeft, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface Variant {
    id: string;
    size: string;
    sku: string | null;
    priceOverride: number | null;
    isActive: boolean;
}

interface Product {
    id: string;
    name: string;
    basePrice: number;
    category: string;
    variants: Variant[];
}

export default function VariantesPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.id as string;

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [variantToEdit, setVariantToEdit] = useState<Variant | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        size: '',
        sku: '',
        priceOverride: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState(false);

    const loadProduct = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/shop/admin/products/${productId}/variants`);

            if (!response.ok) {
                console.warn('Produto não encontrado:', response.status);
                setProduct(null);
                return;
            }

            const result = await response.json();
            setProduct(result.data || null);
        } catch (err) {
            console.warn('Erro ao carregar produto.', err);
            setProduct(null);
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        loadProduct();
    }, [loadProduct]);

    const formatCurrency = (cents: number) => {
        return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const handleCreateClick = () => {
        setVariantToEdit(null);
        setFormData({
            size: '',
            sku: '',
            priceOverride: '',
        });
        setFormError(null);
        setFormSuccess(false);
        setIsFormOpen(true);
    };

    const handleEditClick = (variant: Variant) => {
        setVariantToEdit(variant);
        setFormData({
            size: variant.size,
            sku: variant.sku || '',
            priceOverride: variant.priceOverride ? (variant.priceOverride / 100).toFixed(2) : '',
        });
        setFormError(null);
        setFormSuccess(false);
        setIsFormOpen(true);
    };

    const handleClose = () => {
        setIsFormOpen(false);
        setVariantToEdit(null);
        setFormError(null);
        setFormSuccess(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError(null);

        try {
            if (!formData.size.trim()) {
                setFormError('Tamanho é obrigatório.');
                setIsSubmitting(false);
                return;
            }

            const priceValue = formData.priceOverride ? parseFloat(formData.priceOverride) : null;
            if (formData.priceOverride && (isNaN(priceValue!) || priceValue! <= 0)) {
                setFormError('Preço deve ser maior que zero.');
                setIsSubmitting(false);
                return;
            }

            const payload = {
                productId,
                size: formData.size.trim().toUpperCase(),
                sku: formData.sku.trim() || null,
                priceOverride: priceValue ? Math.round(priceValue * 100) : null,
                isActive: true,
            };

            const isEditing = !!variantToEdit;
            const url = isEditing
                ? `/api/shop/admin/variants/${variantToEdit.id}`
                : '/api/shop/admin/variants';
            const method = isEditing ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Falha ao salvar variante');
            }

            setFormSuccess(true);
            router.refresh();

            setTimeout(() => {
                handleClose();
                loadProduct();
            }, 1000);
        } catch (err) {
            console.error(err);
            setFormError(err instanceof Error ? err.message : 'Erro ao salvar variante.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteVariant = async (variantId: string, size: string) => {
        const confirmed = window.confirm(`Excluir a variante tamanho "${size}"?\n\nEsta ação não pode ser desfeita.`);
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/shop/admin/variants/${variantId}`, {
                method: 'DELETE',
            });

            if (!res.ok && res.status !== 204) {
                throw new Error('Falha ao excluir');
            }

            loadProduct();
        } catch (err) {
            console.error(err);
            alert('Erro ao excluir variante');
        }
    };

    const isEditing = !!variantToEdit;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-[#A3D154] animate-spin" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Produto não encontrado</p>
                <Link href="/produtos" className="text-[#A3D154] hover:underline mt-4 inline-block">
                    Voltar para produtos
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/produtos"
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">{product.name}</h1>
                    <p className="text-slate-500 text-sm">
                        Preço base: {formatCurrency(product.basePrice)} • Gerenciar tamanhos/variantes
                    </p>
                </div>
                <Button
                    onClick={handleCreateClick}
                    className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Variante
                </Button>
            </div>

            {/* Variants Table */}
            <div className="admin-card">
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tamanho</th>
                                <th>SKU</th>
                                <th>Preço</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {product.variants.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">📏</div>
                                            <div className="empty-state-title">Nenhuma variante cadastrada</div>
                                            <div className="empty-state-description">
                                                Clique em &quot;Nova Variante&quot; para adicionar tamanhos
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                product.variants.map((variant) => (
                                    <tr key={variant.id}>
                                        <td className="font-semibold text-slate-800">{variant.size}</td>
                                        <td className="text-slate-500">{variant.sku || '-'}</td>
                                        <td className="font-medium">
                                            {variant.priceOverride
                                                ? formatCurrency(variant.priceOverride)
                                                : formatCurrency(product.basePrice) + ' (padrão)'}
                                        </td>
                                        <td>
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${variant.isActive
                                                ? 'bg-[#A3D154]/20 text-[#5a7a1f]'
                                                : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {variant.isActive ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEditClick(variant)}
                                                    className="btn-admin btn-admin-secondary btn-admin-sm"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => deleteVariant(variant.id, variant.size)}
                                                    className="btn-admin btn-admin-ghost btn-admin-sm text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    title="Excluir variante"
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

            {/* Variant Form Sheet */}
            <Sheet
                isOpen={isFormOpen}
                onClose={handleClose}
                title={isEditing ? 'Editar Variante' : 'Nova Variante'}
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
                            Variante salva com sucesso!
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="size">Tamanho</Label>
                        <Input
                            id="size"
                            placeholder="Ex: P, M, G, GG, 2, 4, 6, 8"
                            required
                            value={formData.size}
                            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                        />
                        <p className="text-xs text-slate-500">
                            O tamanho será convertido para maiúsculas
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sku">SKU (Opcional)</Label>
                        <Input
                            id="sku"
                            placeholder="Ex: CAM-POLO-P-001"
                            value={formData.sku}
                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        />
                        <p className="text-xs text-slate-500">
                            Código interno para controle de estoque
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="priceOverride">Preço Específico (Opcional)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-medium">R$</span>
                            <Input
                                id="priceOverride"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Deixe vazio para usar preço base"
                                className="pl-10"
                                value={formData.priceOverride}
                                onChange={(e) => setFormData({ ...formData, priceOverride: e.target.value })}
                            />
                        </div>
                        <p className="text-xs text-slate-500">
                            Se preenchido, substitui o preço base ({formatCurrency(product.basePrice)})
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
                                isEditing ? 'Salvar Alterações' : 'Criar Variante'
                            )}
                        </Button>
                    </div>
                </form>
            </Sheet>
        </div>
    );
}
