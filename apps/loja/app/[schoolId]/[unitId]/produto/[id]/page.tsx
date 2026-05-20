'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';

import { LoadingSpinner } from '@/components/Loading';
import { ProductDetailCarousel } from '@/components/ProductDetailCarousel';
import { Toast, useToast } from '@/components/Toast';
import {
  resolveStorefrontParams,
  type ResolvedStorefrontParams,
  type StorefrontSchoolLocation,
} from '@/lib/storefront-url';
import { useCart, MAX_QUANTITY_PER_STUDENT, type ModoVenda } from '@/lib/useCart';

interface ProductVariant {
  id: string;
  size: string;
  priceOverride: number | null; // Price in cents
  availableStock?: number;
  available_stock?: number; // Calculated on frontend
  modoVenda?: ModoVenda;
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
  const { addItem, getTotalItems, getQuantityForProductStudent } = useCart();
  const { toast, showToast } = useToast();
  const cartItemCount = getTotalItems();

  const [resolvedStorefront, setResolvedStorefront] = useState<ResolvedStorefrontParams | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [studentName, setStudentName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveStorefront() {
      try {
        setLoading(true);
        setError(null);
        setProduct(null);
        setResolvedStorefront(null);

        const response = await fetch('/api/shop/locations', { cache: 'no-store' });
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.error?.message || 'Erro ao carregar loja');
        }

        const resolvedStorefront = resolveStorefrontParams(
          result.data as StorefrontSchoolLocation[],
          schoolId,
          unitId,
        );

        if (!resolvedStorefront) {
          throw new Error('Loja não encontrada');
        }

        if (cancelled) return;

        setResolvedStorefront(resolvedStorefront);

        if (!resolvedStorefront.isCanonical) {
          router.replace(`${resolvedStorefront.canonicalPath}/produto/${id}`);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Erro ao carregar loja';
        setError(message);
        setLoading(false);
      }
    }

    resolveStorefront();

