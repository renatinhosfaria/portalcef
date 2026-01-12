'use client';

import { Plus, Trash2, ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Variant {
    id: string;
    size: string;
    price: number;
}

interface Product {
    id: string;
    name: string;
    basePrice: number;
    variants: Variant[];
}

interface CartItem {
    variantId: string;
    productName: string;
    variantSize: string;
    studentName: string;
    quantity: number;
    unitPrice: number;
}

export default function VendaPresencialPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    const [items, setItems] = useState<CartItem[]>([]);
    const [studentName, setStudentName] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(''); // Product ID
    const [selectedVariantId, setSelectedVariantId] = useState(''); // Variant ID
    const [quantity, setQuantity] = useState(1);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Load products on mount
    useEffect(() => {
        async function fetchProducts() {
            try {
                const res = await fetch('/api/shop/admin/products');
                if (res.ok) {
                    const data = await res.json();
                    setProducts(data.data || []);
                }
            } catch (err) {
                console.error("Failed to load products", err);
            } finally {
                setLoadingProducts(false);
            }
        }
        fetchProducts();
    }, []);

    const activeProduct = products.find(p => p.id === selectedProduct);
    const totalAmount = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    const addItem = () => {
        if (!selectedProduct || !selectedVariantId || !studentName || quantity < 1) {
            alert('Preencha todos os campos do item');
            return;
        }

        const product = products.find(p => p.id === selectedProduct);
        if (!product) return;

        const variant = product.variants.find(v => v.id === selectedVariantId);
        if (!variant) return;

        const newItem: CartItem = {
            variantId: variant.id,
            productName: product.name,
            variantSize: variant.size,
            studentName,
            quantity,
            unitPrice: variant.price || product.basePrice,
        };

        setItems([...items, newItem]);
        // Reset item fields but keep student name as it might be same student
        setSelectedProduct('');
        setSelectedVariantId('');
        setQuantity(1);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (items.length === 0) {
            alert('Adicione pelo menos um item');
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                customerName,
                customerPhone: customerPhone.replace(/\D/g, ''), // Send digits only
                paymentMethod: 'DINHEIRO', // TODO: Allow selecting method (PIX, DEBIT, CREDIT)
                items: items.map(item => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    studentName: item.studentName
                }))
            };

            const res = await fetch('/api/shop/admin/orders/presencial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Erro ao registrar venda');
            }

            setSuccess(true);
            setItems([]);
            setStudentName('');
            setCustomerName('');
            setCustomerPhone('');
            window.scrollTo(0, 0);
            setTimeout(() => setSuccess(false), 5000);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao registrar venda';
            alert(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (cents: number) => {
        return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Venda Presencial</h1>
                <p className="text-slate-500 mt-1">Registrar venda realizada no balcão (baixa automática de estoque)</p>
            </div>

            {success && (
                <div className="flex items-center gap-3 bg-[#A3D154]/20 border border-[#A3D154] text-[#5a7a1f] px-4 py-3 rounded-xl animate-in fade-in slide-in-from-top-4">
                    <CheckCircle className="w-5 h-5" />
                    Venda registrada com sucesso!
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h2 className="admin-card-title">Adicionar Itens</h2>
                    </div>
                    <div className="admin-card-body space-y-4">
                        {loadingProducts ? (
                            <div className="py-8 text-center text-slate-500">Carregando produtos...</div>
                        ) : (
                            <>
                                <div>
                                    <label className="form-label">Nome do Aluno *</label>
                                    <input
                                        type="text"
                                        value={studentName}
                                        onChange={(e) => setStudentName(e.target.value)}
                                        className="form-input"
                                        placeholder="Ex: João da Silva"
                                    />
                                </div>

                                <div>
                                    <label className="form-label">Produto *</label>
                                    <select
                                        value={selectedProduct}
                                        onChange={(e) => {
                                            setSelectedProduct(e.target.value);
                                            setSelectedVariantId('');
                                        }}
                                        className="form-select"
                                    >
                                        <option value="">Selecione um produto</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.basePrice)}</option>
                                        ))}
                                    </select>
                                </div>

                                {activeProduct && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Tamanho *</label>
                                            <select
                                                value={selectedVariantId}
                                                onChange={(e) => setSelectedVariantId(e.target.value)}
                                                className="form-select"
                                            >
                                                <option value="">Selecione</option>
                                                {activeProduct.variants?.map(v => (
                                                    <option key={v.id} value={v.id}>
                                                        {v.size} {v.price && v.price !== activeProduct.basePrice ? `(${formatCurrency(v.price)})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Quantidade *</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={quantity}
                                                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                                className="form-input"
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={addItem}
                                    disabled={!selectedProduct || !selectedVariantId || !studentName}
                                    className="btn-admin btn-admin-secondary w-full"
                                >
                                    <Plus className="w-4 h-4" />
                                    Adicionar Item
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Cart Summary */}
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h2 className="admin-card-title flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5" />
                            Carrinho
                        </h2>
                    </div>
                    <div className="admin-card-body">
                        {items.length === 0 ? (
                            <div className="empty-state py-8">
                                <div className="empty-state-icon">🛒</div>
                                <div className="empty-state-title">Carrinho vazio</div>
                                <div className="empty-state-description">Adicione itens para iniciar a venda</div>
                            </div>
                        ) : (
                            <div className="space-y-3 mb-6">
                                {items.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div>
                                            <p className="font-semibold text-slate-800">{item.productName}</p>
                                            <p className="text-sm text-slate-500">
                                                Tam: {item.variantSize} | Qtd: {item.quantity} | {item.studentName}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-semibold text-[#A3D154]">
                                                {formatCurrency(item.unitPrice * item.quantity)}
                                            </span>
                                            <button
                                                onClick={() => removeItem(index)}
                                                className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {items.length > 0 && (
                            <div className="border-t border-slate-200 pt-4">
                                <div className="flex justify-between items-center text-xl font-bold mb-6">
                                    <span>Total:</span>
                                    <span className="text-[#A3D154]">{formatCurrency(totalAmount)}</span>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="form-label">Nome do Responsável *</label>
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            className="form-input"
                                            placeholder="Nome completo"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Telefone *</label>
                                        <input
                                            type="tel"
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                            className="form-input"
                                            placeholder="(00) 00000-0000"
                                            required
                                        />
                                    </div>

                                    <div className="bg-amber-50 p-4 rounded-lg flex gap-3 text-sm text-amber-800">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <p>Esta ação baixa o estoque imediatamente e gera um pedido com status &quot;PAGO&quot;.</p>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="btn-admin btn-admin-primary w-full"
                                    >
                                        {submitting ? 'Processando...' : 'Finalizar Venda Presencial'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
