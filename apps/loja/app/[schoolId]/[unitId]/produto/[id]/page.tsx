'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';

import { LoadingSpinner } from '@/components/Loading';
import { ProductDetailCarousel } from '@/components/ProductDetailCarousel';
import { Toast, useToast } from '@/components/Toast';
import { useCart } from '@/lib/useCart';

interface ProductVariant {
  id: string;
  size: string;
  // inventory is returned by backend, we calculate available_stock from it
  inventory?: { quantity: number; reservedQuantity: number }[];
  available_stock?: number; // Calculated on frontend
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string; // CamelCase from backend
  basePrice: number; // From backend (cents)
  images?: string[]; // Array of image URLs (optional fallback to imageUrl)
  variants: ProductVariant[];
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string; unitId: string; id: string }>;
}) {
  const resolvedParams = use(params);
  const { schoolId, unitId, id } = resolvedParams;
  const router = useRouter();
  const { addItem, getTotalItems } = useCart();
  const { toast, showToast } = useToast();
  const cartItemCount = getTotalItems();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [studentName, setStudentName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/shop/products/${id}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Produto não encontrado. Aguarde o cadastro de produtos.');
          } else {
            setError('Erro ao carregar produto.');
          }
          return;
        }

        const result = await response.json();

        // Map backend response to match Component expectations
        const rawProduct = result.data;

        interface RawInventory {
          unitId: string;
          available: number;
          total: number;
          reserved: number;
        }

        interface RawVariant {
          id: string;
          size: string;
          sku: string;
          priceOverride: number | null;
          inventory: RawInventory[];
        }

        const mappedProduct: Product = {
          ...rawProduct,
          variants: (rawProduct.variants as RawVariant[]).map((v) => {
            // Calculate stock from inventory for current unit
            const inventoryStock = v.inventory?.reduce((sum: number, inv: RawInventory) => {
              // Only count stock for the current unit
              if (inv.unitId === unitId) {
                return sum + inv.available;
              }
              return sum;
            }, 0) || 0;

            return {
              ...v,
              available_stock: inventoryStock
            };
          })
        };

        setProduct(mappedProduct);
      } catch (err) {
        console.warn('Erro ao carregar produto:', err);
        setError('Erro ao carregar detalhes do produto.');
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [id, unitId]);

  const handleAddToCart = async () => {
    if (!selectedVariant || !studentName.trim()) {
      showToast({ message: 'Selecione o tamanho e informe o nome do aluno', type: 'error' });
      return;
    }

    const variant = product?.variants.find((v) => v.id === selectedVariant);
    const availableStock = variant?.available_stock || 0;

    if (!variant || availableStock < quantity) {
      showToast({ message: 'Estoque insuficiente', type: 'error' });
      return;
    }

    setAdding(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      addItem({
        variantId: variant.id,
        productId: product!.id,
        productName: product!.name,
        variantSize: variant.size,
        quantity,
        unitPrice: product!.basePrice / 100, // Use real price from backend (cents -> float)
        studentName: studentName.trim(),
        imageUrl: product!.imageUrl,
        availableStock: availableStock,
      });

      showToast({ message: 'Produto adicionado ao carrinho!', type: 'success' });
      setStudentName('');
      setQuantity(1);
      setSelectedVariant(null);
    } catch {
      showToast({ message: 'Erro ao adicionar ao carrinho', type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleInterest = () => {
    router.push(`/${schoolId}/${unitId}/interesse?product=${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-xl text-red-600 mb-4">❌</p>
          <p className="text-gray-700 mb-4">{error || 'Produto não encontrado'}</p>
          <Link href={`/${schoolId}/${unitId}`} className="btn-primary">
            Voltar ao Catálogo
          </Link>
        </div>
      </div>
    );
  }

  const allOutOfStock = product.variants.every((v) => v.available_stock === 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/${schoolId}/${unitId}`} className="text-blue-600 hover:text-blue-800 font-medium">
              ← Continuar Comprando
            </Link>
            <h1 className="text-xl font-bold text-gray-800">Detalhes do Produto</h1>
          </div>
          <Link
            href="/checkout"
            className="relative inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            🛒 Carrinho
            {cartItemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="md:flex">
            {/* Imagem com Carrossel */}
            <div className="md:w-1/2 bg-gray-100 flex items-center justify-center p-8">
              <div className="relative w-full max-w-sm">
                <ProductDetailCarousel
                  images={product.images || []}
                  fallbackImage={product.imageUrl}
                  productName={product.name}
                />
              </div>
            </div>

            {/* Informações */}
            <div className="md:w-1/2 p-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{product.name}</h2>
                <p className="text-gray-600">{product.description}</p>
              </div>

              {/* Seletor de Tamanho */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tamanho *</label>
                <div className="grid grid-cols-4 gap-2">
                  {product.variants.map((variant) => {
                    const isSelected = selectedVariant === variant.id;
                    const isOutOfStock = variant.available_stock === 0;
                    return (
                      <button
                        key={variant.id}
                        onClick={() => !isOutOfStock && setSelectedVariant(variant.id)}
                        disabled={isOutOfStock}
                        className={`py-2 px-4 rounded-lg border-2 font-medium transition ${isOutOfStock
                          ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                          : isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600'
                          }`}
                      >
                        {variant.size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Estoque */}
              {selectedVariant && (
                <p className="text-sm text-gray-600">
                  Estoque disponível:{' '}
                  <span className="font-semibold">
                    {product.variants.find((v) => v.id === selectedVariant)?.available_stock || 0} unidades
                  </span>
                </p>
              )}

              {/* Nome do Aluno */}
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
                  disabled={allOutOfStock}
                />
              </div>

              {/* Quantidade */}
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1 || allOutOfStock}
                    className="w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    id="quantity"
                    value={quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = parseInt(e.target.value) || 1;
                      const maxStock = product.variants.find((v) => v.id === selectedVariant)?.available_stock || 1;
                      setQuantity(Math.max(1, Math.min(val, maxStock)));
                    }}
                    className="input w-20 text-center"
                    min="1"
                    disabled={allOutOfStock}
                  />
                  <button
                    onClick={() => {
                      const maxStock = product.variants.find((v) => v.id === selectedVariant)?.available_stock || 1;
                      setQuantity(Math.min(quantity + 1, maxStock));
                    }}
                    disabled={
                      allOutOfStock ||
                      !selectedVariant ||
                      quantity >= (product.variants.find((v) => v.id === selectedVariant)?.available_stock || 0)
                    }
                    className="w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Botões */}
              <div className="space-y-3 pt-4">
                {!allOutOfStock ? (
                  <button onClick={handleAddToCart} disabled={adding} className="btn-primary w-full">
                    {adding ? <LoadingSpinner size="sm" /> : '🛒 Adicionar ao Carrinho'}
                  </button>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <p className="text-yellow-800 font-medium mb-3">⚠️ Produto sem estoque em todos os tamanhos</p>
                    <button onClick={handleInterest} className="btn-primary w-full">
                      📋 Registrar Interesse
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => { }} />}
    </div>
  );
}