    return () => {
      cancelled = true;
    };
  }, [schoolId, unitId, id, router]);

  useEffect(() => {
    const storefront = resolvedStorefront;
    if (!storefront) return;
    const currentStorefront: ResolvedStorefrontParams = storefront;

    let cancelled = false;

    async function loadProduct() {
      const resolvedStorefront = currentStorefront;

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({ schoolId: resolvedStorefront.schoolId, unitId: resolvedStorefront.unitId });
        const response = await fetch(`/api/shop/products/${id}?${params.toString()}`);

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

        interface RawVariant {
          id: string;
          size: string;
          sku: string;
          priceOverride: number | null;
          isActive?: boolean;
          availableStock?: number;
          modoVenda?: ModoVenda;
        }

        const mappedProduct: Product = {
          ...rawProduct,
          variants: (rawProduct.variants as RawVariant[])
            .filter((v) => v.isActive !== false)
            .map((v) => ({
              ...v,
              priceOverride: v.priceOverride,
              available_stock: v.availableStock || 0,
              modoVenda:
                v.modoVenda ||
                ((v.availableStock || 0) > 0 ? 'PRONTA_ENTREGA' : 'PRE_VENDA'),
            })),
        };

        if (cancelled) return;
        setProduct(mappedProduct);
      } catch (err) {
        if (cancelled) return;
        console.warn('Erro ao carregar produto:', err);
        setError('Erro ao carregar detalhes do produto.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [id, resolvedStorefront]);

  const handleAddToCart = async () => {
    if (!resolvedStorefront) {
      showToast({ message: 'Loja não carregada', type: 'error' });
      return;
    }

    if (!selectedVariant || !studentName.trim()) {
      showToast({ message: 'Selecione o tamanho e informe o nome do aluno', type: 'error' });
      return;
    }

    const variant = product?.variants.find((v) => v.id === selectedVariant);
    const availableStock = variant?.available_stock || 0;
    const selectedModoVenda: ModoVenda =
      variant?.modoVenda || (availableStock > 0 ? 'PRONTA_ENTREGA' : 'PRE_VENDA');

    if (!variant) {
      showToast({ message: 'Tamanho não encontrado', type: 'error' });
      return;
    }

    if (selectedModoVenda !== 'PRE_VENDA' && availableStock < quantity) {
      showToast({ message: 'Estoque insuficiente', type: 'error' });
      return;
    }

    setAdding(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const result = addItem({
        schoolId: resolvedStorefront.schoolId,
        unitId: resolvedStorefront.unitId,
        variantId: variant.id,
        productId: product!.id,
        productName: product!.name,
        variantSize: variant.size,
        quantity,
        unitPrice: (variant.priceOverride ?? product!.basePrice) / 100, // Use variant price if available, else base price
        studentName: studentName.trim(),
        imageUrl: product!.imageUrl,
        availableStock: availableStock,
        modoVenda: selectedModoVenda,
      });

      if (!result.success) {
        showToast({ message: result.message || 'Erro ao adicionar ao carrinho', type: 'error' });
        return;
      }

      showToast({
        message:
          selectedModoVenda === 'PRE_VENDA'
            ? 'Reserva adicionada ao carrinho de pré-venda!'
            : 'Produto adicionado ao carrinho!',
        type: 'success',
      });
      setStudentName('');
      setQuantity(1);
      setSelectedVariant(null);
    } catch {
      showToast({ message: 'Erro ao adicionar ao carrinho', type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !product) {
    const catalogPath = resolvedStorefront?.canonicalPath ?? '/';

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-slate-700 mb-4">{error || 'Produto não encontrado'}</p>
          <Link href={catalogPath} className="btn-primary">
            Voltar ao Catálogo
          </Link>
        </div>
      </div>
    );
  }

  if (!resolvedStorefront) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const selectedVariantData = product.variants.find((v) => v.id === selectedVariant);
  const selectedModoVenda: ModoVenda =
    selectedVariantData?.modoVenda ||
    ((selectedVariantData?.available_stock || 0) > 0 ? 'PRONTA_ENTREGA' : 'PRE_VENDA');

  // Calcula quantidade máxima permitida considerando limite por aluno
  const quantityInCart = product && studentName.trim()
    ? getQuantityForProductStudent(product.id, studentName.trim())
    : 0;
  const remainingAllowed = MAX_QUANTITY_PER_STUDENT - quantityInCart;
  const maxAllowedForStudent = Math.max(0, Math.min(
    selectedModoVenda === 'PRE_VENDA'
      ? remainingAllowed
      : selectedVariantData?.available_stock || 0,
    remainingAllowed
  ));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={resolvedStorefront.canonicalPath} className="text-slate-600 hover:text-slate-800 font-medium transition-colors duration-150">
              ← Continuar Comprando
            </Link>
            <h1 className="text-xl font-semibold text-slate-800">Detalhes do Produto</h1>
          </div>
          <Link
            href="/checkout"
            className="relative inline-flex items-center gap-2 px-4 py-2 bg-[#A3D154] text-white rounded-lg hover:bg-[#8FBD3F] transition-colors duration-150 font-medium"
          >
            Carrinho
            {cartItemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#FB923C] text-white text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center tabular-nums">
                {cartItemCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="md:flex">
            {/* Imagem com Carrossel */}
            <div className="md:w-1/2 bg-slate-50 flex items-center justify-center p-8">
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
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">{product.name}</h2>
                <p className="text-slate-600">{product.description}</p>
              </div>

              {/* Seletor de Tamanho */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tamanho *</label>
                <div className="grid grid-cols-4 gap-2">
                  {product.variants.map((variant) => {
                    const isSelected = selectedVariant === variant.id;
                    const isOutOfStock = variant.available_stock === 0;
                    const isPreSale = variant.modoVenda === 'PRE_VENDA' || isOutOfStock;
                    return (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant.id)}
                        className={`py-2 px-4 rounded-lg border-2 font-medium transition-colors duration-150 ${isPreSale
                          ? isSelected
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400'
                          : isSelected
                            ? 'bg-[#A3D154] text-white border-[#A3D154]'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-[#A3D154]'
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
                <p className="text-sm text-slate-600">
                  {selectedModoVenda === 'PRE_VENDA' ? (
                    <span className="font-semibold text-amber-700">
                      Pré-venda: reserve agora e pague na retirada.
                    </span>
                  ) : (
                    <>
                      Estoque disponível:{' '}
                      <span className="font-semibold tabular-nums">
                        {selectedVariantData?.available_stock || 0} unidades
                      </span>
                    </>
                  )}
                </p>
              )}

              {/* Valor */}
              {selectedVariant && (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-display font-bold text-slate-900 tabular-nums">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      ((selectedVariantData?.priceOverride ?? product.basePrice) / 100),
                    )}
                  </span>
                </div>
              )}

              {/* Nome do Aluno */}
              <div>
                <label htmlFor="studentName" className="block text-sm font-medium text-slate-700 mb-2">
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

              {/* Quantidade */}
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-2">
                  Quantidade
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1 || maxAllowedForStudent === 0}
                    className="w-10 h-10 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors duration-150"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    id="quantity"
                    value={quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = parseInt(e.target.value) || 1;
                      setQuantity(Math.max(1, Math.min(val, maxAllowedForStudent || 1)));
                    }}
                    className="input w-20 text-center"
                    min="1"
                    max={maxAllowedForStudent}
                    disabled={maxAllowedForStudent === 0}
                  />
                  <button
                    onClick={() => {
                      setQuantity(Math.min(quantity + 1, maxAllowedForStudent || 1));
                    }}
                    disabled={
                      !selectedVariant ||
                      quantity >= maxAllowedForStudent
                    }
                    className="w-10 h-10 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors duration-150"
                  >
                    +
                  </button>
                </div>

                {/* Aviso de limite por aluno */}
                {studentName.trim() && selectedVariant && quantityInCart > 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    Este aluno já possui {quantityInCart} unidade(s) deste produto no carrinho.
                    {remainingAllowed > 0
                      ? ` Pode adicionar mais ${remainingAllowed}.`
                      : ' Limite atingido.'}
                  </p>
                )}

                {/* Aviso informativo sobre limite */}
                <p className="text-xs text-slate-400 mt-2">
                  Máximo de {MAX_QUANTITY_PER_STUDENT} unidades por produto por aluno
                </p>
              </div>

              {/* Botões */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={handleAddToCart}
                  disabled={adding || !selectedVariant || maxAllowedForStudent === 0}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? (
                    <LoadingSpinner size="sm" />
                  ) : selectedModoVenda === 'PRE_VENDA' ? (
                    'Reservar em Pré-venda'
                  ) : (
                    'Adicionar ao Carrinho'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => { }} />}
    </div>
  );
}
