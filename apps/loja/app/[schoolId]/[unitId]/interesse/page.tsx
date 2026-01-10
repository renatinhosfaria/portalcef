'use client';

import { useRouter } from 'next/navigation';
import { use, useState } from 'react';

import { LoadingSpinner } from '@/components/Loading';
import { Toast, useToast } from '@/components/Toast';

interface ProductOption {
  id: string;
  name: string;
  category: string;
  sizes: string[];
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
  const { product: _preselectedProduct } = resolvedSearchParams;

  const router = useRouter();
  const { toast, showToast } = useToast();

  // Form state
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

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

  // Mock products (TODO: fetch from API)
  const products: ProductOption[] = [
    { id: '1', name: 'Camiseta Uniforme Diário', category: 'UNIFORME_DIARIO', sizes: ['2', '4', '6', '8', '10', '12', '14', '16'] },
    { id: '2', name: 'Calça Uniforme Diário', category: 'UNIFORME_DIARIO', sizes: ['2', '4', '6', '8', '10', '12', '14', '16'] },
    { id: '3', name: 'Camiseta Educação Física', category: 'EDUCACAO_FISICA', sizes: ['2', '4', '6', '8', '10', '12', '14', '16'] },
    { id: '4', name: 'Short Educação Física', category: 'EDUCACAO_FISICA', sizes: ['2', '4', '6', '8', '10', '12', '14', '16'] },
  ];

  const handleProductToggle = (productId: string) => {
    setSelectedProducts((prev) => {
      if (prev[productId]) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      } else {
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
        for (const [_productId, data] of Object.entries(selectedProducts)) {
          if (!data.size) {
            showToast({ message: 'Selecione o tamanho para todos os produtos', type: 'error' });
            return false;
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
      // TODO: Chamar API POST /shop/interest
      // const response = await fetch(`/api/shop/interest`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     school_id: schoolId,
      //     unit_id: unitId,
      //     customer_name: customerName,
      //     customer_phone: customerPhone,
      //     customer_email: customerEmail || null,
      //     student_name: studentName,
      //     student_class: studentClass,
      //     notes: notes || null,
      //     items: Object.entries(selectedProducts).map(([productId, data]) => ({
      //       variant_id: `variant-${productId}-${data.size}`, // Mock
      //       quantity: data.quantity
      //     }))
      //   })
      // });

      // if (!response.ok) throw new Error('Erro ao registrar interesse');

      // Mock: Simular envio
      await new Promise((resolve) => setTimeout(resolve, 1000));

      showToast({ message: 'Interesse registrado com sucesso! Entraremos em contato em breve.', type: 'success' });
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-800">📋 Registrar Interesse</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    s <= step ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {s}
                </div>
                {s < 4 && <div className={`w-16 h-1 ${s < step ? 'bg-blue-600' : 'bg-gray-300'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Responsável</span>
            <span>Aluno</span>
            <span>Produtos</span>
            <span>Confirmar</span>
          </div>
        </div>

        {/* Step 1: Customer */}
        {step === 1 && (
          <div className="card space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Dados do Responsável</h2>
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                id="customerName"
                value={customerName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerName(e.target.value)}
                className="input w-full"
                placeholder="Ex: João da Silva"
              />
            </div>
            <div>
              <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-2">
                Telefone *
              </label>
              <input
                type="tel"
                id="customerPhone"
                value={customerPhone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerPhone(e.target.value)}
                className="input w-full"
                placeholder="(11) 98765-4321"
              />
            </div>
            <div>
              <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-2">
                E-mail (opcional)
              </label>
              <input
                type="email"
                id="customerEmail"
                value={customerEmail}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerEmail(e.target.value)}
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
          <div className="card space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Dados do Aluno</h2>
            <div>
              <label htmlFor="studentName" className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Aluno *
              </label>
              <input
                type="text"
                id="studentName"
                value={studentName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentName(e.target.value)}
                className="input w-full"
                placeholder="Ex: Maria Silva"
              />
            </div>
            <div>
              <label htmlFor="studentClass" className="block text-sm font-medium text-gray-700 mb-2">
                Turma *
              </label>
              <input
                type="text"
                id="studentClass"
                value={studentClass}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentClass(e.target.value)}
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
          <div className="card space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Produtos de Interesse</h2>
            <p className="text-sm text-gray-600">Selecione os produtos, tamanhos e quantidades desejadas.</p>
            <div className="space-y-4">
              {products.map((product) => {
                const isSelected = !!selectedProducts[product.id];
                return (
                  <div key={product.id} className="border border-gray-300 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="checkbox"
                        id={`product-${product.id}`}
                        checked={isSelected}
                        onChange={() => handleProductToggle(product.id)}
                        className="w-5 h-5"
                      />
                      <label htmlFor={`product-${product.id}`} className="font-medium text-gray-800 flex-1 cursor-pointer">
                        {product.name}
                      </label>
                    </div>
                    {isSelected && (
                      <div className="ml-8 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tamanho *</label>
                          <select
                            value={selectedProducts[product.id]?.size || ''}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSizeChange(product.id, e.target.value)}
                            className="input w-full"
                          >
                            <option value="">Selecione...</option>
                            {product.sizes.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade</label>
                          <input
                            type="number"
                            min="1"
                            value={selectedProducts[product.id]?.quantity || 1}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuantityChange(product.id, parseInt(e.target.value) || 1)}
                            className="input w-24"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="card space-y-6">
            <h2 className="text-lg font-bold text-gray-800">Confirmar e Enviar</h2>

            {/* Summary */}
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Responsável</h3>
                <p className="text-gray-800">
                  {customerName} - {customerPhone}
                </p>
                {customerEmail && <p className="text-gray-600 text-sm">{customerEmail}</p>}
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-2">Aluno</h3>
                <p className="text-gray-800">
                  {studentName} - Turma: {studentClass}
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-2">Produtos Selecionados</h3>
                <ul className="space-y-2">
                  {Object.entries(selectedProducts).map(([productId, data]) => {
                    const product = products.find((p) => p.id === productId);
                    return (
                      <li key={productId} className="text-gray-800">
                        {product?.name} - Tamanho {data.size} - Quantidade: {data.quantity}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                  className="input w-full"
                  rows={4}
                  placeholder="Ex: Preciso com urgência para o início das aulas"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ℹ️ Entraremos em contato assim que os produtos estiverem disponíveis em estoque.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={handleBack} className="btn-outline flex-1" disabled={submitting}>
                ← Voltar
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1">
                {submitting ? <LoadingSpinner size="sm" /> : '✅ Enviar Interesse'}
              </button>
            </div>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => {}} />}
    </div>
  );
}
