'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';

import { LoadingSkeleton, LoadingSpinner } from '@/components/Loading';
import { Toast, useToast } from '@/components/Toast';

interface ProductOption {
  id: string;
  name: string;
  category: string;
  sizes: string[];
  variants: { id: string; size: string }[];
}

interface ApiProduct {
  id: string;
  name: string;
  category: string;
  variants: { id: string; size: string }[];
}

export default function InterestFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolId: string; unitId: string }>;
  searchParams: Promise<{ product?: string }>;
}) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);
  const { schoolId, unitId } = resolvedParams;
  const { product: preselectedProductId } = resolvedSearchParams;

  const router = useRouter();
  const { toast, showToast } = useToast();

  // Form state
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Data fetching state
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Step 1: Customer data
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Step 2: Student data
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');

  // Step 3: Products
  const [selectedProducts, setSelectedProducts] = useState<{ [key: string]: { size: string; quantity: number } }>({});

  // Step 4: Notes
  const [notes, setNotes] = useState('');

  // Fetch products on mount
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoadingProducts(true);
        // Fetch ALL products (no inStock filter) so user can show interest in anything
        const res = await fetch(`/api/shop/catalog/${schoolId}/${unitId}`);

        if (!res.ok) throw new Error('Falha ao carregar produtos');

        const result = await res.json();

        if (result.success && result.data) {
          const mappedProducts: ProductOption[] = result.data.map((p: ApiProduct) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            sizes: p.variants?.map(v => v.size).sort(sortSizes) || [],
            variants: p.variants || []
          }));
          setProducts(mappedProducts);

          // If there is a preselected product in URL (e.g. came from product page), select it
          if (preselectedProductId) {
            const productExists = mappedProducts.find(p => p.id === preselectedProductId);
            if (productExists) {
              setSelectedProducts({ [preselectedProductId]: { size: '', quantity: 1 } });
            }
          }
        }
      } catch (err) {
        console.error(err);
        showToast({ message: 'Erro ao carregar lista de produtos', type: 'error' });
      } finally {
        setLoadingProducts(false);
      }
    }

    fetchProducts();
  }, [schoolId, unitId, preselectedProductId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to sort sizes logically
  const sortSizes = (a: string, b: string) => {
    const sizeOrder: { [key: string]: number } = {
      '2': 2, '4': 4, '6': 6, '8': 8, '10': 10, '12': 12, '14': 14, '16': 16,
      'PP': 20, 'P': 21, 'M': 22, 'G': 23, 'GG': 24, 'XG': 25, 'ÚNICO': 99
    };
    return (sizeOrder[a] || 0) - (sizeOrder[b] || 0);
  };

  const handleProductToggle = (productId: string) => {
    setSelectedProducts((prev) => {
      if (prev[productId]) {
        // Remove
        const { [productId]: _, ...rest } = prev;
        return rest;
      } else {
        // Add
        return { ...prev, [productId]: { size: '', quantity: 1 } };
      }
    });
  };

  const handleSizeChange = (productId: string, size: string) => {
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], size },
    }));
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], quantity: Math.max(1, quantity) },
    }));
  };

  const validateStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1:
        if (!customerName.trim() || !customerPhone.trim()) {
          showToast({ message: 'Preencha nome e telefone', type: 'error' });
          return false;
        }
        return true;
      case 2:
        if (!studentName.trim() || !studentClass.trim()) {
          showToast({ message: 'Preencha nome e turma do aluno', type: 'error' });
          return false;
        }
        return true;
      case 3:
        if (Object.keys(selectedProducts).length === 0) {
          showToast({ message: 'Selecione pelo menos um produto', type: 'error' });
          return false;
        }
        for (const [productId, data] of Object.entries(selectedProducts)) {
          if (!data.size) {
            const prod = products.find(p => p.id === productId);
            // If product has variants, size is mandatory
            if (prod && prod.sizes.length > 0) {
              showToast({ message: `Selecione o tamanho para: ${prod.name}`, type: 'error' });
              return false;
            }
          }
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(Math.max(1, step - 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setSubmitting(true);

    try {
      // Build items payload finding the correct variant ID for the selected size
      const itemsPayload = Object.entries(selectedProducts).map(([productId, data]) => {
        const product = products.find(p => p.id === productId);
        if (!product) throw new Error(`Produto ${productId} não encontrado`);

        // Find variant by size
        const variant = product.variants.find(v => v.size === data.size);

        // Fallback: if product has only 1 variant (e.g. UNICO) and no size selected or matched
        // This handles cases where size might be optional or auto-selected
        const targetVariantId = variant?.id || (product.variants.length === 1 ? product.variants[0].id : null);

        if (!targetVariantId) {
          throw new Error(`Variante não encontrada para o produto ${product.name} tamanho ${data.size}`);
        }

        return {
          variantId: targetVariantId,
          quantity: data.quantity
        };
      });

      const payload = {
        schoolId,
        unitId, // IMPORTANT: Backend expects camelCase in DTO validation usually? 
        // shop-interest.service.dto expects snake_case or camelCase? 
        // let's check standard DTOs. Usually NestJS DTOs match frontend JSON. 
        // Our DTOs in code seem to use camelCase properties (e.g. customerName).
        customerName,
        customerPhone: customerPhone.replace(/\D/g, ''),
        customerEmail: customerEmail || undefined,
        studentName,
        studentClass,
        notes: notes || undefined,
        items: itemsPayload
      };

      const response = await fetch(`/api/shop/interest/${schoolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Erro ao registrar interesse');
      }

      showToast({ message: 'Interesse registrado com sucesso! Entraremos em contato em breve.', type: 'success' });

      // Delay for UX
      setTimeout(() => {
        router.push(`/${schoolId}/${unitId}`);
      }, 2000);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar interesse';
      showToast({ message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-slate-800">Registrar Interesse</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors duration-200 tabular-nums ${s <= step ? 'bg-[#A3D154] text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                >
                  {s}
                </div>
                {s < 4 && <div className={`w-16 h-1 transition-colors duration-200 ${s < step ? 'bg-[#A3D154]' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Responsável</span>
            <span>Aluno</span>
            <span>Produtos</span>
            <span>Confirmar</span>
          </div>
        </div>

        {/* Step 1: Customer */}
        {step === 1 && (
          <div className="card space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-semibold text-slate-800">Dados do Responsável</h2>
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium text-slate-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="input w-full"
                placeholder="Ex: João da Silva"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="customerPhone" className="block text-sm font-medium text-slate-700 mb-2">
                Telefone *
              </label>
              <input
                type="tel"
                id="customerPhone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="input w-full"
                placeholder="(11) 98765-4321"
              />
            </div>
            <div>
              <label htmlFor="customerEmail" className="block text-sm font-medium text-slate-700 mb-2">
                E-mail (opcional)
              </label>
              <input
                type="email"
                id="customerEmail"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="input w-full"
                placeholder="email@exemplo.com"
              />
            </div>
            <button onClick={handleNext} className="btn-primary w-full">
              Próximo →
            </button>
          </div>
        )}

        {/* Step 2: Student */}
        {step === 2 && (
          <div className="card space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-semibold text-slate-800">Dados do Aluno</h2>
            <div>
              <label htmlFor="studentName" className="block text-sm font-medium text-slate-700 mb-2">
                Nome do Aluno *
              </label>
              <input
                type="text"
                id="studentName"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="input w-full"
                placeholder="Ex: Maria Silva"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="studentClass" className="block text-sm font-medium text-slate-700 mb-2">
                Turma *
              </label>
              <input
                type="text"
                id="studentClass"
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                className="input w-full"
                placeholder="Ex: Infantil 3A"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleBack} className="btn-outline flex-1">
                ← Voltar
              </button>
              <button onClick={handleNext} className="btn-primary flex-1">
                Próximo →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Products */}
        {step === 3 && (
          <div className="card space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-semibold text-slate-800">Produtos de Interesse</h2>
            <p className="text-sm text-slate-600">Selecione os produtos, tamanhos e quantidades desejadas.</p>

            {loadingProducts ? (
              <LoadingSkeleton />
            ) : products.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Nenhum produto disponível para esta unidade.
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product) => {
                  const isSelected = !!selectedProducts[product.id];
                  return (
                    <div key={product.id} className={`border rounded-lg p-4 transition-colors duration-150 ${isSelected ? 'border-[#A3D154] bg-[#A3D154]/5' : 'border-slate-200'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          type="checkbox"
                          id={`product-${product.id}`}
                          checked={isSelected}
                          onChange={() => handleProductToggle(product.id)}
                          className="w-5 h-5 accent-[#A3D154] rounded"
                        />
                        <label htmlFor={`product-${product.id}`} className="font-medium text-slate-800 flex-1 cursor-pointer select-none">
                          {product.name}
                        </label>
                      </div>
                      {isSelected && (
                        <div className="ml-8 space-y-3 animate-in fade-in slide-in-from-top-2">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Tamanho *</label>
                            {product.sizes.length > 0 ? (
                              <select
                                value={selectedProducts[product.id]?.size || ''}
                                onChange={(e) => handleSizeChange(product.id, e.target.value)}
                                className="input w-full"
                              >
                                <option value="">Selecione...</option>
                                {product.sizes.map((size) => (
                                  <option key={size} value={size}>
                                    {size}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-sm text-red-500">Produto indisponível (sem variantes cadastradas)</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Quantidade</label>
                            <input
                              type="number"
                              min="1"
                              value={selectedProducts[product.id]?.quantity || 1}
                              onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value) || 1)}
                              className="input w-24"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button onClick={handleBack} className="btn-outline flex-1">
                ← Voltar
              </button>
              <button onClick={handleNext} className="btn-primary flex-1">
                Próximo →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="card space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-semibold text-slate-800">Confirmar e Enviar</h2>

            {/* Summary */}
            <div className="space-y-4 divide-y divider-gray-100">
              <div className="pt-2">
                <h3 className="font-medium text-slate-700 mb-2">Responsável</h3>
                <p className="text-slate-800 font-medium">
                  {customerName}
                </p>
                <p className="text-slate-600 text-sm">{customerPhone} {customerEmail ? `• ${customerEmail}` : ''}</p>
              </div>

              <div className="pt-4">
                <h3 className="font-medium text-slate-700 mb-2">Aluno</h3>
                <p className="text-slate-800 text-sm">
                  <span className="font-medium">{studentName}</span> • Turma {studentClass}
                </p>
              </div>

              <div className="pt-4">
                <h3 className="font-medium text-slate-700 mb-2">Produtos Selecionados</h3>
                <ul className="space-y-2">
                  {Object.entries(selectedProducts).map(([productId, data]) => {
                    const product = products.find((p) => p.id === productId);
                    return (
                      <li key={productId} className="flex justify-between text-sm items-center bg-slate-50 p-2 rounded">
                        <span className="text-slate-800">{product?.name}</span>
                        <div className="flex gap-3 text-slate-600">
                          <span className="font-medium bg-white px-2 rounded border">Tam: {data.size}</span>
                          <span>x{data.quantity}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="pt-4">
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input w-full"
                  rows={3}
                  placeholder="Ex: Preciso com urgência para o início das aulas"
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                Ao enviar, seus dados serão registrados na secretaria da unidade. Entraremos em contato assim que os produtos selecionados estiverem disponíveis em estoque.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={handleBack} className="btn-outline flex-1" disabled={submitting}>
                ← Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" /> Enviando...
                  </>
                ) : 'Enviar Interesse'}
              </button>
            </div>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => { }} />}
    </div>
  );
}
