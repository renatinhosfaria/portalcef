'use client';

import { Plus, Trash2, ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

import { apiFetch } from '../../lib/api';

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

    // Multiple Payments State
    const [payments, setPayments] = useState<Array<{ method: string; amount: number }>>([]);
    const [currentPaymentMethod, setCurrentPaymentMethod] = useState<'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BRINDE'>('DINHEIRO');
    const [currentPaymentAmount, setCurrentPaymentAmount] = useState<number>(0);

    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Load products on mount
    useEffect(() => {
        async function fetchProducts() {
            try {
                const res = await apiFetch('/api/shop/admin/products');
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
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = Math.max(0, totalAmount - totalPaid);

    // Update default amount when remainder changes, but only if user hasn't typed 0 or something manually (simplified: just sync for now or let user type)
    useEffect(() => {
        if (remainingAmount > 0) {
            setCurrentPaymentAmount(remainingAmount);
        } else {
            setCurrentPaymentAmount(0);
        }
    }, [remainingAmount]);


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

    // Auto set value to 0 if Brinde
    useEffect(() => {
        if (currentPaymentMethod === 'BRINDE') {
            setCurrentPaymentAmount(0);
        } else if (currentPaymentAmount === 0 && remainingAmount > 0) {
            // Only auto-fill if amount is 0 (likely just switched back or new)
            setCurrentPaymentAmount(remainingAmount);
        }
    }, [currentPaymentMethod, remainingAmount]);

    const addPayment = () => {
        if (currentPaymentMethod !== 'BRINDE' && currentPaymentAmount <= 0) {
            alert('Valor do pagamento deve ser maior que zero');
            return;
        }
        if (currentPaymentMethod !== 'BRINDE' && currentPaymentAmount > remainingAmount) {
            alert(`Valor do pagamento não pode ser maior que o restante (${formatCurrency(remainingAmount)})`);
            return;
        }

        setPayments([...payments, { method: currentPaymentMethod, amount: currentPaymentAmount }]);
    };

    const removePayment = (index: number) => {
        setPayments(payments.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (items.length === 0) {
            alert('Adicione pelo menos um item');
            return;
        }

        let finalPayments = [...payments];

        // UX Shortcut: if no payments added, check if we can use the current inputs
        if (finalPayments.length === 0) {
            const isImplicitBrinde = currentPaymentMethod === 'BRINDE';
            const isImplicitFullPayment = currentPaymentAmount >= totalAmount;

            if (isImplicitBrinde || isImplicitFullPayment) {
                finalPayments = [{ method: currentPaymentMethod, amount: currentPaymentAmount }];
            }
        }

        const hasBrinde = finalPayments.some(p => p.method === 'BRINDE');
        const finalTotalPaid = finalPayments.reduce((acc, p) => acc + p.amount, 0);

        if (!hasBrinde && finalTotalPaid !== totalAmount) {
            alert(`Total pago (${formatCurrency(finalTotalPaid)}) deve ser igual ao total do pedido (${formatCurrency(totalAmount)})`);
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                customerName,
                customerPhone: customerPhone.replace(/\D/g, ''), // Send digits only
                items: items.map(item => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    studentName: item.studentName
                })),
                payments: finalPayments
            };

            const res = await apiFetch('/api/shop/admin/orders/presencial', {
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
            setPayments([]);
            setStudentName('');
            setCustomerName('');
            setCustomerPhone('');
            setCurrentPaymentMethod('DINHEIRO');
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

                                    {/* Multi Payment Section */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                        <h3 className="font-medium text-slate-800">Pagamento (Total: {formatCurrency(totalAmount)})</h3>

                                        {payments.length > 0 && (
                                            <div className="space-y-2">
                                                {payments.map((p, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-slate-100">
                                                        <span>{p.method.replace('_', ' ')}: {formatCurrency(p.amount)}</span>
                                                        <button onClick={() => removePayment(idx)} type="button" className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-200">
                                                    <span>Total Pago:</span>
                                                    <span className={remainingAmount === 0 ? "text-green-600" : "text-amber-600"}>
                                                        {formatCurrency(totalPaid)}
                                                    </span>
                                                </div>
                                                {remainingAmount > 0 && (
                                                    <div className="flex justify-between text-sm text-red-500">
                                                        <span>Restante:</span>
                                                        <span>{formatCurrency(remainingAmount)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {remainingAmount > 0 && (
                                            <div className="flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <label className="form-label text-xs">Forma</label>
                                                    <select
                                                        value={currentPaymentMethod}
                                                        onChange={(e) => setCurrentPaymentMethod(e.target.value as 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BRINDE')}
                                                        className="form-select text-sm h-10"
                                                    >
                                                        <option value="DINHEIRO">Dinheiro</option>
                                                        <option value="PIX">PIX</option>
                                                        <option value="CARTAO_DEBITO">Débito</option>
                                                        <option value="CARTAO_CREDITO">Crédito</option>
                                                        <option value="BRINDE">Brinde</option>
                                                    </select>
                                                </div>
                                                <div className="w-1/3">
                                                    <label className="form-label text-xs">Valor (R$)</label>
                                                    {/* Input handles raw numbers for cents conversation or just plain input. Using step 0.01 for decimal input */}
                                                    <input
                                                        type="number"
                                                        value={(currentPaymentAmount / 100).toFixed(2)}
                                                        onChange={(e) => setCurrentPaymentAmount(Math.round(parseFloat(e.target.value) * 100))}
                                                        className="form-input text-sm h-10"
                                                        step="0.01"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={addPayment}
                                                    className="btn-admin btn-admin-secondary h-10 px-3 flex items-center justify-center"
                                                    disabled={currentPaymentMethod !== 'BRINDE' && currentPaymentAmount <= 0}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>


                                    <div className="bg-amber-50 p-4 rounded-lg flex gap-3 text-sm text-amber-800">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <p>Esta ação baixa o estoque imediatamente e gera um pedido com status &quot;PAGO&quot;.</p>
                                    </div>

                                    {(() => {
                                        const hasBrinde = payments.some(p => p.method === 'BRINDE');

                                        // Implicit payment logic: if no payments added, but current input is valid to cover cost
                                        const isImplicitBrinde = payments.length === 0 && currentPaymentMethod === 'BRINDE';
                                        const isImplicitFullPayment = payments.length === 0 && currentPaymentAmount >= totalAmount;

                                        const canSubmit = remainingAmount === 0 || hasBrinde || isImplicitBrinde || isImplicitFullPayment;

                                        return (
                                            <button
                                                type="submit"
                                                disabled={submitting || !canSubmit}
                                                className="btn-admin btn-admin-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {submitting ? 'Processando...' : canSubmit ? 'Finalizar Venda Presencial' : `Faltam ${formatCurrency(remainingAmount)}`}
                                            </button>
                                        );
                                    })()}
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
