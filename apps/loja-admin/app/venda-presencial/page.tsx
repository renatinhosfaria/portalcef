'use client';

import { Plus, Trash2, ShoppingCart, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface CartItem {
    variantId: string;
    productName: string;
    variantSize: string;
    studentName: string;
    quantity: number;
    unitPrice: number;
}

const MOCK_PRODUCTS = [
    { id: 'p1', name: 'Camiseta Uniforme Diário', basePrice: 4500, variants: ['2', '4', '6', '8', '10', '12', '14', '16'] },
    { id: 'p2', name: 'Calça Uniforme Diário', basePrice: 5500, variants: ['2', '4', '6', '8', '10', '12', '14', '16'] },
    { id: 'p3', name: 'Camiseta Ed. Física', basePrice: 3500, variants: ['2', '4', '6', '8', '10', '12', '14', '16'] },
    { id: 'p4', name: 'Short Ed. Física', basePrice: 2500, variants: ['2', '4', '6', '8', '10', '12', '14', '16'] },
    { id: 'p5', name: 'Meia Escolar', basePrice: 1000, variants: ['P', 'M', 'G'] },
];

export default function VendaPresencialPage() {
    const [items, setItems] = useState<CartItem[]>([]);
    const [studentName, setStudentName] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [selectedSize, setSelectedSize] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const activeProduct = MOCK_PRODUCTS.find(p => p.id === selectedProduct);
    const totalAmount = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    const addItem = () => {
        if (!selectedProduct || !selectedSize || !studentName || quantity < 1) {
            alert('Preencha todos os campos do item');
            return;
        }

        const product = MOCK_PRODUCTS.find(p => p.id === selectedProduct);
        if (!product) return;

        const newItem: CartItem = {
            variantId: `${selectedProduct}-${selectedSize}`,
            productName: product.name,
            variantSize: selectedSize,
            studentName,
            quantity,
            unitPrice: product.basePrice,
        };

        setItems([...items, newItem]);
        setSelectedProduct('');
        setSelectedSize('');
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

        if (!customerName.trim() || !customerPhone.trim()) {
            alert('Preencha nome e telefone do responsável');
            return;
        }

        setSubmitting(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            setSuccess(true);
            setItems([]);
            setStudentName('');
            setCustomerName('');
            setCustomerPhone('');
            setTimeout(() => setSuccess(false), 3000);
        } catch {
            alert('Erro ao registrar venda');
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
                <p className="text-slate-500 mt-1">Registrar venda realizada no balcão</p>
            </div>

            {success && (
                <div className="flex items-center gap-3 bg-[#A3D154]/20 border border-[#A3D154] text-[#5a7a1f] px-4 py-3 rounded-xl">
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
                                    setSelectedSize('');
                                }}
                                className="form-select"
                            >
                                <option value="">Selecione um produto</option>
                                {MOCK_PRODUCTS.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.basePrice)}</option>
                                ))}
                            </select>
                        </div>

                        {activeProduct && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Tamanho *</label>
                                    <select
                                        value={selectedSize}
                                        onChange={(e) => setSelectedSize(e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="">Selecione</option>
                                        {activeProduct.variants.map(size => (
                                            <option key={size} value={size}>{size}</option>
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
                            disabled={!selectedProduct || !selectedSize || !studentName}
                            className="btn-admin btn-admin-secondary w-full"
                        >
                            <Plus className="w-4 h-4" />
                            Adicionar Item
                        </button>
                    </div>
                </div>

                {/* Cart Summary */}
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h2 className="admin-card-title flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5" />
                            Itens da Venda
                        </h2>
                    </div>
                    <div className="admin-card-body">
                        {items.length === 0 ? (
                            <div className="empty-state py-8">
                                <div className="empty-state-icon">🛒</div>
                                <div className="empty-state-title">Carrinho vazio</div>
                                <div className="empty-state-description">Adicione itens à venda</div>
                            </div>
                        ) : (
                            <div className="space-y-3 mb-6">
                                {items.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
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
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="btn-admin btn-admin-primary w-full"
                                    >
                                        {submitting ? 'Processando...' : 'Finalizar Venda'}
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
